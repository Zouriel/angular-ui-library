import { InteractivityChecker } from '@angular/cdk/a11y';
import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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
