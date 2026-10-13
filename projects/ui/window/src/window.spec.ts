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
