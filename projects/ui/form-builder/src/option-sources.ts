import { InjectionToken, type Provider } from '@angular/core';

/** One choice a source offers. `value` is what rules compare; `label` is what people see. */
export interface UiFbSourceItem {
  value: string | number;
  label: string;
  /** A second line under the label in the list (an email, a code…). Not saved. */
  description?: string;
}

/**
 * How a sourced answer is saved: the value and, alongside it, the label it had
 * when it was picked, so saved answers stay readable even if the source later
 * renames or removes the record.
 */
export interface UiFbChoice {
  value: string | number;
  label: string;
}

/** What `search` is asked for. */
export interface UiFbSourceQuery {
  /** What the person typed (trimmed). Empty when the list first opens. */
  query: string;
  /** 1 for the first page. */
  page: number;
  pageSize: number;
  /** The source's settings for this field. Values may come from other answers. */
  params: Record<string, unknown>;
  /** Aborted when a newer search replaces this one. Pass it to `fetch`. */
  signal: AbortSignal;
}

/** One page of results. Give `hasMore`, or `total`, or neither (a full page means there may be more). */
export interface UiFbSourcePage {
  items: UiFbSourceItem[];
  hasMore?: boolean;
  total?: number;
}

/** A setting admins fill in for a source, e.g. which faculty's courses to list. */
export interface UiFbSourceParamSpec {
  key: string;
  label: string;
  /** How a fixed value is entered. Every param can also take another question's answer. */
  kind?: 'text' | 'number' | 'select';
  options?: { value: string; label: string }[];
  hint?: string;
  placeholder?: string;
  /** Searching waits until this has a value (e.g. Cities need a Country first). */
  required?: boolean;
}

/**
 * A list of options that lives in your app, usually behind an API. Register it
 * with `provideUiFormOptionSources`; it then appears in the builder as a data
 * source for dropdowns and multi-selects, and the renderer searches it page by
 * page as people type.
 */
export interface UiFbOptionSourceDef {
  /** Stored in the form JSON. Keep it stable. */
  type: string;
  /** What admins see, e.g. "Students". */
  label: string;
  description?: string;
  params?: UiFbSourceParamSpec[];
  /** Results per page. Default 20. */
  pageSize?: number;
  /** Don't search until this many characters are typed (for huge lists). Default 0. */
  minQueryLength?: number;
  /** Pause after typing before searching. Default 250ms. */
  debounceMs?: number;
  search(q: UiFbSourceQuery): Promise<UiFbSourcePage> | UiFbSourcePage;
}

/** App-registered option sources. See `provideUiFormOptionSources`. */
export const UI_FB_OPTION_SOURCES = new InjectionToken<UiFbOptionSourceDef[][]>('UI_FB_OPTION_SOURCES');

/**
 * Registers lists your app can search (students, courses, countries…). They
 * appear in the builder as data sources for dropdowns and multi-selects, and
 * run in the renderer:
 *
 * ```ts
 * providers: [provideUiFormOptionSources({
 *   type: 'students',
 *   label: 'Students',
 *   search: ({ query, page, pageSize, signal }) => api.students({ q: query, page, size: pageSize }, signal),
 * })]
 * ```
 */
export function provideUiFormOptionSources(...defs: UiFbOptionSourceDef[]): Provider {
  return { provide: UI_FB_OPTION_SOURCES, useValue: defs, multi: true };
}

/** Field types that can take their options from a source (long lists need search, not a wall of radios). */
export const UI_FB_SOURCE_FIELD_TYPES = ['select', 'multiselect'] as const;

export function isChoice(v: unknown): v is UiFbChoice {
  return !!v && typeof v === 'object' && !Array.isArray(v) && 'value' in v;
}

/** The comparable part of an answer: a saved `{ value, label }` gives its value; anything else is itself. */
export function optionValueOf(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(optionValueOf);
  return isChoice(v) ? v.value : v;
}

/** Turns whatever was stored into `{ value, label }` (a bare value keeps itself as its label). */
export function toChoice(v: unknown): UiFbChoice | null {
  if (v == null || v === '') return null;
  if (isChoice(v)) return { value: v.value, label: String(v.label ?? v.value) };
  return { value: v as string | number, label: String(v) };
}

/** Whether a page of results was the last one. */
export function sourceHasMore(page: UiFbSourcePage, loaded: number, pageSize: number): boolean {
  if (page.hasMore != null) return page.hasMore;
  if (page.total != null) return loaded < page.total;
  return page.items.length >= pageSize;
}
