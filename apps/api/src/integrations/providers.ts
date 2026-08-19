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
