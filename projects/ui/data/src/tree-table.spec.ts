import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { UiTreeTable, type UiTreeTableRow } from './tree-table';

@Component({
  imports: [UiTreeTable],
  template: `<ui-tree-table [rows]="rows" [columns]="[{ key: 'size', header: 'Size' }]" />`,
})
class Host {
  rows: UiTreeTableRow[] = [
    { label: 'src', value: 'src', data: { size: '4 KB' }, children: [{ label: 'app.ts', value: 'app', data: { size: '1 KB' } }] },
    { label: 'README', value: 'readme', data: { size: '2 KB' } },
  ];
}

describe('UiTreeTable', () => {
  it('expands a parent row from its chevron button, which reports aria-expanded and a label', () => {
    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const bodyRows = () => el.querySelectorAll('tbody tr').length;
    const buttons = el.querySelectorAll<HTMLButtonElement>('button.chev');
    expect(buttons.length).toBe(1); // only rows with children get one
    const btn = buttons[0];
    expect(bodyRows()).toBe(2);
    expect(btn.getAttribute('aria-expanded')).toBe('false');
    expect(btn.getAttribute('aria-label')).toBe('Expand src');

    btn.click();
    fixture.detectChanges();
    expect(bodyRows()).toBe(3);
    expect(btn.getAttribute('aria-expanded')).toBe('true');
    expect(btn.getAttribute('aria-label')).toBe('Collapse src');
  });
});
