import { isEmptyValue } from './conditions';
import type { UiFbCalc, UiFbCalcArg, UiFbCalcOp } from './schema';

export interface UiFbCalcContext {
  /**
   * The answers behind a reference. One value for an ordinary field; one per
   * entry for a field inside a repeatable section asked about from outside it.
   */
  values(ref: string): unknown[];
  /** Number of entries, when `ref` is a repeatable group (otherwise `null`). */
  rows(ref: string): number | null;
  today(): string;
}

export interface UiFbCalcOpInfo {
  op: UiFbCalcOp;
  label: string;
  /** How the inputs are described: "Add up Price and Tax". */
  verb: string;
  hint: string;
  /** Exact number of inputs, when it has one. */
  arity?: number;
  /** Inputs are dates rather than numbers. */
  dates?: boolean;
  text?: boolean;
}

export const UI_FB_CALC_OPS: readonly UiFbCalcOpInfo[] = [
  { op: 'sum', label: 'Add up', verb: 'Total of', hint: 'Adds all the inputs together. Inside a repeating section it adds every entry.' },
  { op: 'subtract', label: 'Subtract', verb: 'Difference of', hint: 'The first input minus all the others.' },
  { op: 'multiply', label: 'Multiply', verb: 'Product of', hint: 'Multiplies the inputs, e.g. quantity × price.' },
  { op: 'divide', label: 'Divide', verb: 'Ratio of', hint: 'The first input divided by the second.', arity: 2 },
  { op: 'average', label: 'Average', verb: 'Average of', hint: 'The mean of all the inputs.' },
  { op: 'min', label: 'Smallest', verb: 'Smallest of', hint: 'The lowest of the inputs.' },
  { op: 'max', label: 'Largest', verb: 'Largest of', hint: 'The highest of the inputs.' },
  { op: 'count', label: 'Count', verb: 'Count of', hint: 'How many answers are filled in. Counts ticked options, and entries in a repeating section.' },
  { op: 'ageYears', label: 'Age in years', verb: 'Age from', hint: 'Whole years from a date until today (or until a second date).', dates: true },
  { op: 'daysBetween', label: 'Days between', verb: 'Days between', hint: 'Days from the first date to the second (or to today).', dates: true },
  { op: 'concat', label: 'Join text', verb: 'Joined text of', hint: 'Puts the inputs together, separated by spaces.', text: true },
];

export function calcOpInfo(op: UiFbCalcOp): UiFbCalcOpInfo {
  return UI_FB_CALC_OPS.find((o) => o.op === op) ?? UI_FB_CALC_OPS[0];
}

function toNum(v: unknown): number | null {
  if (typeof v === 'boolean') return v ? 1 : 0;
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v))) return Number(v);
  return null;
}

function parseDate(v: unknown): Date | null {
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}/.test(v)) return null;
  const [y, m, d] = v.slice(0, 10).split('-').map(Number);
  return new Date(y, m - 1, d);
}

function argValues(a: UiFbCalcArg, ctx: UiFbCalcContext): unknown[] {
  if ('ref' in a) return ctx.values(a.ref);
  if ('calc' in a) return [evaluateCalc(a.calc, ctx)];
  return [a.const];
}

/** The result of a calculation, or `null` when there's nothing to work it out from yet. */
export function evaluateCalc(c: UiFbCalc | undefined, ctx: UiFbCalcContext): number | string | null {
  if (!c) return null;
  const round = (n: number | null) => {
    if (n === null || !Number.isFinite(n)) return null;
    if (c.decimals == null) return Math.round(n * 1e10) / 1e10;
    const f = 10 ** c.decimals;
    return Math.round(n * f) / f;
  };
  const perArg = c.args.map((a) => argValues(a, ctx));
  const nums = perArg.flat().map(toNum).filter((n): n is number => n !== null);
  switch (c.op) {
    case 'sum': return nums.length ? round(nums.reduce((s, n) => s + n, 0)) : null;
    case 'subtract': {
      const [first, ...rest] = perArg.map((vs) => vs.map(toNum).filter((n): n is number => n !== null).reduce((s, n) => s + n, 0));
      return nums.length ? round((first ?? 0) - rest.reduce((s, n) => s + n, 0)) : null;
    }
    case 'multiply': return nums.length ? round(nums.reduce((s, n) => s * n, 1)) : null;
    case 'divide': {
      const a = toNum(perArg[0]?.[0]);
      const b = toNum(perArg[1]?.[0]);
      return a === null || b === null || b === 0 ? null : round(a / b);
    }
    case 'average': return nums.length ? round(nums.reduce((s, n) => s + n, 0) / nums.length) : null;
    case 'min': return nums.length ? round(Math.min(...nums)) : null;
    case 'max': return nums.length ? round(Math.max(...nums)) : null;
    case 'count': {
      let n = 0;
      c.args.forEach((a, i) => {
        const rows = 'ref' in a ? ctx.rows(a.ref) : null;
        if (rows !== null) { n += rows; return; }
        for (const v of perArg[i]) n += Array.isArray(v) ? v.length : isEmptyValue(v) || v === false ? 0 : 1;
      });
      return n;
    }
    case 'ageYears':
    case 'daysBetween': {
      const from = parseDate(perArg[0]?.[0]);
      const to = parseDate(perArg[1]?.[0] ?? ctx.today());
      if (!from || !to) return null;
      if (c.op === 'daysBetween') return Math.round((to.getTime() - from.getTime()) / 86_400_000);
      let years = to.getFullYear() - from.getFullYear();
      if (to.getMonth() < from.getMonth() || (to.getMonth() === from.getMonth() && to.getDate() < from.getDate())) years--;
      return years;
    }
    case 'concat': {
      const text = perArg.flat().filter((v) => !isEmptyValue(v)).map((v) => (Array.isArray(v) ? v.join(', ') : String(v)));
      return text.length ? text.join(' ') : null;
    }
  }
  return null;
}

/** "Total of “Price” and “Tax”" */
export function describeCalc(c: UiFbCalc | undefined, name: (ref: string) => string): string {
  if (!c || !c.args.length) return 'Not set up yet';
  const parts = c.args.map((a) => ('ref' in a ? `“${name(a.ref)}”` : 'calc' in a ? `(${describeCalc(a.calc, name)})` : String(a.const)));
  const list = parts.length > 1 ? `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}` : parts[0];
  const info = calcOpInfo(c.op);
  if (c.op === 'ageYears' && parts.length === 1) return `Age from ${parts[0]}`;
  if (c.op === 'daysBetween' && parts.length === 1) return `Days from ${parts[0]} until today`;
  return `${info.verb} ${list}`;
}
