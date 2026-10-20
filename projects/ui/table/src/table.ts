import { Component, computed, inject, input, output, signal } from '@angular/core';
import { UI_CONFIG } from '@zouriel/ui';
import { UiScrollFade } from '@zouriel/ui/behaviors';

export interface UiColumn<T = Record<string, unknown>> {
  key: string;
  header: string;
  sortable?: boolean;
  align?: 'left' | 'right' | 'center';
  /** Optional cell formatter; receives the raw cell value and the full row. */
  format?: (value: unknown, row: T) => string;
}

/**
 * Something a row can have done to it — edit, remove, resend.
 *
 * <p>Separate from {@link UiColumn} on purpose. A column reads a value out of a row; an action does
 * something to it, needs to be a real button for the keyboard and for assistive tech, and can be
 * unavailable for one row and not the next. Squeezing that into a formatter would mean returning
 * markup from a function that is typed to return a string.</p>
 */
export interface UiRowAction<T = Record<string, unknown>> {
  label: string;
  run: (row: T) => void;
  /** Off for this row in particular — a guest with nothing to resend, say. */
  disabled?: (row: T) => boolean;
  /** Screen-reader label, when "Edit" on its own does not say which row it edits. */
  ariaLabel?: (row: T) => string;
}

type SortDir = 'asc' | 'desc' | null;

/** Case-insensitive, and "Item 2" sorts before "Item 10". */
const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });

/**
 * `ui-table` — accessible data table with click-to-sort headers and optional
 * row selection. Pass `columns` + `data`; listen to `(selectionChange)`.
 * On a narrow screen the table keeps its natural width and scrolls sideways inside its border, with
 * the cut-off edge faded, instead of squeezing the columns.
 * (Virtual scroll / CDK table integration is a planned extension.)
 */
