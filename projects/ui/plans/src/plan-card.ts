import { Component, computed, inject, input, model } from '@angular/core';
import { HugeiconsIconComponent } from '@hugeicons/angular';
import Tick02Icon from '@hugeicons/core-free-icons/Tick02Icon';
import { UI_CONFIG, type UiTier } from '@zouriel/ui';
import { UiBadge } from '@zouriel/ui/badge';

let nextId = 0;

/**
 * `ui-plan-card` — one plan or pass on a pricing page: name, price, what's included and an action.
 * A `tier` adds a slim strip of the tier's metal along the top and a small metal dot by the name; the
 * card itself stays on the theme's surface. `highlight` puts one label on the top edge ("Most popular")
 * and strengthens the border; `current` marks the reader's own plan. Project the button with
 * `[plan-action]` (it sits at the bottom, lined up across a `ui-plan-grid`) and small print under it
 * with `[plan-fineprint]`. The card is a group named by the plan; the price is read as one phrase
 * ("MVR 499 per event").
 *
 * `addOn` adds an optional extra under the features ("Add the AI designer", with `addOnNote` "+MVR 77 a
 * month" muted under it): a bordered row that ticks as a whole, bound with `[(addOnChecked)]`. The card
 * doesn't change its price; the caller shows the new total (on its button, say). One checkbox, named by
 * the label and the note. `addOnDisabled` greys it out.
 */
