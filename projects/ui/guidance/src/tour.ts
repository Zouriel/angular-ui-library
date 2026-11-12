import { FocusTrap, FocusTrapFactory, LiveAnnouncer } from '@angular/cdk/a11y';
import { Overlay, OverlayRef } from '@angular/cdk/overlay';
import { ComponentPortal } from '@angular/cdk/portal';
import { DOCUMENT } from '@angular/common';
import {
  Component, DestroyRef, Directive, ElementRef, Injectable, NgZone, computed, effect, inject, input, signal, untracked, type Signal,
} from '@angular/core';
import { injectUiStrings, uiFormatString } from '@zouriel/ui';
import type { UiTourOutcome } from './guidance';

/** Which side of its anchor a tour step's bubble prefers; `auto` is below, else above. `start` /
 *  `end` follow the text direction. */
export type UiTourPlacement = 'auto' | 'top' | 'bottom' | 'start' | 'end';

export interface UiTourStep {
  /** The `uiTourAnchor` id of the element this step points at. */
  anchor: string;
  /** Short text (about 20 words at most). */
  text: string;
  /** Optional, about 6 words at most. */
  title?: string;
  placement?: UiTourPlacement;
}

/** Words for one tour, over the built-in strings (`tourNext`, …). `step` takes `{n}` and `{total}`. */
export interface UiTourLabels {
  back?: string;
  next?: string;
  done?: string;
  skip?: string;
  turnOff?: string;
  step?: string;
}

export interface UiTourSpec {
  id: string;
  /** 1 to 5 steps; more are cut to 5 with a console warning. */
  steps: readonly UiTourStep[];
  labels?: UiTourLabels;
  /** Show "Turn off tips". Default true. */
  turnOff?: boolean;
}

/** At most this many steps in a tour (NN/g: longer tours aren't read). */
export const UI_TOUR_MAX_STEPS = 5;
/** Room between the anchor and the cut-out's edge. */
const PAD = 6;
/** Cut-out to bubble (the arrow plus a breath). */
const GAP = 12;
/** The bubble keeps this far from the screen's edges. */
const MARGIN = 12;

type Side = 'top' | 'bottom' | 'left' | 'right';

/**
 * Starts tours and knows their anchors. `start` dims the page, cuts a rounded hole around each
 * step's anchor and shows a coach-mark bubble beside it, and resolves with how it ended.
 */
@Injectable({ providedIn: 'root' })
export class UiTourService {
  private readonly overlay = inject(Overlay);
  private readonly doc = inject(DOCUMENT);
  private readonly anchors = new Map<string, Set<HTMLElement>>();
  private readonly running = signal<string | null>(null);
  private stopCurrent: ((o: UiTourOutcome) => void) | null = null;
  /** The id of the tour on screen, or null. */
  readonly active: Signal<string | null> = this.running.asReadonly();

  /** Used by `uiTourAnchor`. */
  register(id: string, el: HTMLElement): () => void {
    let set = this.anchors.get(id);
    if (!set) this.anchors.set(id, (set = new Set()));
    set.add(el);
    return () => {
      set!.delete(el);
      if (!set!.size && this.anchors.get(id) === set) this.anchors.delete(id);
    };
  }

  /** The element for an anchor id that is on the page and drawn (has a size), or null. */
  findAnchor(id: string): HTMLElement | null {
    for (const el of this.anchors.get(id) ?? []) {
      if (!el.isConnected) continue;
      const r = el.getBoundingClientRect();
      if (r.width <= 0 || r.height <= 0) continue;
      if (this.doc.defaultView?.getComputedStyle(el).visibility === 'hidden') continue;
      return el;
    }
    return null;
  }

  /**
   * Runs a tour. Steps whose anchor isn't on the page are left out (the count says "1 of 3" when one
   * of four is missing); with none left it resolves `closed` at once. A tour already running ends
   * with `closed` first.
   */
  start(spec: UiTourSpec): Promise<UiTourOutcome> {
    this.stopCurrent?.('closed');
    let steps = spec.steps;
    if (steps.length > UI_TOUR_MAX_STEPS) {
      console.warn(`uiTour "${spec.id}": ${steps.length} steps; a tour has at most ${UI_TOUR_MAX_STEPS}, the rest are left out.`);
      steps = steps.slice(0, UI_TOUR_MAX_STEPS);
    }
    steps = steps.filter((s) => this.findAnchor(s.anchor));
    if (!steps.length) return Promise.resolve('closed');

    return new Promise<UiTourOutcome>((resolve) => {
      const ref: OverlayRef = this.overlay.create({
        positionStrategy: this.overlay.position().global().top('0').left('0'),
        width: '100%',
        height: '100%',
        scrollStrategy: this.overlay.scrollStrategies.noop(),
        panelClass: 'ui-tour-pane',
      });
      const restore = this.doc.activeElement as HTMLElement | null;
      const panel = ref.attach(new ComponentPortal(UiTourPanel)).instance;
      let done = false;
      const end = (outcome: UiTourOutcome) => {
        if (done) return;
        done = true;
        panel.teardown();
        ref.dispose();
        this.running.set(null);
        this.stopCurrent = null;
        if (restore?.isConnected) restore.focus({ preventScroll: true });
        resolve(outcome);
      };
      this.stopCurrent = end;
      this.running.set(spec.id);
      panel.begin(spec, steps, (id) => this.findAnchor(id), end);
    });
  }

