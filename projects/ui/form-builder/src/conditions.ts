import { operatorInfo } from './field-types';
import type { UiFbCondition, UiFbConditionRule, UiFbOperand } from './schema';

/** What a condition can ask about the form while it is being filled in. */
export interface UiFbConditionContext {
  /** The current answer of a field (in the asking element's repeat row, if it shares one). */
  value(ref: string): unknown;
  visible(ref: string): boolean;
  complete(ref: string): boolean;
  /** Number of entries in a repeatable group. */
  rows(ref: string): number;
  /** Today as `YYYY-MM-DD`. */
  today(): string;
}

export function isEmptyValue(v: unknown): boolean {
  return v == null || v === '' || (Array.isArray(v) && v.length === 0) || (typeof v === 'number' && Number.isNaN(v));
}

export function isoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** `YYYY-MM-DD` shifted by `days`. */
export function addDays(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  return isoDate(new Date(y, m - 1, d + days));
}

export function resolveOperand(o: UiFbOperand | undefined, ctx: UiFbConditionContext): unknown {
  if (!o) return undefined;
  if ('ref' in o) return ctx.value(o.ref);
  if ('today' in o) return addDays(ctx.today(), o.today || 0);
  return o.const;
}

const norm = (v: unknown) => String(v ?? '').trim().toLowerCase();

function num(v: unknown): number | null {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v))) return Number(v);
  return null;
}

/** Orders numbers numerically and everything else (ISO dates, HH:MM times) as text. */
function compare(a: unknown, b: unknown): number | null {
  if (isEmptyValue(a) || isEmptyValue(b)) return null;
  const na = num(a);
  const nb = num(b);
  if (na !== null && nb !== null) return na - nb;
  const sa = String(a);
  const sb = String(b);
  return sa < sb ? -1 : sa > sb ? 1 : 0;
}

function same(a: unknown, b: unknown): boolean {
  if (typeof a === 'boolean' || typeof b === 'boolean') return !!a === !!b;
  const c = compare(a, b);
  if (c !== null && num(a) !== null && num(b) !== null) return c === 0;
  return norm(a) === norm(b);
}

const list = (v: unknown): unknown[] => (Array.isArray(v) ? v : isEmptyValue(v) ? [] : [v]);

function evalRule(r: UiFbConditionRule, ctx: UiFbConditionContext): boolean {
  switch (r.op) {
    case 'visible': return ctx.visible(r.ref);
    case 'hidden': return !ctx.visible(r.ref);
    case 'complete': return ctx.complete(r.ref);
    case 'incomplete': return !ctx.complete(r.ref);
    case 'rowsGte': return ctx.rows(r.ref) >= (num(resolveOperand(r.value, ctx)) ?? Infinity);
    case 'rowsLte': return ctx.rows(r.ref) <= (num(resolveOperand(r.value, ctx)) ?? -Infinity);
  }
  const v = ctx.value(r.ref);
  switch (r.op) {
    case 'empty': return isEmptyValue(v) || v === false;
    case 'notEmpty': return !isEmptyValue(v) && v !== false;
    case 'isTrue': return v === true;
    case 'isFalse': return v !== true;
  }
  const info = operatorInfo(r.op);
  const target = resolveOperand(r.value, ctx);
  // An unfinished rule ("Age is more than …") never matches.
  if (info.arity > 0 && isEmptyValue(target)) return r.op === 'neq' || r.op === 'noneOf' || r.op === 'excludes' ? !isEmptyValue(v) : false;
  switch (r.op) {
    case 'eq': return same(v, target);
    case 'neq': return !same(v, target);
    case 'contains': return norm(v).includes(norm(target));
    case 'notContains': return !norm(v).includes(norm(target));
    case 'startsWith': return norm(v).startsWith(norm(target));
    case 'endsWith': return norm(v).endsWith(norm(target));
    case 'gt': case 'after': { const c = compare(v, target); return c !== null && c > 0; }
    case 'gte': case 'onOrAfter': { const c = compare(v, target); return c !== null && c >= 0; }
    case 'lt': case 'before': { const c = compare(v, target); return c !== null && c < 0; }
    case 'lte': case 'onOrBefore': { const c = compare(v, target); return c !== null && c <= 0; }
    case 'between': {
      const hi = resolveOperand(r.value2, ctx);
      const lo = compare(v, target);
      const up = compare(v, hi);
      return lo !== null && up !== null && lo >= 0 && up <= 0;
    }
    case 'anyOf': return list(target).some((t) => same(v, t));
    case 'noneOf': return !list(target).some((t) => same(v, t));
    case 'includes': return list(v).some((x) => same(x, target));
    case 'excludes': return !list(v).some((x) => same(x, target));
    case 'includesAny': return list(target).some((t) => list(v).some((x) => same(x, t)));
    case 'includesAll': return list(target).every((t) => list(v).some((x) => same(x, t)));
    case 'countGte': return list(v).length >= (num(target) ?? Infinity);
    case 'countLte': return list(v).length <= (num(target) ?? -Infinity);
  }
  return false;
}

