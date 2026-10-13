import { InjectionToken, type Provider } from '@angular/core';
import type { UiFbOptionSourceDef, UiFbSourceItem, UiFbSourcePage, UiFbSourceParamSpec } from './option-sources';

/**
 * A list admins set up in the app's settings (see `ui-form-global-settings`):
 * where to ask, how it searches and pages, and how to read the reply. It holds
 * no secrets; the app's fetch hook (`provideUiFormHttpSources`) adds the login.
 */
export interface UiFbHttpSourceConfig {
  /** Stored in forms that use it. Keep it stable once forms use it. */
  type: string;
  label: string;
  description?: string;
  /** Address of the list, e.g. `https://api.example.com/students`. Query settings are added to it. */
  url: string;
  /** Query setting that carries what people typed. Default `q`. */
  searchParam?: string;
  /** `page`: page numbers. `offset`: how many to skip (e.g. `skip`, `offset`). Default `page`. */
  paging?: 'page' | 'offset';
  /** Query setting for the page number or the offset. Default `page` (or `offset`). */
  pageParam?: string;
  /** Number of the first page (0 or 1). Default 1. */
  firstPage?: 0 | 1;
  /** Query setting for how many per page. Default `pageSize`. Empty to leave it out. */
  pageSizeParam?: string;
  pageSize?: number;
  /** Where the list is in the reply, as a dotted path (`data.items`). Empty when the reply is the list itself. */
  itemsPath?: string;
  /** Field (dotted path) whose value is saved. */
  valueField: string;
  /** What people see: a field (`name`) or a pattern combining fields (`{firstName} {lastName}`). */
  labelField: string;
  /** Optional second line: a field or a pattern. */
  descriptionField?: string;
  /** Optional: where the reply says how many there are in all. */
  totalPath?: string;
  /** Optional: where the reply says whether more pages follow. */
  hasMorePath?: string;
  /** Don't search until this many characters are typed. */
  minQueryLength?: number;
  /** Settings form builders fill in per question; each is sent as a query setting of the same name. */
  params?: UiFbSourceParamSpec[];
}

/** Gets the reply for a request. Add the session or token here; throw to refuse. */
export type UiFbSourceFetch = (url: string, init: { signal: AbortSignal }) => Promise<unknown>;

export interface UiFbHttpSourcesOptions {
  /** How requests are made. Default: `fetch` with the browser's cookies for the same site, reading JSON. */
  fetch?: UiFbSourceFetch;
  /**
   * Servers lists may call, as origins (`https://api.example.com`). Settings
   * pointing anywhere else are refused, in the settings screen and at run time.
   * Leave out to allow only this app's own origin.
   */
  allowedOrigins?: string[];
}

export const UI_FB_HTTP_SOURCES = new InjectionToken<UiFbHttpSourcesOptions>('UI_FB_HTTP_SOURCES');

/**
 * How lists set up in the settings screen reach your API:
 *
 * ```ts
 * provideUiFormHttpSources({
 *   allowedOrigins: ['https://api.example.com'],
 *   fetch: (url, { signal }) => http.get(url, { headers: { Authorization: `Bearer ${auth.token()}` } }).pipe(…),
 * })
 * ```
 */
export function provideUiFormHttpSources(options: UiFbHttpSourcesOptions): Provider {
  return { provide: UI_FB_HTTP_SOURCES, useValue: options };
}

const defaultFetch: UiFbSourceFetch = async (url, { signal }) => {
  const res = await fetch(url, { signal, credentials: 'same-origin', headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`The server answered ${res.status}${res.statusText ? ` ${res.statusText}` : ''}`);
  return res.json();
};

/** The request function lists use: the app's hook, or plain `fetch` reading JSON. */
export function sourceFetch(options: UiFbHttpSourcesOptions | null | undefined): UiFbSourceFetch {
  return options?.fetch ?? defaultFetch;
}

/** Reads a dotted path (`data.items`, `user.name`); an empty path is the value itself. */
export function readPath(obj: unknown, path: string | undefined): unknown {
  if (!path) return obj;
  let cur = obj;
  for (const part of path.split('.')) {
    if (cur == null || typeof cur !== 'object') return undefined;
    cur = (cur as Record<string, unknown>)[part];
  }
  return cur;
}

/** `{firstName} {lastName}` fills in fields; a plain name is read as a single field. */
export function fillPattern(obj: unknown, pattern: string | undefined): string {
  if (!pattern) return '';
  if (!pattern.includes('{')) return toText(readPath(obj, pattern.trim()));
  return pattern.replace(/\{([^}]+)\}/g, (_, p: string) => toText(readPath(obj, p.trim()))).replace(/\s+/g, ' ').trim();
}

