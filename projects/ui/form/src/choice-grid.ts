import { Component, ElementRef, TemplateRef, computed, contentChild, forwardRef, inject, input, model, output, signal } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { HugeiconsIconComponent } from '@hugeicons/angular';
import Tick02Icon from '@hugeicons/core-free-icons/Tick02Icon';
import { uiLogicalKey } from '@zouriel/ui';

/** How a compact tile (no `#tile` template) lays out its words: from the start edge, or centred both ways. */
export type UiChoiceAlign = 'start' | 'center';

/** A colour for one tile: tinted at rest, stronger on hover, the tone's border, subtle fill and a tick when chosen. */
export type UiChoiceTone = 'primary' | 'success' | 'info' | 'warning' | 'danger' | 'neutral';

export interface UiChoice {
  value: string;
  label: string;
  /** A second line under the label. */
  description?: string;
  /** Items with the same group are shown under that heading, in the order groups first appear. */
  group?: string;
  disabled?: boolean;
  /** Colours the tile (see UiChoiceTone). Left out, the tile looks as it always has. */
  tone?: UiChoiceTone;
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
 * `align="center"` centres the words of compact tiles; a `tone` on an item colours its tile (a rating
 * scale from success to danger, say).
 *
 * `(picked)` fires on every choice, including choosing the selected tile again — for pickers where a
 * choice is an action (add this) rather than a setting.
 */
@Component({
  selector: 'ui-choice-grid',
  imports: [NgTemplateOutlet, HugeiconsIconComponent],
  providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => UiChoiceGrid), multi: true }],
  template: `
    <div class="wrap" role="radiogroup" [attr.aria-label]="label()">
      @for (section of sections(); track section.group) {
        @if (section.group) { <p class="heading">{{ section.group }}</p> }
        <div class="grid" [style.--ui-choice-min]="minTile()">
          @for (item of section.items; track item.value) {
            <button type="button" role="radio" class="tile" [class.on]="item.value === value()" [class.compact]="!tileTemplate()"
              [class.center]="align() === 'center'" [class.toned]="!!item.tone" [attr.data-tone]="item.tone ?? null"
              [attr.aria-checked]="item.value === value()" [attr.tabindex]="tabStop() === item.value ? 0 : -1"
              [disabled]="disabled() || item.disabled" [attr.data-value]="item.value"
              (click)="choose(item)" (keydown)="onKey($event, item)">
              @if (tileTemplate(); as t) {
                <span class="art"><ng-container [ngTemplateOutlet]="t" [ngTemplateOutletContext]="{ $implicit: item, selected: item.value === value() }" /></span>
              }
              <span class="label">{{ item.label }}</span>
              @if (item.description) { <span class="desc">{{ item.description }}</span> }
              @if (item.tone) { <span class="check" aria-hidden="true"><hugeicons-icon [icon]="tick" [size]="10" [strokeWidth]="2.5" /></span> }
            </button>
          }
        </div>
      }
    </div>
  `,
  styles: `
    :host { display: block; }
    .wrap { display: flex; flex-direction: column; gap: var(--ui-space-2); line-height: 1.35; }
    .heading { margin: var(--ui-space-2) 0 0; font-size: var(--ui-font-size-sm); font-weight: 600; color: var(--ui-color-text-muted); }
    .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(var(--ui-choice-min, 88px), 1fr)); gap: var(--ui-space-2); }
    .tile { display: flex; flex-direction: column; align-items: stretch; gap: var(--ui-space-1); min-width: 0; padding: var(--ui-space-2);
      border: 1px solid var(--ui-color-border); border-radius: var(--ui-radius); background: var(--ui-color-surface); color: var(--ui-color-text);
      font-family: var(--ui-font-default); text-align: center; cursor: pointer;
      transition: border-color var(--ui-motion-base) var(--ui-ease-standard), background var(--ui-motion-base) var(--ui-ease-standard), box-shadow var(--ui-motion-base) var(--ui-ease-standard), transform var(--ui-motion-fast) var(--ui-ease-standard); }
    .tile.compact { text-align: start; }
    .tile.compact.center { align-items: center; justify-content: center; text-align: center; }
    .tile:hover:not(:disabled) { border-color: color-mix(in srgb, var(--ui-color-primary) 50%, var(--ui-color-border)); background: var(--ui-color-surface-hover); }
    .tile:active:not(:disabled) { transform: scale(var(--ui-scale-press)); }
    .tile:focus-visible { outline: none; box-shadow: var(--ui-focus-ring); }
    .tile.on, .tile.on:hover:not(:disabled) { border-color: var(--ui-color-primary); background: var(--ui-color-selected); }
    .tile:disabled { opacity: 0.5; cursor: not-allowed; }
    .art { display: flex; align-items: center; justify-content: center; aspect-ratio: 1.4; border-radius: calc(var(--ui-radius) - 2px);
      background: var(--ui-color-surface-subtle); overflow: hidden; }
    .label { font-size: var(--ui-font-size-sm); line-height: 1.25; overflow: hidden; text-overflow: ellipsis; }
    .desc { font-size: var(--ui-font-size-sm); line-height: 1.3; color: var(--ui-color-text-muted); }
    /*
     * Tones: a light wash of the tone over the surface and a tone-tinted edge at rest, both stronger on
     * hover; chosen, the tone's own border (doubled with an inset ring, so nothing shifts), its -subtle
     * fill and a tick badge in the corner. The label keeps the theme's ink and the description leans a
     * quarter toward it, so both hold AA on every wash (see the style contract). Toned tiles get a little more room so the badge never sits on the words.
     */
    .tile[data-tone='primary'] { --ui-choice-tone: var(--ui-color-primary); --ui-choice-ink: var(--ui-color-primary-contrast);
      --ui-choice-subtle: color-mix(in srgb, var(--ui-color-primary) 10%, var(--ui-color-surface)); }
    .tile[data-tone='success'] { --ui-choice-tone: var(--ui-color-success); --ui-choice-ink: var(--ui-color-success-contrast); --ui-choice-subtle: var(--ui-color-success-subtle); }
    .tile[data-tone='info'] { --ui-choice-tone: var(--ui-color-info); --ui-choice-ink: var(--ui-color-info-contrast); --ui-choice-subtle: var(--ui-color-info-subtle); }
    .tile[data-tone='warning'] { --ui-choice-tone: var(--ui-color-warning); --ui-choice-ink: var(--ui-color-warning-contrast); --ui-choice-subtle: var(--ui-color-warning-subtle); }
    .tile[data-tone='danger'] { --ui-choice-tone: var(--ui-color-danger); --ui-choice-ink: var(--ui-color-danger-contrast); --ui-choice-subtle: var(--ui-color-danger-subtle); }
    .tile[data-tone='neutral'] { --ui-choice-tone: var(--ui-color-text-muted); --ui-choice-ink: var(--ui-color-surface); --ui-choice-subtle: var(--ui-color-neutral-subtle); }
    .tile.toned { position: relative; padding: var(--ui-space-4) var(--ui-space-3);
      border-color: color-mix(in srgb, var(--ui-choice-tone) 50%, var(--ui-color-border));
      background: color-mix(in srgb, var(--ui-choice-tone) 5%, var(--ui-color-surface)); }
    .tile.toned .desc { color: color-mix(in srgb, var(--ui-color-text-muted) 75%, var(--ui-color-text)); }
    .tile.toned:hover:not(:disabled) { border-color: color-mix(in srgb, var(--ui-choice-tone) 80%, var(--ui-color-border));
      background: color-mix(in srgb, var(--ui-choice-tone) 8%, var(--ui-color-surface)); }
    .tile.toned.on, .tile.toned.on:hover:not(:disabled) { border-color: var(--ui-choice-tone); background: var(--ui-choice-subtle);
      box-shadow: inset 0 0 0 1px var(--ui-choice-tone); }
    .tile.toned.on:focus-visible { box-shadow: inset 0 0 0 1px var(--ui-choice-tone), var(--ui-focus-ring); }
    .check { position: absolute; inset-block-start: 6px; inset-inline-end: 6px; display: grid; place-items: center; --ui-color-icon: currentColor;
      width: 14px; height: 14px; border-radius: 50%; background: var(--ui-choice-tone); color: var(--ui-choice-ink);
      opacity: 0; transform: scale(0.5); pointer-events: none;
      transition: opacity var(--ui-motion-fast) var(--ui-ease-standard), transform var(--ui-motion-base) var(--ui-ease-spring); }
    .tile.on .check { opacity: 1; transform: none; }
    @media (prefers-reduced-motion: reduce) { .check { transform: none; } }
  `,
})
export class UiChoiceGrid implements ControlValueAccessor {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  options = input<readonly UiChoice[]>([]);
  label = input('Choices');
  /** Narrowest a tile may get. */
  minTile = input('88px');
  /** `center` centres a compact tile's label and description, across and down (tiles with a `#tile` template are always centred). */
  align = input<UiChoiceAlign>('start');
  value = model<string | null>(null);
  readonly picked = output<UiChoice>();

  protected readonly tick = Tick02Icon;
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
    const key = uiLogicalKey(e);
    if (key === 'ArrowRight' || key === 'ArrowDown') next = Math.min(order.length - 1, i + 1);
    else if (key === 'ArrowLeft' || key === 'ArrowUp') next = Math.max(0, i - 1);
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = order.length - 1;
    if (next < 0) return;
    e.preventDefault();
    const target = order[next];
    this.choose(target);
    Array.from(this.host.nativeElement.querySelectorAll<HTMLElement>('[data-value]')).find((b) => b.dataset['value'] === target.value)?.focus();
  }
}
