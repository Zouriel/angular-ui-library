import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { fitContain } from './gestures';
import { UiImageViewer } from './image-viewer';

/**
 * `fill`: the viewer as the whole page (a payment slip opened from a list) rather than a box on it.
 *
 * <p>jsdom does no layout, so sizes are stubbed where the viewer reads them (the stage's client box
 * and the picture's natural size), and the CSS contract is read back with getComputedStyle, which
 * jsdom does cascade from the component's stylesheet. The real-browser sizes are checked by the
 * showcase screenshots.</p>
 */
@Component({
  imports: [UiImageViewer],
  template: `<div class="page"><ui-image-viewer [src]="src" alt="Payment slip" [fill]="fill()" /></div>`,
})
class Host {
  readonly src = 'slip.jpg';
  readonly fill = signal(true);
}

describe('UiImageViewer fill', () => {
  let fixture: ComponentFixture<Host>;
  let root: HTMLElement;

  const q = <T extends Element = HTMLElement>(sel: string) => root.querySelector(sel) as T;
  const btn = (label: string) => q<HTMLButtonElement>(`button[aria-label="${label}"]`);
  const pct = () => q('.pct').textContent!.trim();
  const transform = () => q('img').style.transform;

  function size(el: Element, width: number, height: number): void {
    Object.defineProperty(el, 'clientWidth', { configurable: true, value: width });
    Object.defineProperty(el, 'clientHeight', { configurable: true, value: height });
  }

  function key(k: string): void {
    q('.stage').dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true }));
    fixture.detectChanges();
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [Host] }).compileComponents();
    fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    root = fixture.nativeElement;
  });

  it('takes the whole area: no height cap, no spacer, and the picture fills the stage, contained', () => {
    const iv = q('.iv');
    expect(iv.classList).toContain('fill');
    expect(getComputedStyle(iv).maxHeight).toBe('none');
    const img = getComputedStyle(q('img'));
    expect(img.position).toBe('absolute');
    expect(img.width).toBe('100%');
    expect(img.height).toBe('100%');
    expect(img.objectFit).toBe('contain');
  });

  it('floats the controls over the bottom of the picture instead of a bar under it', () => {
    const bar = q('.bar');
    expect(bar.classList).toContain('overlay');
    const css = getComputedStyle(bar);
    expect(css.position).toBe('absolute');
    expect(css.bottom).toContain('safe-area-inset-bottom');
    expect(css.borderRadius).toBe('var(--ui-radius-pill)');
    // Inside the viewer's own box, so it lives and dies with it.
    expect(q('.iv').contains(bar)).toBe(true);
  });

  it('keeps the plain viewer as it was: a bar of its own, under the stage', () => {
    fixture.componentInstance.fill.set(false);
    fixture.detectChanges();
    expect(q('.iv').classList).not.toContain('fill');
    expect(q('.bar').classList).not.toContain('overlay');
    expect(getComputedStyle(q('.bar')).position).not.toBe('absolute');
    expect(q('.stage').getAttribute('tabindex')).toBeNull();
  });

  it('the floating controls zoom and fit', () => {
    expect(pct()).toBe('100%');
    btn('Zoom in').click();
    fixture.detectChanges();
    expect(pct()).toBe('125%');
    expect(transform()).toContain('scale(1.25)');
    btn('Zoom out').click();
    btn('Zoom out').click();
    fixture.detectChanges();
    expect(pct()).toBe('75%');
    btn('Reset view').click();
    fixture.detectChanges();
    expect(pct()).toBe('100%');
    expect(transform()).toBe('translate(0px, 0px) scale(1)');
  });

  it('is reachable by keyboard, named, and zooms with + - 0', () => {
    const stage = q('.stage');
    expect(stage.getAttribute('tabindex')).toBe('0');
    expect(stage.getAttribute('role')).toBe('group');
    expect(stage.getAttribute('aria-label')).toBe('Payment slip');
    expect(q('img').getAttribute('alt')).toBe('Payment slip');
    expect(q('.bar').getAttribute('aria-label')).toBe('Image controls');
    for (const label of ['Zoom out', 'Zoom in', 'Reset view']) expect(btn(label)).not.toBeNull();
    key('+');
    key('=');
    expect(pct()).toBe('150%');
    key('-');
    expect(pct()).toBe('125%');
    key('0');
    expect(pct()).toBe('100%');
  });

  it('pans a zoomed picture only as far as the fitted picture reaches, not into the letterbox', () => {
    // A portrait photo (900x1500) fitted into a 400x800 stage is drawn 400x666.67; at 2x that is
    // 800x1333.33, so it can travel 200 sideways and 266.67 up or down, and no further.
    size(q('.stage'), 400, 800);
    const img = q<HTMLImageElement>('img');
    size(img, 400, 800); // the element itself fills the stage
    Object.defineProperty(img, 'naturalWidth', { configurable: true, value: 900 });
    Object.defineProperty(img, 'naturalHeight', { configurable: true, value: 1500 });
    for (let i = 0; i < 4; i++) btn('Zoom in').click();
    fixture.detectChanges();
    expect(pct()).toBe('200%');
    const stage = q('.stage');
    stage.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 1, clientX: 100, clientY: 100, bubbles: true }));
    stage.dispatchEvent(new PointerEvent('pointermove', { pointerId: 1, clientX: 2100, clientY: 2100, bubbles: true }));
    stage.dispatchEvent(new PointerEvent('pointerup', { pointerId: 1, clientX: 2100, clientY: 2100, bubbles: true }));
    fixture.detectChanges();
    const [, x, y] = /translate\((-?[\d.]+)px, (-?[\d.]+)px\)/.exec(transform())!.map(Number);
    expect(x).toBeCloseTo(200, 1);
    expect(y).toBeCloseTo(266.67, 1);
  });

  it('ctrl + wheel (a trackpad pinch) zooms in fill as well', () => {
    q('.stage').dispatchEvent(new WheelEvent('wheel', { deltaY: -100, ctrlKey: true, bubbles: true, cancelable: true }));
    fixture.detectChanges();
    expect(pct()).toBe('110%');
  });
});

describe('fitContain', () => {
  it('fits the whole picture, as large as it goes, either way round', () => {
    expect(fitContain({ width: 900, height: 1500 }, { width: 400, height: 800 })).toEqual({ width: 400, height: 1500 * (400 / 900) });
    expect(fitContain({ width: 1600, height: 900 }, { width: 400, height: 800 })).toEqual({ width: 400, height: 225 });
    // A tiny image is scaled up to the stage, not left as a dot in the middle of it.
    expect(fitContain({ width: 1, height: 1 }, { width: 390, height: 600 })).toEqual({ width: 390, height: 390 });
    // Not loaded yet: treated as filling the stage.
    expect(fitContain({ width: 0, height: 0 }, { width: 390, height: 600 })).toEqual({ width: 390, height: 600 });
  });
});
