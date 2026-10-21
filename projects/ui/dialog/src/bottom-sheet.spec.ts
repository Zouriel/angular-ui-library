import { InteractivityChecker } from '@angular/cdk/a11y';
import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { provideUiConfig } from '@zouriel/ui';
import { UiBottomSheet } from './bottom-sheet';

@Component({
  imports: [UiBottomSheet],
  template: `
    <button id="opener" type="button" (click)="snap.set(1)">Open</button>
    <ui-bottom-sheet [(snap)]="snap" [snaps]="[0, 0.5, 1]" title="Layers" [expandOnFocus]="false" (heightChange)="heights.push($event)">
      <input id="field" />
    </ui-bottom-sheet>
  `,
})
class Host {
  snap = signal(0);
  heights: number[] = [];
}

@Component({
  imports: [UiBottomSheet],
  template: `
    <button id="opener" type="button" (click)="snap.set(1)">Open</button>
    <ui-bottom-sheet [(snap)]="snap" [snaps]="[0, 0.5, 1]" title="Filters" [backdrop]="backdrop()" [expandOnFocus]="false">
      <input id="field" />
    </ui-bottom-sheet>
  `,
})
class ModalHost {
  snap = signal(0);
  backdrop = signal(true);
}

/**
 * The resting logic of the sheet. Dragging itself is verified against real touch input in a browser,
 * not here: synthetic touch events skip the browser's gesture arbitration, which is the whole question.
 */
describe('UiBottomSheet', () => {
  async function render() {
    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    await fixture.whenStable();
    const el: HTMLElement = fixture.nativeElement;
    const sheet = () => el.querySelector<HTMLElement>('.sheet')!;
    const handle = () => el.querySelector<HTMLButtonElement>('.handle')!;
    const settle = async () => {
      fixture.detectChanges();
      await fixture.whenStable();
    };
    return { fixture, el, sheet, handle, settle };
  }

  it('starts closed: inert and pushed below its own height', async () => {
    const { el, sheet } = await render();
    expect(sheet().hasAttribute('inert')).toBe(true);
    expect(el.querySelector('ui-bottom-sheet')!.classList.contains('open')).toBe(false);
    const height = parseFloat(sheet().style.height);
    expect(sheet().style.transform).toBe(`translateY(${height}px)`);
  });

  it('the handle steps up through the snaps, then back to the smallest open one', async () => {
    const { fixture, handle, sheet, settle } = await render();
    handle().click();
    await settle();
    expect(fixture.componentInstance.snap()).toBe(1);
    expect(sheet().hasAttribute('inert')).toBe(false);
    const height = parseFloat(sheet().style.height);
    expect(sheet().style.transform).toBe(`translateY(${height - Math.round(height * 0.5)}px)`);

    handle().click();
    await settle();
    expect(fixture.componentInstance.snap()).toBe(2);
    expect(sheet().style.transform).toBe('translateY(0px)');

    handle().click();
    await settle();
    expect(fixture.componentInstance.snap()).toBe(1);
  });

  it('arrow keys on the handle move a snap, Escape closes', async () => {
    const { fixture, handle, sheet, settle } = await render();
    handle().dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));
    handle().dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));
    handle().dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));
    await settle();
    expect(fixture.componentInstance.snap()).toBe(2);

    sheet().dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await settle();
    expect(fixture.componentInstance.snap()).toBe(0);
  });

  it('Escape from inside gives focus back to where it came from, not <body>', async () => {
    const { fixture, el, settle } = await render();
    document.body.appendChild(el);
    const opener = el.querySelector<HTMLButtonElement>('#opener')!;
    const field = el.querySelector<HTMLInputElement>('#field')!;
    opener.focus();
    opener.click();
    await settle();
    field.focus();
    expect(document.activeElement).toBe(field);
    field.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await settle();
    expect(fixture.componentInstance.snap()).toBe(0);
    expect(document.activeElement).toBe(opener);
    el.remove();
  });

  it('reports the height it settles at', async () => {
    const { fixture, settle } = await render();
    fixture.componentInstance.snap.set(2);
    await settle();
    const heights = fixture.componentInstance.heights;
    expect(heights[0]).toBe(0);
    expect(heights.at(-1)).toBeGreaterThan(0);
  });
});