/** Whether a condition holds. An empty group holds (it doesn't restrict anything yet). */
export function evaluateCondition(c: UiFbCondition | undefined, ctx: UiFbConditionContext): boolean {
  if (!c) return true;
  if ('conditions' in c) {
    if (!c.conditions.length) return true;
    if (c.match === 'all') return c.conditions.every((x) => evaluateCondition(x, ctx));
    if (c.match === 'any') return c.conditions.some((x) => evaluateCondition(x, ctx));
    return !c.conditions.some((x) => evaluateCondition(x, ctx));
  }
  return evalRule(c, ctx);
}

/** How the describer names things and shows values. */
export interface UiFbDescribeContext {
  name(ref: string): string;
  /** Shows a stored value the way people recognise it (e.g. an option's label). */
  value(ref: string, v: unknown): string;
}

function describeOperand(rule: UiFbConditionRule, o: UiFbOperand | undefined, d: UiFbDescribeContext): string {
  if (!o) return '…';
  if ('ref' in o) return `“${d.name(o.ref)}”`;
  if ('today' in o) {
    const n = o.today || 0;
    return n === 0 ? 'today' : n > 0 ? `${n} day${n === 1 ? '' : 's'} from today` : `${-n} day${n === -1 ? '' : 's'} ago`;
  }
  const v = o.const;
  if (isEmptyValue(v)) return '…';
  const info = operatorInfo(rule.op);
  if (info.countValue) return String(v);
  if (Array.isArray(v)) {
    const parts = v.map((x) => d.value(rule.ref, x));
    return parts.length > 1 ? `${parts.slice(0, -1).join(', ')} or ${parts[parts.length - 1]}` : parts[0] ?? '…';
  }
  return d.value(rule.ref, v);
}

/** "Country is any of UK or US and Age is at least 18" */
export function describeCondition(c: UiFbCondition | undefined, d: UiFbDescribeContext, nested = false): string {
  if (!c) return 'always';
  if ('conditions' in c) {
    if (!c.conditions.length) return 'always';
    const parts = c.conditions.map((x) => describeCondition(x, d, true));
    if (c.match === 'none') return `none of these: ${parts.join('; ')}`;
    const joined = parts.join(c.match === 'all' ? ' and ' : ' or ');
    return nested && parts.length > 1 ? `(${joined})` : joined;
  }
  const info = operatorInfo(c.op);
  const name = `“${d.name(c.ref)}”`;
  if (info.countValue) return `${name} ${info.label.replace('…', describeOperand(c, c.value, d))}`;
  if (info.arity === 0) return `${name} ${info.label}`;
  if (info.arity === 2) return `${name} ${info.label} ${describeOperand(c, c.value, d)} and ${describeOperand(c, c.value2, d)}`;
  return `${name} ${info.label} ${describeOperand(c, c.value, d)}`;
}

/** Whether every rule in a condition has what it needs (a field, and values where needed). */
export function conditionComplete(c: UiFbCondition | undefined): boolean {
  if (!c) return true;
  if ('conditions' in c) return c.conditions.every(conditionComplete);
  if (!c.ref) return false;
  const info = operatorInfo(c.op);
  const filled = (o?: UiFbOperand) => !!o && ('ref' in o ? !!o.ref : 'today' in o ? true : !isEmptyValue(o.const));
  if (info.arity >= 1 && !filled(c.value)) return false;
  if (info.arity === 2 && !filled(c.value2)) return false;
  return true;
}
