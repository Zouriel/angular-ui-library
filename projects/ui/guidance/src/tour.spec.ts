import { LiveAnnouncer } from '@angular/cdk/a11y';
import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { UiTourOutcome } from './guidance';
import { UiTourAnchor, UiTourService, type UiTourSpec } from './tour';

@Component({
  imports: [UiTourAnchor],
  template: `
    <button id="start" type="button">Start</button>
    <a id="a1" uiTourAnchor="nav.feed" href="#">Feed</a>
    <a id="a2" uiTourAnchor="nav.inbox" href="#">Inbox</a>
    @if (third()) { <a id="a3" uiTourAnchor="nav.new" href="#">New</a> }
  `,
})
class Host {
  third = signal(true);
}

type Box = { x: number; y: number; w: number; h: number };
const boxes = new Map<string, Box>();
let bubbleSize = { w: 320, h: 150 };
const realRect = HTMLElement.prototype.getBoundingClientRect;
const realOffsetW = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetWidth')!;
const realOffsetH = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetHeight')!;

const spec = (over: Partial<UiTourSpec> = {}): UiTourSpec => ({
  id: 'tour.welcome',
  steps: [
    { anchor: 'nav.feed', text: 'Your events show up here.' },
    { anchor: 'nav.inbox', text: 'Invitations land here.', title: 'Inbox' },
    { anchor: 'nav.new', text: 'Start an event.' },
  ],
  ...over,
});

