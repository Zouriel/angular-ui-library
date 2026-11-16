import { InjectionToken, type Provider } from '@angular/core';
import { addDays, isEmptyValue, isoDate } from './conditions';
import { fieldTypeInfo, valueKindOf, type UiFbValueKind } from './field-types';
import type { UiFbField, UiFbFieldType, UiFbFileValue } from './schema';
import { fbFormat, UI_FB_STRINGS_EN, type UiFbStrings } from './form-strings';

/** `true`/`null`/`undefined` pass; `false` fails with the rule's message; a string fails with that text. */
export type UiFbValidatorResult = boolean | string | null | undefined;

export interface UiFbValidatorContext {
  field: UiFbField;
  /** Another field's current answer (same repeat entry when shared). */
  value(ref: string): unknown;
  /** Another field's label. */
  label(ref: string): string;
  today(): string;
  /** Aborted when the answer changes again before an async check finishes. */
  signal?: AbortSignal;
}

export interface UiFbParamSpec {
  key: string;
  label: string;
  kind: 'number' | 'text' | 'date' | 'field' | 'select';
  options?: { value: string; label: string }[];
  hint?: string;
  placeholder?: string;
  default?: unknown;
  /** For `field` params: which kinds of field can be picked. */
  fieldKinds?: UiFbValueKind[];
}

/**
 * A check that can be added to a field. Built-ins and app-registered checks use
 * the same shape, so registered ones appear in the builder's "Add a rule" list
 * with a settings form generated from `params`.
 */
export interface UiFbValidatorDef {
  type: string;
  label: string;
  description?: string;
  /** Which answers it applies to. Leave out to allow every field. */
  valueKinds?: UiFbValueKind[];
  /** Narrower than `valueKinds`: specific field types only. */
  fieldTypes?: UiFbFieldType[];
  params?: UiFbParamSpec[];
  /**
   * Message when the check fails; supports `{label}` (the field's label) and `{paramKey}` placeholders.
   * A string, or a map by language code (`{ en: '…', dv: '…' }`, the base language `dv` also serves `dv-MV`).
   * Leave it out for a built-in check: its wording comes from the form strings (`UiFbStrings`).
   */
  defaultMessage?: string | Record<string, string>;
  validate(value: unknown, params: Record<string, unknown>, ctx: UiFbValidatorContext): UiFbValidatorResult | Promise<UiFbValidatorResult>;
  /** Runs while typing only after this pause (async checks default to 400ms). */
  debounceMs?: number;
  /** Also run on empty answers (most checks skip them and leave that to "required"). */
  runWhenEmpty?: boolean;
}

/** App-registered checks, merged with the built-ins. See `provideUiFormValidators`. */
export const UI_FB_VALIDATORS = new InjectionToken<UiFbValidatorDef[][]>('UI_FB_VALIDATORS');

/**
 * Registers app-specific checks (e.g. "Student ID exists", which asks the
 * server). They appear in the builder's rule list and run in the renderer.
 *
 * ```ts
 * providers: [provideUiFormValidators({
 *   type: 'studentIdExists', label: 'Student ID exists', valueKinds: ['text'],
 *   defaultMessage: 'We could not find that student ID.',
 *   validate: (v) => fetch(`/api/students/${v}`).then((r) => r.ok),
 * })]
 * ```
 */
export function provideUiFormValidators(...defs: UiFbValidatorDef[]): Provider {
  return { provide: UI_FB_VALIDATORS, useValue: defs, multi: true };
}

// ── Helpers ───────────────────────────────────────────────────────────────

function n(v: unknown): number | null {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v))) return Number(v);
  return null;
}

/** `2026-01-31`, `today`, `today+30`, `today-7` → `YYYY-MM-DD`. */
export function resolveDateParam(v: unknown, today: string): string | null {
  if (typeof v !== 'string' || !v) return null;
  const m = /^today\s*([+-]\s*\d+)?$/i.exec(v.trim());
  if (m) return addDays(today, m[1] ? Number(m[1].replace(/\s/g, '')) : 0);
  return /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null;
}

/** Shows a date param the way people read it. */
export function describeDateParam(v: unknown, strings: UiFbStrings = UI_FB_STRINGS_EN): string {
  if (typeof v !== 'string') return '';
  const m = /^today\s*([+-]\s*\d+)?$/i.exec(v.trim());
  if (!m) return v;
  const d = m[1] ? Number(m[1].replace(/\s/g, '')) : 0;
  return d === 0 ? strings.dateToday : d > 0 ? fbFormat(strings.dateInDays, { n: d }) : fbFormat(strings.dateDaysAgo, { n: -d });
}

