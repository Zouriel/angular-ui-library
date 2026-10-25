import { Component, ElementRef, afterEveryRender, inject, input, viewChild } from '@angular/core';

let nextId = 0;

/** What the label points at: a control that marks itself, else the first text-like field. */
const CONTROL = '[data-ui-field-control]';
const FIELD = 'input:not([type="hidden"]):not([type="button"]):not([type="submit"]):not([type="reset"]), select, textarea';

/**
 * `ui-form-field` — label + hint + error wrapper for any control. The projected control is wrapped
 * by a `<label>`, and the label's `for` is pointed at the control's own text field (given an id if it
 * has none). Without that, a wrapping label names its first labelable element, which in
 * `ui-chip-input` or `ui-multi-select` is the first chip's remove button. A custom control can
 * pick its labelable element (input, select, textarea, button) with a `data-ui-field-control` attribute.
 */
@Component({
  selector: 'ui-form-field',
  template: `
    <div class="ui-field" [class.invalid]="!!error()">
      <label class="field-label" #lbl>
        @if (label()) {
          <span class="lbl">
            {{ label() }}
            @if (required()) { <span class="req" aria-hidden="true">*</span> }
          </span>
        }
        <ng-content />
      </label>
      @if (hint() && !error()) { <span class="hint">{{ hint() }}</span> }
      @if (error()) { <span class="error" role="alert">{{ error() }}</span> }
    </div>
  `,
  styles: `
    :host { display: block; }
    .ui-field { display: flex; flex-direction: column; gap: var(--ui-space-1); line-height: 1.35; }
    .field-label { display: flex; flex-direction: column; gap: var(--ui-space-1); }
    .lbl { font-family: var(--ui-font-default); font-size: var(--ui-font-size-sm); font-weight: 600; color: var(--ui-color-text); }
    .req { color: var(--ui-color-danger); margin-inline-start: 2px; }
    .hint { font-family: var(--ui-font-default); font-size: var(--ui-font-size-sm); color: var(--ui-color-text-muted); }
    .error { font-family: var(--ui-font-default); font-size: var(--ui-font-size-sm); color: var(--ui-color-danger); }
  `,
})
export class UiFormField {
  label = input<string>();
  hint = input<string>();
  error = input<string>();
  required = input(false);

  private readonly lbl = viewChild.required<ElementRef<HTMLLabelElement>>('lbl');

  constructor() {
    // After each render, since the projected control may render its field later (or swap it).
    afterEveryRender({ write: () => this.linkControl() });
  }

  private linkControl(): void {
    const label = this.lbl().nativeElement;
    const target = label.querySelector<HTMLElement>(CONTROL) ?? label.querySelector<HTMLElement>(FIELD);
    if (!target) {
      // No text field (e.g. a rating or segmented control): keep the implicit association.
      if (label.hasAttribute('for')) label.removeAttribute('for');
      return;
    }
    if (!target.id) target.id = `ui-field-control-${nextId++}`;
    if (label.htmlFor !== target.id) label.htmlFor = target.id;
  }
}
