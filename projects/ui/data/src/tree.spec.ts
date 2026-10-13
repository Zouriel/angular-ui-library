import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import Folder01Icon from '@hugeicons/core-free-icons/Folder01Icon';
import { UiTree, type UiTreeNode } from './tree';

@Component({
  imports: [UiTree],
  template: `<ui-tree label="Files" [nodes]="nodes" [(selected)]="selected" (nodeSelect)="picked = $event.value" />`,
})
class Host {
  selected = signal<string | null>(null);
  picked: string | null = null;
  nodes: UiTreeNode[] = [
    {
      label: 'src', value: 'src', icon: Folder01Icon, children: [
        { label: 'app.ts', value: 'app', icon: 'A' },
        { label: 'lib', value: 'lib', children: [{ label: 'util.ts', value: 'util' }] },
      ],
    },
    { label: 'docs', value: 'docs', children: [{ label: 'guide.md', value: 'guide' }] },
    { label: 'README', value: 'readme' },
  ];
}

function setup() {
  const fixture = TestBed.createComponent(Host);
  fixture.detectChanges();
  const el = fixture.nativeElement as HTMLElement;
  const items = () => [...el.querySelectorAll<HTMLElement>('[role="treeitem"]')];
  const item = (value: string) => items().find((i) => i.dataset['value'] === value)!;
  const row = (value: string) => item(value).querySelector<HTMLElement>(':scope > .row')!;
  const press = (k: string, target: HTMLElement = document.activeElement as HTMLElement) => {
    const ev = new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true });
    target.dispatchEvent(ev);
    fixture.detectChanges();
    return ev;
  };
  const focused = () => (document.activeElement as HTMLElement | null)?.dataset['value'];
  return { fixture, el, items, item, row, press, focused };
}

