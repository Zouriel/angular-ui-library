import { DOCUMENT } from '@angular/common';
import { ApplicationRef, DestroyRef, Directive, ElementRef, inject, input } from '@angular/core';

/** The side new content slides in from: `start` is the left in LTR and the right in RTL. */
export type UiSlideFrom = 'start' | 'end';

/** Options for {@link UiSlideTransition.run}. */
export interface UiSlideRunOptions {
  /** The side the new content comes from; defaults to the directive's value. */
  from?: UiSlideFrom;
  /**
   * Going back: the current content slides out to `from` (where it came from) and the content
   * beneath is revealed, rather than new content sliding in over it.
   */
  back?: boolean;
}

/** The value set on `<html data-ui-slide>` for the CSS in `animations.css` to animate. */
type UiSlideMode = 'in-left' | 'in-right' | 'out-left' | 'out-right' | 'fade';

/** The view-transition-name the sliding region carries while a transition runs. */
const NAME = 'ui-slide';

/** Regions on the page, newest last: the router hook slides the last connected one. */
const regions: UiSlideTransition[] = [];

/** The physical mode for a slide from `from` in an element whose direction is `rtl` or not. */
function modeFor(from: UiSlideFrom, back: boolean, rtl: boolean, doc: Document): UiSlideMode {
  const reduced = doc.defaultView?.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  if (reduced) return 'fade';
  const left = (from === 'start') !== rtl;
  return back ? (left ? 'out-left' : 'out-right') : left ? 'in-left' : 'in-right';
}

/** Whether the library's animations are off (`provideUiConfig({ animations: false })`). */
function animationsOff(doc: Document): boolean {
  return doc.documentElement.classList.contains('ui-no-anim');
}

/**
 * Runs `update` inside a view transition that slides `target` (named `ui-slide` for its duration)
 * in `mode`, or, without the View Transitions API, runs it and plays a short slide-and-fade on the
 * new content.
 */
async function slide(doc: Document, target: HTMLElement, mode: UiSlideMode, update: () => unknown): Promise<void> {
  const start = (doc as Document & { startViewTransition?: (cb: () => unknown) => ViewTransitionLike }).startViewTransition;
  if (!start) {
    await update();
    fallback(target, mode);
    return;
  }
  const root = doc.documentElement;
  target.style.setProperty('view-transition-name', NAME);
  root.setAttribute('data-ui-slide', mode);
  const t = start.call(doc, () => update());
  try {
    await t.finished;
  } finally {
    // A newer slide may have started meanwhile; only undo our own marks.
    if (root.getAttribute('data-ui-slide') === mode) root.removeAttribute('data-ui-slide');
    target.style.removeProperty('view-transition-name');
  }
}

/** The fallback: the new content arrives with a 32px slide and a fade (only the fade when reduced). */
function fallback(target: HTMLElement, mode: UiSlideMode): void {
  if (typeof target.animate !== 'function') return;
  const dx = mode === 'in-left' || mode === 'out-right' ? -32 : mode === 'fade' ? 0 : 32;
  target.animate(
    [
      { transform: `translateX(${dx}px)`, opacity: 0 },
      { transform: 'none', opacity: 1 },
    ],
    { duration: 320, easing: 'cubic-bezier(0, 0, 0, 1)' },
  );
}

interface ViewTransitionLike {
  finished: Promise<unknown>;
  skipTransition(): void;
}

/**
 * `uiSlideTransition` — slides a routed or stacked view in from a side, with the View Transitions
 * API (a short slide-and-fade fallback where it is missing). `start` is the left in LTR and the right
 * in RTL; under reduced motion it cross-fades, and with the library's animations off it changes at
 * once.
 *
 * An in-page view stack: change the view inside `run`, which slides the new view in.
 *
 *   <section [uiSlideTransition]="'start'" #slide="uiSlideTransition">@switch (step()) { … }</section>
 *   slide.run(() => step.set('list'));                       // in from the start side
 *   slide.run(() => step.set('search'), { back: true });     // back: the current view leaves to the start side
 *
 * Router outlets: put the directive on the outlet's container and see {@link uiSlideRouteTransition}.
 */
