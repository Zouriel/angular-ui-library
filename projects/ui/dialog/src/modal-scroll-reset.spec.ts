import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { UiBottomSheet } from './bottom-sheet';
import { UiModal } from './modal';

@Component({
  imports: [UiModal, UiBottomSheet],
  template: `
    <ui-modal [open]="true" [title]="title()" [resetScroll]="reset()">
      @if (view() === 'a') {
        <div class="a">Options</div>
      } @else {
        <div class="b">Colours</div>
      }
    </ui-modal>
    <ui-bottom-sheet [snaps]="[0, 1]" [snap]="1" [title]="title()" [resetScroll]="reset()">
      @if (view() === 'a') {
        <div class="a">Options</div>
      } @else {
        <div class="b">Colours</div>
      }
    </ui-bottom-sheet>
  `,
})
class Host {
  view = signal<'a' | 'b'>('a');
  title = signal('Options');
  reset = signal(true);
}

/** A reused modal or sheet whose content is swapped must show the new content from its top. */
describe('modal and sheet body scroll reset', () => {
  async function setup() {
    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    await fixture.whenStable();
    const bodies = () => Array.from(document.querySelectorAll<HTMLElement>('.bd'));
    expect(bodies().length).toBe(2);
    return { fixture, bodies };
  }
  const settle = async (f: { detectChanges(): void; whenStable(): Promise<unknown> }) => {
    f.detectChanges();
    await f.whenStable();
    await new Promise((r) => setTimeout(r, 0));
  };

  it('scrolls back to the top when the projected content is swapped', async () => {
    const { fixture, bodies } = await setup();
    for (const b of bodies()) b.scrollTop = 300;
    expect(bodies().map((b) => b.scrollTop)).toEqual([300, 300]);
    fixture.componentInstance.view.set('b');
    await settle(fixture);
    expect(bodies().map((b) => b.scrollTop)).toEqual([0, 0]);
  });

  it('scrolls back to the top when the title changes', async () => {
    const { fixture, bodies } = await setup();
    for (const b of bodies()) b.scrollTop = 300;
    fixture.componentInstance.title.set('Colours');
    await settle(fixture);
    expect(bodies().map((b) => b.scrollTop)).toEqual([0, 0]);
  });

  it('keeps the scroll with resetScroll off', async () => {
    const { fixture, bodies } = await setup();
    fixture.componentInstance.reset.set(false);
    await settle(fixture);
    for (const b of bodies()) b.scrollTop = 300;
    fixture.componentInstance.view.set('b');
    fixture.componentInstance.title.set('Colours');
    await settle(fixture);
    expect(bodies().map((b) => b.scrollTop)).toEqual([300, 300]);
  });
});
