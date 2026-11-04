import { CdkConnectedOverlay, CdkOverlayOrigin, type ConnectedPosition } from '@angular/cdk/overlay';
import { isPlatformBrowser } from '@angular/common';
import { Component, ElementRef, PLATFORM_ID, computed, inject, input, model, output, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HugeiconsIconComponent } from '@hugeicons/angular';
import FilterHorizontalIcon from '@hugeicons/core-free-icons/FilterHorizontalIcon';
import { UI_CONFIG, injectUiStrings, uiFormatString } from '@zouriel/ui';
import { UiChip } from '@zouriel/ui/badge';
import { UiButton } from '@zouriel/ui/button';
import { UiBottomSheet } from '@zouriel/ui/dialog';
import { UiSearchInput } from '@zouriel/ui/form';
import {
  type UiFilterOption, type UiFilterSection, type UiFilterValue,
  uiActiveFilters, uiFilterCount, uiFilterRemove, uiFilterSet, uiFilterToggle,
} from './filter-model';

let filterSeq = 0;

/**
 * `ui-filter-button`: the one compact "Filter" button a toolbar needs however many filters there
 * are. A filter icon and the label; while filters are on, a count bubble ("2") that screen readers
 * hear as "Filter, 2 on". Click it to open a panel (ui-filter does that for you).
 */
@Component({
  selector: 'ui-filter-button',
  imports: [UiButton, HugeiconsIconComponent],
  template: `
    <ui-button
      [variant]="count() > 0 ? 'secondary' : 'outline'"
      [size]="size()"
      [badge]="count() > 0 ? (count() > 9 ? '9+' : '' + count()) : null"
      badgeTone="primary"
      [ariaLabel]="label() || strings.filter"
      [badgeLabel]="onLabel()"
      [disabled]="disabled()">
      <hugeicons-icon [icon]="icon" [size]="16" [strokeWidth]="1.8" />
      {{ label() || strings.filter }}
    </ui-button>
  `,
  styles: `:host { display: inline-flex; }`,
})
export class UiFilterButton {
  protected readonly strings = injectUiStrings();
  protected readonly icon = FilterHorizontalIcon;
  /** How many filters are on (uiFilterCount): the badge. */
  readonly count = input(0);
  /** The visible words; default the strings' filter ("Filter"). */
  readonly label = input('');
  readonly size = input<'sm' | 'md'>('sm');
  readonly disabled = input(false);
  /** Read after the name while filters are on: "Filter, 2 on". */
  protected readonly onLabel = computed(() => uiFormatString(this.strings.filterOn, { n: this.count() }));
}

/**
 * `ui-filter-panel`: the sections of a filter, one under another, each a titled group of rows:
 * the section's "all" row (Everyone) first, then its options with their counts. A multiple section
 * has checkboxes (any chosen option passes), the others radios. From `searchAt` options (8) a section
 * gets a search field that narrows its rows. Every tap changes `value` at once. Rows are at least
 * 44px tall. Use it inside your own container, or let ui-filter put it in a sheet or popover.
 */