/** With `backdrop` the open sheet is a modal dialog: focus goes in, stays in, and comes back. */
describe('UiBottomSheet with a backdrop', () => {
  // jsdom has no layout, so the CDK would find nothing visible and therefore nothing tabbable.
  beforeEach(() => vi.spyOn(InteractivityChecker.prototype, 'isVisible').mockReturnValue(true));
  afterEach(() => vi.restoreAllMocks());

  async function render(backdrop = true) {
    const fixture = TestBed.createComponent(ModalHost);
    fixture.componentInstance.backdrop.set(backdrop);
    document.body.appendChild(fixture.nativeElement);
    fixture.detectChanges();
    await fixture.whenStable();
    const el: HTMLElement = fixture.nativeElement;
    const sheet = () => el.querySelector<HTMLElement>('.sheet')!;
    const opener = el.querySelector<HTMLButtonElement>('#opener')!;
    const settle = async () => {
      fixture.detectChanges();
      await fixture.whenStable();
    };
    return { fixture, el, sheet, opener, settle };
  }

  it('is aria-modal only while open, and moves focus into the sheet on open', async () => {
    const { fixture, el, sheet, opener, settle } = await render();
    expect(sheet().hasAttribute('aria-modal')).toBe(false);
    opener.focus();
    opener.click();
    await settle();
    expect(sheet().getAttribute('aria-modal')).toBe('true');
    expect(sheet().contains(document.activeElement)).toBe(true);
    expect(document.activeElement).toBe(el.querySelector('.handle'));
    fixture.destroy();
    el.remove();
  });

  it('traps Tab: focus anchors around the sheet are live only while it is open', async () => {
    const { fixture, el, sheet, opener, settle } = await render();
    const anchors = () => [...el.querySelectorAll<HTMLElement>('.cdk-focus-trap-anchor')];
    expect(anchors().length).toBe(2);
    expect(anchors().every((a) => a.getAttribute('tabindex') === null)).toBe(true);
    opener.click();
    await settle();
    expect(anchors().every((a) => a.getAttribute('tabindex') === '0')).toBe(true);
    // Tabbing past the last element lands on the end anchor, which wraps to the first.
    anchors()[1].focus();
    expect(document.activeElement).toBe(sheet().querySelector('.handle'));
    fixture.destroy();
    el.remove();
  });

  it('Escape after Tab has wrapped still returns focus to the opener, not a trap anchor', async () => {
    const { fixture, el, sheet, opener, settle } = await render();
    opener.focus();
    opener.click();
    await settle();
    // Wrapping passes through the end anchor, which sits outside the sheet.
    el.querySelectorAll<HTMLElement>('.cdk-focus-trap-anchor')[1].focus();
    expect(sheet().contains(document.activeElement)).toBe(true);
    sheet().dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await settle();
    expect(document.activeElement).toBe(opener);
    fixture.destroy();
    el.remove();
  });

  it('a backdrop tap closes it and hands focus back to the opener', async () => {
    const { fixture, el, opener, settle } = await render();
    opener.focus();
    opener.click();
    await settle();
    (document.activeElement as HTMLElement).blur(); // a click on the backdrop drops focus on <body>
    el.querySelector<HTMLElement>('.backdrop')!.click();
    await settle();
    expect(fixture.componentInstance.snap()).toBe(0);
    expect(document.activeElement).toBe(opener);
    fixture.destroy();
    el.remove();
  });

  it('without a backdrop it stays non-modal: no aria-modal, focus stays put', async () => {
    const { fixture, el, sheet, opener, settle } = await render(false);
    opener.focus();
    opener.click();
    await settle();
    expect(sheet().hasAttribute('aria-modal')).toBe(false);
    expect(document.activeElement).toBe(opener);
    fixture.destroy();
    el.remove();
  });
});

