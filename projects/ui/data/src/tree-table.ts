import { Component, computed, input, signal } from '@angular/core';

export interface UiTreeTableColumn {
  key: string;
  header: string;
  align?: 'left' | 'right' | 'center';
}
export interface UiTreeTableRow {
  label: string;
  value: string;
  data?: Record<string, unknown>;
  children?: UiTreeTableRow[];
}

interface FlatRow { row: UiTreeTableRow; depth: number; }

/** `ui-tree-table` — hierarchical table; the first column is an expandable tree. */
@Component({
  selector: 'ui-tree-table',
  template: `
    <div class="wrap">
      <table class="tt">
        <thead>
          <tr>
            <th scope="col">{{ firstHeader() }}</th>
            @for (col of columns(); track col.key) { <th scope="col" [attr.data-align]="col.align || 'left'">{{ col.header }}</th> }
          </tr>
        </thead>
        <tbody>
          @for (f of visible(); track f.row.value) {
            <tr>
              <td [style.padding-left]="'calc(var(--ui-space-3) + ' + f.depth * 16 + 'px)'">
                <span class="first">
                @if (f.row.children?.length) {
                  <button type="button" class="chev" [class.open]="expanded().has(f.row.value)" (click)="toggle(f.row)"
                          [attr.aria-expanded]="expanded().has(f.row.value)"
                          [attr.aria-label]="(expanded().has(f.row.value) ? 'Collapse ' : 'Expand ') + f.row.label"><svg viewBox="0 0 12 12" width="12" height="12" aria-hidden="true"><path d="M4 2l4 4-4 4" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
                } @else { <span class="chev spacer"></span> }
                <span class="label">{{ f.row.label }}</span>
                </span>
              </td>
              @for (col of columns(); track col.key) { <td [attr.data-align]="col.align || 'left'">{{ f.row.data?.[col.key] }}</td> }
            </tr>
          }
        </tbody>
      </table>
    </div>
  `,
  styles: `
    :host { display: block; }
    .wrap { border: 1px solid var(--ui-color-border); border-radius: var(--ui-radius); overflow: auto; }
    .tt { width: 100%; border-collapse: collapse; font-family: var(--ui-font-default); font-size: var(--ui-font-size-sm); line-height: 1.35;
      color: var(--ui-color-text); font-variant-numeric: tabular-nums; }
    th, td { padding: var(--ui-space-2) var(--ui-space-3); text-align: left; }
    th[data-align="right"], td[data-align="right"] { text-align: right; }
    th[data-align="center"], td[data-align="center"] { text-align: center; }
    thead th { background: var(--ui-color-surface-raised); border-bottom: 1px solid var(--ui-color-border); font-weight: 600; font-size: 12px; color: var(--ui-color-text-muted); white-space: nowrap; }
    .first { display: flex; align-items: center; gap: var(--ui-space-1); min-width: 0; }
    .first .label { min-width: 0; overflow-wrap: anywhere; }
    tbody tr { border-bottom: 1px solid var(--ui-color-border); }
    tbody tr:last-child { border-bottom: none; }
    tbody tr:hover { background: var(--ui-color-surface-hover); }
    /* 24px hit box (WCAG 2.5.8); the negative margins hand the extra 8px back so rows keep their height. */
    .chev { width: 24px; height: 24px; margin: calc(var(--ui-space-1) * -1); flex: none; display: inline-grid; place-items: center; padding: 0; border: none; background: none;
      color: var(--ui-color-text-muted); font: inherit; cursor: pointer;
      border-radius: var(--ui-radius-xs); transition: transform var(--ui-motion-fast) var(--ui-ease-standard); }
    .chev.open { transform: rotate(90deg); }
    .chev:focus-visible { outline: none; box-shadow: var(--ui-focus-ring); }
    .chev.spacer { cursor: default; }
    .chev:not(.spacer):hover { color: var(--ui-color-text); }
  `,
})
export class UiTreeTable {
  rows = input<UiTreeTableRow[]>([]);
  columns = input<UiTreeTableColumn[]>([]);
  firstHeader = input('Name');
  protected readonly expanded = signal<Set<string>>(new Set());

  protected readonly visible = computed<FlatRow[]>(() => {
    const out: FlatRow[] = [];
    const walk = (rows: UiTreeTableRow[], depth: number) => {
      for (const row of rows) {
        out.push({ row, depth });
        if (row.children?.length && this.expanded().has(row.value)) walk(row.children, depth + 1);
      }
    };
    walk(this.rows(), 0);
    return out;
  });

  protected toggle(row: UiTreeTableRow): void {
    const next = new Set(this.expanded());
    next.has(row.value) ? next.delete(row.value) : next.add(row.value);
    this.expanded.set(next);
  }
}
