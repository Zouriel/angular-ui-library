import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Delete02Icon from '@hugeicons/core-free-icons/Delete02Icon';
import Download04Icon from '@hugeicons/core-free-icons/Download04Icon';
import Share08Icon from '@hugeicons/core-free-icons/Share08Icon';
import { provideUiStrings, uiStringsDv } from '@zouriel/ui';
import { UiTooltip } from '@zouriel/ui/overlay';
import { UI_LONG_PRESS_MS, UiSelectable, UiSelectionBar, type UiSelectionAction } from './selection';

@Component({
  imports: [UiSelectable],
  template: `<div class="scroller" style="height: 200px; overflow: auto">
    <ui-selectable label="Beach" [selected]="selected()" [selecting]="selecting()" (tap)="taps.push(1)" (longPress)="longs.push(1)">
      <img src="a.png" alt="" />
    </ui-selectable>
  </div>`,
})
class TileHost {
  selected = signal(false);
  selecting = signal(false);
  taps: number[] = [];
  longs: number[] = [];
}

const ACTIONS: UiSelectionAction[] = [
  { id: 'share', label: 'Share', icon: Share08Icon },
  { id: 'save', label: 'Save to gallery', icon: Download04Icon },
  { id: 'delete', label: 'Delete', icon: Delete02Icon, danger: true },
];

@Component({
  imports: [UiSelectionBar],
  template: `<ui-selection-bar [count]="count()" [total]="total()" [actions]="actions()" [canSelectAll]="canAll()" [canClear]="canClear()"
    (selectAll)="log.push('all')" (clear)="log.push('clear')" (cancel)="log.push('cancel')" (action)="log.push($event)" />`,
})
class BarHost {
  count = signal(3);
  total = signal<number | null>(10);
  actions = signal<UiSelectionAction[]>([...ACTIONS, { id: 'print', label: 'Print', enabled: false }]);
  canAll = signal(true);
  canClear = signal(true);
  log: string[] = [];
}

function ptr(el: Element, type: string, x = 10, y = 10, pointerType = 'touch'): void {
  el.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, button: 0, pointerId: 1, isPrimary: true, clientX: x, clientY: y, pointerType }));
}