@Component({
  imports: [UiBottomSheet],
  template: `
    <button id="opener" type="button">Before</button>
    <ui-bottom-sheet [(snap)]="snap" [snaps]="snaps()" title="Doctors" [expandOnFocus]="false">
      <input id="field" />
    </ui-bottom-sheet>
  `,
})
class PersistentHost {
  snap = signal(0);
  snaps = signal<readonly number[]>([0.3, 0.55, 1]);
}

/**
 * A sheet with no closed snap (peek / half / full) never "closes": Escape collapses it to its
 * smallest snap and stops there, and it leaves browser history alone so Back always leaves the page.
 */
describe('UiBottomSheet without a closed snap', () => {
  async function render(snap = 0) {
    const fixture = TestBed.createComponent(PersistentHost);
    fixture.componentInstance.snap.set(snap);
    document.body.appendChild(fixture.nativeElement);
    fixture.detectChanges();
    await fixture.whenStable();
    const el: HTMLElement = fixture.nativeElement;
    const sheet = () => el.querySelector<HTMLElement>('.sheet')!;
    const opener = el.querySelector<HTMLButtonElement>('#opener')!;
    const field = el.querySelector<HTMLInputElement>('#field')!;
    const component = fixture.debugElement.query(By.directive(UiBottomSheet)).componentInstance as UiBottomSheet;
    const settle = async () => {
      fixture.detectChanges();
      await fixture.whenStable();
    };
    const escape = () => {
      const e = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
      field.dispatchEvent(e);
      return e;
    };
    return { fixture, el, sheet, opener, field, component, settle, escape };
  }

  it('is persistent only when its smallest snap is above 0', async () => {
    const { fixture, component, settle } = await render();
    expect(component.persistent()).toBe(true);
    fixture.componentInstance.snaps.set([0, 0.5, 1]);
    await settle();
    expect(component.persistent()).toBe(false);
    fixture.destroy();
  });

  it('at its smallest snap, Escape does nothing: it stays at its peek and focus stays put', async () => {
    const { fixture, el, sheet, opener, field, settle, escape } = await render(0);
    expect(sheet().hasAttribute('inert')).toBe(false);
    opener.focus();
    field.focus();
    escape();
    await settle();
    expect(fixture.componentInstance.snap()).toBe(0);
    expect(document.activeElement).toBe(field);
    expect(sheet().hasAttribute('inert')).toBe(false);
    fixture.destroy();
    el.remove();
  });

  it('from a higher snap, Escape collapses it to the smallest snap and keeps focus inside', async () => {
    for (const from of [1, 2]) {
      const { fixture, el, opener, field, settle, escape } = await render(from);
      opener.focus();
      field.focus();
      escape();
      await settle();
      expect(fixture.componentInstance.snap()).toBe(0);
      expect(document.activeElement).toBe(field);
      escape();
      await settle();
      expect(fixture.componentInstance.snap()).toBe(0);
      fixture.destroy();
      el.remove();
    }
  });

  it('the close button collapses it to the smallest snap', async () => {
    const { fixture, el, settle } = await render(2);
    el.querySelector<HTMLButtonElement>('.x')!.click();
    await settle();
    expect(fixture.componentInstance.snap()).toBe(0);
    fixture.destroy();
    el.remove();
  });

  it('never touches browser history, so the browser Back button always leaves the page', async () => {
    const push = vi.spyOn(window.history, 'pushState');
    const replace = vi.spyOn(window.history, 'replaceState');
    const listen = vi.spyOn(window, 'addEventListener');
    const { fixture, el, opener, field, settle, escape } = await render(2);
    opener.focus();
    field.focus();
    escape();
    await settle();
    escape();
    await settle();
    expect(push).not.toHaveBeenCalled();
    expect(replace).not.toHaveBeenCalled();
    const events = listen.mock.calls.map((c) => c[0]);
    expect(events).not.toContain('popstate');
    expect(events).not.toContain('beforeunload');
    expect(events).not.toContain('hashchange');
    vi.restoreAllMocks();
    fixture.destroy();
    el.remove();
  });
});

@Component({
  imports: [UiBottomSheet],
  template: `
    <ui-bottom-sheet [snap]="1" [snaps]="[0, 0.5, 1]" title="Doctors" [maxWidth]="maxWidth()" [backdrop]="true" [expandOnFocus]="false"
      (coverChange)="covers.push($event)">
      <p>Body</p>
    </ui-bottom-sheet>
  `,
})
class WidthHost {
  maxWidth = signal<number | string | null>(null);
  covers: number[] = [];
}

