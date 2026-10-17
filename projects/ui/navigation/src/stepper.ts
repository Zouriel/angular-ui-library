import { Component, Directive, TemplateRef, contentChild, inject, input } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';

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
 *   template under each step.
 * - `variant`: `default` (numbered markers with labels) or `dots` (small dots only, labels kept
 *   for screen readers and as tooltips): a compact progress strip.
 * - `tone`: the colour of finished and active steps, `primary` (default) or `success`.
 */
@Component({
  selector: 'ui-stepper',
  imports: [NgTemplateOutlet],
  host: { '[attr.data-orientation]': 'orientation()', '[attr.data-variant]': 'variant()', '[attr.data-tone]': 'tone()' },
  template: `
    <ol class="ui-stepper" [attr.aria-label]="label() || null">
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
            @if (body() && orientation() === 'vertical' && variant() === 'default') {
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
    :host([data-orientation="vertical"]) .bar { position: absolute; left: 11.5px; top: 28px; bottom: 4px; width: 1px; height: auto; min-width: 0; margin: 0; }
    .body { margin-top: var(--ui-space-2); font-size: var(--ui-font-size-sm); color: var(--ui-color-text); }

    /* Dots: a compact strip of 10px dots. Finished steps take the tone, the active one too with a
       ring, steps not reached yet are solid in the text colour (black on light themes). */
    :host([data-variant="dots"]) .step { gap: 0; flex: 0 0 auto; }
    :host([data-variant="dots"]) .marker { width: 10px; height: 10px; border: 0; background: var(--ui-color-text); }
    :host([data-variant="dots"]) .step.done .marker, :host([data-variant="dots"]) .step.active .marker { background: var(--ui-step-tone); }
    :host([data-variant="dots"]) .step.active .marker { box-shadow: 0 0 0 2px var(--ui-color-surface), 0 0 0 4px var(--ui-step-tone); }
    :host([data-variant="dots"]) .bar { flex: none; width: 8px; min-width: 8px; margin: 0 2px; }
    :host([data-variant="dots"][data-orientation="vertical"]) .step { padding-bottom: 12px; align-items: center; }
    :host([data-variant="dots"][data-orientation="vertical"]) .step:last-child { padding-bottom: 0; }
    :host([data-variant="dots"][data-orientation="vertical"]) .bar { left: 4.5px; top: 12px; bottom: 2px; width: 1px; }

    /* Narrow screens: keep only the active step labelled so all markers fit without clipping. */
    @media (max-width: 560px) {
      :host(:not([data-orientation="vertical"])) .step { gap: var(--ui-space-1); }
      :host(:not([data-orientation="vertical"])[data-variant="default"]) .step:not(.active) .text { display: none; }
      :host(:not([data-orientation="vertical"])) .bar { min-width: var(--ui-space-2); margin: 0 var(--ui-space-1); }
    }
  `,
})
export class UiStepper {
  steps = input<UiStep[]>([]);
  active = input(0);
  orientation = input<'horizontal' | 'vertical'>('horizontal');
  variant = input<'default' | 'dots'>('default');
  tone = input<'primary' | 'success'>('primary');
  /** An accessible name for the list of steps. */
  label = input('');
  protected readonly body = contentChild(UiStepBody);
}
