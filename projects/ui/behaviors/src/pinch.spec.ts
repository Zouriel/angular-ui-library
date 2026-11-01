import { Component, PLATFORM_ID, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { UiPinch } from './pinch';
import { UiSwipe } from './swipe';

/**
 * The fingers are driven with the touch streams a browser sends, including `touches` listing every
 * finger on the screen and `touchend` no longer listing the one that lifted. jsdom honours passive
 * listeners, so `defaultPrevented` also proves the move listener is non-passive.
 */
@Component({
  imports: [UiPinch, UiSwipe],
  template: `
    <div id="outside"></div>
    <div uiSwipe (uiSwipeLeft)="went.push('swipe')">
      <div
        id="host"
        uiPinch
        [uiPinchDisabled]="off()"
        (uiPinchIn)="went.push('in')"
        (uiPinchOut)="went.push('out')"
      >
        <p id="a">a</p>
        <p id="b">b</p>
      </div>
    </div>
  `,
})
class Host {
  readonly off = signal(false);
  readonly went: string[] = [];
}

/** A finger: its id, where it landed and its horizontal position. */
interface Finger {
  id: number;
  target: Element;
  x: number;
}

describe('UiPinch', () => {
  let fixture: ComponentFixture<Host>;
  let host: Host;
  let on: Finger[];

  const el = (id: string) => fixture.nativeElement.querySelector(`#${id}`) as HTMLElement;
  const shape = (f: Finger) => ({ identifier: f.id, target: f.target, clientX: f.x, clientY: 300 });

  function fire(target: Element, type: string, changed: Finger[]): Event {
    const event = new Event(type, { bubbles: true, cancelable: true });
    Object.defineProperty(event, 'touches', { value: on.map(shape) });
    Object.defineProperty(event, 'changedTouches', { value: changed.map(shape) });
    Object.defineProperty(event, 'timeStamp', { value: 1000 });
    target.dispatchEvent(event);
    return event;
  }

  function down(id: number, x: number, target: Element = el(id % 2 ? 'a' : 'b')): Finger {
    const finger = { id, target, x };
    on.push(finger);
    fire(target, 'touchstart', [finger]);
    return finger;
  }

  function move(finger: Finger, x: number): Event {
    finger.x = x;
    return fire(finger.target, 'touchmove', [finger]);
  }

  function up(finger: Finger, type = 'touchend'): void {
    on = on.filter((f) => f !== finger);
    fire(finger.target, type, [finger]);
  }

  /** Two fingers 100px apart, so a position on the second reads as the distance. */
  function pinch(): [Finger, Finger] {
    return [down(1, 0), down(2, 100)];
  }

  beforeEach(async () => {
    on = [];
    await TestBed.configureTestingModule({ imports: [Host] }).compileComponents();
    fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    host = fixture.componentInstance;
  });

  it('steps out at exactly 1.25x the baseline, and not before', () => {
    const [, b] = pinch();
    move(b, 124);
    expect(host.went).toEqual([]);
    move(b, 125);
    expect(host.went).toEqual(['out']);
  });

  it('steps in at exactly 0.8x the baseline, and not before', () => {
    const [, b] = pinch();
    move(b, 81);
    expect(host.went).toEqual([]);
    move(b, 80);
    expect(host.went).toEqual(['in']);
  });

  it('measures diagonally, not along one axis', () => {
    const [a, b] = pinch();
    // 100 apart in x and 100 in y is about 141 apart: one step, though x alone has not changed.
    const diagonal = new Event('touchmove', { bubbles: true, cancelable: true });
    const touches = [
      { identifier: a.id, target: a.target, clientX: 0, clientY: 300 },
      { identifier: b.id, target: b.target, clientX: 100, clientY: 400 },
    ];
    Object.defineProperty(diagonal, 'touches', { value: touches });
    Object.defineProperty(diagonal, 'changedTouches', { value: [touches[1]] });
    b.target.dispatchEvent(diagonal);
    expect(host.went).toEqual(['out']);
  });

  it('takes several steps in one long pinch, each from the last', () => {
    const [, b] = pinch();
    move(b, 125); // baseline 125
    move(b, 150); // 1.2x: not yet
    expect(host.went).toEqual(['out']);
    move(b, 157); // 1.256x
    expect(host.went).toEqual(['out', 'out']);
    move(b, 126); // 0.803x of 157: not yet
    expect(host.went).toEqual(['out', 'out']);
    move(b, 125); // 0.796x
    expect(host.went).toEqual(['out', 'out', 'in']);
  });

  it('fires once for one big jump, and stays quiet until the fingers move on from it', () => {
    const [, b] = pinch();
    move(b, 400);
    move(b, 400);
    expect(host.went).toEqual(['out']);
  });

  it('ignores a third finger, however far it goes', () => {
    const [, b] = pinch();
    const c = down(3, 110);
    move(c, 900);
    move(c, 1);
    expect(host.went).toEqual([]);
    move(b, 125);
    expect(host.went).toEqual(['out']);
  });

  it('carries on from a fresh baseline when one of the two lifts and a third remains', () => {
    const [a] = pinch();
    const c = down(3, 400);
    const before = host.went.length;
    up(a); // the pair is now 2 and 3: 300 apart, which is no step from the old 100
    expect(host.went.length).toBe(before);
    move(c, 474); // 374 of 300: not yet
    expect(host.went).toEqual([]);
    move(c, 475); // 375
    expect(host.went).toEqual(['out']);
  });

  it('resets when fewer than two fingers remain', () => {
    const [a, b] = pinch();
    up(b);
    const moved = move(a, 900);
    expect(host.went).toEqual([]);
    expect(moved.defaultPrevented).toBe(false);
    // The next pinch measures from its own landing, not from the first one's 100.
    const d = down(4, 900 + 400);
    move(d, 900 + 480);
    expect(host.went).toEqual([]);
    move(d, 900 + 500);
    expect(host.went).toEqual(['out']);
  });

  it('a cancelled touch ends the pinch too', () => {
    const [a, b] = pinch();
    up(b, 'touchcancel');
    expect(move(a, 900).defaultPrevented).toBe(false);
    expect(host.went).toEqual([]);
  });

  it('cancels the move while two fingers are down, so the page does not zoom', () => {
    const [, b] = pinch();
    expect(move(b, 101).defaultPrevented).toBe(true);
  });

  it('leaves a move the browser will not let it cancel alone', () => {
    const [, b] = pinch();
    b.x = 125;
    const event = new Event('touchmove', { bubbles: true, cancelable: false });
    const touches = on.map(shape);
    Object.defineProperty(event, 'touches', { value: touches });
    Object.defineProperty(event, 'changedTouches', { value: [shape(b)] });
    b.target.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(false);
    expect(host.went).toEqual(['out']);
  });

  it('never cancels one finger, so the page scrolls and an enclosing uiSwipe still works', () => {
    const a = down(1, 300);
    expect(move(a, 280).defaultPrevented).toBe(false);
    move(a, 180);
    expect(host.went).toEqual(['swipe']);
  });

  it('does not count a finger elsewhere on the screen', () => {
    const elsewhere = { id: 9, target: el('outside'), x: 500 };
    on.push(elsewhere);
    fire(elsewhere.target, 'touchstart', [elsewhere]);
    const a = down(1, 300);
    expect(move(a, 290).defaultPrevented).toBe(false);
    move(a, 10);
    expect(host.went.filter((w) => w !== 'swipe')).toEqual([]);
  });

  it('counts two fingers that landed on different children of the host', () => {
    const a = down(1, 0, el('a'));
    const b = down(2, 100, el('b'));
    expect(a.target).not.toBe(b.target);
    expect(move(b, 125).defaultPrevented).toBe(true);
    expect(host.went).toEqual(['out']);
  });

  it('does not count a touch reported with this one that landed outside the host', () => {
    const a = down(1, 0);
    const elsewhere = { id: 9, target: el('outside'), x: 500 };
    on.push(elsewhere);
    fire(a.target, 'touchstart', [elsewhere]);
    expect(move(a, 10).defaultPrevented).toBe(false);
  });

  it('counts two fingers on the host element itself', () => {
    down(1, 0, el('host'));
    const b = down(2, 100, el('host'));
    expect(move(b, 125).defaultPrevented).toBe(true);
    expect(host.went).toEqual(['out']);
  });

  it('keeps following a finger whose element left the document, as a re-rendered grid does', () => {
    const [a, b] = pinch();
    move(b, 125);
    const stranded = a.target;
    stranded.remove();
    b.target.remove();
    // Removed elements' events no longer reach the host: only their own listeners hear them.
    expect(move(b, 157).defaultPrevented).toBe(true);
    expect(host.went).toEqual(['out', 'out']);
    up(b);
    expect(move(a, 900).defaultPrevented).toBe(false);
    expect(host.went).toEqual(['out', 'out']);
  });

  it('forgets a finger whose end never arrived', () => {
    pinch();
    // Both fingers lifted unseen; the identifiers come back for a new pinch elsewhere on the host.
    on = [];
    down(5, 0);
    const other = down(6, 200);
    move(other, 249);
    expect(host.went).toEqual([]);
    move(other, 250);
    expect(host.went).toEqual(['out']);
  });

  it('does nothing while disabled, and lets go of a pinch it is disabled during', () => {
    host.off.set(true);
    fixture.detectChanges();
    const [, b] = pinch();
    expect(move(b, 300).defaultPrevented).toBe(false);
    expect(host.went).toEqual([]);

    up(b);
    host.off.set(false);
    fixture.detectChanges();
    on = [];
    const [, d] = pinch();
    move(d, 125);
    expect(host.went).toEqual(['out']);
    host.off.set(true);
    fixture.detectChanges();
    expect(move(d, 900).defaultPrevented).toBe(false);
    expect(host.went).toEqual(['out']);
  });

  it('stops listening once destroyed', () => {
    const [, b] = pinch();
    fixture.destroy();
    const moved = move(b, 300);
    expect(moved.defaultPrevented).toBe(false);
    expect(host.went).toEqual([]);
  });
});

describe('UiPinch on the server', () => {
  it('adds no listeners and does not touch the element', async () => {
    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [Host],
      providers: [{ provide: PLATFORM_ID, useValue: 'server' }],
    }).compileComponents();
    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    const target = fixture.nativeElement.querySelector('#host') as HTMLElement;
    const touches = [
      { identifier: 1, target, clientX: 0, clientY: 0 },
      { identifier: 2, target, clientX: 100, clientY: 0 },
    ];
    for (const type of ['touchstart', 'touchmove']) {
      const event = new Event(type, { bubbles: true, cancelable: true });
      Object.defineProperty(event, 'touches', { value: touches });
      Object.defineProperty(event, 'changedTouches', { value: touches });
      target.dispatchEvent(event);
      expect(event.defaultPrevented).toBe(false);
    }
    expect(fixture.componentInstance.went).toEqual([]);
  });
});