const words = (v: unknown) => String(v ?? '').trim().split(/\s+/).filter(Boolean).length;

export const UI_FB_PATTERN_PRESETS: { value: string; label: string; regex: string }[] = [
  { value: 'letters', label: 'Letters and spaces only', regex: "^[\\p{L} '\\-]+$" },
  { value: 'alphanumeric', label: 'Letters and numbers only', regex: '^[\\p{L}\\p{N}]+$' },
  { value: 'digits', label: 'Digits only', regex: '^\\d+$' },
  { value: 'noSpaces', label: 'No spaces', regex: '^\\S+$' },
  { value: 'uppercase', label: 'Capital letters only', regex: '^[\\p{Lu}\\p{N} ]+$' },
  { value: 'custom', label: 'Custom pattern (advanced)', regex: '' },
];

function patternRegex(params: Record<string, unknown>): RegExp | null {
  const preset = UI_FB_PATTERN_PRESETS.find((p) => p.value === params['preset']);
  const source = preset && preset.value !== 'custom' ? preset.regex : String(params['regex'] ?? '');
  if (!source) return null;
  try {
    return new RegExp(source, 'u');
  } catch {
    return null;
  }
}

function age(dob: string, today: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}/.test(dob)) return null;
  const [y, m, d] = dob.split('-').map(Number);
  const [ty, tm, td] = today.split('-').map(Number);
  let a = ty - y;
  if (tm < m || (tm === m && td < d)) a--;
  return a;
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const URL_RE = /^(https?:\/\/)?([\w-]+\.)+[\w-]{2,}(\/\S*)?$/i;
const PHONE = /^\+?[\d\s().-]{6,20}$/;

const COMPARISONS = [
  { value: 'eq', label: 'the same as' },
  { value: 'gt', label: 'more than / after' },
  { value: 'gte', label: 'at least / on or after' },
  { value: 'lt', label: 'less than / before' },
  { value: 'lte', label: 'at most / on or before' },
];

// ── Built-ins ─────────────────────────────────────────────────────────────

