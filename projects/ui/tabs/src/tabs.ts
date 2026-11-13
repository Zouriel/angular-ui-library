import {
  Component, ElementRef, contentChildren, effect, inject, input, model, signal, computed,
} from '@angular/core';
import { HugeiconsIconComponent } from '@hugeicons/angular';
import type { IconSvgObject } from '@hugeicons/angular';
import { uiLogicalKey, injectUiStrings, UiTourAnchor } from '@zouriel/ui';

let tabSeq = 0;

/**
 * `ui-tab` — a single tab + its panel. Provide a `label` and project the panel
 * content. Inactive panels stay in the DOM but are hidden (`[hidden]`).
 *
 * An optional HugeIcons `icon` draws before the label. With `iconOnly` the label is not shown, but it
 * is still the tab's accessible name and its tooltip, so a screen reader and a hovering mouse both get
 * the words the icon stands for.
 */
@Component({
  selector: 'ui-tab',
  template: `
    <div
      role="tabpanel"
      [id]="panelId"
      [attr.aria-labelledby]="tabId"
      [hidden]="!active()"
      tabindex="0">
      <ng-content />
    </div>
  `,
  styles: `:host { display: block; }`,
})
export class UiTab {
  label = input.required<string>();
  disabled = input(false);
  /** A HugeIcons icon drawn before the label. */
  icon = input<IconSvgObject | undefined>(undefined);
  /** Show only the icon. The label stays as the accessible name and the tooltip. */
  iconOnly = input(false);
  /** A tour anchor id (`uiTourAnchor`) for this tab's button in the strip, so a tour step can point at it. */
  anchor = input<string | undefined>(undefined);
  /**
   * A small count after the label (e.g. unread messages). Nothing shows for null, '' or 0 (0.79.0).
   * Screen readers hear it after the label, or `badgeLabel` instead when given ("3 new").
   */
  badge = input<string | number | null | undefined>(null);
  badgeLabel = input<string | undefined>(undefined);
  /** The badge as shown, or null when there is none. */
  readonly badgeText = computed(() => {
    const b = this.badge();
    return b === null || b === undefined || b === '' || b === 0 || b === '0' ? null : String(b);
  });
  readonly active = signal(false);
  readonly tabId = `ui-tab-${tabSeq}`;
  readonly panelId = `ui-tabpanel-${tabSeq++}`;
}

/**
 * `ui-tabs` — WAI-ARIA tabs. Wraps `ui-tab` children; renders a tablist with
 * roving tabindex and Arrow/Home/End keyboard navigation.
 */
