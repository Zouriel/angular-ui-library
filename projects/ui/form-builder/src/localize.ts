/**
 * Languages of a form: resolving and writing `UiFbLocalizedText`, and each locale's direction.
 * Pure functions, shared by the builder, the renderer and the engine.
 */
import type { UiFbDir, UiFbLocale, UiFbLocalizedText, UiFormDefinition } from './schema';

export const UI_FB_DEFAULT_LOCALE = 'en';

/** Languages written right to left (by their base code). */
const RTL_LANGS = new Set(['ar', 'arc', 'ckb', 'dv', 'fa', 'he', 'ks', 'nqo', 'ps', 'sd', 'syr', 'ug', 'ur', 'yi']);

const NAMES: Record<string, string> = {
  en: 'English', dv: 'ދިވެހި', ar: 'العربية', he: 'עברית', fa: 'فارسی', ur: 'اردو', hi: 'हिन्दी', si: 'සිංහල',
  ta: 'தமிழ்', bn: 'বাংলা', fr: 'Français', de: 'Deutsch', es: 'Español', it: 'Italiano', pt: 'Português',
  ru: 'Русский', zh: '中文', ja: '日本語', ko: '한국어', tr: 'Türkçe', id: 'Bahasa Indonesia', ms: 'Bahasa Melayu',
};

/** `dv-MV` → `dv`. */
export function fbBaseLocale(code: string): string {
  return code.toLowerCase().split(/[-_]/)[0];
}

/** The direction a locale is written in when the form doesn't say. */
export function fbDefaultDir(code: string): UiFbDir {
  return RTL_LANGS.has(fbBaseLocale(code)) ? 'rtl' : 'ltr';
}

/** The language's own name (`ދިވެހި` for `dv`), or the code in capitals when it isn't known. */
export function fbLocaleName(code: string): string {
  return NAMES[code.toLowerCase()] ?? NAMES[fbBaseLocale(code)] ?? code.toUpperCase();
}

type LocaleSource = Pick<UiFormDefinition, 'defaultLocale' | 'supportedLocales'> | null | undefined;

export function fbDefaultLocale(def: LocaleSource): string {
  return def?.defaultLocale || def?.supportedLocales?.[0]?.code || UI_FB_DEFAULT_LOCALE;
}

/** The form's languages with label and direction filled in, the default one first. Never empty. */
export function fbLocales(def: LocaleSource): Required<UiFbLocale>[] {
  const first = fbDefaultLocale(def);
  const seen = new Set<string>();
  const out: Required<UiFbLocale>[] = [];
  for (const l of [{ code: first }, ...(def?.supportedLocales ?? [])] as UiFbLocale[]) {
    if (!l?.code || seen.has(l.code)) continue;
    seen.add(l.code);
    // The explicit entry for the default locale (label, dir) wins over the bare one added above.
    const full = def?.supportedLocales?.find((x) => x.code === l.code) ?? l;
    out.push({ code: full.code, label: full.label || fbLocaleName(full.code), dir: full.dir ?? fbDefaultDir(full.code) });
  }
  return out;
}

/**
 * The locale a form is shown in for a requested one: an exact match, else the same language
 * (`dv-MV` → `dv`, `en` → `en-GB`), else the form's default.
 */
export function fbResolveLocale(def: LocaleSource, requested?: string | null): string {
  const all = fbLocales(def);
  if (!requested) return all[0].code;
  const exact = all.find((l) => l.code.toLowerCase() === requested.toLowerCase());
  if (exact) return exact.code;
  const base = fbBaseLocale(requested);
  return all.find((l) => fbBaseLocale(l.code) === base)?.code ?? all[0].code;
}

export function fbLocaleDir(def: LocaleSource, locale?: string | null): UiFbDir {
  const code = fbResolveLocale(def, locale);
  return fbLocales(def).find((l) => l.code === code)?.dir ?? fbDefaultDir(code);
}

/** Whether [text] is a per-locale map rather than one string for every language. */
export function fbIsLocalized(text: UiFbLocalizedText | null | undefined): text is Record<string, string> {
  return !!text && typeof text === 'object';
}

/**
 * [text] in [locale]. A plain string is returned as is. A map falls back, in order, to the same
 * language (`dv-MV` → `dv`), [defaultLocale], then its first non-empty entry. Blank counts as missing.
 */
export function fbText(text: UiFbLocalizedText | null | undefined, locale?: string | null, defaultLocale?: string | null): string {
  if (text == null) return '';
  if (typeof text === 'string') return text;
  const has = (k?: string | null) => (k && typeof text[k] === 'string' && text[k].trim() ? text[k] : null);
  const direct = has(locale);
  if (direct != null) return direct;
  if (locale) {
    const base = fbBaseLocale(locale);
    const near = Object.keys(text).find((k) => fbBaseLocale(k) === base && has(k) != null);
    if (near) return text[near];
  }
  const fallback = has(defaultLocale ?? UI_FB_DEFAULT_LOCALE);
  if (fallback != null) return fallback;
  return Object.values(text).find((v) => typeof v === 'string' && v.trim()) ?? '';
}

/** [text] in exactly [locale], with no fallback: '' when that translation is missing. For editors and lint. */
export function fbTextIn(text: UiFbLocalizedText | null | undefined, locale: string, defaultLocale?: string | null): string {
  if (text == null) return '';
  if (typeof text === 'string') return locale === (defaultLocale ?? UI_FB_DEFAULT_LOCALE) ? text : '';
  return typeof text[locale] === 'string' ? text[locale] : '';
}

/**
 * [text] with its [locale] entry set to [value]. Stays a plain string while only the default
 * locale has text; becomes a map on the first translation; drops blank translations and goes
 * back to a plain string when only the default one is left.
 */
export function fbSetText(text: UiFbLocalizedText | null | undefined, locale: string, value: string, defaultLocale?: string | null): UiFbLocalizedText {
  const def = defaultLocale ?? UI_FB_DEFAULT_LOCALE;
  const map: Record<string, string> = typeof text === 'string' ? (text ? { [def]: text } : {}) : { ...(text ?? {}) };
  if (value.trim() || locale === def) map[locale] = value;
  else delete map[locale];
  const keys = Object.keys(map).filter((k) => k === def || map[k].trim());
  if (!keys.length) return '';
  if (keys.length === 1 && keys[0] === def) return map[def];
  return Object.fromEntries(keys.map((k) => [k, map[k]]));
}
