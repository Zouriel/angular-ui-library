import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it } from 'vitest';
import { UiBottomSheet } from './bottom-sheet';
import { UiModal } from './modal';

interface FakeMql {
  matches: boolean;
  media: string;
  listeners: Set<(e: MediaQueryListEvent) => void>;
  addEventListener: (type: string, cb: (e: MediaQueryListEvent) => void) => void;
  removeEventListener: (type: string, cb: (e: MediaQueryListEvent) => void) => void;
  fire(matches: boolean): void;
}

function mockMatchMedia(initialMatches: boolean) {
  const mqls: FakeMql[] = [];
  const prev = Object.getOwnPropertyDescriptor(window, 'matchMedia');
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: (query: string) => {
      const listeners = new Set<(e: MediaQueryListEvent) => void>();
      const mql: FakeMql = {
        matches: initialMatches,
        media: query,
        listeners,
        addEventListener: (_t, cb) => listeners.add(cb),
        removeEventListener: (_t, cb) => listeners.delete(cb),
        fire(next: boolean) {
          mql.matches = next;
          for (const cb of [...listeners]) cb({ matches: next, media: query } as MediaQueryListEvent);
        },
      };
      mqls.push(mql);
      return mql as unknown as MediaQueryList;
    },
  });
  return {
    mqls,
    restore() {
      if (prev) Object.defineProperty(window, 'matchMedia', prev);
      else delete (window as { matchMedia?: unknown }).matchMedia;
    },
  };
}

@Component({
  imports: [UiModal],
  template: `
    <ui-modal
      [(open)]="open"
      [title]="title()"
      [sheetBelow]="sheetBelow()"
      [sheetSnaps]="sheetSnaps()"
      [closeOnBackdrop]="closeOnBackdrop()"
      [closeOnEscape]="closeOnEscape()">
      <p class="body-copy">Pick up to six photos.</p>
      @if (showFooterStart()) {
        <span modal-footer-start class="counter">3 / 6</span>
      }
      @if (showFooter()) {
        <div modal-footer class="actions">
          <button type="button" class="btn-cancel">Cancel</button>
          <button type="button" class="btn-save">Save</button>
        </div>
      }
    </ui-modal>
  `,
})
class ResponsiveModalHost {
  open = signal(false);
  title = signal('Feed photos');
  sheetBelow = signal<number | null>(768);
  sheetSnaps = signal<readonly number[]>([0, 0.88]);
  closeOnBackdrop = signal(true);
  closeOnEscape = signal(true);
  showFooterStart = signal(true);
  showFooter = signal(true);
}

@Component({
  imports: [UiBottomSheet],
  template: `
    <ui-bottom-sheet [(snap)]="snap" [snaps]="[0, 0.8]" title="Picker" [backdrop]="true">
      <p>Items</p>
      @if (showStart()) { <span sheet-footer-start class="counter">2 / 5</span> }
      @if (showEnd()) { <div sheet-footer class="actions"><button type="button">Done</button></div> }
    </ui-bottom-sheet>
  `,
})
class SheetFooterHost {
  snap = signal(1);
  showStart = signal(true);
  showEnd = signal(true);
}

