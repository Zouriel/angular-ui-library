import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { describe, expect, it } from 'vitest';
import { UiBottomSheet } from './bottom-sheet';

/* 0.44.0: the [sheet-footer] slot. */

@Component({
  imports: [UiBottomSheet],
  template: `
    <ui-bottom-sheet [(snap)]="snap" [snaps]="snaps()" [glass]="glass()" title="Visit" [closable]="false" (coverChange)="covers.push($event)">
      <p class="body">Details</p>
      @if (footer()) { <div sheet-footer class="bar"><button type="button">Start the visit</button></div> }
    </ui-bottom-sheet>
  `,
})
class Host {
  snap = signal(0);
  snaps = signal<number[]>([0.1, 0.5, 0.9]);
  footer = signal(true);
  glass = signal(false);
  covers: number[] = [];
}

function setup(init?: (h: Host) => void) {
  const f = TestBed.createComponent(Host);
  init?.(f.componentInstance);
  f.detectChanges();
  const root = f.nativeElement as HTMLElement;
  const cmp = f.debugElement.query(By.directive(UiBottomSheet)).componentInstance as UiBottomSheet;
  const grab = root.querySelector('.grab') as HTMLElement;
  const foot = root.querySelector('.ft') as HTMLElement;
  const sizes = (head: number, footer: number) => {
    Object.defineProperty(grab, 'offsetHeight', { configurable: true, value: head });
    Object.defineProperty(foot, 'offsetHeight', { configurable: true, value: footer });
    (cmp as unknown as { measure(): void }).measure();
    f.detectChanges();
  };
  const host = root.querySelector('ui-bottom-sheet') as HTMLElement;
  const sheet = root.querySelector('.sheet') as HTMLElement;
  return { f, h: f.componentInstance, root, cmp, grab, foot, sizes, host, sheet };
}

const ROOM = window.innerHeight;

describe('ui-bottom-sheet footer (0.44.0)', () => {
  it('projects the footer into the pinned area after the body, outside the scrolling part', () => {
    const { root, foot } = setup();
    expect(foot.querySelector('.bar')).toBeTruthy();
    expect(root.querySelector('.bd .bar')).toBeNull();
    expect(root.querySelector('.bd .body')).toBeTruthy();
    expect(foot.previousElementSibling!.classList.contains('bd')).toBe(true);
    const s = getComputedStyle(foot);
    expect(s.position).toBe('absolute');
    expect(s.bottom).toBe('var(--ui-sheet-live-hidden, 0px)');
  });

  it('stays at the bottom of the visible part at every snap: the sheet hangs below by exactly the footer\'s offset', () => {
    const { h, f, sizes, host, sheet } = setup();
    sizes(40, 72);
    for (const i of [0, 1, 2]) {
      h.snap.set(i);
      f.detectChanges();
      const hidden = parseFloat(host.style.getPropertyValue('--ui-sheet-live-hidden'));
      const max = parseFloat(sheet.style.height);
      const visible = max - hidden;
      expect(sheet.style.transform).toBe(`translateY(${hidden}px)`);
      expect(visible).toBe(Math.max(Math.round(ROOM * h.snaps()[i]), 112));
    }
  });

  it('raises a peek too short for the header and the footer to fit them, and counts it in coverChange', () => {
    const { h, f, sizes } = setup();
    sizes(40, 72);
    expect(Math.round(ROOM * 0.1)).toBeLessThan(112);
    expect(h.covers.at(-1)).toBe(112);
    h.snap.set(1);
    f.detectChanges();
    expect(h.covers.at(-1)).toBe(Math.round(ROOM * 0.5));
  });

  it('the body scrolls above it: its scroll box ends at the footer\'s top, so nothing scrolls under it (0.44.2)', () => {
    const { sizes, host, root } = setup();
    sizes(40, 72);
    expect(host.style.getPropertyValue('--ui-sheet-footer')).toBe('72px');
    expect(host.classList.contains('has-footer')).toBe(true);
    const bd = getComputedStyle(root.querySelector('.bd')!);
    expect(bd.getPropertyValue('margin-bottom')).toBe('calc(var(--ui-sheet-live-hidden, 0px) + var(--ui-sheet-footer, 0px))');
    expect(bd.getPropertyValue('padding-bottom')).toBe('var(--ui-space-3)');
  });

  it('on a glass sheet the footer is frosted, so the body scrolling under it never shows through (0.44.2)', () => {
    const { f, h, foot } = setup();
    const bg = (el: HTMLElement) => getComputedStyle(el).getPropertyValue('background');
    expect(bg(foot)).toContain('--ui-color-surface');
    h.glass.set(true);
    f.detectChanges();
    const s = getComputedStyle(foot);
    expect(bg(foot)).toContain('--ui-glass-sheet-bg');
    expect(s.backdropFilter || s.getPropertyValue('-webkit-backdrop-filter')).toContain('--ui-glass-sheet-filter');
  });

  it('without footer content nothing changes: no padding var, the peek at its fraction', () => {
    const { h, sizes, host } = setup((x) => x.footer.set(false));
    sizes(40, 0);
    expect(host.style.getPropertyValue('--ui-sheet-footer')).toBe('');
    expect(h.covers.at(-1)).toBe(Math.round(ROOM * 0.1));
    expect(host.classList.contains('has-footer')).toBe(false);
  });
});
