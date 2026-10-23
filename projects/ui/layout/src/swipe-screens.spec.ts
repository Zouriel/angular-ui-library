import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { UiSwipeScreen, UiSwipeScreens, uiSwipeTarget } from './swipe-screens';

/* 0.44.0: ui-swipe-screens. */

@Component({
  imports: [UiSwipeScreens, UiSwipeScreen],
  template: `<div [attr.dir]="dir()" style="height: 600px">
    <ui-swipe-screens [(index)]="index">
      <ui-swipe-screen label="Chat"><div class="list" style="overflow: auto"><button type="button" class="send" (click)="sends = sends + 1">Send</button></div></ui-swipe-screen>
      <ui-swipe-screen label="Results"><p class="results">Results</p></ui-swipe-screen>
      <ui-swipe-screen label="Map" edgeSwipeOnly><div class="map"><button type="button" class="map-back" (click)="backs = backs + 1">Back</button>Map</div></ui-swipe-screen>
    </ui-swipe-screens>
  </div>`,
})
class Host {
  index = signal(0);
  dir = signal<'ltr' | 'rtl'>('ltr');
  sends = 0;
  backs = 0;
}

const W = 400;

function setup(init?: (h: Host) => void) {
  const f = TestBed.createComponent(Host);
  init?.(f.componentInstance);
  f.detectChanges();
  const root = f.nativeElement as HTMLElement;
  const host = root.querySelector('ui-swipe-screens') as HTMLElement;
  if (f.componentInstance.dir() === 'rtl') host.style.direction = 'rtl';
  host.getBoundingClientRect = () => ({ x: 0, y: 0, left: 0, top: 0, right: W, bottom: 600, width: W, height: 600, toJSON: () => ({}) });
  const track = () => (root.querySelector('.ui-swipe-track') as HTMLElement).style.transform;
  const screens = () => Array.from(root.querySelectorAll('ui-swipe-screen')) as HTMLElement[];
  const live = () => (root.querySelector('.ui-swipe-live') as HTMLElement).textContent!.trim();
  return { f, h: f.componentInstance, root, host, track, screens, live, tick: () => f.detectChanges() };
}

let clock = 1000;
function pointer(el: Element, type: string, x: number, y: number, dt = 16): PointerEvent {
  clock += dt;
  const e = new PointerEvent(type, { bubbles: true, cancelable: true, pointerId: 3, pointerType: 'touch', isPrimary: true, clientX: x, clientY: y, button: 0 });
  Object.defineProperty(e, 'timeStamp', { value: clock });
  el.dispatchEvent(e);
  return e;
}

/** A drag from (x0, y) to (x1, y) in `steps` moves `dt` ms apart, then a release. */
function drag(el: Element, x0: number, x1: number, opts: { y?: number; steps?: number; dt?: number; release?: boolean; tick?: () => void } = {}) {
  const { y = 300, steps = 10, dt = 16, release = true } = opts;
  pointer(el, 'pointerdown', x0, y, 0);
  for (let i = 1; i <= steps; i++) pointer(el, 'pointermove', x0 + ((x1 - x0) * i) / steps, y, dt);
  opts.tick?.();
  if (release) pointer(el, 'pointerup', x1, y, dt);
}

describe('uiSwipeTarget (0.44.0)', () => {
  it('snaps past half the width, or one screen on a fast fling, within range', () => {
    expect(uiSwipeTarget(0, 0.4, 0, 3)).toBe(0);
    expect(uiSwipeTarget(0, 0.6, 0, 3)).toBe(1);
    expect(uiSwipeTarget(1, 0.4, 0, 3)).toBe(0);
    expect(uiSwipeTarget(0, 0.1, 500, 3)).toBe(1);
    expect(uiSwipeTarget(1, 1.2, -500, 3)).toBe(0);
    expect(uiSwipeTarget(0, 0.1, 300, 3)).toBe(0);
    expect(uiSwipeTarget(2, 2, 900, 3)).toBe(2);
    expect(uiSwipeTarget(0, 0, -900, 3)).toBe(0);
    expect(uiSwipeTarget(2, 2.0, 900, 3, true)).toBe(2);
    expect(uiSwipeTarget(2, 1.3, 0, 3, true)).toBe(1);
  });
});

