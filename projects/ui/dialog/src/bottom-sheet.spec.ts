import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { UiBottomSheet } from './bottom-sheet';

@Component({
  imports: [UiBottomSheet],
  template: `
    <ui-bottom-sheet [(snap)]="snap" [snaps]="[0, 0.5, 1]" title="Layers" (heightChange)="heights.push($event)">
      <input id="field" />
    </ui-bottom-sheet>
  `,
})
class Host {
  snap = signal(0);
  heights: number[] = [];
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

  it('reports the height it settles at', async () => {
    const { fixture, settle } = await render();
    fixture.componentInstance.snap.set(2);
    await settle();
    const heights = fixture.componentInstance.heights;
    expect(heights[0]).toBe(0);
    expect(heights.at(-1)).toBeGreaterThan(0);
  });
});