@Component({
  selector: 'ui-table',
  imports: [UiScrollFade],
  template: `
    <div class="wrap" [class.no-radius]="!radius()">
      <div class="scroll" uiScrollFade>
      <table class="ui-table">
        <thead>
          <tr>
            @if (selectable()) {
              <th class="sel" scope="col">
                <input type="checkbox" [checked]="allSelected()" [indeterminate]="someSelected()"
                       aria-label="Select all rows" (change)="toggleAll($event)" />
              </th>
            }
            @for (col of columns(); track col.key) {
              <th
                scope="col"
                [attr.data-align]="col.align || 'left'"
                [class.sortable]="col.sortable"
                [attr.aria-sort]="ariaSort(col.key)">
                @if (col.sortable) {
                  <button type="button" class="sort" (click)="sortBy(col.key)">
                    {{ col.header }}
                    <svg class="arrow" viewBox="0 0 12 12" width="12" height="12" aria-hidden="true"><path [attr.d]="sortIcon(col.key)" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
                  </button>
                } @else {
                  {{ col.header }}
                }
              </th>
            }
            @if (actions().length) {
              <!-- The heading is an attribute, not a hidden element. A visually-hidden span here is
                   position:absolute with nothing positioned above it, so its containing block is the
                   document rather than this scroller: overflow:auto does not clip it, its static
                   position sits wherever the (often very wide) table puts it, and the whole PAGE
                   grows to contain it. On a phone that reads as a narrow content column beside a
                   full-width fixed bar — a table quietly resizing the document it lives in. -->
              <th class="acts" scope="col" aria-label="Actions"></th>
            }
          </tr>
        </thead>
        <tbody>
          @for (row of sorted(); track $index) {
            <tr [class.selected]="current().has(row)">
              @if (selectable()) {
                <td class="sel">
                  <input type="checkbox" [checked]="current().has(row)"
                         [attr.aria-label]="'Select row ' + ($index + 1)" (change)="toggleRow(row)" />
                </td>
              }
              @for (col of columns(); track col.key) {
                <td [attr.data-align]="col.align || 'left'">{{ cell(row, col) }}</td>
              }
              @if (actions().length) {
                <td class="acts"><div class="acts-in">
                  @for (action of actions(); track action.label) {
                    <button type="button" class="act"
                            [disabled]="action.disabled ? action.disabled(row) : false"
                            [attr.aria-label]="action.ariaLabel ? action.ariaLabel(row) : null"
                            (click)="action.run(row)">{{ action.label }}</button>
                  }
                </div></td>
              }
            </tr>
          } @empty {
            <tr><td class="empty" [attr.colspan]="colspan()">{{ emptyText() }}</td></tr>
          }
        </tbody>
      </table>
      </div>
    </div>
  `,
  styles: `
    :host { display: block; }
    .wrap { border: 1px solid var(--ui-color-border); border-radius: var(--ui-radius); overflow: hidden; }
    .wrap.no-radius { border-radius: 0; }
    .scroll { overflow: auto; }
    /* Fill the width and let long text wrap. In a narrow box (a phone) the columns keep their natural
       width instead and the box scrolls with a faded edge, so names aren't squeezed onto several lines. */
    .wrap { container-type: inline-size; }
    .ui-table { width: 100%; border-collapse: collapse; font-family: var(--ui-font-default); font-size: var(--ui-font-size-sm); line-height: 1.35; color: var(--ui-color-text); font-variant-numeric: tabular-nums; }
    /* After the rule above, so it wins in a narrow box. */
    @container (max-width: 600px) { .ui-table { width: max-content; min-width: 100%; } }
    th, td { padding: var(--ui-space-2) var(--ui-space-3); text-align: left; }
    th[data-align="right"], td[data-align="right"] { text-align: right; }
    th[data-align="center"], td[data-align="center"] { text-align: center; }
    thead th { background: var(--ui-color-surface-raised); border-bottom: 1px solid var(--ui-color-border); font-weight: 600; font-size: 12px; color: var(--ui-color-text-muted); white-space: nowrap; }
    tbody tr { border-bottom: 1px solid var(--ui-color-border); transition: background var(--ui-motion-fast) var(--ui-ease-standard); }
    tbody tr:last-child { border-bottom: none; }
    tbody tr:hover { background: var(--ui-color-surface-hover); }
    tbody tr.selected { background: var(--ui-color-selected); }
    /* 24px tall hit box (WCAG 2.5.8); the negative margins give the extra height back to the cell's padding. */
    .sort { display: inline-flex; align-items: center; gap: var(--ui-space-1); background: none; border: none; color: inherit; font: inherit; cursor: pointer; padding: 0;
      min-height: 24px; min-width: 24px; margin-block: calc(var(--ui-space-1) * -1); vertical-align: middle; }
    .sort:hover { color: var(--ui-color-text); }
    th:not([aria-sort]) .arrow { opacity: .4; }
    .sort:focus-visible { outline: none; box-shadow: var(--ui-focus-ring); border-radius: var(--ui-radius-xs); }
    .arrow { flex: none; }
    .sel { width: 1px; white-space: nowrap; }
    .sel input { accent-color: var(--ui-color-primary); width: 14px; height: 14px; margin: 0; vertical-align: middle; cursor: pointer; }
    .sel input:focus-visible { outline: none; box-shadow: var(--ui-focus-ring); border-radius: 2px; }
    .empty { text-align: center; color: var(--ui-color-text-muted); padding: var(--ui-space-6); }
    /* Trailing and narrow: the actions are the one column that should never take width from the
       data, and never wrap onto a second line. */
    .acts { width: 1px; white-space: nowrap; }
    /* Several actions on a row keep space-2 apart (a flex gap, so the order and RTL don't matter),
       at the end of the row. */
    .acts-in { display: flex; justify-content: flex-end; gap: var(--ui-space-2); }
    .act { position: relative; flex: none; box-sizing: border-box; height: var(--ui-size-sm); padding: 0 var(--ui-space-2);
      border: 1px solid var(--ui-color-border); border-radius: var(--ui-radius-xs);
      background: var(--ui-color-surface); color: var(--ui-color-text);
      font: inherit; font-size: var(--ui-font-size-sm); cursor: pointer;
      transition: background var(--ui-motion-fast) var(--ui-ease-standard); }
    .act:hover:not(:disabled) { background: var(--ui-color-surface-hover); }
    .act:disabled { opacity: .5; cursor: not-allowed; }
    .act:focus-visible { outline: none; box-shadow: var(--ui-focus-ring); }
    @media (pointer: coarse) {
      .act::before { content: ''; position: absolute; inset: calc((var(--ui-size-sm) - var(--ui-size-touch)) / 2) 0; }
    }

  `,
})
export class UiTable<T extends Record<string, unknown> = Record<string, unknown>> {
  private config = inject(UI_CONFIG);
  columns = input<UiColumn<T>[]>([]);
  data = input<T[]>([]);
  selectable = input(false);
  /** Per-row buttons, in a trailing column. Empty (the default) and the column is not rendered. */
  actions = input<UiRowAction<T>[]>([]);
  emptyText = input('No data');
  radius = input<boolean>(this.config.radius);
  selectionChange = output<T[]>();

