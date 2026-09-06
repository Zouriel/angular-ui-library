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
 * <p>The finger is driven with TOUCH events, because that is what a browser sends for a swipe. It
 * withholds pointer events until it knows the touch is not a gesture, so a swipe produces touch
 * events only — see the note on {@link UiSwipe}. Driving these tests with pointer events would pass
 * happily and prove nothing about a phone, which is exactly how the first version shipped broken.</p>
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
      [uiSwipeMouse]="withMouse()"
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
  readonly withMouse = signal(false);
  readonly went: string[] = [];
}

describe('UiSwipe', () => {
  let fixture: ComponentFixture<Host>;
  let host: Host;

  function el(id: string): HTMLElement {
    return fixture.nativeElement.querySelector(`#${id}`) as HTMLElement;
  }

  /** jsdom has no TouchEvent, so one is assembled with the three fields the directive reads. */
  function touch(
    type: string,
    points: { id?: number; x: number; y: number }[],
    time: number,
  ): Event {
    const event = new Event(type, { bubbles: true });
    const list = points.map((p) => ({ identifier: p.id ?? 1, clientX: p.x, clientY: p.y }));
    Object.defineProperty(event, 'touches', { value: type === 'touchend' ? [] : list });
    Object.defineProperty(event, 'changedTouches', { value: list });
    Object.defineProperty(event, 'timeStamp', { value: time });
    return event;
  }

  function pointer(type: string, init: PointerEventInit, time: number): PointerEvent {
    const event = new PointerEvent(type, { bubbles: true, ...init });
    Object.defineProperty(event, 'timeStamp', { value: time });
    return event;
  }

  /** One finger down, across and up, starting well clear of both screen edges. */
  function drag(dx: number, { dy = 0, ms = 400, from = 'plain', x = 200 } = {}): void {
    const target = el(from);
    target.dispatchEvent(touch('touchstart', [{ x, y: 200 }], 0));
    target.dispatchEvent(touch('touchmove', [{ x: x + dx, y: 200 + dy }], ms));
    target.dispatchEvent(touch('touchend', [{ x: x + dx, y: 200 + dy }], ms));
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

  /**
   * The exact stream a browser delivers for a swipe: touch events, and no pointer event of any kind.
   * A directive built on pointer events hears nothing at all here — which is the bug this fixes.
   */
  it('answers the touch-only stream a real swipe arrives as', () => {
    const target = el('plain');
    target.dispatchEvent(touch('touchstart', [{ x: 300, y: 500 }], 0));
    [284, 268, 253, 237, 221, 205, 189, 173, 158, 142, 126].forEach((x, i) => {
      target.dispatchEvent(touch('touchmove', [{ x, y: 500 - i * 2 }], 17 * (i + 1)));
    });
    target.dispatchEvent(touch('touchend', [{ x: 110, y: 480 }], 240));
    fixture.detectChanges();
    expect(host.went).toEqual(['left']);
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
    drag(200, { x: 8 });
    expect(host.went).toEqual([]);
  });

  it('does not fire on a pinch', () => {
    const target = el('plain');
    target.dispatchEvent(touch('touchstart', [{ id: 1, x: 180, y: 200 }], 0));
    target.dispatchEvent(
      touch('touchstart', [{ id: 1, x: 180, y: 200 }, { id: 2, x: 220, y: 200 }], 10),
    );
    target.dispatchEvent(
      touch('touchmove', [{ id: 1, x: 80, y: 200 }, { id: 2, x: 320, y: 200 }], 300),
    );
    fixture.detectChanges();
    expect(host.went).toEqual([]);
  });

  it('answers while the finger is still down, without waiting for it to lift', () => {
    const target = el('plain');
    target.dispatchEvent(touch('touchstart', [{ x: 200, y: 200 }], 0));
    target.dispatchEvent(touch('touchmove', [{ x: 100, y: 200 }], 200));
    fixture.detectChanges();
    expect(host.went).toEqual(['left']);
  });

  it('answers a gesture only once, however far it carries on', () => {
    const target = el('plain');
    target.dispatchEvent(touch('touchstart', [{ x: 300, y: 200 }], 0));
    for (const x of [240, 180, 120, 60]) {
      target.dispatchEvent(touch('touchmove', [{ x, y: 200 }], 200));
    }
    target.dispatchEvent(touch('touchend', [{ x: 60, y: 200 }], 300));
    fixture.detectChanges();
    expect(host.went).toEqual(['left']);
  });

  /** A system gesture can still take the touch away; what travelled first is evidence enough. */
  it('still answers a swipe the browser took the touch away from', () => {
    const target = el('plain');
    target.dispatchEvent(touch('touchstart', [{ x: 200, y: 200 }], 0));
    target.dispatchEvent(touch('touchmove', [{ x: 130, y: 212 }], 150));
    target.dispatchEvent(touch('touchcancel', [{ x: 130, y: 212 }], 160));
    fixture.detectChanges();
    expect(host.went).toEqual(['left']);
  });

  it('lets a scroll that was taken away stay a scroll', () => {
    const target = el('plain');
    target.dispatchEvent(touch('touchstart', [{ x: 200, y: 200 }], 0));
    target.dispatchEvent(touch('touchmove', [{ x: 175, y: 320 }], 150));
    target.dispatchEvent(touch('touchcancel', [{ x: 175, y: 320 }], 160));
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

  it('stays quiet while disabled', () => {
    host.off.set(true);
    fixture.detectChanges();
    drag(-80);
    expect(host.went).toEqual([]);
  });

  describe('the mouse and the pen', () => {
    function mouseDrag(dx: number, type = 'mouse'): void {
      const target = el('plain');
      target.dispatchEvent(
        pointer('pointerdown', { pointerId: 9, pointerType: type, clientX: 200, clientY: 200 }, 0),
      );
      target.dispatchEvent(
        pointer('pointermove', { pointerId: 9, pointerType: type, clientX: 200 + dx, clientY: 200 }, 300),
      );
      fixture.detectChanges();
    }

    it('ignores the mouse unless asked', () => {
      mouseDrag(-80);
      expect(host.went).toEqual([]);
    });

    it('reads a mouse drag once asked, since no arbitration applies to it', () => {
      host.withMouse.set(true);
      fixture.detectChanges();
      mouseDrag(-80);
      expect(host.went).toEqual(['left']);
    });

    it('reads a pen drag, which is never withheld either', () => {
      mouseDrag(-80, 'pen');
      expect(host.went).toEqual(['left']);
    });

    /**
     * A browser that sends both models for one finger must not be read as two drags — and the
     * pointer half arrives with `pointerType: 'touch'`, so it is dropped on sight.
     */
    it('does not double-count a browser that sends pointer events for touch as well', () => {
      const target = el('plain');
      target.dispatchEvent(touch('touchstart', [{ x: 200, y: 200 }], 0));
      target.dispatchEvent(
        pointer('pointerdown', { pointerId: 1, pointerType: 'touch', clientX: 200, clientY: 200 }, 0),
      );
      target.dispatchEvent(touch('touchmove', [{ x: 100, y: 200 }], 200));
      target.dispatchEvent(
        pointer('pointermove', { pointerId: 1, pointerType: 'touch', clientX: 100, clientY: 200 }, 200),
      );
      fixture.detectChanges();
      expect(host.went).toEqual(['left']);
    });
  });
});
