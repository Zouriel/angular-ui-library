import { Component, Directive, ElementRef, NgZone, OnDestroy, TemplateRef, afterNextRender, computed, contentChild, effect, inject, input, signal, untracked } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { UiScrollFade } from '@zouriel/ui/behaviors';

export interface UiStep {
  label: string;
  description?: string;
}

/** Where a step stands relative to the active one. */
export type UiStepState = 'done' | 'active' | 'todo';

/** The context of a `uiStepBody` template. */
export interface UiStepBodyContext {
  $implicit: UiStep;
  index: number;
  state: UiStepState;
}

/**
 * Content shown under each step's label in a vertical stepper (details, history, actions):
 * `<ng-template uiStepBody let-step let-i="index" let-state="state">…</ng-template>`.
 */
@Directive({ selector: 'ng-template[uiStepBody]' })
export class UiStepBody {
  readonly template = inject<TemplateRef<UiStepBodyContext>>(TemplateRef);
  static ngTemplateContextGuard(_dir: UiStepBody, ctx: unknown): ctx is UiStepBodyContext {
    return true;
  }
}

/**
 * `ui-stepper` — progress through ordered steps.
 *
 * - `orientation`: `horizontal` (default) or `vertical`; a vertical stepper shows a `uiStepBody`
 *   template under each step. A horizontal stepper whose labels don't fit its width (a phone)
 *   lays itself out vertically instead, so no label is cut or hidden; it goes back once it fits.
 * - `variant`: `default` (numbered markers with labels) or `dots` (small dots only, labels kept
 *   for screen readers and as tooltips): a compact progress strip.
 * - `tone`: the colour of finished and active steps, `primary` (default) or `success`.
 */
