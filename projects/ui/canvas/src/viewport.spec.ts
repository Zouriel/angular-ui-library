import { Component, viewChild } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { UiCanvasViewport } from './viewport';

@Component({
  imports: [UiCanvasViewport],
  template: `<ui-canvas-viewport [contentWidth]="2000" [contentHeight]="400"><div></div></ui-canvas-viewport>`,
})
class Host {
  readonly vp = viewChild.required(UiCanvasViewport);
}

describe('UiCanvasViewport fit', () => {
  function setup() {
    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    const vp = fixture.componentInstance.vp();
    // The test DOM has no layout: give the viewport its size directly.
    (vp as unknown as { size: { set(v: { w: number; h: number }): void } }).size.set({ w: 800, h: 600 });
    return { fixture, vp };
  }

  it('fitting on its own stops at fitMinZoom; the fit button shows everything', () => {
    const { fixture, vp } = setup();
    vp.fit();
    expect(vp.view().zoom).toBe(0.6);
    expect(vp.view().x).toBe(0); // too wide at 60%: starts at its left edge

    (fixture.nativeElement.querySelector('button[aria-label="Fit to view"]') as HTMLButtonElement).click();
    expect(vp.view().zoom).toBeCloseTo((800 - 64) / 2000, 9);
    expect(vp.view().x).toBeCloseTo((800 - 2000 * vp.view().zoom) / 2, 9); // centred: all of it shows

    vp.zoomBy(1.2);
    vp.fit();
    expect(vp.view().zoom).toBe(0.6); // a plain fit keeps the readable floor
  });
});