  /** Ends the running tour with `closed` (e.g. the page is leaving). */
  stop(): void {
    this.stopCurrent?.('closed');
  }
}

/**
 * `uiTourAnchor`: marks an element as a tour step's target, by a shared id
 * (`<a uiTourAnchor="nav.feed">`). Several elements may share an id; the first one on screen wins.
 */
@Directive({ selector: '[uiTourAnchor]' })
export class UiTourAnchor {
  readonly id = input.required<string>({ alias: 'uiTourAnchor' });

  constructor() {
    const tours = inject(UiTourService);
    const host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
    let off: (() => void) | null = null;
    // Registered under its id, again whenever the id changes.
    effect(() => {
      const id = this.id();
      untracked(() => {
        off?.();
        off = tours.register(id, host);
      });
    });
    inject(DestroyRef).onDestroy(() => off?.());
  }
}

/** The tour on screen: the dimmed layer with its cut-out and the bubble. Internal: use UiTourService. */
@Component({
  selector: 'ui-tour-panel',
  host: { '[attr.data-side]': 'side()', '[class.calm]': 'calm', '[class.ready]': 'ready()' },
  template: `
    <div class="catcher" aria-hidden="true"></div>
    <div class="hole" aria-hidden="true" [style.left.px]="hole().x" [style.top.px]="hole().y"
      [style.width.px]="hole().w" [style.height.px]="hole().h"></div>
    <div #bubble class="bubble" role="dialog" aria-modal="true" [attr.aria-label]="count()"
      [attr.aria-describedby]="textId" [style.left.px]="pos().x" [style.top.px]="pos().y"
      [style.--ui-tour-arrow.px]="pos().arrow">
      <span class="arrow" aria-hidden="true"></span>
      <div class="head">
        <span class="count" aria-hidden="true">{{ count() }}</span>
        <button type="button" class="link skip" (click)="finish('skipped')">{{ label('skip') }}</button>
      </div>
      @if (step().title) { <div class="title">{{ step().title }}</div> }
      <p class="text" [id]="textId">{{ step().text }}</p>
      <div class="foot">
        @if (turnOff()) {
          <button type="button" class="link off" (click)="finish('turnedOff')">{{ label('turnOff') }}</button>
        }
        <span class="grow"></span>
        @if (index() > 0) {
          <button type="button" class="btn back" (click)="go(-1)">{{ label('back') }}</button>
        }
        <button type="button" class="btn next" (click)="go(1)">{{ last() ? label('done') : label('next') }}</button>
      </div>
    </div>
  `,
  styles: `
    :host { position: fixed; inset: 0; display: block; z-index: var(--ui-z-overlay); }
    /* Takes every pointer: the page behind is not usable while a tour is on. */
    .catcher { position: absolute; inset: 0; }
    /* The dimmed layer is this box's huge shadow, so the box itself is the rounded cut-out. */
    .hole {
      position: absolute; box-sizing: border-box; pointer-events: none;
      border-radius: var(--ui-radius-lg);
      box-shadow: 0 0 0 200vmax var(--ui-color-overlay);
      transition: left var(--ui-motion-slow) var(--ui-ease-standard), top var(--ui-motion-slow) var(--ui-ease-standard),
        width var(--ui-motion-slow) var(--ui-ease-standard), height var(--ui-motion-slow) var(--ui-ease-standard);
    }
    /* A ring in the coach-mark colour, breathing gently, says "this one". */
    .hole::after {
      content: ''; position: absolute; inset: -2px; border-radius: inherit;
      border: 2px solid var(--ui-color-primary);
      animation: ui-tour-ring 1.8s var(--ui-ease-standard) infinite;
    }
    @keyframes ui-tour-ring { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: .55; transform: scale(1.03); } }
    .bubble {
      position: absolute; box-sizing: border-box; width: min(320px, calc(100vw - 24px));
      display: flex; flex-direction: column; gap: var(--ui-space-2);
      padding: var(--ui-space-3) var(--ui-space-4) var(--ui-space-3);
      background: var(--ui-color-primary); color: var(--ui-color-primary-contrast);
      border-radius: var(--ui-radius-lg); box-shadow: var(--ui-shadow-3);
      font-family: var(--ui-font-default); font-size: var(--ui-font-size-sm); line-height: 1.45;
      overflow-wrap: anywhere; visibility: hidden;
    }
    :host(.ready) .bubble { visibility: visible; animation: ui-tour-in var(--ui-motion-base) var(--ui-ease-decelerate) both; }
    @keyframes ui-tour-in { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: none; } }
    .arrow { position: absolute; width: 12px; height: 12px; background: inherit; transform: rotate(45deg); pointer-events: none; }
    :host([data-side="top"]) .arrow { bottom: -6px; left: calc(var(--ui-tour-arrow, 24px) - 6px); }
    :host([data-side="bottom"]) .arrow { top: -6px; left: calc(var(--ui-tour-arrow, 24px) - 6px); }
    :host([data-side="left"]) .arrow { right: -6px; top: calc(var(--ui-tour-arrow, 24px) - 6px); }
    :host([data-side="right"]) .arrow { left: -6px; top: calc(var(--ui-tour-arrow, 24px) - 6px); }
    :host([data-side="none"]) .arrow { display: none; }
    .head { display: flex; align-items: center; justify-content: space-between; gap: var(--ui-space-2); }
    .count { font-size: var(--ui-font-size-sm); font-weight: 600; letter-spacing: var(--ui-tracking-wide); opacity: .85; font-variant-numeric: tabular-nums; }
    .title { font-size: var(--ui-font-size-md); font-weight: 600; line-height: 1.3; }
    .text { margin: 0; font-size: var(--ui-font-size-md); text-wrap: pretty; }
    .foot { display: flex; align-items: center; flex-wrap: wrap; gap: var(--ui-space-2); margin-top: var(--ui-space-1); }
    .grow { flex: 1; }
    button {
      position: relative; font: inherit; color: inherit; cursor: pointer; margin: 0;
      -webkit-tap-highlight-color: transparent;
    }
    button:focus-visible { outline: none; box-shadow: 0 0 0 2px var(--ui-color-primary), 0 0 0 4px var(--ui-color-primary-contrast); }
    /* Text actions: plain words, underlined on hover, so they never pass for the main button. */
    .link {
      border: 0; background: transparent; padding: var(--ui-space-1) var(--ui-space-1);
      border-radius: var(--ui-radius-xs); font-size: var(--ui-font-size-sm); opacity: .9;
    }
    .link:hover { opacity: 1; text-decoration: underline; text-underline-offset: 2px; }
    .off { margin-inline-start: calc(var(--ui-space-1) * -1); text-decoration: underline; text-underline-offset: 2px; text-decoration-thickness: 1px; }
    .skip { margin-inline-end: calc(var(--ui-space-1) * -1); }
    .btn {
      min-height: 32px; padding: 0 var(--ui-space-3); border-radius: var(--ui-radius-pill);
      font-size: var(--ui-font-size-sm); font-weight: 600; white-space: nowrap;
    }
    .back { border: 1px solid color-mix(in srgb, var(--ui-color-primary-contrast) 55%, transparent); background: transparent; }
    .back:hover { background: color-mix(in srgb, var(--ui-color-primary-contrast) 14%, transparent); }
    .next { border: 0; background: var(--ui-color-primary-contrast); color: var(--ui-color-primary); }
    .next:hover { background: color-mix(in srgb, var(--ui-color-primary-contrast) 88%, var(--ui-color-primary)); }
    @media (pointer: coarse) {
      .btn::before, .link::before { content: ''; position: absolute; inset: -6px -2px; }
      .btn { min-height: 36px; }
    }
    :host(.calm) .hole, :host(.calm) .bubble { transition: none; animation: none; }
    :host(.calm) .hole::after { animation: none; }
    @media (prefers-reduced-motion: reduce) {
      .hole, :host(.ready) .bubble { transition: none; animation: none; }
      .hole::after { animation: none; }
    }
  `,
})
export class UiTourPanel {
  private readonly strings = injectUiStrings();
  private readonly doc = inject(DOCUMENT);
  private readonly zone = inject(NgZone);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private readonly announcer = inject(LiveAnnouncer);
  private readonly trapFactory = inject(FocusTrapFactory);
  private static seq = 0;
  protected readonly textId = `ui-tour-text-${UiTourPanel.seq++}`;

