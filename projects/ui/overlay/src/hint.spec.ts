import { Overlay } from '@angular/cdk/overlay';
import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { UiHint, type UiHintCloseReason, type UiHintPlacement } from './hint';

@Component({
  imports: [UiHint],
  template: `
    <input id="other" />
    <button id="anchor" type="button" [uiHint]="text()" [(uiHintOpen)]="open" [uiHintDuration]="duration()"
      [uiHintPlacement]="placement()" [uiHintDismissible]="dismissible()" (uiHintClosed)="reasons.push($event)">Mic</button>
  `,
})
class Host {
  text = signal('Hold to record');
  open = signal(false);
  duration = signal(6000);
  placement = signal<UiHintPlacement>('top');
  dismissible = signal(false);
  reasons: UiHintCloseReason[] = [];
}

describe('uiHint', () => {
  beforeEach(() => vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'requestAnimationFrame', 'cancelAnimationFrame'] }));
  afterEach(() => {
    vi.useRealTimers();
    document.querySelectorAll('.cdk-overlay-container').forEach((c) => (c.innerHTML = ''));
  });

  function setup() {
    const f = TestBed.createComponent(Host);
    document.body.appendChild(f.nativeElement);
    f.detectChanges();
    const el = f.nativeElement as HTMLElement;
    const openIt = () => {
      f.componentInstance.open.set(true);
      f.detectChanges();
      vi.advanceTimersByTime(40);
      f.detectChanges();
    };
    return { f, el, anchor: el.querySelector('#anchor') as HTMLElement, openIt, hint: () => document.querySelector('.ui-hint') as HTMLElement | null };
  }

  it('opens from code as a polite status, never a dialog, and announces its text after appearing', () => {
    const { f, anchor, hint } = setup();
    f.componentInstance.open.set(true);
    f.detectChanges();
    expect(hint()!.getAttribute('role')).toBe('status');
    expect(hint()!.getAttribute('aria-live')).toBe('polite');
    expect(hint()!.textContent!.trim()).toBe('');
    vi.advanceTimersByTime(40);
    f.detectChanges();
    expect(hint()!.textContent!.trim()).toBe('Hold to record');
    expect(anchor.getAttribute('aria-describedby')).toBe(hint()!.id);
    expect(document.querySelector('[role=dialog], .cdk-overlay-backdrop')).toBeNull();
  });

  it('never moves focus and lets typing elsewhere go on', () => {
    const { el, openIt, hint } = setup();
    const other = el.querySelector('#other') as HTMLInputElement;
    other.focus();
    openIt();
    expect(hint()).not.toBeNull();
    expect(document.activeElement).toBe(other);
    const key = new KeyboardEvent('keydown', { key: 'a', bubbles: true, cancelable: true });
    other.dispatchEvent(key);
    expect(key.defaultPrevented).toBe(false);
    expect(hint()).not.toBeNull();
  });

  it('closes after its duration with reason timeout', () => {
    const { f, openIt, hint } = setup();
    openIt();
    vi.advanceTimersByTime(5900);
    expect(hint()).not.toBeNull();
    vi.advanceTimersByTime(200);
    f.detectChanges();
    expect(hint()).toBeNull();
    expect(f.componentInstance.open()).toBe(false);
    expect(f.componentInstance.reasons).toEqual(['timeout']);
  });

  it('stays until dismissed with duration 0', () => {
    const { f, openIt, hint } = setup();
    f.componentInstance.duration.set(0);
    openIt();
    vi.advanceTimersByTime(60_000);
    expect(hint()).not.toBeNull();
  });

  it('closes on Escape, on a tap on it, and on a tap on its anchor, with the reason', () => {
    const { f, anchor, openIt, hint } = setup();
    openIt();
    document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    f.detectChanges();
    expect(hint()).toBeNull();
    openIt();
    hint()!.click();
    f.detectChanges();
    expect(hint()).toBeNull();
    openIt();
    anchor.click();
    f.detectChanges();
    expect(hint()).toBeNull();
    expect(f.componentInstance.reasons).toEqual(['escape', 'tap', 'tap']);
  });

  it('shows a × only when dismissible, which closes with tap', () => {
    const { f, openIt, hint } = setup();
    openIt();
    expect(hint()!.querySelector('button.x')).toBeNull();
    f.componentInstance.open.set(false);
    f.componentInstance.dismissible.set(true);
    f.detectChanges();
    openIt();
    const x = hint()!.querySelector('button.x') as HTMLButtonElement;
    expect(x.getAttribute('aria-label')).toBe('Dismiss');
    x.click();
    f.detectChanges();
    expect(hint()).toBeNull();
    expect(f.componentInstance.reasons).toEqual(['tap']);
  });

  it('does not report a close the app made itself', () => {
    const { f, openIt, hint } = setup();
    openIt();
    f.componentInstance.open.set(false);
    f.detectChanges();
    expect(hint()).toBeNull();
    expect(f.componentInstance.reasons).toEqual([]);
  });

  it('slides along its side before flipping to the opposite one, never beside the anchor unless placed there; start/end follow the text direction', () => {
    const { f, anchor, openIt } = setup();
    const strategy = Object.getPrototypeOf(TestBed.inject(Overlay).position().flexibleConnectedTo(document.body));
    const spy = vi.spyOn(strategy, 'withPositions');
    const created = vi.spyOn(TestBed.inject(Overlay), 'create');
    const sides = () => (spy.mock.lastCall![0] as { uiSide: string }[]).map((p) => p.uiSide);
    openIt();
    expect(sides()).toEqual(['top', 'top', 'top', 'bottom', 'bottom', 'bottom']);
    const aligned = (spy.mock.lastCall![0] as { originX: string; overlayX: string }[]).slice(0, 3).map((p) => `${p.originX}/${p.overlayX}`);
    expect(aligned).toEqual(['center/center', 'start/start', 'end/end']);
    f.componentInstance.open.set(false);
    f.componentInstance.placement.set('start');
    f.detectChanges();
    openIt();
    expect(sides()).toEqual(['start', 'end', 'top', 'top', 'top', 'bottom', 'bottom', 'bottom']);
    const first = (spy.mock.lastCall![0] as { originX: string; overlayX: string; offsetX: number }[])[0];
    expect([first.originX, first.overlayX, first.offsetX < 0]).toEqual(['start', 'end', true]);
    f.componentInstance.open.set(false);
    f.detectChanges();
    anchor.style.direction = 'rtl'; // as an inherited dir="rtl" resolves in a browser
    openIt();
    expect(created.mock.lastCall![0]!.direction).toBe('rtl');
    const rtlFirst = (spy.mock.lastCall![0] as { offsetX: number }[])[0];
    expect(rtlFirst.offsetX > 0).toBe(true); // start is the right side: the gap goes rightwards
    anchor.style.direction = '';
    spy.mockRestore();
    created.mockRestore();
  });

  it('follows its anchor when it moves (Thaana typed swaps a slot icon to the other side)', () => {
    const { anchor, openIt } = setup();
    let left = 10;
    vi.spyOn(anchor, 'getBoundingClientRect').mockImplementation(() => ({ left, top: 100, width: 30, height: 30, right: left + 30, bottom: 130, x: left, y: 100, toJSON() {} }) as DOMRect);
    const updates = vi.spyOn(Object.getPrototypeOf(TestBed.inject(Overlay).create()), 'updatePosition');
    openIt();
    vi.advanceTimersByTime(100);
    const before = updates.mock.calls.length;
    left = 300;
    vi.advanceTimersByTime(50);
    expect(updates.mock.calls.length).toBeGreaterThan(before);
    const after = updates.mock.calls.length;
    vi.advanceTimersByTime(200);
    expect(updates.mock.calls.length).toBe(after); // still: nothing to do
    updates.mockRestore();
  });
});
