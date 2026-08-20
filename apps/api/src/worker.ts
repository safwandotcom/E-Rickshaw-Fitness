import amqp from 'amqplib';
import { loadConfig } from './config.js';
import { Database } from './db.js';
import { loadDotEnv } from './env.js';
import { FieldCipher } from './lib/crypto.js';
import { HttpSmsProvider, type SmsProvider } from './integrations/providers.js';

loadDotEnv();
const config = loadConfig();
const db = new Database(config);
const cipher = new FieldCipher(config.DATA_ENCRYPTION_SECRET);
const smsProvider: SmsProvider | null = config.SMS_GATEWAY_URL && config.SMS_GATEWAY_TOKEN ? new HttpSmsProvider(config.SMS_GATEWAY_URL, config.SMS_GATEWAY_TOKEN) : null;
const connection = await amqp.connect(config.RABBITMQ_URL);
const channel = await connection.createChannel();
await channel.assertExchange('erf.events', 'topic', { durable: true });

async function publishOutbox(): Promise<void> {
  const events = await db.transaction(async (transaction) => {
    const result = await transaction.query<{ id: string; type: string; aggregate_type: string; aggregate_id: string; payload: unknown }>("SELECT id, type, aggregate_type, aggregate_id, payload FROM outbox_events WHERE published_at IS NULL AND (claimed_at IS NULL OR claimed_at < now() - interval '5 minutes') ORDER BY occurred_at LIMIT 100 FOR UPDATE SKIP LOCKED");
    if (!result.rows.length) return [];
    await transaction.query('UPDATE outbox_events SET claimed_at = now(), attempts = attempts + 1 WHERE id = ANY($1::uuid[])', [result.rows.map((event) => event.id)]);
    return result.rows;
  });
  for (const event of events) {
    try {
      channel.publish('erf.events', event.type, Buffer.from(JSON.stringify(event)), { persistent: true, contentType: 'application/json', messageId: event.id });
      await db.query('UPDATE outbox_events SET published_at = now(), claimed_at = NULL WHERE id = $1', [event.id]);
    } catch (error) {
      await db.query('UPDATE outbox_events SET claimed_at = NULL WHERE id = $1', [event.id]);
      throw error;
    }
  }
}

async function expireRecords(): Promise<void> {
  await db.query("UPDATE bills SET status = 'expired' WHERE status = 'unpaid' AND expires_at <= now()");
  await db.query("UPDATE certificates SET status = 'expired' WHERE status = 'active' AND expires_at <= now()");
  await db.query("UPDATE rickshaws r SET status = 'expired', updated_at = now() WHERE r.status = 'certified' AND NOT EXISTS (SELECT 1 FROM certificates c WHERE c.rickshaw_id = r.id AND c.status = 'active' AND c.expires_at > now())");
}

async function dispatchNotificationJob(): Promise<void> {
  if (!smsProvider) return;
  const job = await db.transaction(async (transaction) => {
    const result = await transaction.query<{ id: string; type: string; recipient_encrypted: Buffer; payload: Record<string, unknown>; attempts: number }>("SELECT id, type, recipient_encrypted, payload, attempts FROM notification_jobs WHERE status = 'queued' AND available_at <= now() ORDER BY created_at LIMIT 1 FOR UPDATE SKIP LOCKED");
    if (!result.rows[0]) return null;
    await transaction.query("UPDATE notification_jobs SET status = 'sending', attempts = attempts + 1 WHERE id = $1", [result.rows[0].id]);
    return result.rows[0];
  });
  if (!job) return;
  try {
    const sent = await smsProvider.send({ recipient: cipher.decrypt(job.recipient_encrypted), template: job.type, variables: Object.fromEntries(Object.entries(job.payload).map(([key, value]) => [key, String(value)]) ) });
    await db.query("UPDATE notification_jobs SET status = 'sent', provider_message_id = $1, sent_at = now() WHERE id = $2", [sent.providerMessageId, job.id]);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'SMS delivery failed.';
    await db.query("UPDATE notification_jobs SET status = CASE WHEN attempts >= 5 THEN 'dead_letter' ELSE 'queued' END, last_error = $1, available_at = now() + interval '5 minutes' WHERE id = $2", [message, job.id]);
  }
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
  void dispatchNotificationJob().catch((error) => console.error('notification dispatch failed', error));
}, 1000);
process.once('SIGINT', async () => { clearInterval(timer); await channel.close(); await connection.close(); await db.close(); process.exit(0); });
process.once('SIGTERM', async () => { clearInterval(timer); await channel.close(); await connection.close(); await db.close(); process.exit(0); });
