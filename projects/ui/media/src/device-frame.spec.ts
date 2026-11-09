import { Component, signal, viewChild } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { UiDeviceFrame } from './device-frame';

/** jsdom has no ResizeObserver: this one lets a test report the host's size. */
let report: ((w: number, h: number) => void) | null = null;
class FakeResizeObserver {
  constructor(private cb: ResizeObserverCallback) {}
  observe() {
    report = (w, h) =>
      this.cb([{ contentRect: { width: w, height: h }, borderBoxSize: [{ inlineSize: w, blockSize: h }] } as unknown as ResizeObserverEntry], this as unknown as ResizeObserver);
  }
  disconnect() {}
  unobserve() {}
}

@Component({
  imports: [UiDeviceFrame],
  template: `<ui-device-frame #f [width]="390" [height]="844" [zoom]="zoom()" [maxScale]="maxScale()"><p>Hi</p></ui-device-frame>`,
})
class Host {
  zoom = signal(1);
  maxScale = signal(1);
  frame = viewChild.required(UiDeviceFrame);
}

describe('UiDeviceFrame zoom', () => {
  const saved = globalThis.ResizeObserver;
  // Braces: a function returned from beforeEach is run as its teardown.
  beforeEach(() => {
    globalThis.ResizeObserver = FakeResizeObserver as unknown as typeof ResizeObserver;
  });
  afterEach(() => {
    globalThis.ResizeObserver = saved;
  });

  async function setup() {
    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    await fixture.whenStable();
    // The frame with its bezel is 414 × 868; give it half that height.
    report!(414, 434);
    fixture.detectChanges();
    const el = fixture.nativeElement.querySelector('ui-device-frame') as HTMLElement;
    const fit = () => el.querySelector<HTMLElement>('.fit')!;
    return { fixture, host: fixture.componentInstance, el, fit };
  }

  it('fits at zoom 1, exactly as before: scale = fitScale, no scrolling', async () => {
    const { host, el, fit } = await setup();
    expect(host.frame().fitScale()).toBe(0.5);
    expect(host.frame().scale()).toBe(0.5);
    expect(fit().style.width).toBe('207px');
    expect(el.classList).not.toContain('zoomed');
    expect(host.frame().scrollElement).toBe(el);
  });

  it('multiplies the fitted scale by zoom, scrolls when zoomed in, and is not capped by maxScale', async () => {
    const { fixture, host, el, fit } = await setup();
    host.zoom.set(3);
    fixture.detectChanges();
    expect(host.frame().fitScale()).toBe(0.5);
    expect(host.frame().scale()).toBe(1.5);
    expect(fit().style.width).toBe(`${414 * 1.5}px`);
    expect(el.classList).toContain('zoomed');
    host.zoom.set(0.5);
    fixture.detectChanges();
    expect(host.frame().scale()).toBe(0.25);
    expect(el.classList).not.toContain('zoomed');
  });

  it('keeps zoom within 0.25–8', async () => {
    const { fixture, host } = await setup();
    host.zoom.set(100);
    fixture.detectChanges();
    expect(host.frame().scale()).toBe(4);
    host.zoom.set(0.01);
    fixture.detectChanges();
    expect(host.frame().scale()).toBe(0.125);
    host.zoom.set(Number.NaN);
    fixture.detectChanges();
    expect(host.frame().scale()).toBe(0.5);
  });

  it('pointAt and scrollPointTo map client points to screen px and back', async () => {
    const { fixture, host, el } = await setup();
    const screen = el.querySelector<HTMLElement>('.screen')!;
    let left = 100;
    screen.getBoundingClientRect = () => ({ left, top: 50, right: 0, bottom: 0, width: 0, height: 0, x: left, y: 50, toJSON: () => ({}) }) as DOMRect;
    const p = host.frame().pointAt(200, 150);
    expect(p).toEqual({ x: 200, y: 200 }); // (200-100)/0.5, (150-50)/0.5
    host.zoom.set(2); // scale 1
    fixture.detectChanges();
    left = -40; // where the screen sits after the zoom, before scrolling
    el.scrollLeft = 10;
    el.scrollTop = 5;
    host.frame().scrollPointTo(p, 200, 150);
    // jsdom doesn't clamp: it asks for the scroll that brings p back under (200, 150).
    expect(el.scrollLeft).toBe(10 + -40 + 200 - 200);
    expect(el.scrollTop).toBe(5 + 50 + 200 - 150);
  });
});
