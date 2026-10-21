import { Component, computed, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { UiBottomSheet } from './bottom-sheet';

/*
 * 0.40.0: the sheet stays put while someone types in it on a phone. A 390x844 touch screen, a field in
 * the sheet, the on-screen keyboard simulated through the visual viewport (and the window, for
 * `interactive-widget=resizes-content`), and the browser's own scrolling while typing.
 */

/** A stand-in for window.visualViewport that the test moves the way a phone browser does. */
class FakeViewport extends EventTarget {
  width = 390;
  height = 844;
  offsetTop = 0;
  offsetLeft = 0;
  scale = 1;
}

let vv: FakeViewport;
const original = { matchMedia: window.matchMedia, innerHeight: window.innerHeight, innerWidth: window.innerWidth };
const vvDescriptor = Object.getOwnPropertyDescriptor(window, 'visualViewport');

function setInner(h: number) {
  Object.defineProperty(window, 'innerHeight', { configurable: true, writable: true, value: h });
}

beforeEach(() => {
  vv = new FakeViewport();
  Object.defineProperty(window, 'visualViewport', { configurable: true, value: vv });
  Object.defineProperty(window, 'innerWidth', { configurable: true, writable: true, value: 390 });
  setInner(844);
  // A touch screen.
  window.matchMedia = ((q: string) => ({ matches: q.includes('coarse'), media: q, addEventListener() {}, removeEventListener() {} })) as unknown as typeof window.matchMedia;
});
afterEach(() => {
  window.matchMedia = original.matchMedia;
  setInner(original.innerHeight);
  Object.defineProperty(window, 'innerWidth', { configurable: true, writable: true, value: original.innerWidth });
  if (vvDescriptor) Object.defineProperty(window, 'visualViewport', vvDescriptor);
  else delete (window as unknown as { visualViewport?: unknown }).visualViewport;
});

/** Snaps sized to the window, the way Dhirumi's Find a nurse screen does: the peek must show 320px of content. */
function viewportSnaps(viewHeight: number): number[] {
  const room = Math.max(1, viewHeight - 56);
  const peek = Math.min(1, Math.max(0.2, 320 / room));
  const out: number[] = [];
  for (const s of [Math.round(Math.max(0.3, peek) * 100) / 100, 0.55, 1]) if (!out.length || s > out[out.length - 1]) out.push(s);
  return out;
}

@Component({
  imports: [UiBottomSheet],
  template: `
    <ui-bottom-sheet [snaps]="snaps()" [(snap)]="snap" title="Where should the nurse come?" [closable]="false" [topInset]="56"
      (snapChange)="snapLog.push($event)" (coverChange)="covers.push($event)">
      <input id="island" aria-label="Island" />
      <input id="building" aria-label="Building" />
    </ui-bottom-sheet>`,
})
class AppHost {
  viewHeight = signal(844);
  fixedSnaps = signal<number[] | null>(null);
  snaps = computed(() => this.fixedSnaps() ?? viewportSnaps(this.viewHeight()));
  snap = signal(1);
  snapLog: number[] = [];
  covers: number[] = [];
  constructor() {
    addEventListener('resize', () => this.viewHeight.set(innerHeight));
  }
}

async function setup(fixed?: number[]) {
  const f = TestBed.createComponent(AppHost);
  if (fixed) f.componentInstance.fixedSnaps.set(fixed);
  f.detectChanges();
  await f.whenStable();
  const root = f.nativeElement as HTMLElement;
  const host = root.querySelector('ui-bottom-sheet') as HTMLElement;
  const sheet = root.querySelector('.sheet') as HTMLElement;
  const field = root.querySelector('#island') as HTMLInputElement;
  const settle = async () => {
    f.detectChanges();
    await f.whenStable();
    f.detectChanges();
  };
  /** What the sheet looks like on screen right now. */
  const state = () => {
    const h = f.componentInstance;
    const height = parseFloat(sheet.style.height);
    const translate = parseFloat(/translateY\((-?[\d.]+)px\)/.exec(sheet.style.transform)![1]);
    const bottom = parseFloat(host.style.getPropertyValue('--ui-sheet-offset') || '0');
    return {
      open: host.classList.contains('open'),
      inert: sheet.hasAttribute('inert'),
      fraction: h.snaps()[h.snap()],
      height,
      translate,
      // Top edge of the sheet in the VISIBLE area: layout bottom, less what it rests on, less the browser's pan, less its shown height.
      visualTop: innerHeight - bottom - vv.offsetTop - (height - translate),
    };
  };
  return { f, host, sheet, field, settle, state };
}

/** The keyboard slides up in steps, the way the visual viewport reports it while it animates. */
async function keyboardUp(settle: () => Promise<void>, to: number, { resizeContent }: { resizeContent: boolean }) {
  for (const k of [80, 180, 280, to]) {
    vv.height = 844 - k;
    if (resizeContent) setInner(844 - k);
    vv.dispatchEvent(new Event('resize'));
    window.dispatchEvent(new Event('resize'));
    await settle();
  }
}

async function keyboardDown(settle: () => Promise<void>) {
  vv.height = 844;
  vv.offsetTop = 0;
  setInner(844);
  vv.dispatchEvent(new Event('resize'));
  window.dispatchEvent(new Event('resize'));
  await settle();
}

/** One keystroke: the value changes, and the browser scrolls the caret into view (pan, window scroll, sub-px jitter). */
async function type(field: HTMLInputElement, ch: string, settle: () => Promise<void>, pan: number) {
  field.value += ch;
  field.dispatchEvent(new InputEvent('input', { bubbles: true, data: ch }));
  vv.offsetTop = pan;
  vv.height = Math.round(vv.height) + (pan % 2 ? 0.4 : 0);
  vv.dispatchEvent(new Event('scroll'));
  vv.dispatchEvent(new Event('resize'));
  window.dispatchEvent(new Event('scroll'));
  await settle();
}

describe('ui-bottom-sheet while typing on a phone', () => {
  it('snaps sized to the window (resizes-content keyboard): stays open at its full height, never inert, no re-open loop', async () => {
    const { f, field, settle, state } = await setup();
    expect(state().fraction).toBe(0.55);
    field.focus();
    await settle();
    expect(state().fraction).toBe(1); // risen once, on focus
    const seen: ReturnType<typeof state>[] = [];
    await keyboardUp(async () => {
      await settle();
      seen.push(state());
    }, 336, { resizeContent: true });
    // The app's snaps lost their middle step ([0.71, 1]); the sheet stays at the full one.
    expect(f.componentInstance.snaps().length).toBe(2);
    for (const s of seen) expect([s.open, s.inert, s.fraction]).toEqual([true, false, 1]);
    const before = state();
    for (const [i, ch] of [...'Hulhumale'].entries()) {
      await type(field, ch, settle, 0);
      expect(state(), `after "${ch}" (${i})`).toEqual(before);
    }
    expect(document.activeElement).toBe(field);
    await keyboardDown(settle);
    // Snaps back to three steps, still at the full one: the sheet never left it.
    expect(f.componentInstance.snaps().length).toBe(3);
    expect([state().open, state().fraction, f.componentInstance.snap()]).toEqual([true, 1, 2]);
  });

  it('fixed snaps (resizes-visual keyboard): one rise on focus, then the sheet keeps its place on screen while the browser pans', async () => {
    const { f, field, settle, state } = await setup([0.3, 0.55, 1]);
    field.focus();
    await settle();
    expect(f.componentInstance.snapLog).toEqual([2]);
    await keyboardUp(settle, 336, { resizeContent: false });
    const before = state();
    expect(before.open).toBe(true);
    // Resting on the keyboard: its bottom edge is the top of the keyboard.
    expect(before.visualTop + before.height - before.translate).toBe(844 - 336);
    const pans = [0, 120, 200, 336, 180, 40, 0, 260];
    for (const [i, ch] of [...'Maafushi'].entries()) {
      await type(field, ch, settle, pans[i]);
      const now = state();
      expect([now.visualTop, now.height, now.translate, now.fraction, now.inert], `after "${ch}" with the view panned ${pans[i]}px`).toEqual([
        before.visualTop, before.height, before.translate, 1, false,
      ]);
    }
    expect(f.componentInstance.snapLog).toEqual([2]); // no re-expansion per keystroke
  });

  it('the browser blurring the field and focusing it straight back does not raise a sheet the person lowered', async () => {
    const { f, field, settle } = await setup([0.3, 0.55, 1]);
    field.focus();
    await settle();
    expect(f.componentInstance.snap()).toBe(2);
    f.componentInstance.snap.set(1); // lowered by hand to see the map
    await settle();
    field.blur();
    field.focus();
    await settle();
    expect(f.componentInstance.snap()).toBe(1);
    // A different field is a new focus: it rises.
    (f.nativeElement as HTMLElement).querySelector<HTMLInputElement>('#building')!.focus();
    await settle();
    expect(f.componentInstance.snap()).toBe(2);
  });

  it('focus that really left and came back later raises it again', async () => {
    const { f, field, settle } = await setup([0.3, 0.55, 1]);
    field.focus();
    await settle();
    f.componentInstance.snap.set(1);
    await settle();
    field.blur();
    await new Promise((r) => setTimeout(r, 650));
    field.focus();
    await settle();
    expect(f.componentInstance.snap()).toBe(2);
  });

  it('an app that moves snap along with new snaps keeps its choice', async () => {
    const { f, settle, state } = await setup([0.2]);
    f.componentInstance.snap.set(0); // searching: the one small snap
    await settle();
    // A nurse accepted: new snaps, and the app opens the sheet at the second.
    f.componentInstance.fixedSnaps.set([0.3, 0.7, 1]);
    f.componentInstance.snap.set(1);
    await settle();
    expect([f.componentInstance.snap(), state().fraction]).toEqual([1, 0.7]);
  });

  it('an index past the end reads as the last snap, never as closed', async () => {
    const { f, settle, state } = await setup([0.3, 0.55, 1]);
    f.componentInstance.snap.set(5);
    await settle();
    expect([state().open, state().inert, state().height - state().translate]).toEqual([true, false, Math.round(844 - 56)]);
  });
});