@Component({
  selector: 'ui-tabs',
  imports: [HugeiconsIconComponent, UiTourAnchor],
  template: `
    <div class="tablist" role="tablist" [attr.aria-label]="labelText()">
      @for (tab of tabs(); track tab.tabId; let i = $index) {
        <button
          type="button"
          role="tab"
          class="tab"
          [uiTourAnchor]="tab.anchor()"
          [id]="tab.tabId"
          [attr.aria-controls]="tab.panelId"
          [attr.aria-selected]="selectedIndex() === i"
          [attr.tabindex]="selectedIndex() === i ? 0 : -1"
          [disabled]="tab.disabled()"
          [class.tab--icon]="tab.iconOnly() && !!tab.icon()"
          [attr.aria-label]="tab.iconOnly() && tab.icon() ? tab.label() + (tab.badgeText() ? ', ' + (tab.badgeLabel() ?? tab.badgeText()) : '') : null"
          [attr.title]="tab.iconOnly() && tab.icon() ? tab.label() : null"
          (click)="select(i)"
          (keydown)="onKeydown($event, i)">
          @if (tab.icon(); as icon) {
            <hugeicons-icon class="tab__icon" aria-hidden="true" [icon]="icon" [size]="tab.iconOnly() ? 22 : 18" [strokeWidth]="1.8" />
          }
          @if (!tab.iconOnly() || !tab.icon()) {
            <span class="tab__label">{{ tab.label() }}</span>
          }
          @if (tab.badgeText(); as b) {
            <span class="tab__badge" [attr.aria-hidden]="tab.badgeLabel() || (tab.iconOnly() && tab.icon()) ? 'true' : null">{{ b }}</span>
            @if (tab.badgeLabel(); as bl) {
              @if (!tab.iconOnly() || !tab.icon()) { <span class="tab__sr">{{ bl }}</span> }
            }
          }
        </button>
      }
    </div>
    <ng-content />
  `,
  styles: `
    :host { display: block; }
    /* More tabs than fit is normal on a phone, so the strip SCROLLS rather than pushing the page
       sideways — a tablist wide enough to overflow the viewport takes the whole layout with it. */
    .tablist {
      display: flex;
      gap: var(--ui-space-1);
      border-bottom: 1px solid var(--ui-color-border);
      margin-bottom: var(--ui-space-4);
      overflow-x: auto;
      overscroll-behavior-x: contain;
      -webkit-overflow-scrolling: touch;
      scroll-snap-type: x proximity;
      /* The strip is navigable by tab, arrow keys and swipe; a scrollbar under it is just noise. */
      scrollbar-width: none;
      -ms-overflow-style: none;
    }
    .tablist::-webkit-scrollbar { display: none; }
    .tab {
      position: relative; appearance: none; border: none; background: transparent;
      padding: var(--ui-space-2) var(--ui-space-3); margin-bottom: -1px;
      color: var(--ui-color-text-muted); font: inherit; font-family: var(--ui-font-default); font-size: var(--ui-font-size-sm); line-height: 1.35;
      cursor: pointer; border-bottom: 2px solid transparent;
      /* Never shrink or wrap: a two-line "Audit log" is how a tab strip starts looking broken. */
      flex: 0 0 auto;
      white-space: nowrap;
      scroll-snap-align: start;
      transition: color var(--ui-motion-base) var(--ui-ease-standard),
                  border-color var(--ui-motion-base) var(--ui-ease-standard),
                  transform var(--ui-motion-fast) var(--ui-ease-standard);
    }
    .tab { display: inline-flex; align-items: center; gap: var(--ui-space-2); }
    .tab__icon { display: inline-flex; flex: none; }
    .tab__badge { display: inline-flex; align-items: center; justify-content: center; flex: none; min-width: 18px; height: 18px;
      padding: 0 5px; box-sizing: border-box; border-radius: 999px; background: var(--ui-color-primary); color: var(--ui-color-primary-contrast);
      font-size: calc(12px * var(--ui-font-scale)); font-weight: 600; line-height: 1; font-variant-numeric: tabular-nums; }
    .tab__sr { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; border: 0; }
    /* Icon-only tabs share the strip evenly and keep a thumb-sized target. */
    .tab--icon { flex: 1 1 0; justify-content: center; min-width: var(--ui-size-touch, 44px); }
    @media (pointer: coarse) { .tab { min-height: var(--ui-size-touch); } }
    .tab:hover:not(:disabled) { color: var(--ui-color-text); }
    /* Press feedback on the contents only, so the selected underline doesn't shrink with it. */
    .tab:active:not(:disabled) > * { transform: scale(var(--ui-scale-press)); }
    .tab > * { transition: transform var(--ui-motion-fast) var(--ui-ease-standard); }
    .tab[aria-selected="true"] { --ui-color-icon: currentColor; }
    .tab[aria-selected="true"] { color: var(--ui-color-text); border-bottom-color: var(--ui-color-primary); }
    /* The strip scrolls, which clips an outset ring top and bottom; the ring sits inside instead. */
    .tab:focus-visible { outline: none; box-shadow: inset 0 0 0 2px var(--ui-color-border-focus); border-radius: var(--ui-radius-xs); }
    .tab:disabled { opacity: .5; cursor: not-allowed; }
  `,
})
export class UiTabs {
  protected readonly strings = injectUiStrings();
  private host = inject<ElementRef<HTMLElement>>(ElementRef);
  selectedIndex = model(0);
  /** Default: the built-in `tabs` (Tabs), which follows the app's language. */
  label = input<string | undefined>(undefined);
  protected readonly labelText = computed(() => this.label() ?? this.strings.tabs);
  readonly tabs = contentChildren(UiTab);

  constructor() {
    effect(() => {
      const tabs = this.tabs();
      const sel = this.selectedIndex();
      tabs.forEach((t, i) => t.active.set(i === sel));
      this.revealSelected(sel);
    });
  }

  /**
   * Keeps the selected tab visible when the strip is scrolled. Selection can move without a click —
   * arrow keys, or the host setting selectedIndex — and a selected tab off-screen reads as nothing
   * being selected at all.
   */
  private revealSelected(index: number): void {
    const strip = this.host.nativeElement.querySelector('.tablist');
    const tab = strip?.children.item(index) as HTMLElement | null;
    if (!strip || !tab) return;
    if (strip.scrollWidth <= strip.clientWidth) return;
    tab.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }

  protected select(i: number): void {
    if (this.tabs()[i]?.disabled()) return;
    this.selectedIndex.set(i);
  }

  protected onKeydown(e: KeyboardEvent, i: number): void {
    const count = this.tabs().length;
    let next = i;
    // Right and left follow the row: in RTL the next tab is to the left.
    const key = uiLogicalKey(e);
    if (key === 'ArrowRight') next = (i + 1) % count;
    else if (key === 'ArrowLeft') next = (i - 1 + count) % count;
    else if (key === 'Home') next = 0;
    else if (key === 'End') next = count - 1;
    else return;
    e.preventDefault();
    // Disabled tabs can't take focus, so step past them in the direction of travel.
    const step = key === 'ArrowLeft' || key === 'End' ? -1 : 1;
    const tabs = this.tabs();
    for (let n = 0; n < count && tabs[next]?.disabled(); n++) next = (next + step + count) % count;
    if (tabs[next]?.disabled()) return;
    this.select(next);
    const buttons = this.host.nativeElement.querySelectorAll<HTMLButtonElement>('.tab');
    buttons[next]?.focus();
  }
}
