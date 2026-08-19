import amqp from 'amqplib';
import { loadConfig } from './config.js';
import { Database } from './db.js';
import { loadDotEnv } from './env.js';

loadDotEnv();
const config = loadConfig();
const db = new Database(config);
const connection = await amqp.connect(config.RABBITMQ_URL);
const channel = await connection.createChannel();
await channel.assertExchange('erf.events', 'topic', { durable: true });

async function publishOutbox(): Promise<void> {
  const events = await db.query<{ id: string; type: string; aggregate_type: string; aggregate_id: string; payload: unknown }>('SELECT id, type, aggregate_type, aggregate_id, payload FROM outbox_events WHERE published_at IS NULL ORDER BY occurred_at LIMIT 100 FOR UPDATE SKIP LOCKED');
  for (const event of events.rows) {
    channel.publish('erf.events', event.type, Buffer.from(JSON.stringify(event)), { persistent: true, contentType: 'application/json', messageId: event.id });
    await db.query('UPDATE outbox_events SET published_at = now(), attempts = attempts + 1 WHERE id = $1', [event.id]);
  }
}

async function expireRecords(): Promise<void> {
  await db.query("UPDATE bills SET status = 'expired' WHERE status = 'unpaid' AND expires_at <= now()");
  await db.query("UPDATE certificates SET status = 'expired' WHERE status = 'active' AND expires_at <= now()");
  await db.query("UPDATE rickshaws r SET status = 'expired', updated_at = now() WHERE r.status = 'certified' AND NOT EXISTS (SELECT 1 FROM certificates c WHERE c.rickshaw_id = r.id AND c.status = 'active' AND c.expires_at > now())");
}

await channel.assertQueue('erf.notifications', { durable: true, deadLetterExchange: 'erf.dlx' });
await channel.bindQueue('erf.notifications', 'erf.events', 'payment.instructions.requested');
await channel.bindQueue('erf.notifications', 'erf.events', 'certificate.issued');
channel.consume('erf.notifications', async (message) => {
  if (!message) return;
  try {
    // Replace with approved Telco SMS adapter. The worker deliberately stores no phone number in broker payloads.
    console.info('notification event accepted', message.fields.routingKey, message.properties.messageId);
    channel.ack(message);
  } catch (error) {
    console.error('notification event failed', error);
    channel.nack(message, false, false);
  }
});

const timer = setInterval(() => {
  void publishOutbox().catch((error) => console.error('outbox publish failed', error));
  void expireRecords().catch((error) => console.error('expiry sweep failed', error));
}, 1000);
process.once('SIGINT', async () => { clearInterval(timer); await channel.close(); await connection.close(); await db.close(); process.exit(0); });
process.once('SIGTERM', async () => { clearInterval(timer); await channel.close(); await connection.close(); await db.close(); process.exit(0); });
