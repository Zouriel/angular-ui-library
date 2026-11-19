import { Component, ElementRef, effect, forwardRef, input, signal, untracked, viewChild, computed } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { HugeiconsIconComponent } from '@hugeicons/angular';
import Edit02Icon from '@hugeicons/core-free-icons/Edit02Icon';
import { injectUiStrings } from '@zouriel/ui';
import type { TextVariant } from '@zouriel/ui/text';

/** `ui-editable-text` — click-to-edit inline text (CVA). Enter commits, Escape cancels. */
@Component({
  selector: 'ui-editable-text',
  imports: [HugeiconsIconComponent],
  host: {
    '[class.flush]': 'flush()',
    '[class.block]': 'block()',
    '[class.on-media]': 'onMedia()',
    '[attr.data-variant]': 'variant()',
  },
  template: `
    @if (editing()) {
      <input #inp class="edit" [value]="draft()" [disabled]="disabled()"
             (input)="draft.set($any($event.target).value)"
             (keydown.enter)="commit()" (keydown.escape)="cancel()" (blur)="commit()" />
    } @else {
      <button type="button" class="view" [disabled]="disabled()" (click)="edit()">
        <span [class.placeholder]="!value()">{{ value() || placeholderText() }}</span>
        <span class="pencil" aria-hidden="true">
          <hugeicons-icon [icon]="editIcon" [size]="13" [strokeWidth]="1.8" />
        </span>
      </button>
    }
  `,
  styles: `
    :host { display: inline-block; max-width: 100%; }
    :host(.block) { display: block; width: 100%; }
    :host(.block) .view, :host(.block) .edit { width: 100%; box-sizing: border-box; }
    /* variant (0.89.0): the look of the matching ui-text variant, on both the text and the field. */
    :host([data-variant="h1"]) { --ee-size: var(--ui-font-size-h1); --ee-weight: 700; --ee-lh: 1.1; --ee-track: var(--ui-tracking-tighter); --ee-font: var(--ui-font-display); }
    :host([data-variant="h2"]) { --ee-size: var(--ui-font-size-h2); --ee-weight: 700; --ee-lh: 1.18; --ee-track: var(--ui-tracking-tight); --ee-font: var(--ui-font-display); }
    :host([data-variant="h3"]) { --ee-size: var(--ui-font-size-h3); --ee-weight: 600; --ee-lh: 1.35; --ee-track: var(--ui-tracking-tight); --ee-font: var(--ui-font-display); }
    :host([data-variant="h4"]) { --ee-size: var(--ui-font-size-lg); --ee-weight: 600; }
    :host([data-variant="h5"]) { --ee-size: var(--ui-font-size-h5); --ee-weight: 600; }
    :host([data-variant="h6"]) { --ee-size: var(--ui-font-size-h6); --ee-weight: 600; }
    :host([data-variant="caption"]) { --ee-size: var(--ui-font-size-sm); }
    :host([data-variant="label"]) { --ee-size: var(--ui-font-size-sm); --ee-weight: 600; }
    :host([data-variant="code"]) { --ee-size: var(--ui-font-size-sm); --ee-font: var(--ui-font-mono); }
    .view { display: inline-flex; align-items: center; gap: var(--ui-space-2); background: none; border: 1px solid transparent;
      border-radius: var(--ui-radius); padding: 2px var(--ui-space-2); cursor: text; color: var(--ui-color-text);
      text-align: start; max-width: 100%;
      font-family: var(--ee-font, var(--ui-font-default)); font-size: var(--ee-size, var(--ui-font-size-md)); line-height: var(--ee-lh, 1.35);
      font-weight: var(--ee-weight, inherit); letter-spacing: var(--ee-track, normal); }
    .view:hover:not(:disabled) { border-color: var(--ui-color-border); }
    .view:focus-visible { outline: none; box-shadow: var(--ui-focus-ring); }
    .view:disabled { opacity: .5; cursor: not-allowed; }
    .placeholder { color: var(--ui-color-text-muted); }
    .pencil { opacity: 0; display: inline-flex; align-items: center; flex: none; color: var(--ui-color-text-muted); }
    .view:hover .pencil, .view:focus-visible .pencil { opacity: 1; }
    /* Touch has no hover, so the edit affordance is always shown there. */
    @media (hover: none) { .pencil { opacity: 1; } }
    /* flush (0.82.0): the text starts on the line its neighbours start on, as a heading's text does; the box's
       padding and border (its hover outline, the field) reach out past that line instead of pushing the text in. */
    :host(.flush) .view, :host(.flush) .edit { margin-inline-start: calc(-1 * (var(--ui-space-2) + 1px)); }
    .edit { padding: 2px var(--ui-space-2); background: var(--ui-color-surface); border: 1px solid var(--ui-color-primary);
      border-radius: var(--ui-radius); color: var(--ui-color-text); font-family: var(--ee-font, var(--ui-font-default)); font-size: var(--ee-size, var(--ui-font-size-md)); line-height: var(--ee-lh, 1.35);
      font-weight: var(--ee-weight, inherit); letter-spacing: var(--ee-track, normal);
      max-width: 100%; box-sizing: border-box; text-shadow: none;
      outline: none; box-shadow: var(--ui-focus-ring); }
    /* onMedia (0.89.0), or inside a [data-on-media] scope: light ink with a soft shadow over the picture, a translucent
       hover, a light pencil; the field while editing stays an ordinary opaque input. */
    :host(.on-media) .view, :host-context([data-on-media]) .view { color: var(--ui-media-on-scrim);
      text-shadow: 0 1px 4px color-mix(in srgb, var(--ui-media-scrim) 55%, transparent); }
    :host(.on-media) .view:hover:not(:disabled), :host-context([data-on-media]) .view:hover:not(:disabled) {
      background: color-mix(in srgb, var(--ui-media-scrim) 28%, transparent);
      border-color: color-mix(in srgb, var(--ui-media-on-scrim) 45%, transparent); }
    :host(.on-media) .placeholder, :host-context([data-on-media]) .placeholder { color: color-mix(in srgb, var(--ui-media-on-scrim) 78%, transparent); }
    :host(.on-media) .pencil, :host-context([data-on-media]) .pencil {
      color: var(--ui-media-on-scrim);
      filter: drop-shadow(0 1px 2px color-mix(in srgb, var(--ui-media-scrim) 55%, transparent)); }
  `,
  providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => UiEditableText), multi: true }],
})
export class UiEditableText implements ControlValueAccessor {
  protected readonly strings = injectUiStrings();
  /** Drawn, not ✎ — a glyph is whatever the reader's font has, and inherits no colour. */
  protected readonly editIcon = Edit02Icon;
  /** Default: the built-in `empty` (Empty), which follows the app's language. */
  placeholder = input<string | undefined>(undefined);
  /**
   * Line the text up with what's above and below it (a label, a heading): the hover outline and the field reach out
   * to the start instead of indenting the text by their padding. Off by default; the box then sits where it is put.
   */
  flush = input(false);
  /** Typography of the text and the field, as `ui-text` variants (h1..h6, body, caption, label). Default `body`. */
  variant = input<TextVariant>('body');
  /** Full-width box: the text and the field fill their row. Off by default (inline-sized). */
  block = input(false);
  /** Over a photo: light ink, soft shadow, translucent hover. Also on automatically inside a `[data-on-media]` scope. */
  onMedia = input(false);
  protected readonly placeholderText = computed(() => this.placeholder() ?? this.strings.empty);
  private inp = viewChild<ElementRef<HTMLInputElement>>('inp');

  protected readonly value = signal('');
  protected readonly draft = signal('');
  protected readonly editing = signal(false);
  protected readonly disabled = signal(false);
  private onChange: (v: string) => void = () => {};
  protected onTouched: () => void = () => {};

  writeValue(v: string): void { this.value.set(v ?? ''); }
  registerOnChange(fn: (v: string) => void): void { this.onChange = fn; }
  registerOnTouched(fn: () => void): void { this.onTouched = fn; }
  setDisabledState(d: boolean): void { this.disabled.set(d); }

  constructor() {
    // Focus the field once it exists. A microtask after switching to editing ran before the input was
    // rendered, so it opened unfocused and needed a second click before typing did anything.
    effect(() => {
      const el = this.inp()?.nativeElement;
      if (!el || !this.editing()) return;
      untracked(() => { el.focus(); el.select(); });
    });
  }

  protected edit(): void {
    if (this.disabled()) return;
    this.draft.set(this.value());
    this.editing.set(true);
  }
  protected commit(): void {
    if (!this.editing()) return;
    this.value.set(this.draft());
    this.editing.set(false);
    this.onChange(this.value());
    this.onTouched();
  }
  protected cancel(): void { this.editing.set(false); }
}