  private spec: UiTourSpec = { id: '', steps: [] };
  protected readonly steps = signal<readonly UiTourStep[]>([{ anchor: '', text: '' }]);
  protected readonly index = signal(0);
  protected readonly step = computed(() => this.steps()[this.index()]);
  protected readonly last = computed(() => this.index() === this.steps().length - 1);
  protected readonly turnOff = signal(true);
  protected readonly ready = signal(false);
  protected readonly side = signal<Side | 'none'>('bottom');
  protected readonly hole = signal({ x: 0, y: 0, w: 0, h: 0 });
  protected readonly pos = signal({ x: 0, y: 0, arrow: 24 });
  protected readonly count = computed(() =>
    uiFormatString(this.spec.labels?.step ?? this.strings.tourStep, { n: this.index() + 1, total: this.steps().length }),
  );
  /** Reduced motion (or the library's animations off): no moving spotlight, no ring, no fade. */
  protected readonly calm: boolean;

  private find: (id: string) => HTMLElement | null = () => null;
  private end: (o: UiTourOutcome) => void = () => {};
  private trap: FocusTrap | null = null;
  private frame = 0;
  private settle: ReturnType<typeof setTimeout> | null = null;
  private anchorEl: HTMLElement | null = null;
  private offKeys: (() => void) | null = null;