/**
 * maxWidth caps the sheet and centres it. jsdom has no layout, so these check the wiring (the
 * custom property and the rule using it); the widths themselves are measured in a real browser at
 * 1280 and 390 px, LTR and RTL, for 0.39.1 (noted in the Flutter repo's docs/PORTING.md).
 */
describe('UiBottomSheet maxWidth', () => {
  async function render(maxWidth: number | string | null) {
    const fixture = TestBed.createComponent(WidthHost);
    fixture.componentInstance.maxWidth.set(maxWidth);
    fixture.detectChanges();
    await fixture.whenStable();
    const host = fixture.nativeElement.querySelector('ui-bottom-sheet') as HTMLElement;
    return { fixture, host };
  }

  it('is the full width by default: no cap is set', async () => {
    const { host } = await render(null);
    expect(host.style.getPropertyValue('--ui-sheet-max-width')).toBe('');
  });

  it('a number is px and a string is used as given', async () => {
    const { fixture, host } = await render(560);
    expect(host.style.getPropertyValue('--ui-sheet-max-width')).toBe('560px');
    fixture.componentInstance.maxWidth.set('40rem');
    fixture.detectChanges();
    expect(host.style.getPropertyValue('--ui-sheet-max-width')).toBe('40rem');
  });

  it('the sheet takes the cap and centres with logical auto margins; the backdrop stays full screen', async () => {
    await render(560);
    const css = [...document.querySelectorAll('style')].map((s) => s.textContent ?? '').join('\n');
    const sheetRule = css.match(/\.sheet\[[^\]]+\]\s*\{[^}]*\}/)?.[0] ?? '';
    expect(sheetRule).toContain('max-width: var(--ui-sheet-max-width, none)');
    expect(sheetRule).toContain('margin-inline: auto');
    const backdropRule = css.match(/\.backdrop\[[^\]]+\]\s*\{[^}]*\}/)?.[0] ?? '';
    expect(backdropRule).toContain('inset: 0');
    expect(backdropRule).not.toContain('max-width');
  });

  it('the reported cover is still the height, with or without a cap', async () => {
    const a = await render(null);
    const b = await render(560);
    expect(a.fixture.componentInstance.covers.at(-1)).toBeGreaterThan(0);
    expect(b.fixture.componentInstance.covers.at(-1)).toBe(a.fixture.componentInstance.covers.at(-1));
  });
});

@Component({
  imports: [UiBottomSheet],
  template: `<ui-bottom-sheet [snap]="1" [snaps]="[0, 1]" title="Find a nurse" [glass]="glass()"><input id="field" /></ui-bottom-sheet>`,
})
class GlassHost {
  glass = signal(false);
}

/** The glass look itself (tint, blur, fallbacks, contrast in every theme) is checked in style-contract.spec. */
describe('UiBottomSheet glass', () => {
  it('is solid by default, even when the app turns glass on for other surfaces', async () => {
    TestBed.configureTestingModule({ providers: [provideUiConfig({ glass: true })] });
    const fixture = TestBed.createComponent(GlassHost);
    fixture.detectChanges();
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('ui-bottom-sheet').classList.contains('glass')).toBe(false);
  });

  it('turns the see-through surface on and off with glass', async () => {
    const fixture = TestBed.createComponent(GlassHost);
    fixture.detectChanges();
    await fixture.whenStable();
    const host: HTMLElement = fixture.nativeElement.querySelector('ui-bottom-sheet');
    fixture.componentInstance.glass.set(true);
    fixture.detectChanges();
    expect(host.classList.contains('glass')).toBe(true);
    // Still the same dialog, open, with its content.
    expect(host.querySelector('.sheet')!.hasAttribute('inert')).toBe(false);
    expect(host.querySelector('#field')).toBeTruthy();
    fixture.componentInstance.glass.set(false);
    fixture.detectChanges();
    expect(host.classList.contains('glass')).toBe(false);
  });
});