describe('ui-selectable', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  async function make() {
    const fx = TestBed.createComponent(TileHost);
    fx.detectChanges();
    const el = (fx.nativeElement as HTMLElement).querySelector('ui-selectable') as HTMLElement;
    return { fx, el, host: fx.componentInstance };
  }

  it('a click (or Enter / Space) is a tap; holding 500ms is a long press, and its click is swallowed', async () => {
    const { el, host } = await make();
    el.click();
    expect(host.taps).toEqual([1]);
    el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    el.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));
    expect(host.taps).toEqual([1, 1, 1]);

    ptr(el, 'pointerdown');
    vi.advanceTimersByTime(UI_LONG_PRESS_MS - 1);
    expect(host.longs).toEqual([]);
    vi.advanceTimersByTime(2);
    expect(host.longs).toEqual([1]);
    ptr(el, 'pointerup');
    el.click();
    expect(host.taps, 'the click after a long press is not a tap').toEqual([1, 1, 1]);
    el.click();
    expect(host.taps, 'the next click is').toEqual([1, 1, 1, 1]);
  });

  it('a finger that moves past 10px or a scroll cancels the hold; a tremor does not', async () => {
    const { el, host } = await make();
    ptr(el, 'pointerdown', 10, 10);
    ptr(el, 'pointermove', 10, 25);
    vi.advanceTimersByTime(800);
    expect(host.longs).toEqual([]);
    ptr(el, 'pointerup');

    ptr(el, 'pointerdown', 10, 10);
    vi.advanceTimersByTime(200);
    document.querySelector('.scroller')!.dispatchEvent(new Event('scroll'));
    vi.advanceTimersByTime(800);
    expect(host.longs, 'scrolling must not select').toEqual([]);
    ptr(el, 'pointerup');

    ptr(el, 'pointerdown', 10, 10);
    ptr(el, 'pointermove', 13, 14);
    vi.advanceTimersByTime(UI_LONG_PRESS_MS + 1);
    expect(host.longs).toEqual([1]);

    // Lifting first is just a tap.
    ptr(el, 'pointerup');
    ptr(el, 'pointerdown');
    vi.advanceTimersByTime(100);
    ptr(el, 'pointerup');
    vi.advanceTimersByTime(1000);
    expect(host.longs).toEqual([1]);
  });

  it("suppresses the phone's own long-press menu and treats it as the long press", async () => {
    const { el, host } = await make();
    ptr(el, 'pointerdown');
    vi.advanceTimersByTime(300);
    const menu = new MouseEvent('contextmenu', { bubbles: true, cancelable: true });
    el.dispatchEvent(menu);
    expect(menu.defaultPrevented).toBe(true);
    expect(host.longs).toEqual([1]);
    vi.advanceTimersByTime(1000);
    expect(host.longs, 'not twice').toEqual([1]);
    // A mouse right-click with no press keeps the browser menu.
    ptr(el, 'pointerup');
    el.click();
    const right = new MouseEvent('contextmenu', { bubbles: true, cancelable: true });
    el.dispatchEvent(right);
    expect(right.defaultPrevented).toBe(false);
    // The context-menu key is the keyboard's long press.
    el.dispatchEvent(new KeyboardEvent('keydown', { key: 'ContextMenu', bubbles: true }));
    expect(host.longs).toEqual([1, 1]);
    // Callout and text selection are off.
    const css = (UiSelectable as unknown as { ɵcmp: { styles: string[] } }).ɵcmp.styles.join('');
    expect(css).toMatch(/-webkit-touch-callout:\s*none/);
    expect(css).toMatch(/user-select:\s*none/);
  });

  it('marks only while selecting; a selected tile shrinks with a primary outline and a checked mark', async () => {
    const { fx, el, host } = await make();
    expect(el.querySelector('.mark')).toBeNull();
    expect(el.classList.contains('on')).toBe(false);
    host.selecting.set(true);
    fx.detectChanges();
    const mark = el.querySelector('.mark')!;
    expect(mark).not.toBeNull();
    expect(mark.classList.contains('checked')).toBe(false);
    expect(mark.querySelector('svg')).toBeNull();
    host.selected.set(true);
    fx.detectChanges();
    expect(el.querySelector('.mark')!.classList.contains('checked')).toBe(true);
    expect(el.querySelector('.mark svg')).not.toBeNull();
    expect(el.classList.contains('on')).toBe(true);
    const css = (UiSelectable as unknown as { ɵcmp: { styles: string[] } }).ɵcmp.styles.join('');
    expect(css).toMatch(/\.on[^{]*\.tile[^{:]*\{[^}]*transform:\s*scale\(0\.9\)/);
    expect(css).toMatch(/\.on[^{]*\.tile[^{]*::after[^{]*\{[^}]*border-color:\s*var\(--ui-color-primary\)/);
    expect(css).toMatch(/prefers-reduced-motion[^{]*\{[^}]*\.tile[^{]*\{[^}]*transition:\s*none/);
    // Not selecting: untouched, even if the app still says selected.
    host.selecting.set(false);
    fx.detectChanges();
    expect(el.classList.contains('on')).toBe(false);
    expect(el.querySelector('.mark')).toBeNull();
  });

  it('is a labelled button, and a checkbox (checked or not) while selecting', async () => {
    const { fx, el, host } = await make();
    expect(el.getAttribute('role')).toBe('button');
    expect(el.getAttribute('aria-label')).toBe('Beach');
    expect(el.getAttribute('aria-checked')).toBeNull();
    expect(el.getAttribute('tabindex')).toBe('0');
    host.selecting.set(true);
    fx.detectChanges();
    expect(el.getAttribute('role')).toBe('checkbox');
    expect(el.getAttribute('aria-checked')).toBe('false');
    host.selected.set(true);
    fx.detectChanges();
    expect(el.getAttribute('aria-checked')).toBe('true');
  });
});

describe('ui-selection-bar', () => {
  async function make(setup?: (h: BarHost) => void) {
    const fx = TestBed.createComponent(BarHost);
    setup?.(fx.componentInstance);
    fx.detectChanges();
    await fx.whenStable();
    const el = (fx.nativeElement as HTMLElement).querySelector('ui-selection-bar') as HTMLElement;
    return { fx, el, host: fx.componentInstance };
  }
  const buttons = (el: HTMLElement) => Array.from(el.querySelectorAll<HTMLButtonElement>('.bar button'));
  const byText = (el: HTMLElement, t: string) => buttons(el).find((b) => b.textContent!.trim() === t || b.getAttribute('aria-label') === t);

  it('count, cancel, Select all that turns into Clear, and hidden sides', async () => {
    const { fx, el, host } = await make();
    expect(el.querySelector('.count')!.textContent).toContain('3 selected');
    byText(el, 'Cancel selection')!.click();
    byText(el, 'Select all')!.click();
    expect(host.log).toEqual(['cancel', 'all']);
    host.count.set(10);
    fx.detectChanges();
    expect(byText(el, 'Select all')).toBeUndefined();
    byText(el, 'Clear')!.click();
    expect(host.log).toEqual(['cancel', 'all', 'clear']);
    host.canClear.set(false);
    fx.detectChanges();
    expect(byText(el, 'Clear')).toBeUndefined();
    expect(byText(el, 'Select all')).toBeUndefined();
    host.count.set(3);
    host.canAll.set(false);
    fx.detectChanges();
    expect(byText(el, 'Select all')).toBeUndefined();
    host.canAll.set(true);
    host.total.set(null);
    host.count.set(30);
    fx.detectChanges();
    expect(byText(el, 'Select all'), 'no total: never Clear').toBeDefined();
  });

  it('actions emit their id; off with nothing selected or when not enabled; danger is destructive', async () => {
    const { fx, el, host } = await make((h) => h.count.set(0));
    for (const t of ['Share', 'Save to gallery', 'Delete', 'Print']) expect(byText(el, t)!.disabled, t).toBe(true);
    host.count.set(2);
    fx.detectChanges();
    byText(el, 'Share')!.click();
    byText(el, 'Delete')!.click();
    byText(el, 'Print')!.click();
    expect(host.log).toEqual(['share', 'delete']);
    expect(byText(el, 'Print')!.disabled).toBe(true);
    expect(el.querySelector('ui-button[data-id="delete"] button')!.getAttribute('data-variant')).toBe('destructive');
    expect(el.querySelector('ui-button[data-id="share"] button')!.getAttribute('data-variant')).toBe('ghost');
  });

  it('when the labels do not fit, the toggle and actions become labelled icon buttons, then the count shows the number alone', async () => {
    // jsdom does not lay out: give the bar 360px of room and the labelled layout 520px of need.
    const widths = new Map<string, number>([['ui-selection-bar', 360], ['measure', 520], ['count', 40], ['m-count', 75]]);
    const key = (e: Element) => (e.tagName === 'UI-SELECTION-BAR' ? 'ui-selection-bar' : [...e.classList].find((c) => widths.has(c)) ?? '');
    const cw = vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockImplementation(function (this: HTMLElement) { return widths.get(key(this)) ?? 0; });
    const sw = vi.spyOn(HTMLElement.prototype, 'scrollWidth', 'get').mockImplementation(function (this: HTMLElement) { return widths.get(key(this)) ?? 0; });
    try {
      const { fx, el, host } = await make((h) => {
        h.count.set(12);
        h.total.set(40);
      });
      fx.detectChanges();
      const bar = fx.debugElement.query((d) => d.name === 'ui-selection-bar').componentInstance as UiSelectionBar;
      bar.measure();
      fx.detectChanges();
      expect(bar.compact()).toBe(true);
      expect(el.querySelector('.bar')!.classList.contains('compact')).toBe(true);
      for (const l of ['Share', 'Save to gallery', 'Delete', 'Select all']) {
        const b = el.querySelector<HTMLButtonElement>(`ui-icon-button button[aria-label="${l}"]`);
        expect(b, l).not.toBeNull();
        expect(b!.textContent!.trim(), `${l} is icon only`).toBe('');
      }
      const tips = fx.debugElement.queryAll(By.directive(UiTooltip)).map((d) => d.injector.get(UiTooltip).text());
      expect(tips.sort()).toEqual(['Delete', 'Save to gallery', 'Select all', 'Share']);
      // An action without an icon keeps its label.
      expect(el.querySelector('ui-button[data-id="print"]')!.textContent).toContain('Print');
      // The count gives way: the number on screen, the whole phrase for screen readers.
      expect(bar.short()).toBe(true);
      expect(el.querySelector('.count [aria-hidden="true"]')!.textContent!.trim()).toBe('12');
      expect(el.querySelector('.count [aria-live="polite"]')!.textContent!.trim()).toBe('12 selected');
      // Room again: labels come back.
      widths.set('ui-selection-bar', 800);
      widths.set('count', 200);
      bar.measure();
      fx.detectChanges();
      expect(bar.compact()).toBe(false);
      expect(byText(el, 'Share')!.textContent!.trim()).toBe('Share');
      host.count.set(13);
      fx.detectChanges();
    } finally {
      cw.mockRestore();
      sw.mockRestore();
    }
  });

  it('announces count changes politely and takes its words from the strings (Dhivehi)', async () => {
    TestBed.configureTestingModule({ providers: [provideUiStrings(uiStringsDv)] });
    const { fx, el, host } = await make((h) => h.count.set(2));
    const live = el.querySelector('.count [aria-live="polite"]')!;
    expect(live.getAttribute('aria-atomic')).toBe('true');
    expect(live.textContent!.trim()).toBe('2 ހޮވިފައި');
    host.total.set(2);
    fx.detectChanges();
    expect(byText(el, uiStringsDv.clearSelection)).toBeDefined();
    expect(byText(el, uiStringsDv.cancelSelection)).toBeDefined();
  });
});
