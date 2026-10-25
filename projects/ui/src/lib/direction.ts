import { Directionality } from '@angular/cdk/bidi';
import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { DestroyRef, Injectable, PLATFORM_ID, computed, inject, signal } from '@angular/core';

export type UiTextDirection = 'ltr' | 'rtl';

/**
 * The page's text direction (0.46.0), live. An app with a language toggle calls
 * `set('rtl', 'dv')` (or sets `<html dir>` itself: the service watches the attribute), and every
 * library part that places things by direction follows without a reload: the map's controls, the
 * date picker's popup, anything positioned through the CDK overlay (whose own `Directionality` is
 * read once at start-up, so the service keeps it in step).
 *
 * Styles mirror through logical properties and `:dir(rtl)`; this service is for the few places a
 * script needs to know.
 */
@Injectable({ providedIn: 'root' })
export class UiDirectionService {
  private readonly doc = inject(DOCUMENT);
  private readonly cdk = inject(Directionality, { optional: true });
  private readonly current = signal<UiTextDirection>(this.read());
  /** 'ltr' or 'rtl': `<body dir>` first, then `<html dir>`, as the CDK reads it. */
  readonly dir = this.current.asReadonly();
  readonly rtl = computed(() => this.current() === 'rtl');

  constructor() {
    this.syncCdk(this.current());
    if (!isPlatformBrowser(inject(PLATFORM_ID)) || typeof MutationObserver === 'undefined') return;
    const watch = new MutationObserver(() => this.sync());
    const opts = { attributes: true, attributeFilter: ['dir'] };
    watch.observe(this.doc.documentElement, opts);
    if (this.doc.body) watch.observe(this.doc.body, opts);
    inject(DestroyRef).onDestroy(() => watch.disconnect());
  }

  /** Sets `<html dir>` (and `lang`, when given), e.g. `set('rtl', 'dv')` for Dhivehi, `set('ltr', 'en')` back. */
  set(dir: UiTextDirection, lang?: string): void {
    const html = this.doc.documentElement;
    html.setAttribute('dir', dir);
    if (lang) html.setAttribute('lang', lang);
    // A dir on <body> would win over <html>; the toggle is meant for the whole page.
    if (this.doc.body?.hasAttribute('dir')) this.doc.body.setAttribute('dir', dir);
    this.sync();
  }

  private read(): UiTextDirection {
    const d = this.doc.body?.getAttribute('dir') || this.doc.documentElement?.getAttribute('dir') || 'ltr';
    return d.toLowerCase() === 'rtl' ? 'rtl' : 'ltr';
  }

  private sync(): void {
    const next = this.read();
    if (next === this.current()) return;
    this.current.set(next);
    this.syncCdk(next);
  }

  private syncCdk(dir: UiTextDirection): void {
    const cdk = this.cdk;
    if (!cdk || cdk.value === dir) return;
    cdk.valueSignal.set(dir);
    cdk.change.emit(dir);
  }
}

/** Whether `el` is laid out right to left: the nearest `dir="ltr|rtl"` on it or an ancestor (the CDK
 *  overlay pane carries one too), else its computed `direction`. False outside a browser. */
export function uiIsRtl(el: Element | null | undefined): boolean {
  if (!el) return false;
  const scoped = el.closest?.('[dir="rtl" i], [dir="ltr" i]');
  if (scoped) return scoped.getAttribute('dir')!.toLowerCase() === 'rtl';
  if (typeof getComputedStyle === 'undefined') return false;
  return getComputedStyle(el).direction === 'rtl';
}

/**
 * A key event's key with ArrowLeft and ArrowRight swapped when its target is right to left, so a
 * handler written for LTR ("ArrowRight = next") moves the way the row reads in RTL too.
 */
export function uiLogicalKey(e: KeyboardEvent): string {
  if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return e.key;
  if (!uiIsRtl(e.target as Element | null)) return e.key;
  return e.key === 'ArrowLeft' ? 'ArrowRight' : 'ArrowLeft';
}