@Component({
  selector: 'ui-stepper',
  imports: [NgTemplateOutlet, UiScrollFade],
  host: { '[attr.data-orientation]': 'direction()', '[attr.data-variant]': 'variant()', '[attr.data-tone]': 'tone()' },
  template: `
    <ol class="ui-stepper" uiScrollFade [attr.aria-label]="label() || null">
      @for (step of steps(); track $index; let i = $index, last = $last) {
        <li class="step" [class.done]="i < active()" [class.active]="i === active()" [attr.aria-current]="i === active() ? 'step' : null"
          [attr.title]="variant() === 'dots' ? step.label : null">
          <span class="marker" aria-hidden="true">
            @if (variant() === 'default') {
              @if (i < active()) { <svg viewBox="0 0 24 24" width="14" height="14"><path d="M5 12.5l4.5 4.5L19 7" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg> } @else { {{ i + 1 }} }
            }
          </span>
          <span class="text" [class.sr-only]="variant() === 'dots'">
            <span class="label">{{ step.label }}</span>
            @if (variant() === 'dots') { <span class="sr-only">, {{ i < active() ? 'done' : i === active() ? 'current' : 'not reached' }}</span> }
            @if (step.description && variant() === 'default') { <span class="desc">{{ step.description }}</span> }
            @if (body() && direction() === 'vertical' && variant() === 'default') {
              <div class="body">
                <ng-container *ngTemplateOutlet="body()!.template; context: { $implicit: step, index: i, state: i < active() ? 'done' : i === active() ? 'active' : 'todo' }" />
              </div>
            }
          </span>
          @if (!last) { <span class="bar" aria-hidden="true"></span> }
        </li>
      }
    </ol>
  `,
  styles: `
    :host { display: block; --ui-step-tone: var(--ui-color-primary); --ui-step-tone-contrast: var(--ui-color-primary-contrast); }
    :host([data-tone="success"]) { --ui-step-tone: var(--ui-color-success); --ui-step-tone-contrast: var(--ui-color-success-contrast); }
    .ui-stepper {
      display: flex; margin: 0; padding: 0; list-style: none; font-family: var(--ui-font-default); line-height: 1.35;
      overflow-x: auto; scrollbar-width: none; -ms-overflow-style: none;
    }
    .ui-stepper::-webkit-scrollbar { display: none; }
    .step { display: flex; align-items: center; gap: var(--ui-space-2); flex: 1 1 auto; min-width: fit-content; }
    .step:last-child { flex: 0 1 auto; }
    .marker { --ui-color-icon: currentColor; }
    .marker {
      display: inline-flex; align-items: center; justify-content: center; flex: none;
      width: 24px; height: 24px; border-radius: 50%;
      border: 1px solid var(--ui-color-border); background: var(--ui-color-surface);
      color: var(--ui-color-text-muted); font-size: var(--ui-font-size-sm); font-weight: 600;
    }
    .step.active .marker { border-color: var(--ui-step-tone); color: var(--ui-step-tone); }
    .step.done .marker { background: var(--ui-step-tone); border-color: transparent; color: var(--ui-step-tone-contrast); }
    .text { display: flex; flex-direction: column; min-width: 0; }
    .label { font-size: var(--ui-font-size-sm); color: var(--ui-color-text); font-weight: 500; }
    .step:not(.done):not(.active) .label { color: var(--ui-color-text-secondary); }
    .desc { font-size: var(--ui-font-size-sm); color: var(--ui-color-text-muted); }
    .bar { flex: 1; height: 1px; min-width: var(--ui-space-4); background: var(--ui-color-border); margin: 0 var(--ui-space-2); }
    .step.done .bar { background: var(--ui-step-tone); }
    .sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; border: 0; }

    /* Vertical: markers in a column joined by a line; each step's body sits under its label. */
    :host([data-orientation="vertical"]) .ui-stepper { flex-direction: column; overflow: visible; }
    :host([data-orientation="vertical"]) .step { position: relative; align-items: flex-start; gap: var(--ui-space-3); padding-bottom: var(--ui-space-4); min-width: 0; }
    :host([data-orientation="vertical"]) .step:last-child { padding-bottom: 0; }
    :host([data-orientation="vertical"]) .text { flex: 1; padding-top: 3px; }
    :host([data-orientation="vertical"]) .bar { position: absolute; inset-inline-start: 11.5px; top: 28px; bottom: 4px; width: 1px; height: auto; min-width: 0; margin: 0; }
    .body { margin-top: var(--ui-space-2); font-size: var(--ui-font-size-sm); color: var(--ui-color-text); }

    /* Dots: a compact strip of 10px dots. Finished steps take the tone, the active one too with a
       ring; steps not reached yet are hollow, outlined in the muted text colour. */
    /* Room for the current dot's 4px ring, which the sideways scroller would otherwise clip. */
    :host([data-variant="dots"]) .ui-stepper { padding: 4px; margin: -4px; }
    :host([data-variant="dots"]) .step { gap: 0; flex: 0 0 auto; }
    :host([data-variant="dots"]) .marker { width: 10px; height: 10px; border: 0; box-sizing: border-box; background: transparent;
      box-shadow: inset 0 0 0 1.5px var(--ui-color-text-muted); }
    :host([data-variant="dots"]) .step.done .marker, :host([data-variant="dots"]) .step.active .marker { background: var(--ui-step-tone); box-shadow: none; }
    :host([data-variant="dots"]) .step.active .marker { box-shadow: 0 0 0 2px var(--ui-color-surface), 0 0 0 4px var(--ui-step-tone); }
    /* 6px between a line and a dot; beside the current dot 10px, so its 4px ring keeps the same 6px. */
    :host([data-variant="dots"]) .bar { flex: none; width: 8px; min-width: 8px; margin: 0 6px; }
    :host([data-variant="dots"]) .step.active .bar { margin-inline-start: 10px; }
    :host([data-variant="dots"]) .step:has(+ .step.active) .bar { margin-inline-end: 10px; }
    :host([data-variant="dots"][data-orientation="vertical"]) .step { padding-bottom: 20px; align-items: center; }
    :host([data-variant="dots"][data-orientation="vertical"]) .step:last-child { padding-bottom: 0; }
    :host([data-variant="dots"][data-orientation="vertical"]) .bar { inset-inline-start: 4.5px; top: 16px; bottom: 6px; width: 1px; min-width: 0; margin: 0; }
    :host([data-variant="dots"][data-orientation="vertical"]) .step.active .bar,
    :host([data-variant="dots"][data-orientation="vertical"]) .step:has(+ .step.active) .bar { margin: 0; }
    :host([data-variant="dots"][data-orientation="vertical"]) .step.active .bar { top: 20px; }
    :host([data-variant="dots"][data-orientation="vertical"]) .step:has(+ .step.active) .bar { bottom: 10px; }
  `,
})
export class UiStepper implements OnDestroy {
  steps = input<UiStep[]>([]);
  active = input(0);
  orientation = input<'horizontal' | 'vertical'>('horizontal');
  variant = input<'default' | 'dots'>('default');
  tone = input<'primary' | 'success'>('primary');
  /** An accessible name for the list of steps. */
  label = input('');
  protected readonly body = contentChild(UiStepBody);

  private host = inject<ElementRef<HTMLElement>>(ElementRef);
  private zone = inject(NgZone);
  private resize?: ResizeObserver;
  /** True while a horizontal stepper doesn't fit and is laid out vertically instead. */
  protected readonly squeezed = signal(false);
  /** The width the horizontal layout needed when it last didn't fit. */
  private needed = 0;
  /** The layout actually used. */
  protected readonly direction = computed(() =>
    this.orientation() === 'horizontal' && this.variant() === 'default' && this.squeezed() ? 'vertical' : this.orientation());

  constructor() {
    // New steps may fit again (or no longer): measure them laid out horizontally.
    effect(() => {
      this.steps();
      untracked(() => { if (this.squeezed()) this.squeezed.set(false); });
    });
    afterNextRender(() => {
      if (typeof ResizeObserver === 'undefined') return;
      this.zone.runOutsideAngular(() => {
        this.resize = new ResizeObserver(() => this.fit());
        this.resize.observe(this.host.nativeElement);
        this.resize.observe(this.host.nativeElement.querySelector('ol')!);
      });
      this.fit();
    });
  }

  ngOnDestroy(): void { this.resize?.disconnect(); }

  private fit(): void {
    if (this.orientation() !== 'horizontal' || this.variant() !== 'default') return;
    const host = this.host.nativeElement;
    const ol = host.querySelector('ol')!;
    if (!this.squeezed()) {
      if (ol.scrollWidth > ol.clientWidth + 1) {
        this.needed = ol.scrollWidth;
        this.squeezed.set(true);
      }
    } else if (host.clientWidth >= this.needed) {
      this.squeezed.set(false);
    }
  }
}
