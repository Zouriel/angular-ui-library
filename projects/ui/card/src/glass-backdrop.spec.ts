import { Component, signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { UiCard } from './card';
import { UiGlassBackdrop } from './glass-backdrop';

@Component({
  imports: [UiGlassBackdrop],
  template: `<ui-glass-backdrop [image]="image()" [transition]="200">
    <span>Backdrop</span>
  </ui-glass-backdrop>`,
})
class Host {
  image = signal<string | null>('/one.jpg');
}

@Component({
  imports: [UiCard, UiGlassBackdrop],
  template: `<ui-glass-backdrop [image]="image()" [transition]="200">
    <ui-card [glass]="true">Glass</ui-card>
  </ui-glass-backdrop>`,
})
class CardHost {
  image = signal<string | null>('/one.jpg');
}

let frames: FrameRequestCallback[] = [];
let reduced = false;
let now = 0;
let revoked: string[] = [];
let urlNumber = 0;
let originalWindowRaf: typeof window.requestAnimationFrame;
let originalWindowCancelRaf: typeof window.cancelAnimationFrame;
let originalWindowMatchMedia: typeof window.matchMedia;

function flushFrame(time: number): void {
  now = time;
  const pending = frames;
  frames = [];
  for (const frame of pending) frame(time);
}

function sourceLayers(fixture: { nativeElement: HTMLElement }): HTMLElement[] {
  return [...fixture.nativeElement.querySelectorAll('.source')].filter((el) => (el as HTMLElement).style.opacity !== '0') as HTMLElement[];
}

async function settle(fixture: Pick<ComponentFixture<Host>, 'detectChanges' | 'whenStable'>): Promise<void> {
  for (let i = 0; i < 3; i++) {
    fixture.detectChanges();
    await fixture.whenStable();
    await vi.runAllTicks();
    await vi.advanceTimersByTimeAsync(0);
    await vi.runAllTicks();
  }
}

describe('ui-glass-backdrop transitions', () => {
  beforeEach(() => {
    originalWindowRaf = window.requestAnimationFrame;
    originalWindowCancelRaf = window.cancelAnimationFrame;
    originalWindowMatchMedia = window.matchMedia;
    vi.useFakeTimers();
    frames = [];
    reduced = false;
    now = 0;
    revoked = [];
    urlNumber = 0;
    const matchMedia = (query: string) => ({
      matches: query.includes('reduced-motion') && reduced,
      media: query,
      addEventListener() {},
      removeEventListener() {},
    });
    const requestAnimationFrame = (callback: FrameRequestCallback) => {
      frames.push(callback);
      return frames.length;
    };
    Object.defineProperty(window, 'matchMedia', { configurable: true, value: matchMedia });
    Object.defineProperty(window, 'requestAnimationFrame', { configurable: true, value: requestAnimationFrame });
    Object.defineProperty(window, 'cancelAnimationFrame', { configurable: true, value: () => {} });
    vi.spyOn(performance, 'now').mockImplementation(() => now);
    vi.stubGlobal('Image', class {
      naturalWidth = 400;
      naturalHeight = 200;
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      crossOrigin = '';
      set src(_value: string) { this.onload?.(); }
    });
    vi.spyOn(URL, 'createObjectURL').mockImplementation(() => `blob:${++urlNumber}`);
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(url => revoked.push(url));
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      filter: '', fillStyle: '', drawImage() {}, fillRect() {},
    } as unknown as CanvasRenderingContext2D);
    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(callback => callback(new Blob(['blur'])));
  });

  afterEach(() => {
    if (originalWindowRaf) Object.defineProperty(window, 'requestAnimationFrame', { configurable: true, value: originalWindowRaf });
    else delete (window as { requestAnimationFrame?: typeof window.requestAnimationFrame }).requestAnimationFrame;
    if (originalWindowCancelRaf) Object.defineProperty(window, 'cancelAnimationFrame', { configurable: true, value: originalWindowCancelRaf });
    else delete (window as { cancelAnimationFrame?: typeof window.cancelAnimationFrame }).cancelAnimationFrame;
    if (originalWindowMatchMedia) Object.defineProperty(window, 'matchMedia', { configurable: true, value: originalWindowMatchMedia });
    else delete (window as { matchMedia?: typeof window.matchMedia }).matchMedia;
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('waits for the new blur, paints complementary background and card opacities, revokes the old URL, then idles', async () => {
    const fixture = TestBed.createComponent(CardHost);
    fixture.detectChanges();
    await settle(fixture);
    const host = fixture.nativeElement as HTMLElement;
    const card = host.querySelector('.ui-card') as HTMLElement;
    expect(sourceLayers(fixture)).toHaveLength(1);
    frames = [];

    fixture.componentInstance.image.set('/two.jpg');
    fixture.detectChanges();
    await settle(fixture);
    flushFrame(performance.now() + 100);
    fixture.detectChanges();
    const mid = sourceLayers(fixture);
    expect(mid).toHaveLength(2);
    expect(Number(mid[0].style.opacity)).toBeCloseTo(0.5, 1);
    expect(Number(mid[1].style.opacity)).toBeCloseTo(0.5, 1);
    expect(card.style.getPropertyValue('--_ui-glass-backdrop-opacity-0')).toBe('0.5');
    expect(card.style.getPropertyValue('--_ui-glass-backdrop-opacity-1')).toBe('0.5');

    flushFrame(200);
    fixture.detectChanges();
    expect(sourceLayers(fixture)).toHaveLength(1);
    expect(sourceLayers(fixture)[0].style.backgroundImage).toContain('/two.jpg');
    expect(revoked).toContain('blob:1');
  });

  it('interrupts from the visible blend and goes directly to the newest image', async () => {
    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    await settle(fixture);
    frames = [];
    fixture.componentInstance.image.set('/two.jpg');
    fixture.detectChanges();
    await settle(fixture);
    flushFrame(performance.now() + 80);
    fixture.componentInstance.image.set('/three.jpg');
    fixture.detectChanges();
    await settle(fixture);
    flushFrame(performance.now() + 1000);
    fixture.detectChanges();
    expect(sourceLayers(fixture)).toHaveLength(1);
    expect(sourceLayers(fixture)[0].style.backgroundImage).toContain('/three.jpg');
    expect(revoked).toContain('blob:1');
    expect(revoked).toContain('blob:2');
  });

  it('is instant under reduced motion and schedules no fade frame', async () => {
    reduced = true;
    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    await settle(fixture);
    frames = [];
    fixture.componentInstance.image.set('/two.jpg');
    fixture.detectChanges();
    await settle(fixture);
    expect(sourceLayers(fixture)).toHaveLength(1);
    expect(sourceLayers(fixture)[0].style.backgroundImage).toContain('/two.jpg');
    flushFrame(performance.now() + 100);
    expect(frames).toHaveLength(0);
  });
});
