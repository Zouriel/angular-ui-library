import { ApplicationRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { provideUiConfig } from '@zouriel/ui';
import { UiButton } from '@zouriel/ui/button';
import { UiSpinner } from '@zouriel/ui/spinner';
import { UiLoadingOverlay } from '@zouriel/ui/feedback';
import {
  UI_SHUTTER_A0, UI_SHUTTER_C, UI_SHUTTER_CYCLE, UiShutterLoader,
  uiShutterBladeDistance, uiShutterBlades, uiShutterClosure, uiShutterPulse,
} from './shutter-loader';

/*
 * Reference values come from running the owner-approved demo's own drawing code under node
 * (scratchpad shutter/page.html, variant B: `render(t)`), not from this implementation:
 * blade [x1, y1, x2, y2] for blade 0..5, 4 decimals.
 */
const REF_OPEN = [
  [6.6391, 4.5565, 5.7542, 7.883], [6.2037, 6.1978, 2.8804, 7.0946], [4.5645, 6.6413, 2.1262, 4.2117],
  [3.3609, 5.4435, 4.2458, 2.117], [3.7963, 3.8022, 7.1196, 2.9054], [5.4355, 3.3587, 7.8738, 5.7883],
];
/** t = 0.09 s: the first click fully shut (v = 1, a = 0.1176). */
const REF_SHUT = [
  [5.1666, 4.8312, 4.3536, 7.8872], [5.2295, 5.0599, 2.1765, 5.8838], [5.0629, 5.2287, 2.8228, 2.9967],
  [4.8334, 5.1688, 5.6464, 2.1128], [4.7705, 4.9401, 7.8235, 4.1162], [4.9371, 4.7713, 7.1772, 7.0033],
];
/** t = 0.2 s: opening again (v = 0.0911, a = 1.3468). */
const REF_T02 = [
  [6.5049, 4.5815, 5.6191, 7.9115], [6.1149, 6.0941, 2.7881, 6.9919], [4.61, 6.5126, 2.1691, 4.0804],
  [3.4951, 5.4185, 4.3809, 2.0885], [3.8851, 3.9059, 7.2119, 3.0081], [5.39, 3.4874, 7.8309, 5.9196],
];

const asArrays = (a: number) => uiShutterBlades(a).map((b) => [b.x1, b.y1, b.x2, b.y2]);
/** `digits`: 3 for the maths; 2 for drawn paths, which are written to 3 decimals of the 10-unit box. */
function expectClose(actual: number[][], expected: number[][], digits = 3) {
  expect(actual).toHaveLength(6);
  actual.forEach((row, i) => row.forEach((n, j) => expect(n).toBeCloseTo(expected[i][j], digits)));
}
/** The drawn blades, parsed back from the `d` attributes. */
function drawn(el: HTMLElement): number[][] {
  return [...el.querySelectorAll('path')].map((p) => (p.getAttribute('d') ?? '').match(/-?[\d.]+/g)!.map(Number));
}
/** How close a blade's inner end comes to the centre. */
const innerReach = (b: number[]) => Math.hypot(b[0] - UI_SHUTTER_C, b[1] - UI_SHUTTER_C);

function make(inputs: Record<string, unknown> = {}) {
  const fixture = TestBed.createComponent(UiShutterLoader);
  for (const [k, v] of Object.entries(inputs)) fixture.componentRef.setInput(k, v);
  fixture.detectChanges();
  return { fixture, cmp: fixture.componentInstance, el: fixture.nativeElement as HTMLElement };
}

const originalMatchMedia = window.matchMedia;
function reduceMotion(on: boolean) {
  window.matchMedia = ((q: string) => ({ matches: on && q.includes('reduced-motion'), media: q, addEventListener() {}, removeEventListener() {} })) as unknown as typeof window.matchMedia;
}

afterEach(() => {
  window.matchMedia = originalMatchMedia;
  document.documentElement.classList.remove('ui-no-anim');
});

describe('UiShutterLoader geometry', () => {
  it('draws the open blades exactly as the approved drawing', () => {
    expectClose(asArrays(UI_SHUTTER_A0), REF_OPEN);
  });

  it('shut (v = 1), the blades nearly meet in the centre; open they leave the iris wide', () => {
    const shut = asArrays(uiShutterBladeDistance(1));
    expectClose(shut, REF_SHUT);
    for (const b of shut) expect(innerReach(b)).toBeLessThan(0.3);
    for (const b of asArrays(UI_SHUTTER_A0)) expect(innerReach(b)).toBeGreaterThan(1.4);
  });
});

describe('UiShutterLoader timing', () => {
  // Full motion, whatever matchMedia stub another spec file left on the shared window.
  beforeEach(() => reduceMotion(false));
  it('is shut at 0.09 s, part open at 0.2 s and fully open by 1.5 s', () => {
    expect(uiShutterClosure(0.09)).toBeCloseTo(1, 6);
    expect(uiShutterBladeDistance(uiShutterClosure(0.09))).toBeCloseTo(0.08 * UI_SHUTTER_A0, 6);
    expect(uiShutterClosure(0.2)).toBeCloseTo(0.0911, 3);
    expect(uiShutterClosure(1.5)).toBe(0);
    expect(uiShutterBladeDistance(uiShutterClosure(1.5))).toBe(UI_SHUTTER_A0);
    expect(uiShutterClosure(0)).toBe(0);
  });

  it('clicks three times per 2.1 s loop (under 3 a second) and repeats', () => {
    let shutCount = 0, wasShut = false;
    for (let ms = 0; ms < 2100; ms++) {
      const shut = uiShutterClosure(ms / 1000) > 0.9;
      if (shut && !wasShut) shutCount++;
      wasShut = shut;
    }
    expect(shutCount).toBe(3);
    expect(shutCount / UI_SHUTTER_CYCLE).toBeLessThan(3);
    expect(uiShutterClosure(UI_SHUTTER_CYCLE + 0.09)).toBeCloseTo(1, 6);
    expect(uiShutterClosure(UI_SHUTTER_CYCLE + 0.35 + 0.09)).toBeCloseTo(1, 6);
  });

  it('moves the drawn blades with time', () => {
    const { cmp, el } = make();
    expectClose(drawn(el), REF_OPEN, 2);
    cmp.drawAt(0.09);
    expectClose(drawn(el), REF_SHUT, 2);
    cmp.drawAt(0.2);
    expectClose(drawn(el), REF_T02, 2);
    cmp.drawAt(1.5);
    expectClose(drawn(el), REF_OPEN, 2);
  });
});

describe('UiShutterLoader reduced motion', () => {
  it('keeps the blades still and pulses the opacity instead (prefers-reduced-motion)', () => {
    reduceMotion(true);
    const { cmp, el } = make();
    const mark = el.querySelector('svg > g')!;
    const seen = new Set<string>();
    for (const t of [0, 0.09, 0.2, 0.44, 0.79, 1.05, 1.5, 2.0]) {
      cmp.drawAt(t);
      expectClose(drawn(el), REF_OPEN, 2);
      seen.add(mark.getAttribute('opacity') ?? '1');
    }
    cmp.drawAt(UI_SHUTTER_CYCLE / 2);
    expect(Number(mark.getAttribute('opacity'))).toBeCloseTo(0.55, 3);
    expect(seen.size).toBeGreaterThan(3);
  });

  it('pulses 1 -> 0.55 -> 1 over one loop, never stopping', () => {
    expect(uiShutterPulse(0)).toBeCloseTo(1, 6);
    expect(uiShutterPulse(UI_SHUTTER_CYCLE / 2)).toBeCloseTo(0.55, 6);
    expect(uiShutterPulse(UI_SHUTTER_CYCLE)).toBeCloseTo(1, 6);
    expect(uiShutterPulse(0.5)).toBeLessThan(1);
  });

  it('does the same when the library animations are off', () => {
    document.documentElement.classList.add('ui-no-anim');
    const { cmp, el } = make();
    cmp.drawAt(0.09);
    expectClose(drawn(el), REF_OPEN, 2);
    expect(Number(el.querySelector('svg > g')!.getAttribute('opacity'))).toBeLessThan(1);
  });

  it('with motion allowed, the opacity stays full', () => {
    reduceMotion(false);
    const { cmp, el } = make();
    cmp.drawAt(1.05);
    expect(el.querySelector('svg > g')!.hasAttribute('opacity')).toBe(false);
  });
});

describe('UiShutterLoader API', () => {
  it('is announced like ui-spinner: role status named "Loading…", or its label', () => {
    const { el } = make();
    const status = el.querySelector('[role="status"]')!;
    expect(status.getAttribute('aria-label')).toBe('Loading…');
    expect(make({ label: 'Saving' }).el.querySelector('[role="status"]')!.getAttribute('aria-label')).toBe('Saving');
  });

  it('decorative hides it from screen readers', () => {
    const { el } = make({ decorative: true });
    expect(el.getAttribute('aria-hidden')).toBe('true');
    expect(el.querySelector('[role]')).toBeNull();
    expect(el.querySelector('[aria-label]')).toBeNull();
  });

  it('sizes by name (the spinner boxes) or pixels, and draws in currentColor unless coloured', () => {
    const md = make().el;
    expect(md.style.getPropertyValue('--_shutter-size')).toBe('20px');
    expect(make({ size: 'lg' }).el.style.getPropertyValue('--_shutter-size')).toBe('32px');
    expect(make({ size: 'sm' }).el.style.getPropertyValue('--_shutter-size')).toBe('14px');
    expect(make({ size: 28 }).el.style.getPropertyValue('--_shutter-size')).toBe('28px');
    expect(md.querySelector('svg > g')!.getAttribute('stroke')).toBe('currentColor');
    expect(md.style.color).toBe('');
    expect(make({ color: 'red' }).el.style.color).toBe('red');
  });

  it('draws the ring and six blades with the approved strokes', () => {
    const { el } = make();
    const ring = el.querySelector('circle')!;
    expect([ring.getAttribute('r'), ring.getAttribute('stroke-width')]).toEqual(['3.05', '1.1']);
    expect(el.querySelectorAll('path')).toHaveLength(6);
    expect(el.querySelector('path')!.parentElement!.getAttribute('stroke-width')).toBe('0.75');
    expect(el.querySelector('svg > g')!.getAttribute('stroke-linecap')).toBe('round');
  });
});

describe('spinner: config switch', () => {
  function loadingButton() {
    const f = TestBed.createComponent(UiButton);
    f.componentRef.setInput('loading', true);
    f.detectChanges();
    return f.nativeElement as HTMLElement;
  }

  it("by default ('ring') a loading button, ui-spinner and the loading overlay draw the ring", () => {
    const b = loadingButton();
    expect(b.querySelector('.spin')).not.toBeNull();
    expect(b.querySelector('ui-shutter-loader')).toBeNull();
    const s = TestBed.createComponent(UiSpinner);
    s.detectChanges();
    expect(s.nativeElement.querySelector('.ui-spinner')).not.toBeNull();
    expect(s.nativeElement.querySelector('ui-shutter-loader')).toBeNull();
  });

  it("with spinner: 'shutter' they all draw the shutter, same size and announcement", () => {
    TestBed.configureTestingModule({ providers: [provideUiConfig({ spinner: 'shutter' })] });
    const b = loadingButton();
    const inButton = b.querySelector('ui-shutter-loader')!;
    expect(inButton).not.toBeNull();
    expect(b.querySelector('.spin')).toBeNull();
    expect(inButton.getAttribute('aria-hidden')).toBe('true'); // the button says aria-busy itself

    const s = TestBed.createComponent(UiSpinner);
    s.componentRef.setInput('size', 'lg');
    s.componentRef.setInput('label', 'Fetching');
    s.detectChanges();
    const sh = s.nativeElement.querySelector('ui-shutter-loader') as HTMLElement;
    expect(sh).not.toBeNull();
    expect(s.nativeElement.querySelector('.ui-spinner')).toBeNull();
    expect(sh.style.getPropertyValue('--_shutter-size')).toBe('32px');
    expect(sh.querySelector('[role="status"]')!.getAttribute('aria-label')).toBe('Fetching');

    const o = TestBed.createComponent(UiLoadingOverlay);
    o.componentRef.setInput('loading', true);
    o.detectChanges();
    expect(o.nativeElement.querySelector('ui-shutter-loader')).not.toBeNull();
    expect(o.nativeElement.querySelector('.spin')).toBeNull();
  });
});

describe('UiShutterLoader still / play once', () => {
  const originalRaf = globalThis.requestAnimationFrame;
  const originalCancel = globalThis.cancelAnimationFrame;
  let clock = 1000;
  let nextId = 1;
  let rafCalls = 0;
  let pending = new Map<number, FrameRequestCallback>();

  function step(ms: number) {
    clock += ms;
    const run = [...pending.values()];
    pending.clear();
    for (const cb of run) cb(clock);
  }

  beforeEach(() => {
    reduceMotion(false);
    clock = 1000;
    nextId = 1;
    rafCalls = 0;
    pending = new Map();
    globalThis.requestAnimationFrame = ((cb: FrameRequestCallback) => {
      rafCalls++;
      const id = nextId++;
      pending.set(id, cb);
      return id;
    }) as typeof requestAnimationFrame;
    globalThis.cancelAnimationFrame = ((id: number) => {
      pending.delete(id);
    }) as typeof cancelAnimationFrame;
  });

  afterEach(() => {
    TestBed.resetTestingModule();
    globalThis.requestAnimationFrame = originalRaf;
    globalThis.cancelAnimationFrame = originalCancel;
  });

  it('still renders the rest frame and schedules no animation frames, even under reduced motion', () => {
    const fixture = TestBed.createComponent(UiShutterLoader);
    fixture.componentRef.setInput('still', true);
    rafCalls = 0;
    pending.clear();
    fixture.detectChanges();
    TestBed.inject(ApplicationRef).tick();
    const el = fixture.nativeElement as HTMLElement;
    expect(rafCalls).toBe(0);
    expect(pending.size).toBe(0);
    expectClose(drawn(el), REF_OPEN, 2);
    expect(el.querySelector('svg > g')!.hasAttribute('opacity')).toBe(false);

    reduceMotion(true);
    const fixtureReduced = TestBed.createComponent(UiShutterLoader);
    fixtureReduced.componentRef.setInput('still', true);
    rafCalls = 0;
    pending.clear();
    fixtureReduced.detectChanges();
    TestBed.inject(ApplicationRef).tick();
    const elReduced = fixtureReduced.nativeElement as HTMLElement;
    expect(rafCalls).toBe(0);
    expect(pending.size).toBe(0);
    expectClose(drawn(elReduced), REF_OPEN, 2);
    expect(elReduced.querySelector('svg > g')!.hasAttribute('opacity')).toBe(false);
  });

  it('play() runs one cycle, emits cycleEnd once, returns to rest and stops scheduling frames', () => {
    const { cmp, el } = make({ still: true });
    TestBed.inject(ApplicationRef).tick();
    let ends = 0;
    cmp.cycleEnd.subscribe(() => ends++);
    expect(pending.size).toBe(0);
    const callsBeforePlay = rafCalls;

    cmp.play();
    expect(rafCalls).toBe(callsBeforePlay + 1);
    expect(pending.size).toBe(1);

    step(0); // t = 0
    expectClose(drawn(el), REF_OPEN, 2);
    expect(pending.size).toBe(1);

    step(90); // t = 0.09 s: first click shut
    expectClose(drawn(el), REF_SHUT, 2);
    expect(ends).toBe(0);

    step(1410); // t = 1.5 s: open, resting until 2.1 s
    expectClose(drawn(el), REF_OPEN, 2);
    expect(ends).toBe(0);
    expect(pending.size).toBe(1);

    step(600); // t = 2.1 s: cycle complete
    expect(ends).toBe(1);
    expect(pending.size).toBe(0);
    expectClose(drawn(el), REF_OPEN, 2);
    expect(el.querySelector('svg > g')!.hasAttribute('opacity')).toBe(false);

    const callsAtEnd = rafCalls;
    step(500);
    expect(rafCalls).toBe(callsAtEnd);
    expect(ends).toBe(1);
  });

  it('calling play() during a running one-shot restarts it and emits cycleEnd once', () => {
    const { cmp, el } = make({ still: true });
    TestBed.inject(ApplicationRef).tick();
    let ends = 0;
    cmp.cycleEnd.subscribe(() => ends++);

    cmp.play();
    step(0);
    step(1000); // t = 1.0 s into first play
    expect(ends).toBe(0);

    cmp.play(); // restart
    step(16); // new t = 0
    step(90); // new t = 0.09 s: shut again
    expectClose(drawn(el), REF_SHUT, 2);

    step(1200); // past original 2.1 s end time
    expect(ends).toBe(0);
    expect(pending.size).toBe(1);

    step(810); // new t = 2.1 s
    expect(ends).toBe(1);
    expect(pending.size).toBe(0);
    expectClose(drawn(el), REF_OPEN, 2);
  });

  it('under reduced motion, play() breathes once (1 -> 0.55 -> 1) then stops and emits cycleEnd', () => {
    reduceMotion(true);
    const { cmp, el } = make({ still: true });
    TestBed.inject(ApplicationRef).tick();
    const mark = el.querySelector('svg > g')!;
    let ends = 0;
    cmp.cycleEnd.subscribe(() => ends++);

    cmp.play();
    step(0);
    expectClose(drawn(el), REF_OPEN, 2);
    expect(mark.hasAttribute('opacity')).toBe(false);

    step(1050); // t = 1.05 s: mid-breathe
    expectClose(drawn(el), REF_OPEN, 2);
    expect(Number(mark.getAttribute('opacity'))).toBeCloseTo(0.55, 3);
    expect(ends).toBe(0);

    step(1050); // t = 2.1 s: back to full opacity and stopped
    expect(ends).toBe(1);
    expect(pending.size).toBe(0);
    expectClose(drawn(el), REF_OPEN, 2);
    expect(mark.hasAttribute('opacity')).toBe(false);
  });

  it('default (still = false) still joins the loop and repeats across cycles', () => {
    const { cmp, el } = make();
    TestBed.inject(ApplicationRef).tick();
    let ends = 0;
    cmp.cycleEnd.subscribe(() => ends++);
    expect(pending.size).toBe(1);

    step(0);
    step(2190); // 2.1 s + 0.09 s: second cycle's first click
    expect(pending.size).toBe(1);
    expect(ends).toBe(0);
    expectClose(drawn(el), REF_SHUT, 2);
  });
});