function toText(v: unknown): string {
  return v == null ? '' : typeof v === 'object' ? JSON.stringify(v) : String(v);
}

/** The origin of an address, or '' when it isn't a full http(s) address. */
export function originOf(url: string): string {
  try {
    const u = new URL(url, typeof location !== 'undefined' ? location.href : 'http://localhost');
    return u.protocol === 'http:' || u.protocol === 'https:' ? u.origin : '';
  } catch {
    return '';
  }
}

/** Whether a list may call `url`: its origin is allowed, or it's this app's own. */
export function originAllowed(url: string, allowed: readonly string[] | undefined): boolean {
  const o = originOf(url);
  if (!o) return false;
  const own = typeof location !== 'undefined' ? location.origin : '';
  return o === own || (allowed ?? []).some((a) => a.replace(/\/+$/, '') === o);
}

/** The address a search asks, with the query, paging and settings added. */
export function sourceUrl(c: UiFbHttpSourceConfig, q: { query: string; page: number; pageSize: number; params: Record<string, unknown> }): string {
  const u = new URL(c.url, typeof location !== 'undefined' ? location.href : 'http://localhost');
  const set = (k: string | undefined, v: unknown) => { if (k && v != null && v !== '') u.searchParams.set(k, String(v)); };
  set(c.searchParam ?? 'q', q.query);
  const offset = (c.paging ?? 'page') === 'offset';
  set(c.pageParam || (offset ? 'offset' : 'page'), offset ? (q.page - 1) * q.pageSize : q.page - 1 + (c.firstPage ?? 1));
  if (c.pageSizeParam !== '') set(c.pageSizeParam ?? 'pageSize', q.pageSize);
  for (const [k, v] of Object.entries(q.params)) set(k, Array.isArray(v) ? v.join(',') : v);
  return u.toString();
}

/** Reads one page of a reply. Throws a plain-English error when the reply doesn't match the setup. */
export function readSourceReply(c: UiFbHttpSourceConfig, reply: unknown, pageSize: number): UiFbSourcePage {
  const list = readPath(reply, c.itemsPath);
  if (!Array.isArray(list)) {
    const keys = reply && typeof reply === 'object' && !Array.isArray(reply) ? Object.keys(reply).slice(0, 8).join(', ') : '';
    throw new Error(c.itemsPath
      ? `No list at “${c.itemsPath}” in the reply${keys ? ` (it has: ${keys})` : ''}.`
      : `The reply isn’t a list${keys ? `; the list may be under one of: ${keys}` : ''}.`);
  }
  const items: UiFbSourceItem[] = [];
  for (const row of list) {
    const value = readPath(row, c.valueField);
    if (value == null || value === '') continue;
    const label = fillPattern(row, c.labelField) || String(value);
    const description = c.descriptionField ? fillPattern(row, c.descriptionField) || undefined : undefined;
    items.push({ value: typeof value === 'number' ? value : String(value), label, description });
  }
  if (list.length && !items.length) throw new Error(`No “${c.valueField}” field in the items.`);
  const total = c.totalPath ? Number(readPath(reply, c.totalPath)) : NaN;
  const more = c.hasMorePath ? readPath(reply, c.hasMorePath) : undefined;
  return {
    items,
    total: Number.isFinite(total) ? total : undefined,
    hasMore: typeof more === 'boolean' ? more : more == null ? (list.length < pageSize ? false : undefined) : !!more,
  };
}

/** Turns a list set up in settings into an option source the builder and renderer can search. */
export function httpOptionSource(c: UiFbHttpSourceConfig, options: UiFbHttpSourcesOptions = {}): UiFbOptionSourceDef {
  const get = sourceFetch(options);
  const pageSize = c.pageSize ?? 20;
  return {
    type: c.type,
    label: c.label,
    description: c.description,
    params: c.params,
    pageSize,
    minQueryLength: c.minQueryLength,
    search: async (q) => {
      const url = sourceUrl(c, q);
      if (!originAllowed(url, options.allowedOrigins)) throw new Error(`This app doesn’t allow lists from ${originOf(url) || 'that address'}.`);
      return readSourceReply(c, await get(url, { signal: q.signal }), q.pageSize);
    },
  };
}
