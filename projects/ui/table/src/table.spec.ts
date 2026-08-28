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

  /** A visible "Actions" heading over buttons that say what they do is a word doing no work. */
  it('gives the column a heading only a screen reader hears', () => {
    withActions([{ label: 'Edit', run: () => {} }]);
    const head = fixture.nativeElement.querySelector('th.acts');
    expect(head.textContent.trim()).toBe('Actions');
    expect(getComputedStyle(head.querySelector('.sr')).position).toBe('absolute');
  });
});