@Component({
  selector: 'ui-filter-panel',
  imports: [FormsModule, UiSearchInput],
  template: `
    @for (s of sections(); track s.id) {
      <fieldset class="sec">
        <legend class="title">{{ s.title }}</legend>
        @if (searchable(s)) {
          <ui-search-input class="search" size="sm" [label]="s.title" [ngModel]="query(s)" (ngModelChange)="setQuery(s, $event)" data-sheet-nodrag />
        }
        @if (!query(s)) {
          <label class="row">
            <input class="native" [type]="s.multiple ? 'checkbox' : 'radio'" [name]="group(s)" [checked]="isAll(s)" (change)="all(s, $event)" />
            <span class="mark" [class.round]="!s.multiple" aria-hidden="true"><svg viewBox="0 0 16 16"><path d="M3 8.5l3 3 7-7" /></svg></span>
            <span class="lbl">{{ s.allLabel || strings.filterAll }}</span>
            @if (s.allCount != null) { <span class="count">{{ s.allCount }}</span> }
          </label>
        }
        @for (o of shown(s); track o.id) {
          <label class="row">
            <input class="native" [type]="s.multiple ? 'checkbox' : 'radio'" [name]="group(s)" [checked]="isOn(s, o)" (change)="toggle(s, o, $event)" />
            <span class="mark" [class.round]="!s.multiple" aria-hidden="true"><svg viewBox="0 0 16 16"><path d="M3 8.5l3 3 7-7" /></svg></span>
            <span class="lbl">{{ o.label }}</span>
            @if (o.count != null) { <span class="count">{{ o.count }}</span> }
          </label>
        } @empty {
          <p class="none">{{ strings.noResults }}</p>
        }
      </fieldset>
    }
  `,
  styles: `
    :host { display: flex; flex-direction: column; gap: var(--ui-space-4); font-family: var(--ui-font-default); color: var(--ui-color-text); }
    .sec { margin: 0; padding: 0; border: none; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
    .title {
      padding: 0 var(--ui-space-2) var(--ui-space-1); font-size: var(--ui-font-size-sm); font-weight: 600;
      color: var(--ui-color-text-muted); letter-spacing: var(--ui-tracking-tight);
    }
    .search { margin: 0 0 var(--ui-space-1); }
    .row {
      position: relative; display: flex; align-items: center; gap: var(--ui-space-3);
      min-height: var(--ui-size-touch); padding: 0 var(--ui-space-2); box-sizing: border-box;
      border-radius: var(--ui-radius-sm); cursor: pointer; font-size: var(--ui-font-size-md); line-height: 1.35;
      transition: background var(--ui-motion-fast) var(--ui-ease-standard);
    }
    .row:hover { background: var(--ui-color-surface-hover); }
    .native { position: absolute; opacity: 0; width: 0; height: 0; margin: 0; }
    .mark {
      display: inline-flex; align-items: center; justify-content: center; flex: none;
      box-sizing: border-box; width: 18px; height: 18px;
      border: 1px solid var(--ui-control-border); border-radius: var(--ui-radius-xs); background: var(--ui-color-surface);
      transition: background var(--ui-motion-fast) var(--ui-ease-standard), border-color var(--ui-motion-fast) var(--ui-ease-standard);
    }
    .mark.round { border-radius: 50%; }
    .mark svg { width: 12px; height: 12px; fill: none; stroke: var(--ui-color-primary-contrast); stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; opacity: 0; }
    .native:checked + .mark { background: var(--ui-color-primary); border-color: var(--ui-color-primary); }
    .native:checked + .mark svg { opacity: 1; }
    .native:focus-visible + .mark { box-shadow: var(--ui-focus-ring); }
    .row:hover .native:not(:checked) + .mark { border-color: var(--ui-color-primary); }
    .lbl { flex: 1 1 auto; min-width: 0; overflow-wrap: anywhere; padding: var(--ui-space-2) 0; }
    .count { flex: none; font-size: var(--ui-font-size-sm); color: var(--ui-color-text-muted); font-variant-numeric: tabular-nums; }
    .none { margin: 0; padding: var(--ui-space-2); font-size: var(--ui-font-size-sm); color: var(--ui-color-text-muted); }
  `,
})
export class UiFilterPanel {
  protected readonly strings = injectUiStrings();
  readonly sections = input<readonly UiFilterSection[]>([]);
  readonly value = model<UiFilterValue>({});

  private readonly seq = filterSeq++;
  private readonly queries = signal<Readonly<Record<string, string>>>({});

  protected group(s: UiFilterSection): string { return `ui-filter-${this.seq}-${s.id}`; }
  protected searchable(s: UiFilterSection): boolean { return s.options.length >= (s.searchAt ?? 8); }
  protected query(s: UiFilterSection): string { return this.queries()[s.id] ?? ''; }
  protected setQuery(s: UiFilterSection, q: string): void { this.queries.update((all) => ({ ...all, [s.id]: q ?? '' })); }
  protected shown(s: UiFilterSection): readonly UiFilterOption[] {
    const q = this.query(s).trim().toLocaleLowerCase();
    return q ? s.options.filter((o) => o.label.toLocaleLowerCase().includes(q)) : s.options;
  }
  protected isAll(s: UiFilterSection): boolean { return !(this.value()[s.id]?.length); }
  protected isOn(s: UiFilterSection, o: UiFilterOption): boolean { return !!this.value()[s.id]?.includes(o.id); }

  protected all(s: UiFilterSection, e: Event): void {
    this.value.set(uiFilterSet(this.value(), s.id, []));
    // Ticking "all" again when it already was leaves it ticked (a checkbox would untick itself).
    (e.target as HTMLInputElement).checked = true;
  }

  protected toggle(s: UiFilterSection, o: UiFilterOption, e: Event): void {
    this.value.set(uiFilterToggle(s, this.value(), o.id));
    (e.target as HTMLInputElement).checked = this.isOn(s, o);
  }
}

/** `ui-filter-footer`: Clear all (off while nothing is on) and the close button, "Show 12" when the
 *  app gives `resultCount`, else "Done". ui-filter pins it under the panel. */
