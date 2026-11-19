import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { UiContextMenu } from './context-menu';
import { UI_LONG_PRESS_MS, UI_LONG_PRESS_SLOP } from '@zouriel/ui';
import type { UiMenuItem } from './menu';

@Component({
  imports: [UiContextMenu],
  template: `<div id="t" tabindex="0" [uiContextMenu]="items" [openOnClick]="onClick()" (contextSelect)="picked.push($event.value)">Target</div>`,
})
class Host {
  items: UiMenuItem[] = [{ label: 'Change', value: 'change' }, { label: 'Remove', value: 'remove' }];
  onClick = signal(false);
  picked: string[] = [];
}

const panelOpen = () => document.querySelector('ui-context-menu-panel') !== null;
const pd = (type: string, init: PointerEventInit = {}) =>
  new PointerEvent(type, { bubbles: true, cancelable: true, pointerId: 1, isPrimary: true, pointerType: 'touch', clientX: 40, clientY: 40, ...init });

describe('UiContextMenu (0.89.0)', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => { vi.useRealTimers(); document.querySelectorAll('.cdk-overlay-container').forEach((c) => (c.innerHTML = '')); });

  function setup() {
    const f = TestBed.createComponent(Host);
    document.body.appendChild(f.nativeElement);
    f.detectChanges();
    const t = (f.nativeElement as HTMLElement).querySelector<HTMLElement>('#t')!;
    return { f, t };
  }

  it('a right-click opens it', () => {
    const { t } = setup();
    t.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 10, clientY: 10 }));
    expect(panelOpen()).toBe(true);
  });

  it('a plain click does not open it by default, and does with openOnClick', () => {
    const { f, t } = setup();
    t.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 1, clientX: 10, clientY: 10 }));
    expect(panelOpen()).toBe(false);
    f.componentInstance.onClick.set(true);
    f.detectChanges();
    t.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 1, clientX: 10, clientY: 10 }));
    expect(panelOpen()).toBe(true);
  });

  it('a touch held for 500 ms opens it; the click and native contextmenu after it are swallowed', () => {
    const { f, t } = setup();
    f.componentInstance.onClick.set(true);
    f.detectChanges();
    t.dispatchEvent(pd('pointerdown'));
    vi.advanceTimersByTime(UI_LONG_PRESS_MS - 1);
    expect(panelOpen()).toBe(false);
    vi.advanceTimersByTime(50);
    expect(panelOpen()).toBe(true);
    t.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true }));
    t.dispatchEvent(pd('pointerup'));
    t.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, detail: 1 }));
    expect(document.querySelectorAll('ui-context-menu-panel').length).toBe(1);
  });

  it('does nothing when the items array is empty', () => {
    const { f, t } = setup();
    f.componentInstance.items = [];
    f.componentInstance.onClick.set(true);
    f.detectChanges();
    t.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 10, clientY: 10 }));
    t.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 1, clientX: 10, clientY: 10 }));
    expect(panelOpen()).toBe(false);
  });

  it('a touch that moves more than 10 px, or lifts early, does not open it; a mouse press never does', () => {
    const { t } = setup();
    t.dispatchEvent(pd('pointerdown'));
    t.dispatchEvent(pd('pointermove', { clientX: 40 + UI_LONG_PRESS_SLOP + 1 }));
    vi.advanceTimersByTime(600);
    expect(panelOpen()).toBe(false);
    t.dispatchEvent(pd('pointerdown'));
    vi.advanceTimersByTime(300);
    t.dispatchEvent(pd('pointerup'));
    vi.advanceTimersByTime(600);
    expect(panelOpen()).toBe(false);
    t.dispatchEvent(pd('pointerdown', { pointerType: 'mouse' }));
    vi.advanceTimersByTime(600);
    expect(panelOpen()).toBe(false);
  });

  it('the context-menu key and Shift+F10 open it at the element', () => {
    const { t } = setup();
    t.dispatchEvent(new KeyboardEvent('keydown', { key: 'ContextMenu', bubbles: true, cancelable: true }));
    expect(panelOpen()).toBe(true);
    document.querySelectorAll('.cdk-overlay-container').forEach((c) => (c.innerHTML = ''));
    t.dispatchEvent(new KeyboardEvent('keydown', { key: 'F10', shiftKey: true, bubbles: true, cancelable: true }));
    expect(panelOpen()).toBe(true);
  });

  it('openOnClick gives a generic focused host Enter and Space activation', () => {
    const { f, t } = setup();
    f.componentInstance.onClick.set(true);
    f.detectChanges();
    t.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
    expect(panelOpen()).toBe(true);
    document.querySelectorAll('.cdk-overlay-container').forEach((c) => (c.innerHTML = ''));
    t.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true }));
    expect(panelOpen()).toBe(true);
  });

  it('scrolling or a second touch cancels a pending long press', () => {
    const { t } = setup();
    t.dispatchEvent(pd('pointerdown'));
    document.dispatchEvent(new Event('scroll'));
    vi.advanceTimersByTime(UI_LONG_PRESS_MS + 1);
    expect(panelOpen()).toBe(false);
    t.dispatchEvent(pd('pointerdown'));
    document.dispatchEvent(pd('pointerdown', { pointerId: 2 }));
    vi.advanceTimersByTime(UI_LONG_PRESS_MS + 1);
    expect(panelOpen()).toBe(false);
  });

  it('picking an item emits it', () => {
    const { f, t } = setup();
    t.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 10, clientY: 10 }));
    f.detectChanges();
    document.querySelectorAll<HTMLButtonElement>('ui-context-menu-panel .mi')[1].click();
    expect(f.componentInstance.picked).toEqual(['remove']);
  });
});