  constructor() {
    const view = this.doc.defaultView;
    const reduced = !!view?.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    this.calm = reduced || this.doc.documentElement.classList.contains('ui-no-anim');
  }

  protected label(key: keyof Omit<UiTourLabels, 'step'>): string {
    const own = this.spec.labels?.[key];
    if (own) return own;
    switch (key) {
      case 'back': return this.strings.tourBack;
      case 'next': return this.strings.tourNext;
      case 'done': return this.strings.tourDone;
      case 'skip': return this.strings.tourSkip;
      default: return this.strings.tipsOff;
    }
  }

  /** Called once by the service. */
  begin(spec: UiTourSpec, steps: readonly UiTourStep[], find: (id: string) => HTMLElement | null, end: (o: UiTourOutcome) => void): void {
    this.spec = spec;
    this.find = find;
    this.end = end;
    this.turnOff.set(spec.turnOff !== false);
    this.steps.set(steps);
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.preventDefault();
      e.stopPropagation();
      this.zone.run(() => this.finish('closed'));
    };
    this.zone.runOutsideAngular(() => this.doc.addEventListener('keydown', onKey, true));
    this.offKeys = () => this.doc.removeEventListener('keydown', onKey, true);
    this.trap = this.trapFactory.create(this.host);
    this.show(0, 1);
  }

  /** Back (-1) or Next/Done (1). */
  protected go(dir: 1 | -1): void {
    if (dir === 1 && this.last()) return this.finish('finished');
    this.show(this.index() + dir, dir);
  }

  protected finish(outcome: UiTourOutcome): void {
    this.end(outcome);
  }

  /** Shows step `i`, or the next one along `dir` whose anchor is still on the page. */
  private show(i: number, dir: 1 | -1): void {
    const steps = this.steps();
    while (i >= 0 && i < steps.length && !this.find(steps[i].anchor)) i += dir;
    if (i < 0) i = this.index();
    if (i >= steps.length) return this.finish(dir === 1 && this.index() > 0 ? 'finished' : 'closed');
    const el = this.find(steps[i].anchor)!;
    this.index.set(i);
    this.anchorEl = el;
    this.ready.set(false);
    const view = this.doc.defaultView!;
    const r = el.getBoundingClientRect();
    const vw = this.doc.documentElement.clientWidth || view.innerWidth;
    const vh = view.innerHeight;
    const inView = r.top >= 0 && r.left >= 0 && r.bottom <= vh && r.right <= vw;
    if (!inView) el.scrollIntoView({ block: 'center', inline: 'nearest', behavior: this.calm ? 'instant' : 'smooth' });
    this.layout();
    this.startFollow();
    // Wait for the scroll to settle (the anchor's box stops moving), then show the bubble.
    let lastKey = '';
    let still = 0;
    const started = Date.now();
    const check = () => {
      const b = el.getBoundingClientRect();
      const key = `${Math.round(b.left)},${Math.round(b.top)},${Math.round(b.width)},${Math.round(b.height)}`;
      still = key === lastKey ? still + 1 : 0;
      lastKey = key;
      if (still >= 2 || Date.now() - started > 900) {
        this.settle = null;
        this.zone.run(() => this.reveal());
      } else {
        this.settle = setTimeout(check, 50);
      }
    };
    if (this.settle) clearTimeout(this.settle);
    this.zone.runOutsideAngular(() => (this.settle = setTimeout(check, inView ? 0 : 50)));
  }

  private reveal(): void {
    this.layout();
    this.ready.set(true);
    const s = this.step();
    const text = s.title ? `${s.title}. ${s.text}` : s.text;
    this.announcer.announce(
      uiFormatString(this.strings.tourStepAnnounce, { n: this.index() + 1, total: this.steps().length, text }),
      'polite',
    );
    // Focus the main button once it is drawn; the trap keeps Tab inside the bubble.
    setTimeout(() => this.host.querySelector<HTMLElement>('.next')?.focus({ preventScroll: true }));
  }

  private startFollow(): void {
    const view = this.doc.defaultView;
    if (!view?.requestAnimationFrame || this.frame) return;
    const tick = () => {
      this.frame = view.requestAnimationFrame(tick);
      this.layout();
    };
    this.zone.runOutsideAngular(() => (this.frame = view.requestAnimationFrame(tick)));
  }

  /** Places the cut-out on the anchor and the bubble beside it, inside the screen. */
  private layout(): void {
    const el = this.anchorEl;
    const view = this.doc.defaultView;
    if (!el || !view) return;
    const r = el.getBoundingClientRect();
    const vw = this.doc.documentElement.clientWidth || view.innerWidth;
    const vh = view.innerHeight;
    const hole = { x: r.left - PAD, y: r.top - PAD, w: r.width + PAD * 2, h: r.height + PAD * 2 };
    const h = this.hole();
    if (h.x !== hole.x || h.y !== hole.y || h.w !== hole.w || h.h !== hole.h) this.hole.set(hole);

    const bubble = this.host.querySelector<HTMLElement>('.bubble');
    const bw = bubble?.offsetWidth ?? 320;
    const bh = bubble?.offsetHeight ?? 140;
    const rtl = view.getComputedStyle(el).direction === 'rtl';
    const pref = this.step().placement ?? 'auto';
    const room: Record<Side, number> = {
      top: hole.y - GAP - MARGIN,
      bottom: vh - (hole.y + hole.h) - GAP - MARGIN,
      left: hole.x - GAP - MARGIN,
      right: vw - (hole.x + hole.w) - GAP - MARGIN,
    };
    const fits = (s: Side) => room[s] >= (s === 'top' || s === 'bottom' ? bh : bw);
    const start: Side = rtl ? 'right' : 'left';
    const endSide: Side = rtl ? 'left' : 'right';
    const order: Side[] =
      pref === 'top' ? ['top', 'bottom'] :
      pref === 'start' ? [start, endSide, 'bottom', 'top'] :
      pref === 'end' ? [endSide, start, 'bottom', 'top'] :
      ['bottom', 'top'];
    const side: Side | 'none' = order.find(fits) ?? 'none';
    const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(Math.max(lo, hi), v));
    const cx = hole.x + hole.w / 2;
    const cy = hole.y + hole.h / 2;
    let x: number;
    let y: number;
    let arrow = 24;
    if (side === 'top' || side === 'bottom') {
      x = clamp(cx - bw / 2, MARGIN, vw - bw - MARGIN);
      y = side === 'bottom' ? hole.y + hole.h + GAP : hole.y - GAP - bh;
      arrow = clamp(cx - x, 18, bw - 18);
    } else if (side === 'left' || side === 'right') {
      x = side === 'right' ? hole.x + hole.w + GAP : hole.x - GAP - bw;
      y = clamp(cy - bh / 2, MARGIN, vh - bh - MARGIN);
      arrow = clamp(cy - y, 18, bh - 18);
    } else {
      // No side has room (a tall anchor on a phone): over the page, on the half away from the anchor.
      x = clamp(cx - bw / 2, MARGIN, vw - bw - MARGIN);
      y = cy > vh / 2 ? MARGIN : vh - bh - MARGIN;
    }
    x = clamp(x, MARGIN, vw - bw - MARGIN);
    y = clamp(y, MARGIN, vh - bh - MARGIN);
    const p = this.pos();
    if (p.x !== x || p.y !== y || p.arrow !== arrow) this.pos.set({ x, y, arrow });
    if (this.side() !== side) this.side.set(side);
  }

  /** Called by the service when the tour ends. */
  teardown(): void {
    this.offKeys?.();
    this.offKeys = null;
    if (this.settle) clearTimeout(this.settle);
    if (this.frame) this.doc.defaultView?.cancelAnimationFrame(this.frame);
    this.frame = 0;
    this.trap?.destroy();
    this.trap = null;
  }
}
