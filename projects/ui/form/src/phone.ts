import { UI_PHONE_COUNTRY_ROWS } from './phone-countries';

/** A country in `ui-phone-input`'s list (generated from libphonenumber metadata, see tools/gen-phone-countries.mjs). */
export interface UiPhoneCountry {
  /** ISO 3166 alpha-2, e.g. 'MV'. */
  iso2: string;
  /** English name (CLDR). */
  name: string;
  /** Dial code without '+', e.g. '960'. */
  dial: string;
  /** National trunk prefix ('0' in the UK, '1' in the US, '' in the Maldives or Italy). */
  trunk: string;
  /** The main country for a dial code that several share (+1: US, +44: GB, +7: RU). */
  main: boolean;
  /** libphonenumber's leadingDigits: national numbers that start like this belong here (+1 268: AG). */
  leading: string;
}

/** Every country, sorted by English name. */
export const UI_PHONE_COUNTRIES: readonly UiPhoneCountry[] = UI_PHONE_COUNTRY_ROWS.map(
  ([iso2, name, dial, trunk, main, leading]) => ({ iso2, name, dial, trunk, main, leading }),
);

const byIso = new Map(UI_PHONE_COUNTRIES.map((c) => [c.iso2, c]));
const byDial = new Map<string, UiPhoneCountry[]>();
for (const c of UI_PHONE_COUNTRIES) byDial.set(c.dial, [...(byDial.get(c.dial) ?? []), c]);
const leadingRe = new Map<string, RegExp>();

/** The country for an ISO code (any case), or null. */
export function uiPhoneCountry(iso2: string | null | undefined): UiPhoneCountry | null {
  return iso2 ? byIso.get(iso2.toUpperCase()) ?? null : null;
}

/** The flag emoji for an ISO code: its two regional indicator symbols. */
export function uiPhoneFlag(iso2: string): string {
  const a = 0x1f1e6 - 'A'.charCodeAt(0);
  return String.fromCodePoint(...iso2.toUpperCase().split('').map((ch) => a + ch.charCodeAt(0)));
}

/** Digits only (drops spaces, dashes, dots, brackets, slashes and anything else). */
export function uiPhoneDigits(text: string): string {
  return text.replace(/\D/g, '');
}

/**
 * The country for international digits (after the '+'): the longest dial code (1 to 3 digits) that
 * exists, then among the countries sharing it: the one whose leading digits match the national
 * number, else `defaultCountry` if it shares the code, else the code's main country.
 */
export function uiPhoneSplit(international: string, defaultCountry?: string | null): { country: UiPhoneCountry; national: string } | null {
  const digits = uiPhoneDigits(international);
  for (let n = Math.min(3, digits.length); n >= 1; n--) {
    const list = byDial.get(digits.slice(0, n));
    if (!list) continue;
    const national = digits.slice(n);
    const fallback = uiPhoneCountry(defaultCountry);
    const matched = national
      ? list.filter((c) => c.leading && leading(c).test(national))
      : [];
    const country =
      (matched.length > 1 ? matched.find((c) => c === fallback) ?? matched.find((c) => c.main) : undefined) ??
      matched[0] ??
      (fallback && list.includes(fallback) ? fallback : undefined) ??
      list.find((c) => c.main)!;
    return { country, national };
  }
  return null;
}

function leading(c: UiPhoneCountry): RegExp {
  let re = leadingRe.get(c.iso2);
  if (!re) leadingRe.set(c.iso2, (re = new RegExp(`^(?:${c.leading})`)));
  return re;
}

/**
 * The national digits to store: punctuation dropped, then the country's trunk prefix removed. A
 * trunk that starts with '0' ('0', '06') is always removed; another ('1' in North America, '8' in
 * Russia) only when at least 10 digits follow it, since a shorter number can begin with those digits.
 */
export function uiPhoneNational(country: UiPhoneCountry, text: string): string {
  const digits = uiPhoneDigits(text);
  const t = country.trunk;
  if (t && digits.startsWith(t) && (t.startsWith('0') || digits.length - t.length >= 10)) return digits.slice(t.length);
  return digits;
}

/** '+' + dial code + national digits, or null with no digits. */
export function uiPhoneE164(country: UiPhoneCountry, nationalText: string): string | null {
  const national = uiPhoneNational(country, nationalText);
  return national ? `+${country.dial}${national}` : null;
}

/** Whether typed text is a whole international number ('+44…' or '0044…'). */
export function uiPhoneIsInternational(text: string): boolean {
  const t = text.trim();
  return t.startsWith('+') || /^00\d/.test(t.replace(/[^\d+]/g, ''));
}

/** The international digits of '+44 7700…' or '0044 7700…'. */
export function uiPhoneInternationalDigits(text: string): string {
  const t = text.trim();
  const d = uiPhoneDigits(t);
  return t.startsWith('+') ? d : d.replace(/^00/, '');
}

/** Countries matching a search: name (any word start or anywhere), ISO code, or dial code ('+44' or '44'). */
export function uiPhoneSearch(query: string, list: readonly UiPhoneCountry[] = UI_PHONE_COUNTRIES): UiPhoneCountry[] {
  const q = query.trim().toLowerCase();
  if (!q) return [...list];
  const dial = q.replace(/^\+/, '');
  const isDial = /^\d+$/.test(dial);
  return list.filter((c) =>
    isDial
      ? c.dial.startsWith(dial)
      : c.name.toLowerCase().includes(q) || c.iso2.toLowerCase() === q,
  );
}