@Directive({ selector: '[uiSlideTransition]', exportAs: 'uiSlideTransition' })
export class UiSlideTransition {
  /** The side new content comes from (an empty attribute means `end`). */
  readonly from = input<UiSlideFrom, UiSlideFrom | '' | null | undefined>('end', {
    alias: 'uiSlideTransition',
    transform: (v) => (v === 'start' ? 'start' : 'end'),
  });

  private readonly el = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly doc = inject(DOCUMENT);
  private readonly app = inject(ApplicationRef);

  constructor() {
    regions.push(this);
    inject(DestroyRef).onDestroy(() => regions.splice(regions.indexOf(this), 1));
  }

  /** The host element (what slides). */
  get element(): HTMLElement {
    return this.el.nativeElement;
  }

  /** The mode a slide from `from` (or back to it) takes here, given direction and motion settings. */
  mode(options: UiSlideRunOptions = {}): UiSlideMode {
    const rtl = this.doc.defaultView?.getComputedStyle(this.element).direction === 'rtl';
    return modeFor(options.from ?? this.from(), !!options.back, rtl, this.doc);
  }

  /**
   * Runs `update` (a signal change that swaps the view) and slides the new view in. Resolves when
   * the transition has finished.
   */
  run(update: () => unknown, options: UiSlideRunOptions = {}): Promise<void> {
    const apply = async () => {
      await update();
      // Render now, so the transition captures the new view (signals otherwise render a beat later).
      this.app.tick();
    };
    if (animationsOff(this.doc)) return apply();
    return slide(this.doc, this.element, this.mode(options), apply);
  }
}

/** What {@link uiSlideRouteTransition} reads from a route snapshot (structurally, so this entry point needs no router). */
interface UiSlideRouteSnapshot {
  data: { [key: string]: unknown };
  firstChild: UiSlideRouteSnapshot | null;
}

function deepest(s: UiSlideRouteSnapshot | null | undefined): UiSlideRouteSnapshot | null {
  let r = s ?? null;
  while (r?.firstChild) r = r.firstChild;
  return r;
}

function slideData(s: UiSlideRouteSnapshot | null): UiSlideFrom | null {
  const v = s?.data?.['uiSlide'];
  return v === 'start' || v === 'end' ? v : null;
}

/**
 * Router hook for slide transitions between routes:
 *
 *   provideRouter(routes, withViewTransitions({ onViewTransitionCreated: uiSlideRouteTransition }))
 *   { path: 'nurses', component: NurseList, data: { uiSlide: 'start' } }
 *
 * Going to a route with `data.uiSlide` slides it in from that side. Leaving such a route for one
 * without it is treated as going back: the page leaves to the side it came from. Other navigations
 * change at once. The slide runs in the last `[uiSlideTransition]` region on the page (put it on the
 * outlet's container), or the whole body if there is none. RTL and reduced motion as on the
 * directive; with the library's animations off it never slides.
 */
export function uiSlideRouteTransition(info: { transition: ViewTransitionLike; from: UiSlideRouteSnapshot; to: UiSlideRouteSnapshot }): void {
  const doc = inject(DOCUMENT);
  const to = slideData(deepest(info.to));
  const from = slideData(deepest(info.from));
  const side = to ?? from;
  if (!side || animationsOff(doc)) {
    info.transition.skipTransition();
    return;
  }
  const region = [...regions].reverse().find((r) => r.element.isConnected);
  const target = region?.element ?? doc.body;
  const rtl = doc.defaultView?.getComputedStyle(target).direction === 'rtl';
  const mode = modeFor(side, !to, rtl, doc);
  const root = doc.documentElement;
  target.style.setProperty('view-transition-name', NAME);
  root.setAttribute('data-ui-slide', mode);
  info.transition.finished.finally(() => {
    if (root.getAttribute('data-ui-slide') === mode) root.removeAttribute('data-ui-slide');
    target.style.removeProperty('view-transition-name');
  });
}
