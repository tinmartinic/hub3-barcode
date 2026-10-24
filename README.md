# hub3-barcode

Validated **HUB3 payment barcode** ("slikaj i plati", PDF417) for Croatian banking apps. TypeScript, pure JavaScript rendering (no canvas, no native modules), SVG or PNG output.

Put the barcode on an invoice or offer and the customer scans it with their bank's mobile app instead of typing IBAN, amount and reference.

## Why another HUB3 package

[`pdf417-generator`](https://www.npmjs.com/package/pdf417-generator) already does the job and is widely used. This package differs in a few specific ways:

| | `pdf417-generator` | `hub3-barcode` |
|---|---|---|
| Needs `node-canvas` (native) on Node | yes | no |
| SVG output | no (canvas) | yes |
| IBAN mod-97 check | no (format only) | yes |
| Optional payer and amount | payer required | both optional |
| Diacritics (č ć š ž đ) to ASCII | no | yes, on by default |
| Line breaks inside a field shift the layout | possible | flattened |
| TypeScript types | no | yes |
| Strict mode that rejects over-long fields | no | yes |

If you only need a browser canvas drawing, `pdf417-generator` is fine. If you want a barcode in a server-rendered PDF or email without native dependencies, and want typos caught before they reach a customer, use this.

## Install

```bash
npm install hub3-barcode
```

Node 20 or newer.

## Usage

```ts
import { writeFileSync } from 'node:fs';
import { hub3Png, hub3Svg } from 'hub3-barcode';

const invoice = {
  amount: 123.45, // EUR. Omit or use 0 to let the payer type the amount.
  payer: { name: 'Ivan Horvat', address: 'Ilica 1', city: '10000 Zagreb' }, // optional
  recipient: {
    name: 'Example d.o.o.',
    address: 'Ulica 2',
    city: '21000 Split',
    iban: 'HR06 1234 5670 1234 5678 9', // fictitious example IBAN
  },
  model: 'HR01',
  reference: '2026-0001',
  purposeCode: 'COST',
  description: 'Invoice 2026-0001',
};

writeFileSync('pay.png', await hub3Png(invoice));
writeFileSync('pay.svg', hub3Svg(invoice));
```

Embed in HTML or a PDF renderer with `await hub3DataUrl(invoice)`.

Need only the text, to render with another library? `buildHub3Payload(invoice)` returns the string that goes inside the barcode.

### Functions

| Function | Returns |
|---|---|
| `buildHub3Payload(input, options?)` | The HUB3 text (14 fields, each ended by a line feed) |
| `hub3Png(input, options?)` | `Promise<Buffer>` PNG |
| `hub3Svg(input, options?)` | SVG string |
| `hub3DataUrl(input, options?)` | `Promise<string>` data URL |
| `isValidIban(iban)` `isValidCroatianIban(iban)` | boolean |
| `formatAmount(eur)` `toAscii(text)` | helpers, exported for reuse |

Options: `strict` (throw on over-long fields instead of cutting), `ascii` (default true), and for rendering `scale`, `eclevel`, `columns`, `padding`.

### Field limits (HUB3)

| Field | Max length |
|---|---|
| Payer name / address / city | 30 / 27 / 27 |
| Recipient name / address / city | 25 / 25 / 27 |
| IBAN | 21 |
| Model | 4 (`HR` + 2 digits) |
| Reference (poziv na broj) | 22 |
| Purpose code | 4 letters |
| Description | 35 |

## Verified and not verified

- The tests encode the payload into a PDF417 PNG and decode it again with a ZXing reader, so what is printed is exactly the payload.
- Field order, lengths and the 15-digit amount in cents follow the HUB3 layout as published in other open implementations and used in production by the author for invoices.
- **Not verified:** acceptance in every Croatian bank app. Scan a sample with the apps your customers use before you rely on it. Apps differ in how they treat non-ASCII text, which is why `ascii` defaults to true.
- Currency is fixed to EUR.

## Development

```bash
npm install
npm run typecheck
npm test
npm run build
```

## Author

Built by [Tin Martinić](https://github.com/tinmartinic) at [Neviox Digital](https://nevioxdigital.com) ([GitHub](https://github.com/Neviox-Digital-Agency), [LinkedIn](https://www.linkedin.com/in/martinictin/)).

## License

MIT
