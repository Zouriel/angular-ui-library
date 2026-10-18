/**
 * Locale-aware month/weekday names for the datepicker family, from the runtime's default locale
 * (Intl), instead of hard-coded English. The grids stay Sunday-first to match `Date#getDay()`.
 */
const fmt = (o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat(undefined, o);

const monthLong = fmt({ month: 'long' });
const monthShort = fmt({ month: 'short' });
const weekdayShort = fmt({ weekday: 'short' });

export const MONTHS: readonly string[] = Array.from({ length: 12 }, (_, m) => monthLong.format(new Date(2000, m, 1)));
export const MONTHS_SHORT: readonly string[] = Array.from({ length: 12 }, (_, m) => monthShort.format(new Date(2000, m, 1)));
// 2 January 2000 was a Sunday.
export const WEEKDAYS: readonly string[] = Array.from({ length: 7 }, (_, d) => weekdayShort.format(new Date(2000, 0, 2 + d)));

const monthYearFmt = fmt({ month: 'long', year: 'numeric' });
/** "October 2026" for a [year, monthIndex] view. */
export function monthYear(y: number, m: number): string {
  return monthYearFmt.format(new Date(y, m, 1));
}

const longDate = fmt({ year: 'numeric', month: 'long', day: 'numeric' });
const shortDate = fmt({ year: 'numeric', month: 'short', day: 'numeric' });
/** Formats an ISO `YYYY-MM-DD` day as local text ("October 13, 2026", or "Oct 13, 2026" when short). */
export function formatIsoDate(isoDate: string, short = false): string {
  const [y, m, d] = isoDate.split('-').map(Number);
  return (short ? shortDate : longDate).format(new Date(y, m - 1, d));
}

/**
 * The [year, monthIndex] of an ISO `YYYY-MM-DD` day, or null for anything else. An empty string or a
 * malformed value counts as no date, so a form that starts its field at '' gets today's month rather
 * than a calendar of year 0.
 */
export function isoMonth(isoDate: string | null | undefined): [number, number] | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate ?? '');
  return m ? [Number(m[1]), Number(m[2]) - 1] : null;
}