export const UI_FB_BUILTIN_VALIDATORS: readonly UiFbValidatorDef[] = [
  {
    type: 'email', label: 'Valid email', description: 'Looks like name@example.com', fieldTypes: ['email', 'text'],
    validate: (v) => EMAIL.test(String(v).trim()),
  },
  {
    type: 'url', label: 'Valid web address', description: 'Looks like example.com', fieldTypes: ['url', 'text'],
    validate: (v) => URL_RE.test(String(v).trim()),
  },
  {
    type: 'phone', label: 'Valid phone number', description: 'Digits, spaces, + and brackets', fieldTypes: ['phone', 'text'],
    validate: (v) => PHONE.test(String(v).trim()) && (String(v).match(/\d/g)?.length ?? 0) >= 6,
  },
  {
    type: 'minLength', label: 'Minimum length', valueKinds: ['text'],
    params: [{ key: 'min', label: 'At least', kind: 'number', placeholder: 'characters' }],
    validate: (v, p) => String(v).length >= (n(p['min']) ?? 0),
  },
  {
    type: 'maxLength', label: 'Maximum length', valueKinds: ['text'],
    params: [{ key: 'max', label: 'At most', kind: 'number', placeholder: 'characters' }],
    validate: (v, p) => String(v).length <= (n(p['max']) ?? Infinity),
  },
  {
    type: 'minWords', label: 'Minimum words', fieldTypes: ['textarea', 'text'],
    params: [{ key: 'min', label: 'At least', kind: 'number', placeholder: 'words' }],
    validate: (v, p) => words(v) >= (n(p['min']) ?? 0),
  },
  {
    type: 'maxWords', label: 'Maximum words', fieldTypes: ['textarea', 'text'],
    params: [{ key: 'max', label: 'At most', kind: 'number', placeholder: 'words' }],
    validate: (v, p) => words(v) <= (n(p['max']) ?? Infinity),
  },
  {
    type: 'pattern', label: 'Allowed characters', description: 'Only accept certain kinds of characters', valueKinds: ['text'],
    params: [
      { key: 'preset', label: 'Allow', kind: 'select', options: UI_FB_PATTERN_PRESETS.map(({ value, label }) => ({ value, label })), default: 'letters' },
      { key: 'regex', label: 'Pattern', kind: 'text', hint: 'A regular expression. Only used with “Custom pattern”.', placeholder: '^[A-Z]{2}\\d{6}$' },
    ],
    validate: (v, p) => {
      const re = patternRegex(p);
      return !re || re.test(String(v));
    },
  },
  {
    type: 'min', label: 'Minimum value', valueKinds: ['number'],
    params: [{ key: 'min', label: 'At least', kind: 'number' }],
    validate: (v, p) => (n(v) ?? 0) >= (n(p['min']) ?? -Infinity),
  },
  {
    type: 'max', label: 'Maximum value', valueKinds: ['number'],
    params: [{ key: 'max', label: 'At most', kind: 'number' }],
    validate: (v, p) => (n(v) ?? 0) <= (n(p['max']) ?? Infinity),
  },
  {
    type: 'integer', label: 'Whole number', valueKinds: ['number'], fieldTypes: ['number', 'calculated'],
    validate: (v) => Number.isInteger(n(v)),
  },
  {
    type: 'decimalPlaces', label: 'Decimal places', valueKinds: ['number'],
    params: [{ key: 'places', label: 'At most', kind: 'number', placeholder: 'decimal places' }],
    validate: (v, p) => {
      const s = String(n(v) ?? '');
      const dot = s.indexOf('.');
      return dot < 0 || s.length - dot - 1 <= (n(p['places']) ?? 0);
    },
  },
  {
    type: 'minDate', label: 'Earliest date', valueKinds: ['date'],
    params: [{ key: 'date', label: 'On or after', kind: 'date', hint: 'A date, or “today”, “today+7”, “today-30”.' }],
    validate: (v, p, ctx) => {
      const d = resolveDateParam(p['date'], ctx.today());
      return !d || String(v) >= d;
    },
  },
  {
    type: 'maxDate', label: 'Latest date', valueKinds: ['date'],
    params: [{ key: 'date', label: 'On or before', kind: 'date', hint: 'A date, or “today”, “today+7”, “today-30”.' }],
    validate: (v, p, ctx) => {
      const d = resolveDateParam(p['date'], ctx.today());
      return !d || String(v) <= d;
    },
  },
  {
    type: 'ageAtLeast', label: 'Minimum age', description: 'For a date of birth', valueKinds: ['date'],
    params: [{ key: 'years', label: 'At least', kind: 'number', placeholder: 'years old' }],
    validate: (v, p, ctx) => (age(String(v), ctx.today()) ?? Infinity) >= (n(p['years']) ?? 0),
  },
  {
    type: 'ageAtMost', label: 'Maximum age', description: 'For a date of birth', valueKinds: ['date'],
    params: [{ key: 'years', label: 'At most', kind: 'number', placeholder: 'years old' }],
    validate: (v, p, ctx) => (age(String(v), ctx.today()) ?? -Infinity) <= (n(p['years']) ?? Infinity),
  },
  {
    type: 'earliestTime', label: 'Earliest time', valueKinds: ['time'],
    params: [{ key: 'time', label: 'At or after', kind: 'text', placeholder: '09:00' }],
    validate: (v, p) => !p['time'] || String(v) >= String(p['time']),
  },
  {
    type: 'latestTime', label: 'Latest time', valueKinds: ['time'],
    params: [{ key: 'time', label: 'At or before', kind: 'text', placeholder: '17:00' }],
    validate: (v, p) => !p['time'] || String(v) <= String(p['time']),
  },
  {
    type: 'minSelected', label: 'Tick at least', valueKinds: ['multi'],
    params: [{ key: 'count', label: 'At least', kind: 'number', placeholder: 'options' }],
    validate: (v, p) => (Array.isArray(v) ? v.length : 0) >= (n(p['count']) ?? 0),
    runWhenEmpty: false,
  },
  {
    type: 'maxSelected', label: 'Tick at most', valueKinds: ['multi'],
    params: [{ key: 'count', label: 'At most', kind: 'number', placeholder: 'options' }],
    validate: (v, p) => (Array.isArray(v) ? v.length : 0) <= (n(p['count']) ?? Infinity),
  },
  {
    type: 'fileType', label: 'File types', valueKinds: ['file'],
    params: [{ key: 'accept', label: 'Allowed types', kind: 'text', placeholder: '.pdf, .docx, image/*', hint: 'Extensions or types, separated by commas.' }],
    validate: (v, p) => {
      const rules = String(p['accept'] ?? '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
      if (!rules.length) return true;
      return (v as UiFbFileValue[]).every((f) => rules.some((r) =>
        r.startsWith('.') ? f.name.toLowerCase().endsWith(r) : r.endsWith('/*') ? f.type.toLowerCase().startsWith(r.slice(0, -1)) : f.type.toLowerCase() === r));
    },
  },
  {
    type: 'maxFileSize', label: 'Largest file', valueKinds: ['file'],
    params: [{ key: 'mb', label: 'Up to', kind: 'number', placeholder: 'MB' }],
    validate: (v, p) => (v as UiFbFileValue[]).every((f) => f.size <= (n(p['mb']) ?? Infinity) * 1024 * 1024),
  },
  {
    type: 'maxFiles', label: 'Number of files', valueKinds: ['file'],
    params: [{ key: 'count', label: 'At most', kind: 'number', placeholder: 'files' }],
    validate: (v, p) => (v as UiFbFileValue[]).length <= (n(p['count']) ?? Infinity),
  },
  {
    type: 'equalsField', label: 'Matches another answer', description: 'e.g. “Confirm email” must match “Email”',
    valueKinds: ['text', 'number', 'date', 'time', 'choice'],
    params: [{ key: 'field', label: 'Must match', kind: 'field' }],
    validate: (v, p, ctx) => {
      const other = ctx.value(String(p['field'] ?? ''));
      return isEmptyValue(other) || String(v).trim().toLowerCase() === String(other).trim().toLowerCase();
    },
  },
  {
    type: 'compareField', label: 'Compared with another answer', description: 'e.g. end date after start date',
    valueKinds: ['number', 'date', 'time'],
    params: [
      { key: 'comparison', label: 'Must be', kind: 'select', options: COMPARISONS, default: 'gt' },
      { key: 'field', label: 'Than', kind: 'field', fieldKinds: ['number', 'date', 'time'] },
    ],
    validate: (v, p, ctx) => {
      const other = ctx.value(String(p['field'] ?? ''));
      if (isEmptyValue(other)) return true;
      const a = n(v) ?? String(v);
      const b = n(other) ?? String(other);
      switch (p['comparison']) {
        case 'eq': return a === b;
        case 'gt': return a > b;
        case 'gte': return a >= b;
        case 'lt': return a < b;
        case 'lte': return a <= b;
      }
      return true;
    },
  },
];

/** Format checks every email/url/phone field gets without anyone adding them. */
export const UI_FB_IMPLICIT_VALIDATOR: Partial<Record<UiFbFieldType, string>> = { email: 'email', url: 'url', phone: 'phone' };

/** Checks that make sense for a field, built-ins first. */
export function validatorsFor(field: Pick<UiFbField, 'type' | 'props'>, all: readonly UiFbValidatorDef[]): UiFbValidatorDef[] {
  const kind = valueKindOf(field.type, field.props?.format);
  const info = fieldTypeInfo(field.type);
  if (field.type === 'hidden') return [];
  return all.filter((d) => {
    if (d.fieldTypes && !d.fieldTypes.includes(field.type)) return false;
    if (d.valueKinds && !d.valueKinds.includes(kind)) return false;
    // Format checks belong to their own field types; a text field can opt in.
    if (info.type !== 'text' && ['email', 'url', 'phone'].includes(d.type) && UI_FB_IMPLICIT_VALIDATOR[field.type] !== d.type) return false;
    return true;
  });
}

/** Fills `{label}` and `{param}` placeholders. */
export function formatMessage(template: string, vars: Record<string, unknown>): string {
  return template.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars && vars[k] != null && vars[k] !== '' ? String(vars[k]) : m));
}

