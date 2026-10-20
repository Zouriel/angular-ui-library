import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { UiHoldButton } from './hold-button';

@Component({
  imports: [UiHoldButton],
  template: `<ui-hold-button [hold]="1000" (confirmed)="count = count + 1">Arrived</ui-hold-button>`,
})
class Host {
  count = 0;
}

describe('ui-hold-button', () => {
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
    const btn = (f.nativeElement as HTMLElement).querySelector('ui-hold-button button') as HTMLButtonElement;
    const ptr = (type: string) => btn.dispatchEvent(new PointerEvent(type, { bubbles: true, button: 0, pointerId: 1 }));
    const key = (type: string, k = ' ', repeat = false) => {
      const e = new KeyboardEvent(type, { key: k, bubbles: true, cancelable: true, repeat });
      btn.dispatchEvent(e);
      return e;
    };
    const dialog = () => document.querySelector('[role=alertdialog], [role=dialog]');
    return { f, btn, ptr, key, dialog };
  }

  it('confirms after being held for the whole time, with no dialog', () => {
    const { f, btn, ptr, dialog } = setup();
    ptr('pointerdown');
    f.detectChanges();
    expect(btn.querySelector('.fill')).not.toBeNull();
    vi.advanceTimersByTime(999);
    expect(f.componentInstance.count).toBe(0);
    vi.advanceTimersByTime(2);
    expect(f.componentInstance.count).toBe(1);
    ptr('pointerup');
    btn.click(); // the click that follows the release
    f.detectChanges();
    expect(f.componentInstance.count).toBe(1);
    expect(dialog()).toBeNull();
  });

  it('cancels when let go early, and a hold attempt that was let go opens nothing', () => {
    const { f, btn, ptr, dialog } = setup();
    ptr('pointerdown');
    vi.advanceTimersByTime(600);
    ptr('pointerup');
    btn.click();
    vi.advanceTimersByTime(2000);
    f.detectChanges();
    expect(f.componentInstance.count).toBe(0);
    expect(dialog()).toBeNull();
  });

  it('a tap, or an assistive click with no press, opens the confirm dialog, which confirms', () => {
    const { f, btn, ptr, dialog } = setup();
    ptr('pointerdown');
    vi.advanceTimersByTime(100);
    ptr('pointerup');
    btn.click();
    f.detectChanges();
    expect(dialog()).not.toBeNull();
    const confirm = [...document.querySelectorAll('.ui-layer button')].find((b) => b.textContent?.trim() === 'Confirm') as HTMLButtonElement;
    confirm.click();
    f.detectChanges();
    expect(f.componentInstance.count).toBe(1);
  });

  it('a screen reader click (no pointer or key events before it) opens the dialog', () => {
    const { f, btn, dialog } = setup();
    btn.click();
    f.detectChanges();
    expect(dialog()).not.toBeNull();
    expect(f.componentInstance.count).toBe(0);
  });

  it('holds from the keyboard: Space or Enter held confirms, a quick press opens the dialog', () => {
    const { f, key, dialog } = setup();
    expect(key('keydown', 'Enter').defaultPrevented).toBe(true);
    key('keydown', 'Enter', true);
    vi.advanceTimersByTime(1001);
    key('keyup', 'Enter');
    f.detectChanges();
    expect(f.componentInstance.count).toBe(1);
    expect(dialog()).toBeNull();
    key('keydown', ' ');
    vi.advanceTimersByTime(100);
    key('keyup', ' ');
    f.detectChanges();
    expect(f.componentInstance.count).toBe(1);
    expect(dialog()).not.toBeNull();
  });

  it('is described by its hint', () => {
    const { btn } = setup();
    const id = btn.getAttribute('aria-describedby')!;
    expect(document.getElementById(id)!.textContent).toBe('Press and hold to confirm');
  });

  it('disabled mid-press: the press is dropped and nothing confirms', () => {
    const f = TestBed.createComponent(Toggle);
    document.body.appendChild(f.nativeElement);
    f.detectChanges();
    const btn = (f.nativeElement as HTMLElement).querySelector('ui-hold-button button') as HTMLButtonElement;
    btn.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0, pointerId: 1 }));
    vi.advanceTimersByTime(500);
    f.componentInstance.off.set(true);
    f.detectChanges();
    TestBed.tick();
    vi.advanceTimersByTime(1000);
    expect(f.componentInstance.count).toBe(0);
  });

  it('disabled from inside (confirmed) while still held: no error, and the release opens nothing', () => {
    const f = TestBed.createComponent(Toggle);
    document.body.appendChild(f.nativeElement);
    f.componentInstance.offOnConfirm = true;
    f.detectChanges();
    const btn = (f.nativeElement as HTMLElement).querySelector('ui-hold-button button') as HTMLButtonElement;
    btn.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0, pointerId: 1 }));
    vi.advanceTimersByTime(1001);
    f.detectChanges();
    expect(f.componentInstance.count).toBe(1);
    btn.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, button: 0, pointerId: 1 }));
    btn.click();
    f.detectChanges();
    expect(document.querySelector('[role=dialog]')).toBeNull();
    expect(f.componentInstance.count).toBe(1);
  });
});

@Component({
  imports: [UiHoldButton],
  template: `<ui-hold-button [hold]="1000" [disabled]="off()" (confirmed)="done()">Arrived</ui-hold-button>`,
})
class Toggle {
  off = signal(false);
  count = 0;
  offOnConfirm = false;
  done(): void {
    this.count++;
    if (this.offOnConfirm) this.off.set(true);
  }
}
