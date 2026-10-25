import { LOCALE_ID, computed, inject, type Signal } from '@angular/core';
import { injectUiStrings, uiFormatString, type UiStrings } from '@zouriel/ui';

/**
 * Month and weekday names for the datepicker family (0.46.0): from the built-in strings when they
 * carry names (Dhivehi, which Intl has no data for), otherwise from Intl in `strings.locale` or the
 * app's `LOCALE_ID`. Never the browser's default locale, so the app decides the language.
 */
export interface UiDateNames {
  readonly locale: string;
  /** January first. */
  readonly months: readonly string[];
  readonly monthsShort: readonly string[];
  /** Sunday first (index = `Date#getDay()`). */
  readonly weekdays: readonly string[];
  readonly weekdaysShort: readonly string[];
  /** The grids' first column, 0 Sunday … 6 Saturday. */
  readonly firstDay: number;
  /** `weekdaysShort` in grid order (starting at `firstDay`). */
  readonly gridWeekdays: readonly string[];
  readonly gridWeekdaysLong: readonly string[];
  /** "October 2026" for a [year, monthIndex] view. */
  monthYear(y: number, m: number): string;
  /** An ISO `YYYY-MM-DD` day as text ("October 13, 2026"; "Oct 13, 2026" when short). */
  formatIso(isoDate: string, short?: boolean): string;
}

function safeFormat(locale: string, o: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  try {
    return new Intl.DateTimeFormat(locale || 'en-US', o);
  } catch {
    return new Intl.DateTimeFormat('en-US', o);
  }
}

/** The first day of the week a locale uses (0 Sunday … 6 Saturday), Sunday when it can't be told. */
export function uiFirstDayOfWeek(locale: string): number {
  try {
    const loc = new Intl.Locale(locale || 'en-US') as Intl.Locale & { getWeekInfo?: () => { firstDay: number }; weekInfo?: { firstDay: number } };
    // A bare language has no region, and CLDR's week data is per region: ask with its likely region.
    const full = (loc.maximize?.() ?? loc) as typeof loc;
    const info = full.getWeekInfo?.() ?? full.weekInfo;
    if (info && typeof info.firstDay === 'number') return info.firstDay % 7; // Intl: 1 Monday … 7 Sunday
  } catch {
    /* no week data: Sunday, as before 0.46 */
  }
  return 0;
}

const full = (list: readonly string[], n: number) => list.length === n && list.every((s) => !!s);

/** The date names for `strings` (and the app locale when the strings name none). */
export function uiDateNames(strings: UiStrings, appLocale = 'en-US'): UiDateNames {
  const locale = strings.locale || appLocale;
  const fmt = (o: Intl.DateTimeFormatOptions) => safeFormat(locale, o);
  const intlMonths = (month: 'long' | 'short') => {
    const f = fmt({ month });
    return Array.from({ length: 12 }, (_, m) => f.format(new Date(2000, m, 1)));
  };
  const intlDays = (weekday: 'long' | 'short') => {
    const f = fmt({ weekday });
    // 2 January 2000 was a Sunday.
    return Array.from({ length: 7 }, (_, d) => f.format(new Date(2000, 0, 2 + d)));
  };
  const months = full(strings.months, 12) ? strings.months : intlMonths('long');
  const monthsShort = full(strings.monthsShort, 12) ? strings.monthsShort : full(strings.months, 12) ? strings.months : intlMonths('short');
  const weekdays = full(strings.weekdays, 7) ? strings.weekdays : intlDays('long');
  const weekdaysShort = full(strings.weekdaysShort, 7) ? strings.weekdaysShort : full(strings.weekdays, 7) ? strings.weekdays : intlDays('short');
  const fd = strings.firstDayOfWeek;
  const firstDay = typeof fd === 'number' && fd >= 0 && fd <= 6 ? Math.floor(fd) : uiFirstDayOfWeek(locale);
  const order = Array.from({ length: 7 }, (_, i) => (firstDay + i) % 7);
  const named = full(strings.months, 12);
  const monthYearFmt = fmt({ month: 'long', year: 'numeric' });
  const longDate = fmt({ year: 'numeric', month: 'long', day: 'numeric' });
  const shortDate = fmt({ year: 'numeric', month: 'short', day: 'numeric' });
  return {
    locale,
    months,
    monthsShort,
    weekdays,
    weekdaysShort,
    firstDay,
    gridWeekdays: order.map((d) => weekdaysShort[d]),
    gridWeekdaysLong: order.map((d) => weekdays[d]),
    monthYear(y, m) {
      if (named) return uiFormatString(strings.monthYearFormat || '{month} {y}', { month: months[m], y });
      return monthYearFmt.format(new Date(y, m, 1));
    },
    formatIso(isoDate, short = false) {
      const [y, m, d] = isoDate.split('-').map(Number);
      if (named) {
        const template = (short ? strings.dateFormatShort : strings.dateFormat) || strings.dateFormat || '{d} {month} {y}';
        return uiFormatString(template, { d, month: (short ? monthsShort : months)[m - 1], y });
      }
      return (short ? shortDate : longDate).format(new Date(y, m - 1, d));
    },
  };
}

/** The date names in effect for a component, following a runtime language switch. */
export function injectUiDateNames(): Signal<UiDateNames> {
  const strings = injectUiStrings();
  const appLocale = inject(LOCALE_ID, { optional: true }) ?? 'en-US';
  // Reading the live strings inside computed() tracks UiStringsService.
  return computed(() => uiDateNames({ ...strings }, appLocale));
}

/** Leading blank cells before the 1st of a month in a grid that starts on `firstDay`. */
export function uiLeadingBlanks(y: number, m: number, firstDay: number): number {
  return (new Date(y, m, 1).getDay() - firstDay + 7) % 7;
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
