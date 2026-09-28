import { Component, ElementRef, TemplateRef, computed, contentChild, forwardRef, inject, input, model, output, signal } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

export interface UiChoice {
  value: string;
  label: string;
  /** A second line under the label. */
  description?: string;
  /** Items with the same group are shown under that heading, in the order groups first appear. */
  group?: string;
  disabled?: boolean;
}

/** Context of the `#tile` template: the item, and whether it is chosen. */
export interface UiChoiceTileContext {
  $implicit: UiChoice;
  selected: boolean;
}

/**
 * `ui-choice-grid` — pick one of many options shown as tiles: presets, templates, effects. A radio
 * group underneath (CVA or `[(value)]`): arrow keys move through the tiles in reading order, only the
 * chosen one is in the tab order, and Enter/Space choose. Each tile shows its label (and description);
 * project `<ng-template #tile let-item let-selected="selected">` to draw a picture above it.
 *
 * `(picked)` fires on every choice, including choosing the selected tile again — for pickers where a
 * choice is an action (add this) rather than a setting.
 */
@Component({
  selector: 'ui-choice-grid',
  imports: [NgTemplateOutlet],
  providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => UiChoiceGrid), multi: true }],
  template: `
    <div class="wrap" role="radiogroup" [attr.aria-label]="label()">
      @for (section of sections(); track section.group) {
        @if (section.group) { <p class="heading">{{ section.group }}</p> }
        <div class="grid" [style.--ui-choice-min]="minTile()">
          @for (item of section.items; track item.value) {
            <button type="button" role="radio" class="tile" [class.on]="item.value === value()" [class.compact]="!tileTemplate()"
              [attr.aria-checked]="item.value === value()" [attr.tabindex]="tabStop() === item.value ? 0 : -1"
              [disabled]="disabled() || item.disabled" [attr.data-value]="item.value"
              (click)="choose(item)" (keydown)="onKey($event, item)">
              @if (tileTemplate(); as t) {
                <span class="art"><ng-container [ngTemplateOutlet]="t" [ngTemplateOutletContext]="{ $implicit: item, selected: item.value === value() }" /></span>
              }
              <span class="label">{{ item.label }}</span>
              @if (item.description) { <span class="desc">{{ item.description }}</span> }
            </button>
          }
        </div>
      }
    </div>
  `,
  styles: `
    :host { display: block; }
    .wrap { display: flex; flex-direction: column; gap: var(--ui-space-2); }
    .heading { margin: var(--ui-space-2) 0 0; font-size: var(--ui-font-size-sm); font-weight: 600; color: var(--ui-color-text-muted); }
    .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(var(--ui-choice-min, 88px), 1fr)); gap: var(--ui-space-2); }
    .tile { display: flex; flex-direction: column; align-items: stretch; gap: var(--ui-space-1); min-width: 0; padding: var(--ui-space-2);
      border: 1px solid var(--ui-color-border); border-radius: var(--ui-radius); background: var(--ui-color-surface); color: var(--ui-color-text);
      font-family: var(--ui-font-default); text-align: center; cursor: pointer;
      transition: border-color var(--ui-motion-base) var(--ui-ease-standard), background var(--ui-motion-base) var(--ui-ease-standard), transform var(--ui-motion-fast) var(--ui-ease-standard); }
    .tile.compact { text-align: left; }
    .tile:hover:not(:disabled) { border-color: var(--ui-color-primary); }
    .tile:active:not(:disabled) { transform: scale(var(--ui-scale-press)); }
    .tile:focus-visible { outline: none; box-shadow: var(--ui-focus-ring); }
    .tile.on { border-color: var(--ui-color-primary); background: color-mix(in srgb, var(--ui-color-primary) 12%, var(--ui-color-surface)); }
    .tile:disabled { opacity: 0.5; cursor: not-allowed; }
    .art { display: flex; align-items: center; justify-content: center; aspect-ratio: 1.4; border-radius: calc(var(--ui-radius) - 2px);
      background: var(--ui-color-surface-subtle); overflow: hidden; }
    .label { font-size: var(--ui-font-size-sm); line-height: 1.25; overflow: hidden; text-overflow: ellipsis; }
    .desc { font-size: var(--ui-font-size-sm); line-height: 1.3; color: var(--ui-color-text-muted); }
  `,
})
export class UiChoiceGrid implements ControlValueAccessor {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  options = input<readonly UiChoice[]>([]);
  label = input('Choices');
  /** Narrowest a tile may get. */
  minTile = input('88px');
  value = model<string | null>(null);
  readonly picked = output<UiChoice>();

  protected readonly tileTemplate = contentChild<TemplateRef<UiChoiceTileContext>>('tile');
  protected readonly disabled = signal(false);
  private onChange: (v: string | null) => void = () => {};
  protected onTouched: () => void = () => {};

  protected readonly sections = computed(() => {
    const out: { group: string; items: UiChoice[] }[] = [];
    for (const item of this.options()) {
      const group = item.group ?? '';
      let section = out.find((s) => s.group === group);
      if (!section) out.push((section = { group, items: [] }));
      section.items.push(item);
    }
    return out;
  });

  /** The chosen tile takes the tab stop; with none chosen, the first that can be. */
  protected readonly tabStop = computed(() => {
    const items = this.options().filter((o) => !o.disabled);
    return items.find((o) => o.value === this.value())?.value ?? items[0]?.value ?? null;
  });

  writeValue(v: string | null): void { this.value.set(v ?? null); }
  registerOnChange(fn: (v: string | null) => void): void { this.onChange = fn; }
  registerOnTouched(fn: () => void): void { this.onTouched = fn; }
  setDisabledState(d: boolean): void { this.disabled.set(d); }

  protected choose(item: UiChoice): void {
    if (item.disabled || this.disabled()) return;
    this.value.set(item.value);
    this.onChange(item.value);
    this.onTouched();
    this.picked.emit(item);
  }

  protected onKey(e: KeyboardEvent, item: UiChoice): void {
    const order = this.sections().flatMap((s) => s.items).filter((o) => !o.disabled);
    const i = order.indexOf(item);
    let next = -1;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = Math.min(order.length - 1, i + 1);
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') next = Math.max(0, i - 1);
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = order.length - 1;
    if (next < 0) return;
    e.preventDefault();
    const target = order[next];
    this.choose(target);
    Array.from(this.host.nativeElement.querySelectorAll<HTMLElement>('[data-value]')).find((b) => b.dataset['value'] === target.value)?.focus();
  }
}
