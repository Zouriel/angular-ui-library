import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { UiSwipe } from './swipe';

/**
 * What the directive refuses is most of what it does.
 *
 * <p>It sits on a whole page, over everything else that page wants to do with a finger, and it never
 * calls `preventDefault` — so almost every test here is about a gesture NOT being read as a swipe.
 * A page that navigates while you were scrolling a table sideways is far worse than one that makes
 * you reach for the bar.</p>
 *
 * <p>jsdom gives every element a width of 0, so the distance threshold falls back to its floor of
 * 32px — the same branch a genuinely narrow phone takes.</p>
 */
@Component({
  imports: [UiSwipe],
  template: `
    <div
      uiSwipe
      [uiSwipeDisabled]="off()"
      (uiSwipeLeft)="went.push('left')"
      (uiSwipeRight)="went.push('right')"
      style="width: 400px"
    >
      <p id="plain">anywhere</p>
      <input id="field" />
      <div id="strip" style="overflow-x: auto"><span id="wide">wide</span></div>
      <div id="opted-out" data-no-swipe><span id="inside">no</span></div>
    </div>
  `,
})
class Host {
  readonly off = signal(false);
  readonly went: string[] = [];
}

describe('UiSwipe', () => {
  let fixture: ComponentFixture<Host>;
  let host: Host;

  function at(type: string, init: PointerEventInit, time: number): PointerEvent {
    const event = new PointerEvent(type, { bubbles: true, ...init });
    Object.defineProperty(event, 'timeStamp', { value: time });
    return event;
  }

  function el(id: string): HTMLElement {
    return fixture.nativeElement.querySelector(`#${id}`) as HTMLElement;
  }

  /** One finger down, across and up, starting well clear of both screen edges. */
  function drag(
    dx: number,
    { dy = 0, ms = 400, from = 'plain', type = 'touch', pointerId = 1 } = {},
  ): void {
    const target = el(from);
    const x = 200;
    target.dispatchEvent(
      at('pointerdown', { pointerId, pointerType: type, clientX: x, clientY: 200 }, 0),
    );
    target.dispatchEvent(
      at('pointermove', { pointerId, pointerType: type, clientX: x + dx, clientY: 200 + dy }, ms),
    );
    target.dispatchEvent(
      at('pointerup', { pointerId, pointerType: type, clientX: x + dx, clientY: 200 + dy }, ms),
    );
    fixture.detectChanges();
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [Host] }).compileComponents();
    fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    host = fixture.componentInstance;

    // jsdom does not lay anything out, so the strip has to be told it overflows.
    Object.defineProperty(el('strip'), 'scrollWidth', { value: 900, configurable: true });
    Object.defineProperty(el('strip'), 'clientWidth', { value: 300, configurable: true });
  });

  it('reads a drag across the page as a swipe, in the direction it travelled', () => {
    drag(-80);
    expect(host.went).toEqual(['left']);
    drag(80);
    expect(host.went).toEqual(['left', 'right']);
  });

  it('takes a short flick as well as a long drag', () => {
    drag(-28, { ms: 40 });
    expect(host.went).toEqual(['left']);
  });

  it('ignores a drag that went nowhere', () => {
    drag(-12, { ms: 400 });
    expect(host.went).toEqual([]);
  });

  it('ignores a drag that was mostly down the screen', () => {
    drag(-80, { dy: 120 });
    expect(host.went).toEqual([]);
  });

  it('leaves the screen edges to the browser, which navigates there itself', () => {
    const target = el('plain');
    target.dispatchEvent(at('pointerdown', { pointerId: 1, pointerType: 'touch', clientX: 8, clientY: 200 }, 0));
    target.dispatchEvent(at('pointerup', { pointerId: 1, pointerType: 'touch', clientX: 208, clientY: 200 }, 300));
    fixture.detectChanges();
    expect(host.went).toEqual([]);
  });

  it('does not fire on a pinch', () => {
    const target = el('plain');
    target.dispatchEvent(at('pointerdown', { pointerId: 1, pointerType: 'touch', clientX: 180, clientY: 200 }, 0));
    target.dispatchEvent(at('pointerdown', { pointerId: 2, pointerType: 'touch', clientX: 220, clientY: 200 }, 10));
    target.dispatchEvent(at('pointermove', { pointerId: 1, pointerType: 'touch', clientX: 80, clientY: 200 }, 300));
    target.dispatchEvent(at('pointermove', { pointerId: 2, pointerType: 'touch', clientX: 320, clientY: 200 }, 300));
    target.dispatchEvent(at('pointerup', { pointerId: 1, pointerType: 'touch', clientX: 80, clientY: 200 }, 300));
    target.dispatchEvent(at('pointerup', { pointerId: 2, pointerType: 'touch', clientX: 320, clientY: 200 }, 300));
    fixture.detectChanges();
    expect(host.went).toEqual([]);
  });

  it('answers while the finger is still down, without waiting for it to lift', () => {
    const target = el('plain');
    target.dispatchEvent(at('pointerdown', { pointerId: 1, pointerType: 'touch', clientX: 200, clientY: 200 }, 0));
    target.dispatchEvent(at('pointermove', { pointerId: 1, pointerType: 'touch', clientX: 100, clientY: 200 }, 200));
    fixture.detectChanges();
    expect(host.went).toEqual(['left']);
  });

  it('answers a gesture only once, however far it carries on', () => {
    const target = el('plain');
    target.dispatchEvent(at('pointerdown', { pointerId: 1, pointerType: 'touch', clientX: 300, clientY: 200 }, 0));
    for (const x of [240, 180, 120, 60]) {
      target.dispatchEvent(at('pointermove', { pointerId: 1, pointerType: 'touch', clientX: x, clientY: 200 }, 200));
    }
    target.dispatchEvent(at('pointerup', { pointerId: 1, pointerType: 'touch', clientX: 60, clientY: 200 }, 300));
    fixture.detectChanges();
    expect(host.went).toEqual(['left']);
  });

  /**
   * The case a phone actually produces. A real swipe drifts vertically, the page scrolls that pixel,
   * and the browser takes the pointer — so a directive that waits for the release waits forever.
   */
  it('still answers a swipe the browser took the pointer away from', () => {
    const target = el('plain');
    target.dispatchEvent(at('pointerdown', { pointerId: 1, pointerType: 'touch', clientX: 200, clientY: 200 }, 0));
    target.dispatchEvent(at('pointermove', { pointerId: 1, pointerType: 'touch', clientX: 130, clientY: 212 }, 150));
    target.dispatchEvent(at('pointercancel', { pointerId: 1, pointerType: 'touch' }, 160));
    fixture.detectChanges();
    expect(host.went).toEqual(['left']);
  });

  it('lets a scroll that was taken away stay a scroll', () => {
    const target = el('plain');
    target.dispatchEvent(at('pointerdown', { pointerId: 1, pointerType: 'touch', clientX: 200, clientY: 200 }, 0));
    target.dispatchEvent(at('pointermove', { pointerId: 1, pointerType: 'touch', clientX: 175, clientY: 320 }, 150));
    target.dispatchEvent(at('pointercancel', { pointerId: 1, pointerType: 'touch' }, 160));
    fixture.detectChanges();
    expect(host.went).toEqual([]);
  });

  it('leaves a sideways-scrolling strip its own drag', () => {
    drag(-80, { from: 'wide' });
    expect(host.went).toEqual([]);
  });

  it('leaves a field its own drag', () => {
    drag(-80, { from: 'field' });
    expect(host.went).toEqual([]);
  });

  it('honours data-no-swipe on anything above the finger', () => {
    drag(-80, { from: 'inside' });
    expect(host.went).toEqual([]);
  });

  it('ignores the mouse unless asked', () => {
    drag(-80, { type: 'mouse' });
    expect(host.went).toEqual([]);
  });

  it('stays quiet while disabled', () => {
    host.off.set(true);
    fixture.detectChanges();
    drag(-80);
    expect(host.went).toEqual([]);
  });
});
