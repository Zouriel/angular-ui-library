import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { UiTable, UiRowAction } from './table';

/**
 * Row actions. The table's other columns read values out of a row; these do something to it, which
 * is why they are buttons and not formatters — and why the things worth pinning are the ones a
 * formatter could never have got right: the trailing column appearing only when there is something
 * to put in it, the empty row still spanning the whole table, and a per-row disable.
 */
describe('UiTable row actions', () => {
  type Guest = Record<string, unknown> & { id: string; name: string; email: string | null };

  let fixture: ComponentFixture<UiTable<Guest>>;
  const rows: Guest[] = [
    { id: '1', name: 'Ali', email: 'ali@example.com' },
    { id: '2', name: 'Mariyam', email: null },
  ];

  function buttons(label: string): HTMLButtonElement[] {
    return [...fixture.nativeElement.querySelectorAll('td.acts .act')].filter(
      (b) => (b as HTMLElement).textContent?.trim() === label,
    ) as HTMLButtonElement[];
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [UiTable] }).compileComponents();
    fixture = TestBed.createComponent(UiTable<Guest>);
    fixture.componentRef.setInput('columns', [{ key: 'name', header: 'Guest' }]);
    fixture.componentRef.setInput('data', rows);
    fixture.detectChanges();
  });

  function withActions(actions: UiRowAction<Guest>[]): void {
    fixture.componentRef.setInput('actions', actions);
    fixture.detectChanges();
  }

  it('adds no column at all when there are no actions', () => {
    expect(fixture.nativeElement.querySelector('th.acts')).toBeNull();
    expect(fixture.nativeElement.querySelector('td.acts')).toBeNull();
  });

  it('gives every row its own button, and hands back the row it belongs to', () => {
    const edited: Guest[] = [];
    withActions([{ label: 'Edit', run: (row) => edited.push(row) }]);

    expect(buttons('Edit')).toHaveLength(2);
    buttons('Edit')[1].click();
    expect(edited).toEqual([rows[1]]);
  });

  /** The whole reason this is a button and not a formatted string. */
  it('keeps neighbouring actions space-2 apart', () => {
    withActions([{ label: 'Edit', run: () => {} }, { label: 'Remove', run: () => {} }]);

    const [edit] = buttons('Edit');
    const [remove] = buttons('Remove');
    expect(edit.nextElementSibling).toBe(remove);
    expect(getComputedStyle(remove).marginLeft).toBe('var(--ui-space-2)');
    expect(getComputedStyle(edit).marginLeft).toBe('var(--ui-space-1)');
  });

  it('can be unavailable for one row and not another', () => {
    withActions([{ label: 'Resend', run: () => {}, disabled: (row) => !row.email }]);

    expect(buttons('Resend')[0].disabled).toBe(false);
    expect(buttons('Resend')[1].disabled).toBe(true);
  });

  it('names the row for a screen reader when asked to', () => {
    withActions([{ label: 'Edit', run: () => {}, ariaLabel: (row) => `Edit ${row.name}` }]);
    expect(buttons('Edit')[0].getAttribute('aria-label')).toBe('Edit Ali');
  });

  /**
   * The empty row spans the table by a count, so a column added beside it has to be counted too —
   * otherwise "No data" stops short and the layout breaks exactly when there is nothing to look at.
   */
  it('keeps the empty row spanning the whole table', () => {
    withActions([{ label: 'Edit', run: () => {} }]);
    fixture.componentRef.setInput('data', []);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.empty').getAttribute('colspan')).toBe('2');

    fixture.componentRef.setInput('selectable', true);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.empty').getAttribute('colspan')).toBe('3');
  });

  /**
   * The heading is an attribute, and it has to stay one.
   *
   * <p>Written as a visually-hidden span it is position:absolute with nothing positioned above it,
   * so its containing block is the document rather than the table's own scroller. overflow:auto
   * cannot clip it, its static position sits wherever a wide table puts it, and the PAGE grows to
   * contain it — a 360px viewport measured 869px of document, which on a phone reads as a narrow
   * content column beside a full-width fixed bar. No element in this cell, and nothing to escape.</p>
   */
  it('names the column without putting an element in the cell', () => {
    withActions([{ label: 'Edit', run: () => {} }]);
    const head = fixture.nativeElement.querySelector('th.acts');

    expect(head.getAttribute('aria-label')).toBe('Actions');
    expect(head.children.length).toBe(0);
    expect(head.textContent.trim()).toBe('');
  });
});

describe('UiTable sorting and selection', () => {
  type Item = Record<string, unknown> & { name: string; qty: number | null };
  const a: Item = { name: 'banana', qty: 10 };
  const b: Item = { name: 'Apple', qty: 2 };
  const c: Item = { name: 'item 10', qty: null };
  const d: Item = { name: 'item 9', qty: 1 };
  let fixture: ComponentFixture<UiTable<Item>>;
  const el = () => fixture.nativeElement as HTMLElement;
  const names = () => [...el().querySelectorAll('tbody tr')].map((tr) => tr.querySelectorAll('td')[0]?.textContent?.trim());
  const sortButton = (i: number) => el().querySelectorAll<HTMLButtonElement>('th .sort')[i];

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [UiTable] }).compileComponents();
    fixture = TestBed.createComponent(UiTable<Item>);
    fixture.componentRef.setInput('columns', [
      { key: 'name', header: 'Name', sortable: true },
      { key: 'qty', header: 'Qty', sortable: true },
    ]);
    fixture.componentRef.setInput('data', [a, b, c, d]);
    fixture.detectChanges();
  });

  it('sorts text case-insensitively and numbers inside text in numeric order', () => {
    sortButton(0).click();
    fixture.detectChanges();
    expect(names()).toEqual(['Apple', 'banana', 'item 9', 'item 10']);
    expect(el().querySelectorAll('th')[0].getAttribute('aria-sort')).toBe('ascending');
  });

  it('cycles ascending, descending, unsorted; numbers compare as numbers and empties go last', () => {
    const click = () => { sortButton(1).click(); fixture.detectChanges(); };
    click();
    expect(names()).toEqual(['item 9', 'Apple', 'banana', 'item 10']);
    click();
    expect(names()).toEqual(['banana', 'Apple', 'item 9', 'item 10']);
    expect(el().querySelectorAll('th')[1].getAttribute('aria-sort')).toBe('descending');
    click();
    expect(names()).toEqual(['banana', 'Apple', 'item 10', 'item 9']);
    expect(el().querySelectorAll('th')[1].hasAttribute('aria-sort')).toBe(false);
  });

  it('draws the sort indicator as an icon, not a text glyph', () => {
    const btn = sortButton(0);
    expect(btn.querySelector('svg.arrow')).not.toBeNull();
    expect(btn.textContent?.trim()).toBe('Name');
  });

  it('forgets selected rows that leave the data', () => {
    fixture.componentRef.setInput('selectable', true);
    fixture.detectChanges();
    const emitted: Item[][] = [];
    fixture.componentInstance.selectionChange.subscribe((rows) => emitted.push(rows));
    const all = el().querySelector<HTMLInputElement>('thead input')!;
    all.click();
    fixture.detectChanges();
    expect(emitted.at(-1)).toHaveLength(4);

    fixture.componentRef.setInput('data', [a, b]);
    fixture.detectChanges();
    expect(all.checked).toBe(true);
    expect(all.indeterminate).toBe(false);

    el().querySelectorAll<HTMLInputElement>('tbody input')[0].click();
    fixture.detectChanges();
    expect(emitted.at(-1)).toEqual([b]);
    expect(all.indeterminate).toBe(true);
  });
});