@Component({
  selector: 'ui-filter-footer',
  imports: [UiButton],
  template: `
    <ui-button variant="ghost" [disabled]="count() === 0" (click)="clearAll.emit()">{{ strings.filterClearAll }}</ui-button>
    <ui-button variant="primary" (click)="done.emit()">{{ doneLabel() }}</ui-button>
  `,
  styles: `:host { display: flex; align-items: center; justify-content: space-between; gap: var(--ui-space-2); }`,
})
export class UiFilterFooter {
  protected readonly strings = injectUiStrings();
  /** How many filters are on. */
  readonly count = input(0);
  /** How many items pass, for "Show 12"; null for "Done". */
  readonly resultCount = input<number | null>(null);
  readonly clearAll = output<void>();
  readonly done = output<void>();
  protected readonly doneLabel = computed(() => {
    const n = this.resultCount();
    return n == null ? this.strings.filterDone : uiFormatString(this.strings.filterShow, { n });
  });
}

/**
 * `ui-filter`: a ui-filter-button that opens the filter panel. On a narrow screen (under `narrowAt`,
 * 600px) the panel is a modal bottom sheet with the footer pinned to it; on a wider one it is a
 * popover under the button, 340px wide, whose body scrolls between its title and footer. Each tap in
 * the panel changes `value` at once, so the page behind updates as you choose; the footer's "Show
 * N" (from `resultCount`) or Done closes it, Clear all turns every section off. Escape, a tap
 * outside and the sheet's own close close it too; focus goes back to the button.
 *
 * Add a section to `sections` to add a filter: the toolbar keeps its one button.
 */
@Component({
  selector: 'ui-filter',
  imports: [CdkOverlayOrigin, CdkConnectedOverlay, UiFilterButton, UiFilterPanel, UiFilterFooter, UiBottomSheet],
  template: `
    <span class="origin" cdkOverlayOrigin #origin="cdkOverlayOrigin" #trigger>
      <ui-filter-button [count]="count()" [label]="label()" [size]="size()" [disabled]="disabled()" (click)="toggle()" />
    </span>

    <ng-template
      cdkConnectedOverlay
      [cdkConnectedOverlayOrigin]="origin"
      [cdkConnectedOverlayOpen]="open() && !narrow()"
      [cdkConnectedOverlayPositions]="positions"
      [cdkConnectedOverlayPush]="true"
      [cdkConnectedOverlayViewportMargin]="8"
      (overlayOutsideClick)="outside($event)"
      (detach)="open.set(false)">
      <div class="ui-filter-pop" [class.glass]="glass()" [class.no-radius]="!radius()" role="dialog" [attr.aria-label]="heading()"
        (keydown.escape)="closeToButton()" animate.enter="ui-scale-enter" animate.leave="ui-scale-leave">
        <div class="head">{{ heading() }}</div>
        <div class="body"><ui-filter-panel [sections]="sections()" [(value)]="value" /></div>
        <ui-filter-footer class="foot" [count]="count()" [resultCount]="resultCount()" (clearAll)="clearAll()" (done)="closeToButton()" />
      </div>
    </ng-template>

    @if (narrow()) {
      <ui-bottom-sheet [snaps]="snaps" [snap]="open() ? 1 : 0" (snapChange)="open.set($event > 0)" [backdrop]="true" [title]="heading()" [maxWidth]="560">
        <ui-filter-panel [sections]="sections()" [(value)]="value" />
        <ui-filter-footer sheet-footer [count]="count()" [resultCount]="resultCount()" (clearAll)="clearAll()" (done)="open.set(false)" />
      </ui-bottom-sheet>
    }
  `,
  styles: `
    :host { display: inline-flex; }
    .origin { display: inline-flex; }
    .ui-filter-pop {
      display: flex; flex-direction: column; width: 340px; max-width: calc(100vw - 16px); max-height: min(560px, 70vh);
      box-sizing: border-box; overflow: hidden;
      background: var(--ui-color-surface-raised); color: var(--ui-color-text);
      border: 1px solid var(--ui-color-border); border-radius: var(--ui-radius); box-shadow: var(--ui-shadow-2);
      font-family: var(--ui-font-default);
    }
    .ui-filter-pop.no-radius { border-radius: 0; }
    .ui-filter-pop.glass { background: var(--ui-glass-panel-bg); backdrop-filter: blur(var(--ui-glass-blur)); border-color: var(--ui-glass-border); }
    .head { flex: none; padding: var(--ui-space-3) var(--ui-space-4) var(--ui-space-2); font-size: var(--ui-font-size-md); font-weight: 600; }
    .body { flex: 1 1 auto; min-height: 0; overflow: auto; overscroll-behavior: contain; padding: 0 var(--ui-space-2) var(--ui-space-3); }
    .foot { flex: none; padding: var(--ui-space-2) var(--ui-space-3); border-top: 1px solid var(--ui-color-border); }
  `,
})
export class UiFilter {
  private readonly config = inject(UI_CONFIG);
  private readonly browser = isPlatformBrowser(inject(PLATFORM_ID));
  protected readonly strings = injectUiStrings();