describe('UiTourService', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'requestAnimationFrame', 'cancelAnimationFrame', 'Date'] });
    boxes.clear();
    boxes.set('a1', { x: 20, y: 700, w: 60, h: 40 });
    boxes.set('a2', { x: 120, y: 700, w: 60, h: 40 });
    boxes.set('a3', { x: 220, y: 100, w: 80, h: 30 });
    bubbleSize = { w: 320, h: 150 };
    HTMLElement.prototype.getBoundingClientRect = function (this: HTMLElement) {
      const b = boxes.get(this.id);
      return b ? new DOMRect(b.x, b.y, b.w, b.h) : realRect.call(this);
    };
    Object.defineProperty(HTMLElement.prototype, 'offsetWidth', { configurable: true, get(this: HTMLElement) { return this.classList.contains('bubble') ? bubbleSize.w : 0; } });
    Object.defineProperty(HTMLElement.prototype, 'offsetHeight', { configurable: true, get(this: HTMLElement) { return this.classList.contains('bubble') ? bubbleSize.h : 0; } });
    HTMLElement.prototype.scrollIntoView = vi.fn();
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1440 });
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 900 });
  });
  afterEach(() => {
    TestBed.inject(UiTourService).stop();
    vi.useRealTimers();
    HTMLElement.prototype.getBoundingClientRect = realRect;
    Object.defineProperty(HTMLElement.prototype, 'offsetWidth', realOffsetW);
    Object.defineProperty(HTMLElement.prototype, 'offsetHeight', realOffsetH);
    document.querySelectorAll('.cdk-overlay-container').forEach((c) => (c.innerHTML = ''));
  });

  function setup() {
    const f = TestBed.createComponent(Host);
    document.body.appendChild(f.nativeElement);
    f.detectChanges();
    const tours = TestBed.inject(UiTourService);
    const settle = () => {
      for (let i = 0; i < 6; i++) {
        vi.advanceTimersByTime(60);
        f.detectChanges();
      }
    };
    const q = <T extends HTMLElement>(sel: string) => document.querySelector(sel) as T | null;
    const run = (s: UiTourSpec = spec()) => {
      let outcome: UiTourOutcome | undefined;
      const p = tours.start(s).then((o) => (outcome = o));
      f.detectChanges();
      settle();
      return { p, get outcome() { return outcome; } };
    };
    const hole = () => {
      const st = q('.hole')!.style;
      return { x: parseFloat(st.left), y: parseFloat(st.top), w: parseFloat(st.width), h: parseFloat(st.height) };
    };
    const click = (sel: string) => {
      q(sel)!.click();
      f.detectChanges();
      settle();
    };
    return { f, tours, q, run, hole, click, settle };
  }

  it('cuts the spotlight around the anchor (6px of room) and shows the bubble as a modal dialog with the count', async () => {
    const { q, run, hole } = setup();
    run();
    expect(hole()).toEqual({ x: 14, y: 694, w: 72, h: 52 });
    const bubble = q('.bubble')!;
    expect(bubble.getAttribute('role')).toBe('dialog');
    expect(bubble.getAttribute('aria-modal')).toBe('true');
    expect(bubble.getAttribute('aria-label')).toBe('1 of 3');
    expect(q('.count')!.textContent!.trim()).toBe('1 of 3');
    expect(q('.text')!.textContent!.trim()).toBe('Your events show up here.');
    expect(q('.back')).toBeNull();
    expect(q('.next')!.textContent!.trim()).toBe('Next');
    expect(q('ui-tour-panel')!.classList.contains('ready')).toBe(true);
  });

  it('Next moves the spotlight to the next anchor; Back returns; Done on the last finishes and gives focus back', async () => {
    const { q, run, hole, click } = setup();
    const start = q<HTMLButtonElement>('#start')!;
    start.focus();
    const t = run();
    expect(document.activeElement).toBe(q('.next'));
    click('.next');
    expect(hole()).toEqual({ x: 114, y: 694, w: 72, h: 52 });
    expect(q('.title')!.textContent!.trim()).toBe('Inbox');
    expect(q('.count')!.textContent!.trim()).toBe('2 of 3');
    click('.back');
    expect(hole().x).toBe(14);
    click('.next');
    click('.next');
    expect(hole()).toEqual({ x: 214, y: 94, w: 92, h: 42 });
    expect(q('.next')!.textContent!.trim()).toBe('Done');
    click('.next');
    await t.p;
    expect(t.outcome).toBe('finished');
    expect(q('ui-tour-panel')).toBeNull();
    expect(document.activeElement).toBe(start);
  });

  it('Skip, Turn off tips and Escape end it with their outcomes', async () => {
    const { q, run, click, f } = setup();
    let t = run();
    click('.skip');
    await t.p;
    expect(t.outcome).toBe('skipped');

    t = run();
    expect(q('.off')!.textContent!.trim()).toBe('Turn off tips');
    click('.off');
    await t.p;
    expect(t.outcome).toBe('turnedOff');

    t = run();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    f.detectChanges();
    await t.p;
    expect(t.outcome).toBe('closed');
    expect(q('ui-tour-panel')).toBeNull();

    t = run(spec({ turnOff: false, labels: { next: 'Go on', skip: 'Not now' } }));
    expect(q('.off')).toBeNull();
    expect(q('.next')!.textContent!.trim()).toBe('Go on');
    expect(q('.skip')!.textContent!.trim()).toBe('Not now');
  });

  it('leaves out steps whose anchor is not on the page, and resolves closed when none is', async () => {
    const { f, q, run, tours } = setup();
    f.componentInstance.third.set(false);
    f.detectChanges();
    boxes.set('a2', { x: 0, y: 0, w: 0, h: 0 }); // drawn with no size (display: none)
    const t = run();
    expect(q('.count')!.textContent!.trim()).toBe('1 of 1');
    expect(q('.next')!.textContent!.trim()).toBe('Done');
    tours.stop();
    await t.p;
    expect(await tours.start(spec({ steps: [{ anchor: 'nowhere', text: 'x' }] }))).toBe('closed');
  });

  it('skips a step whose anchor disappears during the tour', async () => {
    const { f, q, run, click } = setup();
    const t = run();
    boxes.set('a2', { x: 0, y: 0, w: 0, h: 0 });
    click('.next');
    expect(q('.text')!.textContent!.trim()).toBe('Start an event.');
    expect(q('.count')!.textContent!.trim()).toBe('3 of 3');
    f.componentInstance.third.set(false);
    f.detectChanges();
    click('.next');
    await t.p;
    expect(t.outcome).toBe('finished');
  });

  it('keeps at most 5 steps, with a warning', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { q, run } = setup();
    const steps = Array.from({ length: 7 }, (_, i) => ({ anchor: 'nav.feed', text: `Step ${i + 1}` }));
    run(spec({ steps }));
    expect(q('.count')!.textContent!.trim()).toBe('1 of 5');
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('announces each step for screen readers', async () => {
    const { run, click } = setup();
    const announce = vi.spyOn(TestBed.inject(LiveAnnouncer), 'announce').mockResolvedValue();
    run();
    expect(announce).toHaveBeenLastCalledWith('Step 1 of 3: Your events show up here.', 'polite');
    click('.next');
    expect(announce).toHaveBeenLastCalledWith('Step 2 of 3: Inbox. Invitations land here.', 'polite');
  });

  it('scrolls an anchor that is off screen into view first', async () => {
    const { q, run } = setup();
    boxes.set('a1', { x: 20, y: 1600, w: 60, h: 40 });
    run();
    expect(q('#a1')!.scrollIntoView).toHaveBeenCalled();
  });

  it('keeps the bubble on a 390px phone screen, beside the anchor, with the arrow at the anchor', async () => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 390 });
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 844 });
    const { q, run, click } = setup();
    boxes.set('a1', { x: 330, y: 790, w: 48, h: 40 }); // a bottom-bar tab at the end of the row
    boxes.set('a2', { x: 4, y: 8, w: 48, h: 40 }); // a top-start icon
    run();
    const at = () => {
      const st = q('.bubble')!.style;
      return { x: parseFloat(st.left), y: parseFloat(st.top) };
    };
    let p = at();
    expect(p.x).toBeGreaterThanOrEqual(12);
    expect(p.x + 320).toBeLessThanOrEqual(390 - 12);
    expect(p.y + 150).toBeLessThanOrEqual(790 - 6 - 12 + 0.5);
    expect(q('ui-tour-panel')!.getAttribute('data-side')).toBe('top');
    const arrow = parseFloat(q('.bubble')!.style.getPropertyValue('--ui-tour-arrow'));
    expect(p.x + arrow).toBeCloseTo(354, 0);
    click('.next');
    p = at();
    expect(q('ui-tour-panel')!.getAttribute('data-side')).toBe('bottom');
    expect(p.x).toBe(12);
    expect(p.y).toBeGreaterThanOrEqual(8 + 40 + 6 + 12 - 0.5);
  });
});
