import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { UiWindow } from './window';
import { UiWindowManager } from './window-manager';

@Component({
  imports: [UiWindow],
  template: `<ui-window #w [(open)]="open" title="Test" (closed)="closedCount = closedCount + 1">body</ui-window>`,
})
class Host {
  readonly open = signal(true);
  closedCount = 0;
}

describe('UiWindow', () => {
  function setup() {
    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    const mgr = TestBed.inject(UiWindowManager);
    return { fixture, mgr, el: fixture.nativeElement as HTMLElement };
  }

  it('closes through [(open)] and leaves the manager, and comes back when reopened', () => {
    const { fixture, mgr, el } = setup();
    expect(mgr.count()).toBe(1);
    (el.querySelector('button[aria-label="Close"]') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(fixture.componentInstance.open()).toBe(false);
    expect(fixture.componentInstance.closedCount).toBe(1);
    expect(mgr.count()).toBe(0);

    fixture.componentInstance.open.set(true);
    fixture.detectChanges();
    expect(mgr.count()).toBe(1);
    expect(el.querySelector('section.ui-window')).not.toBeNull();
  });

  it("docks to the top half for 'top'", () => {
    const { fixture, el } = setup();
    const win = fixture.debugElement.children[0].componentInstance as UiWindow;
    win.dock('top');
    fixture.detectChanges();
    const section = el.querySelector('section.ui-window') as HTMLElement;
    expect(section.style.top).toBe('0px');
    expect(section.style.width).toBe(`${window.innerWidth}px`);
    expect(section.style.height).toBe(`${Math.floor(window.innerHeight / 2)}px`);
  });
});

describe('UiWindow minimize', () => {
  it('turns Minimize into Restore while minimized, which brings the window back', () => {
    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const first = () => el.querySelector('.chrome button') as HTMLButtonElement;
    expect(first().getAttribute('aria-label')).toBe('Minimize');
    first().click();
    fixture.detectChanges();
    expect(el.querySelector('section.ui-window')!.classList).toContain('minimized');
    expect(first().getAttribute('aria-label')).toBe('Restore');
    first().click();
    fixture.detectChanges();
    expect(el.querySelector('section.ui-window')!.classList).not.toContain('minimized');
    expect(el.querySelector('.body')).not.toBeNull();
    expect(first().getAttribute('aria-label')).toBe('Minimize');
  });

  it('a maximized window restored from minimized is still maximized', () => {
    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const win = fixture.debugElement.children[0].componentInstance as UiWindow;
    win.dock('maximize');
    fixture.detectChanges();
    const first = () => el.querySelector('.chrome button') as HTMLButtonElement;
    first().click();
    fixture.detectChanges();
    first().click();
    fixture.detectChanges();
    const section = el.querySelector('section.ui-window') as HTMLElement;
    expect(section.style.width).toBe(`${window.innerWidth}px`);
    expect(el.querySelectorAll('.chrome button')[1].getAttribute('aria-label')).toBe('Restore');
  });
});

describe('UiWindowManager.tile', () => {
  @Component({
    imports: [UiWindow],
    template: `<ui-window title="A">a</ui-window><ui-window title="B">b</ui-window>`,
  })
  class Two {}

  it('leaves an 8px gutter between windows and around the edges', () => {
    const fixture = TestBed.createComponent(Two);
    fixture.detectChanges();
    TestBed.inject(UiWindowManager).tile();
    fixture.detectChanges();
    const [a, b] = [...(fixture.nativeElement as HTMLElement).querySelectorAll('section.ui-window')] as HTMLElement[];
    const box = (s: HTMLElement) => ({ x: parseFloat(s.style.left), y: parseFloat(s.style.top), w: parseFloat(s.style.width), h: parseFloat(s.style.height) });
    const ra = box(a), rb = box(b);
    expect(ra.x).toBe(8);
    expect(ra.y).toBe(8);
    expect(rb.x - (ra.x + ra.w)).toBe(8);
    expect(rb.x + rb.w).toBeLessThanOrEqual(window.innerWidth - 8);
    expect(ra.y + ra.h).toBeLessThanOrEqual(window.innerHeight - 8);
  });
});

describe('UiWindow dragging', () => {
  function drag(el: HTMLElement, fixture: { detectChanges(): void }, from: [number, number], to: [number, number]) {
    const bar = el.querySelector('header.titlebar') as HTMLElement;
    bar.dispatchEvent(new PointerEvent('pointerdown', { button: 0, clientX: from[0], clientY: from[1], bubbles: true }));
    document.dispatchEvent(new PointerEvent('pointermove', { clientX: to[0], clientY: to[1] }));
    fixture.detectChanges();
    const section = el.querySelector('section.ui-window') as HTMLElement;
    return { left: parseFloat(section.style.left), top: parseFloat(section.style.top), width: parseFloat(section.style.width), section,
      release: () => { document.dispatchEvent(new PointerEvent('pointerup', { clientX: to[0], clientY: to[1] })); fixture.detectChanges(); } };
  }

  it('moves with the pointer inside the viewport', () => {
    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    const r = drag(fixture.nativeElement, fixture, [200, 90], [260, 150]);
    expect(r.left).toBe(140);
    expect(r.top).toBe(140);
    r.release();
  });

  it('keeps at least 48px of the title bar on screen when dragged past the right or left edge', () => {
    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    // The pointer stays clear of the 24px snap band, but the window would leave the screen.
    // The window starts at x=80, so a 30 -> innerWidth-30 drag would carry it well past the edge.
    const right = drag(fixture.nativeElement, fixture, [30, 90], [window.innerWidth - 30, 300]);
    expect(right.left).toBe(window.innerWidth - 48);
    right.release();
    // Back to the start, then a long drag to the left.
    const back = drag(fixture.nativeElement, fixture, [window.innerWidth - 30, 300], [130, 300]);
    back.release();
    expect(back.left).toBeLessThan(200);
    const left = drag(fixture.nativeElement, fixture, [window.innerWidth - 30, 300], [30, 300]);
    expect(left.left + left.width).toBe(48);
    left.release();
  });

  it('never lets the title bar go above the top or below the bottom edge', () => {
    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    const down = drag(fixture.nativeElement, fixture, [200, 90], [200, window.innerHeight * 3]);
    // Title bar height can't be measured without layout, so the 32px fallback applies.
    expect(down.top).toBeLessThanOrEqual(window.innerHeight - 32);
    expect(down.top).toBeGreaterThanOrEqual(0);
    down.release();
    const up = drag(fixture.nativeElement, fixture, [200, 300], [200, -500]);
    expect(up.top).toBe(0);
    up.release();
  });
});

describe('UiWindow on a narrow screen', () => {
  it('opens inside the viewport even when the initial bounds reach past it', () => {
    const fixture = TestBed.createComponent(WideHost);
    fixture.detectChanges();
    const section = fixture.nativeElement.querySelector('section.ui-window') as HTMLElement;
    const left = parseFloat(section.style.left);
    const width = parseFloat(section.style.width);
    expect(width).toBeLessThanOrEqual(window.innerWidth);
    expect(left).toBeGreaterThanOrEqual(0);
    expect(left + width).toBeLessThanOrEqual(window.innerWidth);
  });
});

@Component({
  imports: [UiWindow],
  template: `<ui-window [initialX]="5000" [initialY]="40" [initialWidth]="5000" [initialHeight]="200">body</ui-window>`,
})
class WideHost {}