describe('ui-swipe-screens (0.44.0)', () => {
  it('a drag follows the finger and snaps past half the width; a short slow one snaps back', () => {
    const { h, root, track, tick, host } = setup();
    const list = root.querySelector('.list')!;
    expect(track()).toBe('translateX(0%)');
    drag(list, 300, 200, { release: false, dt: 40 });
    tick();
    expect(host.hasAttribute('data-dragging')).toBe(true);
    expect(track()).toBe('translateX(-25%)');
    pointer(list, 'pointerup', 200, 300, 40);
    tick();
    expect(h.index()).toBe(0);
    expect(track()).toBe('translateX(0%)');
    expect(host.hasAttribute('data-dragging')).toBe(false);

    drag(list, 350, 120, { dt: 60 });
    tick();
    expect(h.index()).toBe(1);
    expect(track()).toBe('translateX(-100%)');
  });

  it('a fast short fling moves one screen; at the ends it goes no further', () => {
    const { h, root, tick } = setup();
    drag(root.querySelector('.list')!, 300, 240, { steps: 4, dt: 10 });
    tick();
    expect(h.index()).toBe(1);
    // Back with a fling the other way.
    drag(root.querySelector('.results')!, 100, 160, { steps: 4, dt: 10 });
    tick();
    expect(h.index()).toBe(0);
    // Already at the first screen: a fling towards the start stays.
    drag(root.querySelector('.list')!, 100, 300, { steps: 4, dt: 10 });
    tick();
    expect(h.index()).toBe(0);
  });

  it('leaves a drag that starts on the first screen\'s leading edge to the app (its drawer)', () => {
    const { h, root, track, tick } = setup();
    drag(root.querySelector('.list')!, 10, 390, { tick });
    expect(track()).toBe('translateX(0%)');
    drag(root.querySelector('.list')!, 20, -300, { tick });
    tick();
    expect(h.index()).toBe(0);
    // Just past the strip: taken.
    drag(root.querySelector('.list')!, 30, -300);
    tick();
    expect(h.index()).toBe(1);
  });

  it('leaves vertical drags to the content (a list scrolls)', () => {
    const { h, root, track, tick } = setup();
    const list = root.querySelector('.list')!;
    pointer(list, 'pointerdown', 300, 300);
    pointer(list, 'pointermove', 296, 330);
    // Once decided vertical, a later sideways move is not taken either.
    const late = pointer(list, 'pointermove', 100, 340);
    pointer(list, 'pointerup', 100, 340);
    tick();
    expect(late.defaultPrevented).toBe(false);
    expect(track()).toBe('translateX(0%)');
    expect(h.index()).toBe(0);
    // Diagonal, more vertical than horizontal: not taken.
    pointer(list, 'pointerdown', 300, 300);
    pointer(list, 'pointermove', 280, 325);
    pointer(list, 'pointermove', 100, 340);
    pointer(list, 'pointerup', 100, 340);
    tick();
    expect(h.index()).toBe(0);
  });

  it('an edgeSwipeOnly screen keeps its drags; only its leading-edge strip swipes back, never forward', () => {
    const { h, root, tick } = setup((x) => x.index.set(2));
    const map = root.querySelector('.map')!;
    drag(map, 200, 390);
    tick();
    expect(h.index()).toBe(2);
    const strips = root.querySelectorAll('[data-swipe-edge]');
    expect(strips.length).toBe(1);
    const strip = strips[0] as HTMLElement;
    expect(strip.closest('ui-swipe-screen')!.getAttribute('aria-label')).toBe('Map');
    expect(strip.style.width).toBe('24px');
    expect(strip.getAttribute('aria-hidden')).toBe('true');
    // Pushed towards the next screen: nothing.
    drag(strip, 10, -200);
    tick();
    expect(h.index()).toBe(2);
    drag(strip, 10, 300);
    tick();
    expect(h.index()).toBe(1);
  });

  it('mirrors in RTL: the next screen is to the left, and the leading edge is the right', () => {
    const { h, root, track, tick } = setup((x) => x.dir.set('rtl'));
    const list = root.querySelector('.list')!;
    drag(list, 395, 0, { tick });
    expect(h.index()).toBe(0);
    drag(list, 100, 200, { release: false, dt: 40 });
    tick();
    expect(track()).toBe('translateX(25%)');
    pointer(list, 'pointerup', 200, 300, 40);
    drag(list, 100, 350, { dt: 60 });
    tick();
    expect(h.index()).toBe(1);
    expect(track()).toBe('translateX(100%)');
  });

  it('setting index moves there; screens out of view are inert and hidden, and the new one is announced', () => {
    const { h, track, screens, live, tick, root } = setup();
    tick();
    expect(live()).toBe('');
    expect(screens().map((s) => s.hasAttribute('inert'))).toEqual([false, true, true]);
    expect(screens().map((s) => s.getAttribute('aria-hidden'))).toEqual([null, 'true', 'true']);
    expect(screens().map((s) => s.getAttribute('aria-label'))).toEqual(['Chat', 'Results', 'Map']);
    h.index.set(2);
    tick();
    expect(track()).toBe('translateX(-200%)');
    expect(screens().map((s) => s.hasAttribute('inert'))).toEqual([true, true, false]);
    expect(live()).toBe('Map');
    // Every screen stays in the DOM (alive).
    expect(root.querySelector('.send')).toBeTruthy();

    // While dragging, the screen coming in is shown.
    h.index.set(0);
    tick();
    drag(root.querySelector('.list')!, 300, 200, { release: false });
    tick();
    expect(screens().map((s) => s.hasAttribute('inert'))).toEqual([false, false, true]);
    pointer(root.querySelector('.list')!, 'pointerup', 200, 300, 400);
    tick();
    expect(screens().map((s) => s.hasAttribute('inert'))).toEqual([false, true, true]);
    expect(live()).toBe('Chat');
  });

  it('a swipe that started on a button does not click it; the next tap does', () => {
    const { h, root, tick } = setup();
    const send = root.querySelector('.send') as HTMLElement;
    drag(send, 300, 250, { dt: 200 });
    send.click();
    tick();
    expect(h.sends).toBe(0);
    pointer(send, 'pointerdown', 300, 300);
    pointer(send, 'pointerup', 300, 300);
    send.click();
    expect(h.sends).toBe(1);
  });

  it('a tap on the back-swipe strip reaches what is under it (the screen\'s Back arrow); a swipe from it clicks nothing', () => {
    const { h, root, tick } = setup((x) => x.index.set(2));
    const strip = root.querySelector('[data-swipe-edge]') as HTMLElement;
    const back = root.querySelector('.map-back') as HTMLElement;
    const map = root.querySelector('.map') as HTMLElement;
    const screen = strip.closest('ui-swipe-screen') as HTMLElement;
    const doc = document as Document & { elementsFromPoint?: (x: number, y: number) => Element[] };
    const was = doc.elementsFromPoint;
    // jsdom has no layout: the strip, then the Back arrow under it, is what a real page reports at (10, 20).
    doc.elementsFromPoint = () => [strip, back, map, screen, document.body];
    const click = () => strip.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, clientX: 10, clientY: 20 }));
    try {
      pointer(strip, 'pointerdown', 10, 20);
      pointer(strip, 'pointerup', 10, 20);
      click();
      tick();
      expect(h.backs).toBe(1);
      expect(h.index(), 'a tap is not a swipe').toBe(2);

      drag(strip, 10, 300, { y: 20 });
      click();
      tick();
      expect(h.index()).toBe(1);
      expect(h.backs, 'the click a swipe causes is swallowed, not passed through').toBe(1);
    } finally {
      doc.elementsFromPoint = was;
    }
  });
});
