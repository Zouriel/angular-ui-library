import {
  Component, ElementRef, afterRenderEffect, contentChildren, effect, inject, input, model, signal, computed,
} from '@angular/core';
import { HugeiconsIconComponent } from '@hugeicons/angular';
import type { IconSvgObject } from '@hugeicons/angular';
import { uiLogicalKey, injectUiStrings, UiTourAnchor } from '@zouriel/ui';

/** Horizontal alignment of the tab buttons along the strip. */
export type UiTabsAlign = 'start' | 'center' | 'fill';

/** How the strip is drawn: `line` (underline + rule) or `glow` (a moving accent glow). */
export type UiTabsAppearance = 'line' | 'glow';

let tabSeq = 0;

/**
 * `ui-tab` — a single tab + its panel. Provide a `label` and project the panel
 * content. Leave the body empty on every tab for strip-only mode (no panel gap).
 * Inactive panels stay in the DOM but are hidden (`[hidden]`).
 *
 * An optional HugeIcons `icon` draws before the label. With `iconOnly` the label is not shown, but it
 * is still the tab's accessible name and its tooltip, so a screen reader and a hovering mouse both get
 * the words the icon stands for.
 */
@Component({
  selector: 'ui-tab',
  template: `<div role="tabpanel" [id]="panelId" [attr.aria-labelledby]="tabId" [hidden]="!active() || stripOnly()" tabindex="0"><ng-content /></div>`,
  styles: `:host { display: block; }`,
})
export class UiTab {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
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
  /** @internal Set by the parent when no tab has panel content. */
  readonly stripOnly = signal(false);
  readonly tabId = `ui-tab-${tabSeq}`;
  readonly panelId = `ui-tabpanel-${tabSeq++}`;

  /** @internal */
  panelEl(): HTMLElement | null {
    return this.host.nativeElement.querySelector('[role="tabpanel"]');
  }

  /** @internal True when any element or non-whitespace text is projected into the tab panel. */
  hasPanelContent(): boolean {
    const el = this.panelEl();
    if (!el) return false;
    return Array.from(el.childNodes).some(
      (n) => n.nodeType === 1 || (n.nodeType === 3 && !!n.textContent?.trim()),
    );
  }
}

/**
 * `ui-tabs` — WAI-ARIA tabs. Wraps `ui-tab` children; renders a tablist with
 * roving tabindex and Arrow/Home/End keyboard navigation.
 */
@Component({
  selector: 'ui-tabs',
  imports: [HugeiconsIconComponent, UiTourAnchor],
  template: `
    <div
      class="tablist"
      [class.center]="align() === 'center'"
      [class.fill]="align() === 'fill'"
      [class.glow]="appearance() === 'glow'"
      [class.strip-only]="stripOnly()"
      role="tablist"
      [attr.aria-label]="labelText()">
      @if (appearance() === 'glow') {
        <span
          class="tab-glow"
          aria-hidden="true"
          [style.width.px]="glowWidth()"
          [style.transform]="'translateX(' + glowX() + 'px)'">
        </span>
      }
      @for (tab of tabs(); track tab.tabId; let i = $index) {
        <button
          type="button"
          role="tab"
          class="tab"
          [uiTourAnchor]="tab.anchor()"
          [id]="tab.tabId"
          [attr.aria-controls]="stripOnly() ? null : tab.panelId"
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
      position: relative;
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
    /* Safe centering along the full-width bottom rule: auto inline margins split leftover room
       when tabs fit and collapse to 0 when they overflow, so tab 0 stays reachable by scroll. */
    .tablist.center .tab:first-child, .tablist.center .tab:first-of-type { margin-inline-start: auto; }
    .tablist.center .tab:last-child, .tablist.center .tab:last-of-type { margin-inline-end: auto; }
    .tablist.strip-only { margin-bottom: 0; }
    /* Fill gives each tab the same share of the full strip. */
    .tablist.fill { overflow-x: hidden; }
    .tablist.fill .tab { flex: 1 1 0; min-width: 0; justify-content: center; }
    .tablist.fill .tab__label { min-width: 0; overflow: hidden; text-overflow: ellipsis; }
    /* Glow has one indicator that slides between tabs, rather than separate glows fading in place. */
    .tablist.glow { border-bottom: none; }
    .tablist.glow .tab { margin-bottom: 0; border-bottom-color: transparent; }
    .tab-glow {
      position: absolute; z-index: 0; left: 0; bottom: 0; height: var(--ui-space-6);
      pointer-events: none; opacity: 1;
      background: radial-gradient(ellipse at center bottom, color-mix(in srgb, var(--ui-color-primary) 46%, transparent), transparent 72%);
      transition: transform var(--ui-motion-base) var(--ui-ease-standard), width var(--ui-motion-base) var(--ui-ease-standard);
    }
    @media (prefers-reduced-motion: reduce) { .tab-glow { transition: none; } }
    .tab {
      position: relative; z-index: 1; appearance: none; border: none; background: transparent;
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
  /** Horizontal alignment of the tabs along the full-width bottom rule. */
  align = input<UiTabsAlign>('start');
  /** `line` keeps the existing underline and rule; `glow` uses a moving accent glow. */
  appearance = input<UiTabsAppearance>('line');
  /** Default: the built-in `tabs` (Tabs), which follows the app's language. */
  label = input<string | undefined>(undefined);
  protected readonly labelText = computed(() => this.label() ?? this.strings.tabs);
  protected readonly stripOnly = signal(false);
  protected readonly glowX = signal(0);
  protected readonly glowWidth = signal(0);
  readonly tabs = contentChildren(UiTab);

  constructor() {
    effect(() => {
      const tabs = this.tabs();
      const sel = this.selectedIndex();
      tabs.forEach((t, i) => t.active.set(i === sel));
      this.revealSelected(sel);
    });
    afterRenderEffect(() => {
      const tabs = this.tabs();
      const empty = tabs.length > 0 && tabs.every((t) => !t.hasPanelContent());
      this.stripOnly.set(empty);
      tabs.forEach((t) => t.stripOnly.set(empty));

      const appearance = this.appearance();
      const selected = this.selectedIndex();
      this.align();
      if (appearance !== 'glow') return;
      const button = this.host.nativeElement.querySelectorAll<HTMLElement>('.tab').item(selected);
      if (!button) return;
      this.glowX.set(button.offsetLeft);
      this.glowWidth.set(button.offsetWidth);
    });
  }

  /**
   * Keeps the selected tab visible when the strip is scrolled. Selection can move without a click —
   * arrow keys, or the host setting selectedIndex — and a selected tab off-screen reads as nothing
   * being selected at all.
   */
  private revealSelected(index: number): void {
    const strip = this.host.nativeElement.querySelector('.tablist');
    const tab = strip?.querySelectorAll<HTMLElement>('.tab').item(index);
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
