import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import Folder01Icon from '@hugeicons/core-free-icons/Folder01Icon';
import { UiTree, type UiTreeNode } from './tree';

@Component({
  imports: [UiTree],
  template: `<ui-tree [nodes]="nodes" [(selected)]="selected" />`,
})
class Host {
  selected: string | null = null;
  nodes: UiTreeNode[] = [
    { label: 'src', value: 'src', icon: Folder01Icon, children: [{ label: 'app.ts', value: 'app', icon: 'A' }] },
    { label: 'README', value: 'readme' },
  ];
}

function setup() {
  const fixture = TestBed.createComponent(Host);
  fixture.detectChanges();
  const el = fixture.nativeElement as HTMLElement;
  return { fixture, el, rows: () => [...el.querySelectorAll<HTMLElement>('[role="treeitem"]')] };
}
const key = (target: HTMLElement, k: string) => target.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true }));

describe('UiTree', () => {
  it('draws a HugeIcons icon as an svg and a string icon as text', () => {
    const { fixture, el, rows } = setup();
    expect(rows()[0].querySelector('.icon svg')).not.toBeNull();
    key(rows()[0], 'ArrowRight');
    fixture.detectChanges();
    const child = rows()[1];
    expect(child.querySelector('.icon svg')).toBeNull();
    expect(child.querySelector('.icon')?.textContent?.trim()).toBe('A');
    // A node with no icon renders no icon box at all.
    expect(el.querySelectorAll('.icon').length).toBe(2);
  });

  it('moves focus with Arrow Up/Down and Home/End through the visible rows', () => {
    const { fixture, rows } = setup();
    key(rows()[0], 'ArrowRight');
    fixture.detectChanges();
    const r = rows();
    expect(r.length).toBe(3);
    r[0].focus();
    key(r[0], 'ArrowDown');
    expect(document.activeElement).toBe(r[1]);
    key(r[1], 'End');
    expect(document.activeElement).toBe(r[2]);
    key(r[2], 'ArrowDown'); // stays on the last row
    expect(document.activeElement).toBe(r[2]);
    key(r[2], 'Home');
    expect(document.activeElement).toBe(r[0]);
    key(r[0], 'ArrowUp');
    expect(document.activeElement).toBe(r[0]);
  });

  it('selects with Enter and writes back through [(selected)]', () => {
    const { fixture, rows } = setup();
    key(rows()[1], 'Enter');
    fixture.detectChanges();
    expect(fixture.componentInstance.selected).toBe('readme');
    expect(rows()[1].getAttribute('aria-selected')).toBe('true');
  });
});
