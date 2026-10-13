import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { UiMagnetic } from './magnetic';

@Component({
  imports: [UiMagnetic],
  template: `
    <button id="plain" uiMagnetic [magneticStrength]="0.5">plain</button>
    <button id="wide" uiMagnetic [magneticStrength]="0.5" [magneticRadius]="40">wide</button>
  `,
})
class Host {}

/** jsdom has no PointerEvent; the directive reads clientX/Y and pointerType. */
function pointer(type: string, x: number, y: number): Event {
  const e = new MouseEvent(type, { clientX: x, clientY: y, bubbles: true });
  Object.defineProperty(e, 'pointerType', { value: 'mouse' });
  return e;
}

describe('UiMagnetic', () => {
  const original = window.matchMedia;
  beforeEach(() => {
    window.matchMedia = ((q: string) => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {} })) as unknown as typeof window.matchMedia;
  });
  afterEach(() => { window.matchMedia = original; });

  function setup() {
    const fixture = TestBed.createComponent(Host);
    const el = (id: string) => fixture.nativeElement.querySelector('#' + id) as HTMLElement;
    // A 100 × 40 box at (100, 100).
    for (const id of ['plain', 'wide']) el(id).getBoundingClientRect = () => new DOMRect(100, 100, 100, 40);
    fixture.detectChanges();
    return { fixture, el };
  }

  it('pulls toward the pointer while it is over the element', () => {
    const { el } = setup();
    el('plain').dispatchEvent(pointer('pointerenter', 170, 120));
    el('plain').dispatchEvent(pointer('pointermove', 170, 120));
    expect(el('plain').style.translate).toBe('10px 0px');
    el('plain').dispatchEvent(pointer('pointerleave', 300, 300));
    expect(el('plain').style.translate).toBe('0 0');
  });

  it('starts pulling within magneticRadius of the element, and lets go beyond it', () => {
    const { el } = setup();
    // 30px right of the box: inside the 40px radius.
    window.dispatchEvent(pointer('pointermove', 230, 120));
    expect(el('wide').style.translate).toBe('40px 0px');
    // 60px right: outside.
    window.dispatchEvent(pointer('pointermove', 260, 120));
    expect(el('wide').style.translate).toBe('0 0');
    // The element without a radius ignores pointers that are not over it.
    expect(el('plain').style.translate).toBe('');
  });
});
