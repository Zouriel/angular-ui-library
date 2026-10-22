import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { UiFab } from '@zouriel/ui/button';
import { UiFabHold } from './fab-hold';

/* 0.44.0: ui-fab [hold] (UiFabHold) and topOffset. */

@Component({
  imports: [UiFab, UiFabHold],
  template: `<ui-fab label="SOS, call for help" text="SOS" tone="danger" position="top-center" [topOffset]="56" [hold]="hold()"
    confirmTitle="Send an SOS?" confirmLabel="Send SOS" [destructive]="true" (confirmed)="count = count + 1" (click)="clicks = clicks + 1">!</ui-fab>`,
})
class Host {
  hold = signal<number | null>(1000);
  count = 0;
  clicks = 0;
}

describe('ui-fab hold (0.44.0)', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.useRealTimers();
    document.querySelectorAll('.ui-layer').forEach((l) => l.remove());
    document.body.style.overflow = '';
  });

  function setup() {
    const f = TestBed.createComponent(Host);
    document.body.appendChild(f.nativeElement);
    f.detectChanges();
    const btn = (f.nativeElement as HTMLElement).querySelector('ui-fab button') as HTMLButtonElement;
    const ptr = (type: string) => btn.dispatchEvent(new PointerEvent(type, { bubbles: true, button: 0, pointerId: 1 }));
    const key = (type: string, k = ' ', repeat = false) => {
      const e = new KeyboardEvent(type, { key: k, bubbles: true, cancelable: true, repeat });
      btn.dispatchEvent(e);
      return e;
    };
    const dialog = () => document.querySelector('[role=alertdialog], [role=dialog]');
    const fill = () => btn.querySelector('.fill') as HTMLElement | null;
    const layerButton = (text: string) => [...document.querySelectorAll('.ui-layer button')].find((b) => b.textContent?.trim() === text) as HTMLButtonElement | undefined;
    return { f, h: f.componentInstance, btn, ptr, key, dialog, fill, layerButton };
  }

  it('held for the whole time it confirms, with the fill growing over the hold, and no dialog', () => {
    const { f, h, btn, ptr, dialog, fill } = setup();
    expect(fill()!.style.width).toBe('0%');
    ptr('pointerdown');
    f.detectChanges();
    expect(fill()!.style.width).toBe('100%');
    expect(fill()!.style.transitionDuration).toBe('1000ms');
    vi.advanceTimersByTime(999);
    expect(h.count).toBe(0);
    vi.advanceTimersByTime(2);
    expect(h.count).toBe(1);
    ptr('pointerup');
    btn.click();
    f.detectChanges();
    expect(h.count).toBe(1);
    expect(dialog()).toBeNull();
  });

  it('let go early: cancelled, the fill empties, and nothing opens', () => {
    const { f, h, btn, ptr, dialog, fill } = setup();
    ptr('pointerdown');
    vi.advanceTimersByTime(600);
    ptr('pointerup');
    btn.click();
    vi.advanceTimersByTime(2000);
    f.detectChanges();
    expect(h.count).toBe(0);
    expect(fill()!.style.width).toBe('0%');
    expect(dialog()).toBeNull();
  });

  it('a tap opens the confirm dialog with the given words; confirming emits; it opens again next time', () => {
    const { f, h, btn, ptr, dialog, layerButton } = setup();
    ptr('pointerdown');
    vi.advanceTimersByTime(100);
    ptr('pointerup');
    btn.click();
    f.detectChanges();
    expect(dialog()).not.toBeNull();
    expect(document.querySelector('.ui-layer')!.textContent).toContain('Send an SOS?');
    layerButton('Send SOS')!.click();
    f.detectChanges();
    expect(h.count).toBe(1);
    vi.advanceTimersByTime(1000);
    f.detectChanges();
    // A screen reader's activation (a click with no press) opens it again.
    btn.click();
    f.detectChanges();
    vi.advanceTimersByTime(50);
    expect(layerButton('Send SOS')).toBeTruthy();
    layerButton('Cancel')!.click();
    f.detectChanges();
    expect(h.count).toBe(1);
  });

  it('holds from the keyboard: Space held confirms; a quick Enter opens the dialog', () => {
    const { f, h, key, dialog } = setup();
    expect(key('keydown', ' ').defaultPrevented).toBe(true);
    vi.advanceTimersByTime(1001);
    key('keyup', ' ');
    expect(h.count).toBe(1);
    f.detectChanges();
    expect(dialog()).toBeNull();
    key('keydown', 'Enter');
    vi.advanceTimersByTime(50);
    key('keyup', 'Enter');
    f.detectChanges();
    expect(dialog()).not.toBeNull();
    expect(h.count).toBe(1);
  });

  it('is described by the hold hint; [hold]=null is a plain fab again', () => {
    const { f, h, btn, ptr, dialog, fill } = setup();
    const id = btn.getAttribute('aria-describedby')!;
    expect(document.getElementById(id)!.textContent!.trim()).toBe('Press and hold to confirm');
    expect(btn.getAttribute('aria-label')).toBe('SOS, call for help');
    h.hold.set(null);
    f.detectChanges();
    expect(btn.getAttribute('aria-describedby')).toBeNull();
    expect(fill()).toBeNull();
    ptr('pointerdown');
    vi.advanceTimersByTime(1500);
    ptr('pointerup');
    btn.click();
    f.detectChanges();
    expect(h.count).toBe(0);
    expect(dialog()).toBeNull();
    expect(h.clicks).toBeGreaterThan(0);
  });
});
