import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it } from 'vitest';
import { UiActionSheet, UiActionSheetPanel, type UiActionSheetAction, type UiActionSheetOptions } from './action-sheet';
import { UiDrawer } from './drawer';

/**
 * 0.61.0, from the owner on invites.blog's guest list: the three-dots menu opened "a very slacked off
 * full screen model". jsdom has no layout: heights and the handle's position are measured in a real
 * browser (showcase, 390 and 1440); here the behaviour, order, classes and the style rules.
 */
const ACTIONS: UiActionSheetAction<string>[] = [
  { label: 'Remove', value: 'remove', danger: true },
  { label: 'Edit', value: 'edit' },
  { label: 'Resend', value: 'resend' },
];

const panel = () => document.body.querySelector('.ui-layer .panel') as HTMLElement;
const rows = () => [...panel().querySelectorAll<HTMLButtonElement>('.row')];
const stylesOf = (c: unknown) => ((c as { ɵcmp: { styles: string[] } }).ɵcmp.styles ?? []).join('\n').replace(/\s+/g, ' ');

async function openSheet(extra: Partial<UiActionSheetOptions<string>> = {}) {
  const sheet = TestBed.inject(UiActionSheet);
  const p = sheet.open<string>({ title: 'Aminath Hassan', actions: ACTIONS, ...extra });
  await new Promise((r) => setTimeout(r));
  TestBed.inject(UiActionSheet); // keep the injector alive
  return p;
}

function touch(el: HTMLElement, type: string, y: number) {
  const e = new Event(type, { bubbles: true, cancelable: true });
  Object.defineProperty(e, 'touches', { value: type === 'touchend' ? [] : [{ clientY: y }] });
  el.dispatchEvent(e);
}

describe('UiActionSheet', () => {
  afterEach(() => {
    document.body.querySelectorAll(':scope > .ui-layer, :scope > ui-action-sheet').forEach((l) => l.remove());
    document.body.style.overflow = '';
  });

  it('resolves with the chosen action value and closes', async () => {
    const p = openSheet();
    await new Promise((r) => setTimeout(r));
    rows().find((r) => r.textContent!.includes('Resend'))!.click();
    expect(await p).toBe('resend');
  });

  it('resolves undefined on Escape and on Cancel (the built-in label for "")', async () => {
    let p = openSheet();
    await new Promise((r) => setTimeout(r));
    panel().dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(await p).toBeUndefined();

    p = openSheet({ cancelLabel: '' });
    await new Promise((r) => setTimeout(r));
    const cancel = [...panel().querySelectorAll('button')].find((b) => b.textContent!.trim() === 'Cancel');
    expect(cancel).toBeTruthy();
    cancel!.click();
    expect(await p).toBeUndefined();
  });

  it('puts danger rows after the others, in the danger colour (icon too)', async () => {
    void openSheet();
    await new Promise((r) => setTimeout(r));
    expect(rows().map((r) => r.textContent!.trim())).toEqual(['Edit', 'Resend', 'Remove']);
    expect(rows()[2].classList.contains('danger')).toBe(true);
    const css = stylesOf(UiActionSheetPanel).replace(/\[_ngcontent-[^\]]*\]/g, '');
    expect(css).toMatch(/\.row\.danger\s*\{\s*color:\s*var\(--ui-color-danger\)/);
    expect(css).toMatch(/\.row\.danger \.ic\s*\{\s*color:\s*var\(--ui-color-danger\)/);
    expect(css).toMatch(/min-height:\s*48px/);
  });

  it('is a content-sized bottom drawer with a handle, named by the title', async () => {
    void openSheet();
    await new Promise((r) => setTimeout(r));
    expect(panel().dataset['side']).toBe('bottom');
    expect(panel().classList.contains('fit-content')).toBe(true);
    expect(panel().querySelector('.grip')?.getAttribute('aria-hidden')).toBe('true');
    expect(panel().getAttribute('aria-label')).toBe('Aminath Hassan');
  });

  it('marks the first enabled action for initial focus; arrows move between rows, skipping disabled', async () => {
    void openSheet({ actions: [{ label: 'Edit', value: 'e', disabled: true }, { label: 'Resend', value: 'r' }, { label: 'Remove', value: 'x', danger: true }] });
    await new Promise((r) => setTimeout(r));
    const [edit, resend, remove] = rows();
    expect(edit.hasAttribute('cdkfocusinitial')).toBe(false);
    expect(resend.hasAttribute('cdkfocusinitial')).toBe(true);
    resend.focus();
    resend.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    expect(document.activeElement).toBe(remove);
    remove.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    expect(document.activeElement).toBe(resend);
  });

  it('closes with undefined on a swipe down', async () => {
    const p = openSheet();
    await new Promise((r) => setTimeout(r));
    const el = panel();
    Object.defineProperty(el, 'offsetHeight', { configurable: true, get: () => 200 });
    touch(el, 'touchstart', 500);
    touch(el, 'touchmove', 520);
    touch(el, 'touchmove', 650);
    touch(el, 'touchend', 650);
    expect(await p).toBeUndefined();
  });
});

@Component({
  imports: [UiDrawer],
  template: `<ui-drawer [(open)]="open" side="bottom" title="Edit guest" [handle]="handle()" [fit]="fit()"><p>Body</p></ui-drawer>`,
})
class Host {
  readonly open = signal(true);
  readonly handle = signal(false);
  readonly fit = signal<'fixed' | 'content'>('fixed');
}

describe('UiDrawer handle and fit', () => {
  afterEach(() => {
    document.body.querySelectorAll(':scope > .ui-layer').forEach((l) => l.remove());
    document.body.style.overflow = '';
  });

  it('draws the handle only when asked, and fit="content" only when set', async () => {
    const f = TestBed.createComponent(Host);
    f.detectChanges();
    await f.whenStable();
    expect(panel().querySelector('.grip')).toBeNull();
    expect(panel().classList.contains('fit-content')).toBe(false);
    f.componentInstance.handle.set(true);
    f.componentInstance.fit.set('content');
    f.detectChanges();
    expect(panel().querySelector('.grip')).not.toBeNull();
    expect(panel().classList.contains('fit-content')).toBe(true);
    const css = stylesOf(UiDrawer).replace(/\[_ngcontent-[^\]]*\]/g, '');
    expect(css).toMatch(/bottom"?\]\.fit-content\s*\{\s*height:\s*auto;\s*max-height:\s*calc\(var\(--ui-drawer-room,\s*100dvh\)\s*\*\s*0\.9\)/);
    expect(css).toMatch(/\.pill\s*\{\s*width:\s*36px;\s*height:\s*4px/);
  });

  it('without a handle a touch drag does nothing', async () => {
    const f = TestBed.createComponent(Host);
    f.detectChanges();
    await f.whenStable();
    const el = panel();
    touch(el, 'touchstart', 500);
    touch(el, 'touchmove', 700);
    touch(el, 'touchend', 700);
    f.detectChanges();
    expect(f.componentInstance.open()).toBe(true);
    expect(el.style.transform).toBe('');
  });
});