describe('UiTree', () => {
  it('draws a HugeIcons icon as an svg and a string icon as text', () => {
    const { el, item, press } = setup();
    expect(item('src').querySelector(':scope > .row .icon svg')).not.toBeNull();
    item('src').focus();
    press('ArrowRight');
    const child = item('app');
    expect(child.querySelector('.icon svg')).toBeNull();
    expect(child.querySelector('.icon')?.textContent?.trim()).toBe('A');
    // A node with no icon renders no icon box at all.
    expect(el.querySelectorAll('.icon').length).toBe(2);
  });

  it('exposes the ARIA tree structure', () => {
    const { el, item, press } = setup();
    const tree = el.querySelector('[role="tree"]')!;
    expect(tree.getAttribute('aria-label')).toBe('Files');
    item('src').focus();
    press('ArrowRight');

    const src = item('src');
    expect(src.getAttribute('aria-level')).toBe('1');
    expect(src.getAttribute('aria-setsize')).toBe('3');
    expect(src.getAttribute('aria-posinset')).toBe('1');
    expect(src.getAttribute('aria-expanded')).toBe('true');
    expect(src.getAttribute('aria-selected')).toBe('false');
    expect(src.getAttribute('aria-label')).toBe('src');
    expect(item('docs').getAttribute('aria-expanded')).toBe('false');
    expect(item('docs').getAttribute('aria-posinset')).toBe('2');
    // Leaves carry no aria-expanded.
    expect(item('readme').hasAttribute('aria-expanded')).toBe(false);

    // Children live in a role=group inside their parent treeitem.
    const group = src.querySelector(':scope > [role="group"]')!;
    expect(group).not.toBeNull();
    const kids = [...group.querySelectorAll(':scope > [role="treeitem"]')];
    expect(kids.map((k) => k.getAttribute('data-value'))).toEqual(['app', 'lib']);
    expect(item('app').getAttribute('aria-level')).toBe('2');
    expect(item('app').getAttribute('aria-setsize')).toBe('2');
    expect(item('lib').getAttribute('aria-posinset')).toBe('2');
    // A collapsed parent renders no group.
    expect(item('docs').querySelector('[role="group"]')).toBeNull();
    // The chevron is decoration, not a nested button inside the treeitem.
    expect(src.querySelector('button')).toBeNull();
  });

  it('has a single tab stop: the first item, then the selected one, then the last focused', () => {
    const { fixture, items, item, press } = setup();
    const stops = () => items().filter((i) => i.tabIndex === 0).map((i) => i.dataset['value']);
    expect(stops()).toEqual(['src']);
    expect(item('docs').tabIndex).toBe(-1);

    fixture.componentInstance.selected.set('readme');
    fixture.detectChanges();
    expect(stops()).toEqual(['readme']);

    item('readme').focus();
    press('ArrowUp');
    expect(stops()).toEqual(['docs']);
  });

  it('moves with Up/Down through visible items and Home/End to the ends', () => {
    const { item, press, focused } = setup();
    item('src').focus();
    press('ArrowRight'); // open src
    press('ArrowDown');
    expect(focused()).toBe('app');
    press('ArrowDown');
    expect(focused()).toBe('lib');
    press('ArrowDown'); // lib is closed, so util is skipped
    expect(focused()).toBe('docs');
    press('End');
    expect(focused()).toBe('readme');
    press('ArrowDown'); // stays on the last item
    expect(focused()).toBe('readme');
    press('Home');
    expect(focused()).toBe('src');
    press('ArrowUp');
    expect(focused()).toBe('src');
  });

  it('Right opens a closed parent, then moves to its first child; Left closes, then moves to the parent', () => {
    const { item, press, focused } = setup();
    item('src').focus();
    expect(press('ArrowRight').defaultPrevented).toBe(true);
    expect(item('src').getAttribute('aria-expanded')).toBe('true');
    expect(focused()).toBe('src');
    press('ArrowRight');
    expect(focused()).toBe('app');
    press('ArrowRight'); // leaf: nothing happens
    expect(focused()).toBe('app');
    press('ArrowLeft'); // leaf: go to parent
    expect(focused()).toBe('src');
    press('ArrowLeft'); // open parent: close it
    expect(item('src').getAttribute('aria-expanded')).toBe('false');
    expect(focused()).toBe('src');
    press('ArrowLeft'); // closed root: nothing
    expect(focused()).toBe('src');
  });

  it('selects with Enter and Space and writes back through [(selected)]', () => {
    const { fixture, item, press } = setup();
    item('readme').focus();
    press('Enter');
    expect(fixture.componentInstance.selected()).toBe('readme');
    expect(fixture.componentInstance.picked).toBe('readme');
    expect(item('readme').getAttribute('aria-selected')).toBe('true');
    item('docs').focus();
    expect(press(' ').defaultPrevented).toBe(true);
    expect(fixture.componentInstance.selected()).toBe('docs');
    expect(item('readme').getAttribute('aria-selected')).toBe('false');
  });

  it('jumps by first letter, wrapping, and ignores letters no label starts with', () => {
    const { item, press, focused } = setup();
    item('src').focus();
    press('r');
    expect(focused()).toBe('readme');
    press('S'); // case-insensitive, wraps to the top
    expect(focused()).toBe('src');
    expect(press('z').defaultPrevented).toBe(false);
    expect(focused()).toBe('src');
  });

  it('* expands every sibling of the focused item', () => {
    const { item, press } = setup();
    item('readme').focus();
    press('*');
    expect(item('src').getAttribute('aria-expanded')).toBe('true');
    expect(item('docs').getAttribute('aria-expanded')).toBe('true');
    // Only one level: lib stays closed.
    expect(item('lib').getAttribute('aria-expanded')).toBe('false');
  });

  it('clicking the chevron toggles without selecting; clicking the row selects', () => {
    const { fixture, item, row } = setup();
    row('src').querySelector<HTMLElement>('.chev')!.click();
    fixture.detectChanges();
    expect(item('src').getAttribute('aria-expanded')).toBe('true');
    expect(fixture.componentInstance.selected()).toBeNull();
    row('app').click();
    fixture.detectChanges();
    expect(fixture.componentInstance.selected()).toBe('app');
  });

  it('collapsing over the focused item moves focus to the collapsed parent', () => {
    const { fixture, item, row, press, focused } = setup();
    item('src').focus();
    press('ArrowRight');
    press('ArrowDown');
    expect(focused()).toBe('app');
    row('src').querySelector<HTMLElement>('.chev')!.click();
    fixture.detectChanges();
    expect(item('app')).toBeUndefined();
    expect(focused()).toBe('src');
    expect(item('src').tabIndex).toBe(0);
  });
});
