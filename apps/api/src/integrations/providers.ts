export interface PaymentCallback {
  eventId: string;
  transactionId: string;
  billCode: string;
  amountPaisa: number;
  status: 'paid' | 'failed' | 'reversed';
}

export interface MfsProvider {
  readonly name: string;
  verifyCallback(rawBody: string, signature: string): boolean;
  parseCallback(rawBody: string): PaymentCallback;
}

export interface SmsMessage {
  recipient: string;
  template: string;
  variables: Record<string, string>;
}

export interface SmsProvider {
  send(message: SmsMessage): Promise<{ providerMessageId: string; accepted: boolean }>;
}

/** Production adapters belong here; credentials must be supplied by the secret manager. */
export class UnconfiguredSmsProvider implements SmsProvider {
  async send(): Promise<{ providerMessageId: string; accepted: boolean }> {
    throw new Error('SMS provider is not configured for this environment.');
  }
}

export class HttpSmsProvider implements SmsProvider {
  constructor(private readonly url: string, private readonly token: string) {}

  async send(message: SmsMessage): Promise<{ providerMessageId: string; accepted: boolean }> {
    const response = await fetch(this.url, { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${this.token}` }, body: JSON.stringify(message) });
    if (!response.ok) throw new Error(`SMS gateway returned HTTP ${response.status}.`);
    const body = await response.json() as { message_id?: string; accepted?: boolean };
    return { providerMessageId: body.message_id ?? 'unknown', accepted: body.accepted ?? true };
  }
}