  protected readonly sortKey = signal<string | null>(null);
  protected readonly sortDir = signal<SortDir>(null);
  protected readonly selected = signal<Set<T>>(new Set());
  /**
   * The selection, limited to rows still in `data`. Rows are tracked by reference, so when the
   * data is replaced (filtered, reloaded) a row that left must stop counting as selected.
   */
  protected readonly current = computed(() => {
    const rows = new Set(this.data());
    return new Set([...this.selected()].filter((r) => rows.has(r)));
  });

  protected readonly sorted = computed(() => {
    const rows = this.data();
    const key = this.sortKey();
    const dir = this.sortDir();
    if (!key || !dir) return rows;
    const copy = [...rows];
    copy.sort((a, b) => {
      const av = a[key], bv = b[key];
      if (av == null) return 1;
      if (bv == null) return -1;
      const cmp = typeof av === 'number' && typeof bv === 'number'
        ? av - bv
        : collator.compare(String(av), String(bv));
      return dir === 'asc' ? cmp : -cmp;
    });
    return copy;
  });

  protected readonly colspan = computed(
    () => this.columns().length + (this.selectable() ? 1 : 0) + (this.actions().length ? 1 : 0),
  );
  protected readonly allSelected = computed(() => this.data().length > 0 && this.current().size === this.data().length);
  protected readonly someSelected = computed(() => this.current().size > 0 && !this.allSelected());

  protected cell(row: T, col: UiColumn<T>): string {
    const value = row[col.key];
    if (col.format) return col.format(value, row);
    return value == null ? '' : String(value);
  }

  protected sortBy(key: string): void {
    if (this.sortKey() !== key) {
      this.sortKey.set(key);
      this.sortDir.set('asc');
    } else {
      const next: SortDir = this.sortDir() === 'asc' ? 'desc' : this.sortDir() === 'desc' ? null : 'asc';
      this.sortDir.set(next);
      if (!next) this.sortKey.set(null);
    }
  }

  protected ariaSort(key: string): string | null {
    if (this.sortKey() !== key || !this.sortDir()) return null;
    return this.sortDir() === 'asc' ? 'ascending' : 'descending';
  }
  /** Up/down chevron pair when unsorted, one chevron for the active direction. */
  protected sortIcon(key: string): string {
    const dir = this.sortKey() === key ? this.sortDir() : null;
    return dir === 'asc' ? 'M3 7.5l3-3 3 3' : dir === 'desc' ? 'M3 4.5l3 3 3-3' : 'M3.5 4.5L6 2l2.5 2.5M3.5 7.5L6 10l2.5-2.5';
  }

  protected toggleRow(row: T): void {
    const next = new Set(this.current());
    next.has(row) ? next.delete(row) : next.add(row);
    this.selected.set(next);
    this.selectionChange.emit([...next]);
  }
  protected toggleAll(e: Event): void {
    const checked = (e.target as HTMLInputElement).checked;
    const next = checked ? new Set(this.data()) : new Set<T>();
    this.selected.set(next);
    this.selectionChange.emit([...next]);
  }
}

/**
 * `ui-row-actions` — the buttons of a row in a table you build yourself (or any small group of
 * actions): space-2 apart so neighbours never touch, at the end of the row, wrapping onto a second
 * line when the cell is narrow (a table shown as cards on a phone). `align="start"` puts them at the
 * start instead.
 *
 *   <td><ui-row-actions><ui-button size="sm" variant="outline">View</ui-button>…</ui-row-actions></td>
 */
@Component({
  selector: 'ui-row-actions',
  host: { '[attr.data-align]': 'align()' },
  template: `<ng-content />`,
  styles: `
    :host { display: flex; flex-wrap: wrap; align-items: center; justify-content: flex-end; gap: var(--ui-space-2); }
    :host([data-align="start"]) { justify-content: flex-start; }
  `,
})
export class UiRowActions {
  /** Which end of the cell the actions sit at. */
  align = input<'start' | 'end'>('end');
}