describe('UiModal responsive sheetBelow & footer-start slot', () => {
  let mm: ReturnType<typeof mockMatchMedia> | null = null;

  afterEach(() => {
    mm?.restore();
    mm = null;
    document.body.style.overflow = '';
    document.body.querySelectorAll(':scope > .ui-layer').forEach((n) => n.remove());
  });

  it('renders a centred modal above sheetBelow and places [modal-footer-start] at inline-start', async () => {
    mm = mockMatchMedia(false);
    const f = TestBed.createComponent(ResponsiveModalHost);
    document.body.appendChild(f.nativeElement);
    f.componentInstance.open.set(true);
    f.detectChanges();
    await f.whenStable();

    const layer = document.body.querySelector(':scope > .ui-layer') as HTMLElement;
    expect(layer.querySelector('.panel')).not.toBeNull();
    expect(layer.querySelector('ui-bottom-sheet')).toBeNull();
    expect(layer.querySelector('.bd .body-copy')?.textContent).toContain('Pick up to six photos.');

    const ft = layer.querySelector('footer.ft') as HTMLElement;
    const counter = ft.querySelector('.counter') as HTMLElement;
    const actions = ft.querySelector('.actions') as HTMLElement;
    expect(counter?.textContent?.trim()).toBe('3 / 6');
    expect(actions?.querySelector('.btn-save')).not.toBeNull();
    expect(getComputedStyle(ft).display).toBe('flex');
    expect(getComputedStyle(counter).marginInlineEnd).toBe('auto');

    f.destroy();
  });

  it('switches to ui-bottom-sheet below sheetBelow and routes body + [modal-footer-start] + [modal-footer]', async () => {
    mm = mockMatchMedia(true);
    const f = TestBed.createComponent(ResponsiveModalHost);
    document.body.appendChild(f.nativeElement);
    f.componentInstance.open.set(true);
    f.detectChanges();
    await f.whenStable();

    const layer = document.body.querySelector(':scope > .ui-layer') as HTMLElement;
    const sheet = layer.querySelector('ui-bottom-sheet') as HTMLElement;
    expect(sheet).not.toBeNull();
    expect(layer.querySelector('.panel')).toBeNull();
    expect(sheet.classList.contains('open')).toBe(true);
    expect(sheet.querySelector('.title')?.textContent?.trim()).toBe('Feed photos');
    expect(sheet.querySelector('.bd .body-copy')?.textContent).toContain('Pick up to six photos.');

    const ft = sheet.querySelector('.ft') as HTMLElement;
    const counter = ft.querySelector('.counter') as HTMLElement;
    const actions = ft.querySelector('.actions') as HTMLElement;
    expect(counter?.textContent?.trim()).toBe('3 / 6');
    expect(actions?.querySelector('.btn-save')).not.toBeNull();
    expect(getComputedStyle(ft).display).toBe('flex');
    expect(getComputedStyle(ft).justifyContent).toBe('flex-end');
    expect(getComputedStyle(counter).marginInlineEnd).toBe('auto');

    // Closing the bottom sheet via its close button sets UiModal [(open)] back to false.
    (sheet.querySelector('button.x') as HTMLButtonElement).click();
    f.detectChanges();
    await f.whenStable();
    expect(f.componentInstance.open()).toBe(false);

    f.destroy();
  });

  it('reacts to live matchMedia breakpoint changes while open', async () => {
    mm = mockMatchMedia(false);
    const f = TestBed.createComponent(ResponsiveModalHost);
    document.body.appendChild(f.nativeElement);
    f.componentInstance.open.set(true);
    f.detectChanges();
    await f.whenStable();

    expect(document.body.querySelector(':scope > .ui-layer .panel')).not.toBeNull();
    expect(document.body.querySelector(':scope > .ui-layer ui-bottom-sheet')).toBeNull();

    // Narrow viewport -> switches to bottom sheet and keeps open + body + footer.
    mm.mqls.at(-1)!.fire(true);
    f.detectChanges();
    await f.whenStable();

    const sheet = document.body.querySelector(':scope > .ui-layer ui-bottom-sheet') as HTMLElement;
    expect(sheet).not.toBeNull();
    expect(sheet.classList.contains('open')).toBe(true);
    expect(sheet.querySelector('.bd .body-copy')).not.toBeNull();
    expect(sheet.querySelector('.ft .counter')?.textContent?.trim()).toBe('3 / 6');

    // Wide viewport again -> switches back to centred modal.
    mm.mqls.at(-1)!.fire(false);
    f.detectChanges();
    await f.whenStable();

    expect(document.body.querySelector(':scope > .ui-layer .panel')).not.toBeNull();
    expect(document.body.querySelector(':scope > .ui-layer ui-bottom-sheet')).toBeNull();
    expect(document.body.querySelector(':scope > .ui-layer .ft .counter')?.textContent?.trim()).toBe('3 / 6');

    f.destroy();
  });

  it('respects closeOnBackdrop=false and closeOnEscape=false in bottom-sheet mode', async () => {
    mm = mockMatchMedia(true);
    const f = TestBed.createComponent(ResponsiveModalHost);
    document.body.appendChild(f.nativeElement);
    f.componentInstance.closeOnBackdrop.set(false);
    f.componentInstance.closeOnEscape.set(false);
    f.componentInstance.open.set(true);
    f.detectChanges();
    await f.whenStable();

    const sheet = document.body.querySelector(':scope > .ui-layer ui-bottom-sheet') as HTMLElement;
    (sheet.querySelector('.backdrop') as HTMLElement).click();
    f.detectChanges();
    expect(f.componentInstance.open()).toBe(true);

    sheet.querySelector('section.sheet')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    f.detectChanges();
    expect(f.componentInstance.open()).toBe(true);

    f.destroy();
  });

  it('keeps modal presentation when sheetBelow is null even on narrow screens', async () => {
    mm = mockMatchMedia(true);
    const f = TestBed.createComponent(ResponsiveModalHost);
    document.body.appendChild(f.nativeElement);
    f.componentInstance.sheetBelow.set(null);
    f.componentInstance.open.set(true);
    f.detectChanges();
    await f.whenStable();

    expect(document.body.querySelector(':scope > .ui-layer .panel')).not.toBeNull();
    expect(document.body.querySelector(':scope > .ui-layer ui-bottom-sheet')).toBeNull();

    f.destroy();
  });

  it('UiBottomSheet aligns .ft as flex row with [sheet-footer-start] pushed to start and hides when empty', async () => {
    const f = TestBed.createComponent(SheetFooterHost);
    f.detectChanges();
    await f.whenStable();

    const ft = f.nativeElement.querySelector('.ft') as HTMLElement;
    const counter = ft.querySelector('.counter') as HTMLElement;
    expect(getComputedStyle(ft).display).toBe('flex');
    expect(getComputedStyle(ft).justifyContent).toBe('flex-end');
    expect(getComputedStyle(counter).marginInlineEnd).toBe('auto');

    f.componentInstance.showStart.set(false);
    f.componentInstance.showEnd.set(false);
    f.detectChanges();
    expect(ft.children.length).toBe(0);

    f.destroy();
  });
});