@Component({
  selector: 'ui-plan-card',
  imports: [UiBadge, HugeiconsIconComponent],
  template: `
    <div class="card" role="group" [attr.aria-labelledby]="nameId" [attr.data-tier]="tier()" [class.highlight]="!!highlight()" [class.no-radius]="!radius()">
      @if (tier()) { <span class="edge" aria-hidden="true"></span> }
      <div class="head">
        <h3 class="name" [id]="nameId">{{ name() }}</h3>
        @if (tier()) { <ui-badge class="dot" [tier]="tier()" [dot]="true" aria-hidden="true" /> }
        @if (current()) { <ui-badge class="current" tone="primary">{{ currentLabel() }}</ui-badge> }
      </div>
      @if (highlight()) { <span class="ribbon">{{ highlight() }}</span> }
      @if (tagline()) { <p class="tagline">{{ tagline() }}</p> }
      <p class="price">
        <span class="amount" aria-hidden="true">{{ price() }}</span>
        @if (period()) { <span class="period" aria-hidden="true">{{ period() }}</span> }
        <span class="sr-only">{{ priceLabel() }}</span>
      </p>
      @if (note()) { <p class="note">{{ note() }}</p> }
      @if (features().length) {
        <ul class="features">
          @for (f of features(); track $index) {
            <li><hugeicons-icon [icon]="tick" [size]="16" [strokeWidth]="2" aria-hidden="true" /><span>{{ f }}</span></li>
          }
        </ul>
      }
      @if (addOn()) {
        <label class="addon" [class.on]="addOnChecked()" [class.disabled]="addOnDisabled()">
          <input
            type="checkbox"
            class="native"
            [checked]="addOnChecked()"
            [disabled]="addOnDisabled()"
            [attr.aria-label]="addOnName()"
            (change)="toggleAddOn($event)" />
          <span class="box" aria-hidden="true">
            <svg viewBox="0 0 16 16" class="tick"><path d="M3 8.5l3 3 7-7" /></svg>
          </span>
          <span class="addon-text" aria-hidden="true">
            <span class="addon-label">{{ addOn() }}</span>
            @if (addOnNote()) { <span class="addon-note">{{ addOnNote() }}</span> }
          </span>
        </label>
      }
      <div class="foot">
        <div class="action"><ng-content select="[plan-action]" /></div>
        <div class="fineprint"><ng-content select="[plan-fineprint]" /></div>
      </div>
    </div>
  `,
  styles: `
    :host { display: block; }
    .card {
      --_edge: var(--ui-color-primary);
      position: relative; box-sizing: border-box;
      display: flex; flex-direction: column;
      /* Fill a stretched grid cell, so cards in a row are equal height and their actions line up. */
      height: 100%;
      padding: var(--ui-space-6);
      background: var(--ui-color-surface); color: var(--ui-color-text);
      border: 1px solid var(--ui-color-border);
      border-radius: var(--ui-radius-lg);
      box-shadow: var(--ui-shadow-1);
      font-family: var(--ui-font-default); line-height: 1.4;
    }
    .card.no-radius { border-radius: 0; }
    .card[data-tier="gold"] { --_edge: var(--ui-tier-gold-border); --_sheen: var(--ui-gradient-tier-gold); --_on: var(--ui-tier-gold-contrast); }
    .card[data-tier="platinum"] { --_edge: var(--ui-tier-platinum-border); --_sheen: var(--ui-gradient-tier-platinum); --_on: var(--ui-tier-platinum-contrast); }
    .card[data-tier="premium"] { --_edge: var(--ui-tier-premium-border); --_sheen: var(--ui-gradient-tier-premium); --_on: var(--ui-tier-premium-contrast); }
    /* The tier: a 4px strip of its metal along the top, inside the border. The layer covers the whole
       card so its rounded corners bend the strip with the card's (a 4px-tall box can't hold the radius). */
    .edge {
      position: absolute; inset: 0; pointer-events: none;
      background: var(--_sheen) top / 100% 4px no-repeat;
      border-radius: calc(var(--ui-radius-lg) - 1px);
    }
    .card.no-radius .edge { border-radius: 0; }
    /* The highlight: a second pixel of border drawn inside (content doesn't move) and a label on the top edge. */
    .card.highlight { border-color: var(--_edge); box-shadow: inset 0 0 0 1px var(--_edge), var(--ui-shadow-1); }
    .ribbon {
      position: absolute; top: 0; left: 50%; transform: translate(-50%, -50%);
      box-sizing: border-box; height: 24px; max-width: calc(100% - 2 * var(--ui-space-4));
      display: inline-flex; align-items: center; padding: 0 var(--ui-space-3);
      overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
      border-radius: var(--ui-radius-pill); border: 1px solid var(--ui-color-primary);
      background: var(--ui-color-primary); color: var(--ui-color-primary-contrast);
      font-size: 12px; font-weight: 600; line-height: 1.2;
    }
    .card[data-tier] .ribbon { background: var(--_sheen); color: var(--_on); border-color: var(--_edge); }
    .head { display: flex; align-items: center; gap: var(--ui-space-2); min-width: 0; }
    .name { margin: 0; min-width: 0; font-size: calc(18px * var(--ui-font-scale)); font-weight: 600; line-height: 1.3; overflow-wrap: anywhere; }
    .current { margin-inline-start: auto; }
    p { margin: 0; }
    .tagline { margin-top: var(--ui-space-1); font-size: calc(13px * var(--ui-font-scale)); color: var(--ui-color-text-secondary); }
    .price { margin-top: var(--ui-space-4); display: flex; flex-wrap: wrap; align-items: baseline; gap: var(--ui-space-1); }
    .amount { font-size: calc(28px * var(--ui-font-scale)); font-weight: 700; line-height: 1.15; letter-spacing: var(--ui-tracking-tight); font-variant-numeric: tabular-nums; }
    .period { font-size: calc(13px * var(--ui-font-scale)); color: var(--ui-color-text-secondary); }
    .note { margin-top: var(--ui-space-1); font-size: calc(13px * var(--ui-font-scale)); color: var(--ui-color-text-muted); }
    .features { list-style: none; margin: var(--ui-space-4) 0 0; padding: 0; display: flex; flex-direction: column; gap: var(--ui-space-2); }
    .features li { display: flex; align-items: flex-start; gap: var(--ui-space-2); font-size: calc(14px * var(--ui-font-scale)); line-height: 1.45; }
    .features hugeicons-icon { flex: none; margin-top: 2px; color: var(--ui-color-success); }
    /* The add-on: one row that ticks as a whole; ticked, its border takes the tier's (or primary). */
    .addon {
      position: relative; box-sizing: border-box;
      margin-top: var(--ui-space-4);
      display: flex; align-items: flex-start; gap: var(--ui-space-3);
      padding: var(--ui-space-3) var(--ui-space-4);
      background: var(--ui-color-surface-subtle);
      border: 1px solid var(--ui-color-border);
      border-radius: var(--ui-radius);
      cursor: pointer;
      transition: border-color var(--ui-motion-fast) var(--ui-ease-standard), background var(--ui-motion-fast) var(--ui-ease-standard);
    }
    .card.no-radius .addon { border-radius: 0; }
    .addon:not(.disabled):hover { background: var(--ui-color-surface-hover); }
    .addon.on { border-color: var(--_edge); }
    .addon.disabled { opacity: .5; cursor: not-allowed; }
    .addon:has(.native:focus-visible) { box-shadow: var(--ui-focus-ring); }
    .addon .native { position: absolute; opacity: 0; width: 0; height: 0; margin: 0; }
    .addon .box {
      display: inline-flex; align-items: center; justify-content: center;
      box-sizing: border-box; width: 18px; height: 18px; flex: none; margin-top: 1px;
      border: 1px solid var(--ui-control-border); border-radius: var(--ui-radius-xs);
      background: var(--ui-color-surface);
      transition: background var(--ui-motion-fast) var(--ui-ease-standard), border-color var(--ui-motion-fast) var(--ui-ease-standard);
    }
    .addon .tick { width: 12px; height: 12px; fill: none; stroke: var(--ui-color-primary-contrast); stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; stroke-dasharray: 16; stroke-dashoffset: 16; transition: stroke-dashoffset var(--ui-motion-base) var(--ui-ease-standard); }
    .addon .native:checked + .box { background: var(--ui-color-primary); border-color: var(--ui-color-primary); }
    .addon .native:checked + .box .tick { stroke-dashoffset: 0; }
    .addon:not(.disabled):hover .native:not(:checked) + .box { border-color: var(--ui-color-primary); }
    .addon-text { min-width: 0; display: flex; flex-direction: column; gap: 2px; }
    .addon-label { font-size: calc(14px * var(--ui-font-scale)); font-weight: 600; line-height: 1.35; overflow-wrap: anywhere; }
    .addon-note { font-size: calc(13px * var(--ui-font-scale)); line-height: 1.35; color: var(--ui-color-text-muted); overflow-wrap: anywhere; }
    /* The action takes the slack, so it sits at the bottom of a stretched card. */
    .foot { margin-top: auto; padding-top: var(--ui-space-6); display: flex; flex-direction: column; }
    .foot:has(.action:empty):has(.fineprint:empty) { display: none; }
    .action:empty, .fineprint:empty { display: none; }
    .fineprint { margin-top: var(--ui-space-2); font-size: 12px; color: var(--ui-color-text-muted); text-align: center; }
    .sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
  `,
})
export class UiPlanCard {
  private config = inject(UI_CONFIG);
  protected readonly tick = Tick02Icon;
  protected readonly nameId = `ui-plan-name-${nextId++}`;
  /** The plan's name; it also names the card for screen readers. */
  name = input.required<string>();
  /** The price, already formatted ("MVR 499"). */
  price = input.required<string>();
  /** What the price covers ("per event", "a month"). Read with the price: "MVR 499 per event". */
  period = input<string | null>(null);
  /** A small line under the price ("about $32"). */
  note = input<string | null>(null);
  /** One line under the name. */
  tagline = input<string | null>(null);
  /** What's included, shown as a check list. */
  features = input<readonly string[]>([]);
  /** The plan's tier: a strip of its metal along the top and a metal dot by the name. */
  tier = input<UiTier | null>(null);
  /** One label on the top edge ("Most popular") and a stronger border. Use on one card per grid. */
  highlight = input<string | null>(null);
  /** The reader's own plan: shows `currentLabel` as a badge. The action is the caller's to choose. */
  current = input(false);
  currentLabel = input('Your plan');
  radius = input<boolean>(this.config.radius);
  /** An optional extra under the features, shown as a tick row ("Add the AI designer"). Nothing shows without it. */
  addOn = input<string | null>(null);
  /** A muted second line in the add-on row ("+MVR 77 a month, about $5"). */
  addOnNote = input<string | null>(null);
  /** Whether the add-on is ticked; two-way: `[(addOnChecked)]`. */
  addOnChecked = model(false);
  /** Greys the add-on out and stops it toggling. */
  addOnDisabled = input(false);
  /** The add-on checkbox's accessible name: the label and the note. */
  protected readonly addOnName = computed(() => [this.addOn(), this.addOnNote()].filter((s) => !!s).join(', '));
  protected toggleAddOn(e: Event): void {
    this.addOnChecked.set((e.target as HTMLInputElement).checked);
  }
  /** What screen readers hear for the price. */
  protected readonly priceLabel = computed(() => [this.price(), this.period()].filter((s) => !!s).join(' '));
}
