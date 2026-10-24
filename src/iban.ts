/** Removes spaces and uppercases, so "hr79 2402 ..." and "HR79 2402 ..." compare equal. */
export function normalizeIban(iban: string): string {
  return iban.replace(/\s+/g, '').toUpperCase();
}

/** ISO 13616 mod-97 check. Does not check country-specific length. */
export function isValidIban(iban: string): boolean {
  const s = normalizeIban(iban);
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/.test(s)) return false;
  const rearranged = s.slice(4) + s.slice(0, 4);
  let remainder = 0;
  for (const ch of rearranged) {
    const value = ch >= 'A' && ch <= 'Z' ? ch.charCodeAt(0) - 55 : Number(ch);
    remainder = (remainder * (value > 9 ? 100 : 10) + value) % 97;
  }
  return remainder === 1;
}

/** Croatian IBAN: "HR" plus 19 digits, mod-97 valid. */
export function isValidCroatianIban(iban: string): boolean {
  const s = normalizeIban(iban);
  return /^HR\d{19}$/.test(s) && isValidIban(s);
}
