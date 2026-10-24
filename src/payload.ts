import { isValidCroatianIban, normalizeIban } from './iban.js';

export interface Party {
  name?: string;
  address?: string;
  city?: string;
}

export interface Hub3Input {
  /** Amount in EUR, for example `123.45`. Zero (the default) leaves the amount for the payer to type. */
  amount?: number;
  /** Payer (platitelj). Optional: the banking app lets the payer fill it in. */
  payer?: Party;
  /** Recipient (primatelj). */
  recipient: { name: string; address?: string; city?: string; iban: string };
  /** Payment model, `HR` plus two digits. Default `HR99` (no reference number). */
  model?: string;
  /** Reference number (poziv na broj), max 22 characters. */
  reference?: string;
  /** Four-letter purpose code, for example `OTHR` or `COST`. Default `OTHR`. */
  purposeCode?: string;
  /** Payment description, max 35 characters. */
  description?: string;
}

export interface Hub3Options {
  /**
   * Throw when a field is longer than the HUB3 limit instead of cutting it. Default false:
   * text is cut to the limit. Names and addresses are always cut at the limit, never rejected,
   * unless `strict` is true.
   */
  strict?: boolean;
  /**
   * Replace diacritics (č ć š ž đ and others) with ASCII before encoding. Default true.
   * Banking apps differ in how they decode non-ASCII bytes in the barcode.
   */
  ascii?: boolean;
}

export class Hub3Error extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'Hub3Error';
  }
}

const LIMITS = {
  payerName: 30,
  payerAddress: 27,
  payerCity: 27,
  recipientName: 25,
  recipientAddress: 25,
  recipientCity: 27,
  reference: 22,
  purposeCode: 4,
  description: 35,
} as const;

/** Latin text to plain ASCII. "Čakovec Đurđica" becomes "Cakovec Djurdjica". */
export function toAscii(text: string): string {
  return text
    .replace(/đ/g, 'dj')
    .replace(/Đ/g, 'Dj')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^\x20-\x7e]/g, '');
}

/** Amount in euro cents as the 15-digit zero-padded string HUB3 expects. */
export function formatAmount(eur: number): string {
  if (!Number.isFinite(eur) || eur < 0) throw new Hub3Error('Amount must be a non-negative number.');
  const cents = Math.round(eur * 100);
  const digits = String(cents);
  if (digits.length > 15) throw new Hub3Error('Amount is too large for HUB3 (15 digits of cents).');
  return digits.padStart(15, '0');
}

/**
 * Builds the text that goes inside the PDF417 barcode, in the HUB3 field order:
 * header, currency, amount, payer (name, address, city), recipient (name, address, city),
 * IBAN, model, reference, purpose code, description. Each field ends with a line feed.
 */
export function buildHub3Payload(input: Hub3Input, options: Hub3Options = {}): string {
  const { strict = false, ascii = true } = options;

  const iban = normalizeIban(input.recipient.iban);
  if (!isValidCroatianIban(iban)) {
    throw new Hub3Error('Recipient IBAN is not a valid Croatian IBAN (HR + 19 digits, mod-97).');
  }

  const model = input.model ?? 'HR99';
  if (!/^HR\d{2}$/.test(model)) throw new Hub3Error('Model must be "HR" followed by two digits, e.g. HR99.');

  const purposeCode = input.purposeCode ?? 'OTHR';
  if (!/^[A-Z]{4}$/.test(purposeCode)) throw new Hub3Error('Purpose code must be four capital letters.');

  if (!input.recipient.name?.trim()) throw new Hub3Error('Recipient name is required.');

  const field = (label: string, value: string | undefined, max: number): string => {
    const flat = (value ?? '').replace(/[\r\n]+/g, ' ');
    const clean = (ascii ? toAscii(flat) : flat).trim();
    if (clean.length > max) {
      if (strict) throw new Hub3Error(`${label} is ${clean.length} characters, HUB3 allows ${max}.`);
      return clean.slice(0, max).trimEnd();
    }
    return clean;
  };

  const payer = input.payer ?? {};
  return (
    [
      'HRVHUB30',
      'EUR',
      formatAmount(input.amount ?? 0),
      field('Payer name', payer.name, LIMITS.payerName),
      field('Payer address', payer.address, LIMITS.payerAddress),
      field('Payer city', payer.city, LIMITS.payerCity),
      field('Recipient name', input.recipient.name, LIMITS.recipientName),
      field('Recipient address', input.recipient.address, LIMITS.recipientAddress),
      field('Recipient city', input.recipient.city, LIMITS.recipientCity),
      iban,
      model,
      field('Reference', input.reference, LIMITS.reference),
      purposeCode,
      field('Description', input.description, LIMITS.description),
    ].join('\n') + '\n'
  );
}
