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
