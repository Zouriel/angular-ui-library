import { Overlay } from '@angular/cdk/overlay';
import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { UiTooltip } from './tooltip';

/** Stands in for ui-button: a component host that only wraps the control it draws. */
@Component({ selector: 'test-wrapped', template: `<button type="button" class="drawn">Save</button>` })
class Wrapped {}

@Component({
  imports: [UiTooltip, Wrapped],
  template: `
    <test-wrapped id="wrapped" uiTooltip="Saved to cloud" />
    <button id="plain" type="button" uiTooltip="Plain">Plain</button>
  `,
})
class Host {}

describe('uiTooltip anchoring', () => {
  afterEach(() => document.querySelectorAll('.cdk-overlay-container').forEach((c) => (c.innerHTML = '')));

  function setup() {
    const f = TestBed.createComponent(Host);
    document.body.appendChild(f.nativeElement);
    f.detectChanges();
    const position = TestBed.inject(Overlay).position();
    const spy = vi.spyOn(Object.getPrototypeOf(position), 'flexibleConnectedTo');
    return { f, spy };
  }

  it('points at the control a wrapper component draws, not the (possibly stretched) host', () => {
    const { f, spy } = setup();
    const host = (f.nativeElement as HTMLElement).querySelector<HTMLElement>('#wrapped')!;
    host.dispatchEvent(new MouseEvent('mouseenter'));
    f.detectChanges();
    expect(spy).toHaveBeenCalledWith(host.querySelector('button.drawn'));
    expect(document.querySelector('.ui-tooltip')?.textContent).toBe('Saved to cloud');
    spy.mockRestore();
  });

  it('points at a plain element itself', () => {
    const { f, spy } = setup();
    const plain = (f.nativeElement as HTMLElement).querySelector<HTMLElement>('#plain')!;
    plain.dispatchEvent(new MouseEvent('mouseenter'));
    f.detectChanges();
    expect(spy).toHaveBeenCalledWith(plain);
    spy.mockRestore();
  });
});

/** jsdom has no Touch: an Event carrying touch lists of plain objects (what the handlers read). */
function touchEvent(type: string, target: EventTarget, x: number, y: number): Event {
  const t = { identifier: 1, target, clientX: x, clientY: y };
  const e = new Event(type, { bubbles: true, cancelable: true });
  Object.defineProperty(e, 'touches', { value: type === 'touchend' || type === 'touchcancel' ? [] : [t] });
  Object.defineProperty(e, 'changedTouches', { value: [t] });
  return e;
}

describe('uiTooltip long press on touch', () => {
  @Component({
    imports: [UiTooltip],
    template: `<button id="b" type="button" uiTooltip="Opened 3:14 pm" (click)="taps = taps + 1">Send</button>`,
  })
  class TouchHost {
    taps = 0;
  }

  afterEach(() => {
    vi.useRealTimers();
    document.querySelectorAll('.cdk-overlay-container').forEach((c) => (c.innerHTML = ''));
  });

  function setup() {
    vi.useFakeTimers();
    const f = TestBed.createComponent(TouchHost);
    document.body.appendChild(f.nativeElement);
    f.detectChanges();
    const b = (f.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('#b')!;
    const touch = (type: string, x = 10, y = 10) => {
      b.dispatchEvent(touchEvent(type, b, x, y));
    };
    return { f, b, touch };
  }

  it('shows after a 500ms hold, hides after the finger lifts, and the press is not a tap', () => {
    const { f, b, touch } = setup();
    touch('touchstart');
    vi.advanceTimersByTime(499);
    expect(document.querySelector('.ui-tooltip')).toBeNull();
    vi.advanceTimersByTime(2);
    f.detectChanges();
    expect(document.querySelector('.ui-tooltip')?.textContent).toBe('Opened 3:14 pm');
    touch('touchend');
    b.click();
    expect(f.componentInstance.taps).toBe(0);
    vi.advanceTimersByTime(1600);
    expect(document.querySelector('.ui-tooltip')).toBeNull();
    // The next quick tap is a tap again.
    touch('touchstart');
    vi.advanceTimersByTime(100);
    touch('touchend');
    b.click();
    expect(f.componentInstance.taps).toBe(1);
    expect(document.querySelector('.ui-tooltip')).toBeNull();
  });

  it('a finger that moves (a scroll) cancels the long press', () => {
    const { touch } = setup();
    touch('touchstart', 10, 10);
    touch('touchmove', 10, 40);
    vi.advanceTimersByTime(600);
    expect(document.querySelector('.ui-tooltip')).toBeNull();
  });
});
