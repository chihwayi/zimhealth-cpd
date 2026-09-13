// Maps an E.164 phone number to an ISO 3166-1 alpha-2 country code using the
// number's calling code — deterministic, no external lookup, no asking the
// nurse to pick a country on WhatsApp. Covers Southern/Central Africa first;
// extend as the platform reaches new countries.
const CALLING_CODE_TO_COUNTRY: Array<[string, string]> = [
  ['+263', 'ZW'], // Zimbabwe
  ['+260', 'ZM'], // Zambia
  ['+264', 'NA'], // Namibia
  ['+27', 'ZA'], // South Africa
  ['+267', 'BW'], // Botswana
  ['+258', 'MZ'], // Mozambique
  ['+265', 'MW'], // Malawi
  ['+266', 'LS'], // Lesotho
  ['+268', 'SZ'], // Eswatini
  ['+243', 'CD'], // DR Congo
];

export function detectCountryFromPhone(phone: string): string | null {
  const normalized = phone.startsWith('+') ? phone : `+${phone.replace(/\D/g, '')}`;
  // Longest calling code first so +263 doesn't get shadowed by a shorter prefix.
  const sorted = [...CALLING_CODE_TO_COUNTRY].sort((a, b) => b[0].length - a[0].length);
  for (const [code, country] of sorted) {
    if (normalized.startsWith(code)) return country;
  }
  return null;
}