  readonly sections = input<readonly UiFilterSection[]>([]);
  readonly value = model<UiFilterValue>({});
  /** How many items pass the current value, for the footer's "Show 12"; null for "Done". */
  readonly resultCount = input<number | null>(null);
  /** The button's words; default "Filter". */
  readonly label = input('');
  /** The panel's title; default the button's words. */
  readonly title = input('');
  readonly size = input<'sm' | 'md'>('sm');
  readonly disabled = input(false);
  /** Below this width (px) the panel is a bottom sheet. */
  readonly narrowAt = input(600);
  readonly open = model(false);
  readonly glass = input<boolean>(this.config.glass);
  readonly radius = input<boolean>(this.config.radius);

  protected readonly count = computed(() => uiFilterCount(this.value()));
  protected readonly heading = computed(() => this.title() || this.label() || this.strings.filter);
  protected readonly narrow = signal(false);
  protected readonly snaps = [0, 0.85] as const;
  protected readonly positions: ConnectedPosition[] = [
    { originX: 'start', originY: 'bottom', overlayX: 'start', overlayY: 'top', offsetY: 4 },
    { originX: 'end', originY: 'bottom', overlayX: 'end', overlayY: 'top', offsetY: 4 },
    { originX: 'start', originY: 'top', overlayX: 'start', overlayY: 'bottom', offsetY: -4 },
    { originX: 'end', originY: 'top', overlayX: 'end', overlayY: 'bottom', offsetY: -4 },
  ];
  private readonly trigger = viewChild.required<ElementRef<HTMLElement>>('trigger');

  protected toggle(): void {
    if (!this.open()) this.narrow.set(this.isNarrow());
    this.open.update((o) => !o);
  }

  private isNarrow(): boolean {
    if (!this.browser) return false;
    const w = this.trigger().nativeElement.ownerDocument.defaultView;
    return !!w?.matchMedia?.(`(max-width: ${this.narrowAt() - 0.02}px)`)?.matches;
  }

  protected outside(e: MouseEvent): void {
    // The button toggles on its own; closing here too would reopen it.
    if (this.trigger().nativeElement.contains(e.target as Node)) return;
    this.open.set(false);
  }

  protected closeToButton(): void {
    this.open.set(false);
    this.trigger().nativeElement.querySelector<HTMLButtonElement>('button')?.focus();
  }

  protected clearAll(): void {
    this.value.set({});
  }
}

/**
 * `ui-filter-chips`: the filters that are on, as small chips ("Aisha ×") with Clear all after them,
 * for under a toolbar. A chip's × turns that one off; nothing shows while no filter is on.
 */
@Component({
  selector: 'ui-filter-chips',
  imports: [UiChip, UiButton],
  template: `
    @if (active().length) {
      <div class="chips" role="group" [attr.aria-label]="label() || strings.filter">
        @for (a of active(); track a.section + ':' + a.option) {
          <ui-chip [removable]="true" [label]="a.label" tone="primary" (remove)="remove(a.section, a.option)">{{ a.label }}</ui-chip>
        }
        <ui-button variant="ghost" size="sm" (click)="value.set({})">{{ strings.filterClearAll }}</ui-button>
      </div>
    }
  `,
  styles: `
    :host { display: block; }
    .chips { display: flex; flex-wrap: wrap; align-items: center; gap: var(--ui-space-2); min-width: 0; }
    .chips ui-chip { max-width: 100%; }
  `,
})
export class UiFilterChips {
  protected readonly strings = injectUiStrings();
  readonly sections = input<readonly UiFilterSection[]>([]);
  readonly value = model<UiFilterValue>({});
  /** The group's accessible name; default "Filter". */
  readonly label = input('');
  protected readonly active = computed(() => uiActiveFilters(this.sections(), this.value()));
  protected remove(section: string, option: string): void {
    this.value.set(uiFilterRemove(this.value(), section, option));
  }
}
