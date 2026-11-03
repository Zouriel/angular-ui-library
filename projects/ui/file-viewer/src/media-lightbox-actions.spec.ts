import { ComponentFixture, TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Delete02Icon from '@hugeicons/core-free-icons/Delete02Icon';
import Download04Icon from '@hugeicons/core-free-icons/Download04Icon';
import Image01Icon from '@hugeicons/core-free-icons/Image01Icon';
import Share08Icon from '@hugeicons/core-free-icons/Share08Icon';
import { UiMediaLightbox, type UiMediaAction, type UiMediaItem } from './media-lightbox';

/**
 * 0.53.0: the top bar's actions never overflow. Labelled pills when they fit beside the meta line and
 * the close button, icon buttons when they don't, and the first few plus a More menu when even the icons
 * don't fit.
 *
 * <p>jsdom has no layout, so widths are given: the bar's content width, and each labelled pill sized from
 * its label (34px of padding and border plus 6.5px a character, close to the real 13px font). The same
 * cases are measured in Chromium against the built showcase.</p>
 */
const ALL: UiMediaAction[] = [
  { id: 'save', label: 'Save to gallery', icon: Download04Icon },
  { id: 'share', label: 'Share', icon: Share08Icon },
  { id: 'original', label: 'Download original', icon: Image01Icon, href: (i: UiMediaItem) => i.src, download: () => '' },
  { id: 'remove', label: 'Remove', icon: Delete02Icon, tone: 'danger' },
];
const items: UiMediaItem[] = [
  { src: 'a.jpg', caption: 'Aisha, 12 Dec' },
  { src: 'b.jpg' },
];
const pill = (label: string) => Math.ceil(34 + 6.5 * label.length);

describe('UiMediaLightbox top bar actions', () => {
  let fixture: ComponentFixture<UiMediaLightbox>;
  let box: UiMediaLightbox;
  let barWidth = 0;
  const spies: { mockRestore(): void }[] = [];

  /** The width a rendered element takes, from the sizes above. */
  function widthOf(el: HTMLElement): number {
    if (el.classList.contains('bar--top')) return barWidth;
    if (el.classList.contains('m-act') || el.classList.contains('act')) return pill(el.textContent!.trim());
    if (el.classList.contains('more') || el.classList.contains('ic')) return 38;
    return 0;
  }

  beforeEach(async () => {
    spies.push(vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockImplementation(function (this: HTMLElement) { return widthOf(this); }));
    spies.push(vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockImplementation(function (this: HTMLElement) { return widthOf(this); }));
    await TestBed.configureTestingModule({ imports: [UiMediaLightbox] }).compileComponents();
    fixture = TestBed.createComponent(UiMediaLightbox);
    box = fixture.componentInstance;
    fixture.componentRef.setInput('items', items);
    box.open.set(true);
  });
  afterEach(() => {
    while (spies.length) spies.pop()!.mockRestore();
  });

  function show(width: number, actions: UiMediaAction[]): HTMLElement {
    // The phone's width less the bar's 16px padding on each side.
    barWidth = width - 32;
    fixture.componentRef.setInput('actions', actions);
    fixture.detectChanges();
    box.fitActions();
    fixture.detectChanges();
    return fixture.nativeElement.querySelector('.acts') as HTMLElement;
  }

  for (const width of [320, 360, 390]) {
    for (const n of [2, 3, 4]) {
      for (const icons of [true, false]) {
        it(`${width} wide, ${n} actions ${icons ? 'with' : 'without'} icons: fits, every action named and reachable`, async () => {
          const actions = ALL.slice(0, n).map((a) => (icons ? a : { ...a, icon: undefined }));
          const fired: string[] = [];
          box.action.subscribe((e) => fired.push(e.id));
          const acts = show(width, actions);
          const fit = box.fit();
          // The row fits beside the 72px the caption keeps and its 12px gap.
          const kids = Array.from(acts.children) as HTMLElement[];
          const used = kids.reduce((sum, el) => sum + widthOf(el), 0) + 8 * (kids.length - 1);
          expect(used, `${fit}: ${used}px`).toBeLessThanOrEqual(barWidth - 72 - 12);
          // Every action is in the bar, named by its label, or in the More menu.
          const inBar = kids.filter((k) => k.dataset['id']).map((k) => k.dataset['id']);
          for (const k of kids.filter((k) => k.dataset['id'])) {
            const a = actions.find((x) => x.id === k.dataset['id'])!;
            if (k.classList.contains('act-ic')) {
              expect(k.getAttribute('aria-label')).toBe(a.label);
              expect(k.getAttribute('title')).toBe(a.label);
              expect(k.textContent!.trim()).toBe('');
              expect(k.classList.contains('act--danger')).toBe(a.tone === 'danger');
            } else {
              expect(k.textContent!.trim()).toBe(a.label);
            }
          }
          const rest = actions.filter((a) => !inBar.includes(a.id)).map((a) => a.id);
          const more = acts.querySelector<HTMLButtonElement>('.more > button');
          if (!rest.length) {
            expect(more).toBeNull();
            expect(inBar).toEqual(actions.map((a) => a.id));
          } else {
            expect(fit).toBe('menu');
            expect(inBar, 'the last ones go to the menu').toEqual(actions.slice(0, actions.length - rest.length).map((a) => a.id));
            expect(more!.getAttribute('aria-label')).toBe('More actions');
            more!.click();
            fixture.detectChanges();
            expect(more!.getAttribute('aria-expanded')).toBe('true');
            const menuItems = Array.from(acts.querySelectorAll<HTMLElement>('[role="menuitem"]'));
            expect(menuItems.map((m) => m.dataset['id'])).toEqual(rest);
            const last = menuItems[menuItems.length - 1];
            expect(last.classList.contains('menu__item--danger')).toBe(actions.find((a) => a.id === rest[rest.length - 1])!.tone === 'danger');
            last.click();
            fixture.detectChanges();
            expect(fired).toEqual([rest[rest.length - 1]]);
            expect(acts.querySelector('[role="menu"]')).toBeNull();
          }
          if (width === 390 && n === 2) expect(fit).toBe('labelled');
          if (width === 360 && n === 3 && icons) expect(fit).toBe('icons');
          if (width === 320 && n === 4 && !icons) expect(fit).toBe('menu');
        });
      }
    }
  }

  it('wide: every label as a pill', () => {
    show(1200, ALL);
    expect(box.fit()).toBe('labelled');
    expect(Array.from(fixture.nativeElement.querySelectorAll('.act')).map((a) => (a as HTMLElement).textContent!.trim()))
      .toEqual(['Save to gallery', 'Share', 'Download original', 'Remove']);
  });

  it('the menu answers its own keys: arrows move, Escape closes it and not the viewer', () => {
    const acts = show(320, ALL.map((a) => ({ ...a, icon: undefined })));
    const more = acts.querySelector<HTMLButtonElement>('.more > button')!;
    more.click();
    fixture.detectChanges();
    const menu = acts.querySelector<HTMLElement>('[role="menu"]')!;
    const menuItems = Array.from(menu.querySelectorAll<HTMLElement>('[role="menuitem"]'));
    menuItems[0].focus();
    const down = new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true });
    menuItems[0].dispatchEvent(down);
    expect(document.activeElement).toBe(menuItems[1]);
    expect(down.defaultPrevented).toBe(true);
    expect(box.index()).toBe(0);
    const esc = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
    menuItems[1].dispatchEvent(esc);
    fixture.detectChanges();
    expect(esc.defaultPrevented).toBe(true);
    expect(acts.querySelector('[role="menu"]')).toBeNull();
    expect(box.open()).toBe(true);
    expect(document.activeElement).toBe(more);
  });

  it("the dialog's own Escape (focus outside the menu) closes the menu first, then the viewer", async () => {
    const acts = show(320, ALL.map((a) => ({ ...a, icon: undefined })));
    acts.querySelector<HTMLButtonElement>('.more > button')!.click();
    fixture.detectChanges();
    // The first item takes focus once the menu is drawn.
    await new Promise((r) => setTimeout(r));
    expect(document.activeElement?.getAttribute('role')).toBe('menuitem');
    const dlg = fixture.nativeElement.querySelector('dialog') as HTMLDialogElement;
    dlg.dispatchEvent(new Event('cancel', { cancelable: true }));
    fixture.detectChanges();
    expect(acts.querySelector('[role="menu"]')).toBeNull();
    expect(box.open()).toBe(true);
    dlg.dispatchEvent(new Event('cancel', { cancelable: true }));
    fixture.detectChanges();
    expect(box.open()).toBe(false);
  });
});