/** The words shown for a comparison param in messages. */
export function comparisonWords(v: unknown, strings: UiFbStrings = UI_FB_STRINGS_EN): string {
  return ({ eq: strings.compareEq, gt: strings.compareGt, gte: strings.compareGte, lt: strings.compareLt, lte: strings.compareLte } as Record<string, string>)[String(v)] ?? String(v ?? '');
}

/**
 * The message a check shows when it fails and the rule has none of its own, in a language. A registered
 * check's `defaultMessage` (a string, or a map by language code) wins; a built-in's comes from `strings`.
 */
export function validatorMessage(def: Pick<UiFbValidatorDef, 'type' | 'defaultMessage'>, strings: UiFbStrings, locale = 'en'): string {
  const dm = def.defaultMessage;
  if (typeof dm === 'string') return dm;
  if (dm) {
    const base = locale.split(/[-_]/)[0];
    const hit = dm[locale] ?? dm[base] ?? Object.entries(dm).find(([k]) => k.toLowerCase() === locale.toLowerCase() || k.toLowerCase() === base.toLowerCase())?.[1];
    return hit ?? dm['en'] ?? Object.values(dm)[0] ?? strings.validatorInvalid;
  }
  const key = `validator${def.type.charAt(0).toUpperCase()}${def.type.slice(1)}`;
  const own = (strings as unknown as Record<string, string | undefined>)[key];
  return typeof own === 'string' ? own : strings.validatorInvalid;
}

export function todayIso(): string {
  return isoDate(new Date());
}
