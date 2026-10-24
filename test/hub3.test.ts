import { readBarcodes } from 'zxing-wasm/reader';
import { describe, expect, it } from 'vitest';

import {
  Hub3Error,
  buildHub3Payload,
  formatAmount,
  hub3Png,
  hub3Svg,
  isValidCroatianIban,
  isValidIban,
  toAscii,
} from '../src/index.js';

// Valid but fictitious IBAN used throughout the tests (mod-97 checked below).
const IBAN = 'HR0612345670123456789';

const base = {
  amount: 123.45,
  payer: { name: 'Ivan Horvat', address: 'Ilica 1', city: '10000 Zagreb' },
  recipient: { name: 'Example d.o.o.', address: 'Ulica 2', city: '21000 Split', iban: IBAN },
  model: 'HR01',
  reference: '2026-0001',
  purposeCode: 'COST',
  description: 'Invoice 2026-0001',
};

describe('IBAN', () => {
  it('accepts well-known valid IBANs', () => {
    expect(isValidIban(IBAN)).toBe(true);
    expect(isValidIban('DE89 3704 0044 0532 0130 00')).toBe(true);
    expect(isValidIban('gb82west12345698765432')).toBe(true);
  });

  it('rejects a single wrong digit and malformed input', () => {
    expect(isValidIban('HR0612345670123456780')).toBe(false);
    expect(isValidIban('')).toBe(false);
    expect(isValidIban('12345')).toBe(false);
  });

  it('requires 21 characters for a Croatian IBAN', () => {
    expect(isValidCroatianIban(IBAN)).toBe(true);
    expect(isValidCroatianIban(`${IBAN}0`)).toBe(false);
    expect(isValidCroatianIban('DE89370400440532013000')).toBe(false);
  });
});

describe('formatAmount', () => {
  it('pads euro cents to 15 digits with no separator', () => {
    expect(formatAmount(123.45)).toBe('000000000012345');
    expect(formatAmount(0)).toBe('000000000000000');
  });

  it('avoids floating point drift', () => {
    expect(formatAmount(0.1 + 0.2)).toBe('000000000000030');
    expect(formatAmount(1.005 * 100)).toBe('000000000010050');
  });

  it('rejects negative, NaN and oversized amounts', () => {
    expect(() => formatAmount(-1)).toThrow(Hub3Error);
    expect(() => formatAmount(Number.NaN)).toThrow(Hub3Error);
    expect(() => formatAmount(1e14)).toThrow(Hub3Error);
  });
});

describe('buildHub3Payload', () => {
  it('produces the 14 HUB3 lines in order, each ended by a line feed', () => {
    const lines = buildHub3Payload(base).split('\n');
    expect(lines.pop()).toBe('');
    expect(lines).toEqual([
      'HRVHUB30',
      'EUR',
      '000000000012345',
      'Ivan Horvat',
      'Ilica 1',
      '10000 Zagreb',
      'Example d.o.o.',
      'Ulica 2',
      '21000 Split',
      IBAN,
      'HR01',
      '2026-0001',
      'COST',
      'Invoice 2026-0001',
    ]);
  });

  it('works without payer and amount (payer fills both in the app)', () => {
    const lines = buildHub3Payload({ recipient: base.recipient }).split('\n');
    expect(lines[2]).toBe('000000000000000');
    expect(lines.slice(3, 6)).toEqual(['', '', '']);
    expect(lines[10]).toBe('HR99');
    expect(lines[12]).toBe('OTHR');
  });

  it('transliterates diacritics by default and keeps them when ascii is false', () => {
    const input = { ...base, payer: { name: 'Đurđica Čačić', city: '21000 Šibenik' } };
    expect(buildHub3Payload(input).split('\n')[3]).toBe('Djurdjica Cacic');
    expect(buildHub3Payload(input, { ascii: false }).split('\n')[3]).toBe('Đurđica Čačić');
  });

  it('cuts over-long fields at the HUB3 limit, or throws in strict mode', () => {
    const long = { ...base, description: 'x'.repeat(50), recipient: { ...base.recipient, name: 'N'.repeat(40) } };
    const lines = buildHub3Payload(long).split('\n');
    expect(lines[6]).toHaveLength(25);
    expect(lines[13]).toHaveLength(35);
    expect(() => buildHub3Payload(long, { strict: true })).toThrow(/allows 25/);
  });

  it('flattens line breaks so a field can never shift the layout', () => {
    const lines = buildHub3Payload({ ...base, description: 'a\nb\r\nc' }).split('\n');
    expect(lines).toHaveLength(15);
    expect(lines[13]).toBe('a b c');
  });

  it('rejects an invalid IBAN, model, purpose code and missing recipient name', () => {
    expect(() => buildHub3Payload({ ...base, recipient: { ...base.recipient, iban: 'HR0612345670123456780' } })).toThrow(
      /IBAN/,
    );
    expect(() => buildHub3Payload({ ...base, model: 'XX99' })).toThrow(/Model/);
    expect(() => buildHub3Payload({ ...base, purposeCode: 'cost' })).toThrow(/Purpose/);
    expect(() => buildHub3Payload({ ...base, recipient: { ...base.recipient, name: ' ' } })).toThrow(/name/);
  });

  it('accepts an IBAN written with spaces and lowercase', () => {
    const spaced = { ...base, recipient: { ...base.recipient, iban: 'hr06 1234 5670 1234 5678 9' } };
    expect(buildHub3Payload(spaced).split('\n')[9]).toBe(IBAN);
  });
});

describe('rendering', () => {
  it('PNG output decodes back to exactly the payload (round trip through a real PDF417 reader)', async () => {
    const png = await hub3Png(base);
    expect([...png.subarray(0, 4)]).toEqual([0x89, 0x50, 0x4e, 0x47]);
    const results = await readBarcodes(new Blob([new Uint8Array(png)], { type: 'image/png' }), {
      formats: ['PDF417'],
      tryHarder: true,
    });
    expect(results).toHaveLength(1);
    expect(results[0]!.text.replace(/\r/g, '')).toBe(buildHub3Payload(base));
  });

  it('SVG output is an svg document', () => {
    const svg = hub3Svg(base);
    expect(svg.startsWith('<svg')).toBe(true);
  });
});

describe('toAscii', () => {
  it('handles Croatian letters', () => {
    expect(toAscii('čćšžđ ČĆŠŽĐ')).toBe('ccszdj CCSZDj');
  });
});
