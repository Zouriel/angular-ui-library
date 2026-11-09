import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import Folder01Icon from '@hugeicons/core-free-icons/Folder01Icon';
import { UiTree, UiTreeNodeEnd, type UiTreeMove, type UiTreeNode, type UiTreeRename } from './tree';

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

@Component({
  imports: [UiTree, UiTreeNodeEnd],
  template: `
    <ui-tree label="Layers" [nodes]="nodes" [multiple]="multiple()" [reorderable]="reorderable()" [renamable]="renamable()"
             [(selected)]="selected" [(selectedValues)]="values" [(expanded)]="open"
             (nodeMove)="moves.push($event)" (nodeActivate)="activated.push($event.value)" (nodeRename)="renames.push($event)">
      <ng-template uiTreeNodeEnd let-node><button type="button" class="eye" (click)="eyes.push(node.value)">Eye {{ node.label }}</button></ng-template>
    </ui-tree>
  `,
})
class LayersHost {
  multiple = signal(true);
  reorderable = signal(true);
  renamable = signal(true);
  selected = signal<string | null>(null);
  values = signal<string[]>([]);
  open = signal<string[]>(['group']);
  moves: UiTreeMove[] = [];
  activated: string[] = [];
  renames: UiTreeRename[] = [];
  eyes: string[] = [];
  nodes: UiTreeNode[] = [
    { label: 'Title', value: 'title' },
    { label: 'Group', value: 'group', children: [
      { label: 'Photo', value: 'photo' },
      { label: 'Frame', value: 'frame', children: [{ label: 'Shape', value: 'shape' }] },
    ] },
    { label: 'Empty', value: 'empty', container: true },
    { label: 'Hidden', value: 'hidden', muted: true },
  ];
}

function layers() {
  const fixture = TestBed.createComponent(LayersHost);
  fixture.detectChanges();
  const el = fixture.nativeElement as HTMLElement;
  const host = fixture.componentInstance;
  const item = (value: string) => [...el.querySelectorAll<HTMLElement>('[role="treeitem"]')].find((i) => i.dataset['value'] === value)!;
  const row = (value: string) => item(value)?.querySelector<HTMLElement>(':scope > .row')!;
  const click = (value: string, init: MouseEventInit = {}) => {
    row(value).dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, ...init }));
    fixture.detectChanges();
  };
  const press = (k: string, init: KeyboardEventInit = {}, target: HTMLElement = document.activeElement as HTMLElement) => {
    const ev = new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true, ...init });
    target.dispatchEvent(ev);
    fixture.detectChanges();
    return ev;
  };
  return { fixture, el, host, item, row, click, press };
}

/** Each row 20px tall, stacked from y=0 in visible order; elementFromPoint finds the row at y. */
function fakeLayout(el: HTMLElement) {
  const rows = () => [...el.querySelectorAll<HTMLElement>('.row')];
  for (const r of rows()) {
    r.getBoundingClientRect = () => {
      const i = rows().indexOf(r);
      return { left: 0, top: i * 20, right: 200, bottom: i * 20 + 20, width: 200, height: 20, x: 0, y: i * 20, toJSON: () => ({}) } as DOMRect;
    };
  }
  const prev = document.elementFromPoint;
  document.elementFromPoint = (_x: number, y: number) => rows()[Math.floor(y / 20)] ?? null;
  return () => (document.elementFromPoint = prev);
}

function pointer(type: string, target: HTMLElement, y: number, x = 50) {
  const ev = new MouseEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: y, button: 0 });
  Object.defineProperty(ev, 'pointerId', { value: 1 });
  Object.defineProperty(ev, 'pointerType', { value: 'mouse' });
  target.dispatchEvent(ev);
}

describe('UiTree layers features', () => {
  it('draws muted nodes dimmed and leaves others alone', () => {
    const { row } = layers();
    expect(row('hidden').classList).toContain('muted');
    expect(row('title').classList).not.toContain('muted');
  });

  it('multiple: click selects one, Ctrl/Cmd toggles, Shift selects the visible range; selected follows the last click', () => {
    const { el, host, click, item } = layers();
    expect(el.querySelector('[role="tree"]')!.getAttribute('aria-multiselectable')).toBe('true');
    click('title');
    expect(host.values()).toEqual(['title']);
    click('frame', { ctrlKey: true });
    expect(host.values()).toEqual(['title', 'frame']);
    expect(host.selected()).toBe('frame');
    click('title', { metaKey: true });
    expect(host.values()).toEqual(['frame']);
    expect(host.selected()).toBe('title');
    click('photo');
    click('empty', { shiftKey: true });
    // photo, frame (its child shape is closed so it's not in the range), empty
    expect(host.values()).toEqual(['photo', 'frame', 'empty']);
    expect(host.selected()).toBe('empty');
    expect(item('frame').getAttribute('aria-selected')).toBe('true');
    expect(item('title').getAttribute('aria-selected')).toBe('false');
    // Ctrl+Shift adds the range to what's selected.
    click('title');
    click('photo', { shiftKey: true, ctrlKey: true });
    expect(host.values()).toEqual(['title', 'group', 'photo']);
  });

  it('multiple: Space toggles the focused node, Enter selects only it', () => {
    const { host, item, press } = layers();
    item('title').focus();
    press(' ');
    item('hidden').focus();
    press(' ');
    expect(host.values()).toEqual(['title', 'hidden']);
    press(' ');
    expect(host.values()).toEqual(['title']);
    press('Enter');
    expect(host.values()).toEqual(['hidden']);
  });

  it('single mode leaves selectedValues alone and has no aria-multiselectable', () => {
    const { fixture, el, host, click } = layers();
    host.multiple.set(false);
    fixture.detectChanges();
    expect(el.querySelector('[role="tree"]')!.hasAttribute('aria-multiselectable')).toBe(false);
    click('title');
    click('photo', { ctrlKey: true });
    expect(host.selected()).toBe('photo');
    expect(host.values()).toEqual([]);
  });

  it('renders the uiTreeNodeEnd template on every row; using it does not select the row', () => {
    const { el, host, row, item } = layers();
    expect(el.querySelectorAll('.end .eye').length).toBe(6);
    expect(row('photo').querySelector('.end .eye')!.textContent).toContain('Eye Photo');
    row('photo').querySelector<HTMLButtonElement>('.eye')!.click();
    expect(host.eyes).toEqual(['photo']);
    expect(host.values()).toEqual([]);
    expect(host.selected()).toBeNull();
    // Enter on the button is the button's, not the tree's.
    const btn = row('photo').querySelector<HTMLButtonElement>('.eye')!;
    btn.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
    expect(host.selected()).toBeNull();
    expect(item('photo')).toBeDefined();
  });

  it('expanded is a two-way model: binding opens nodes and the chevron writes back', () => {
    const { fixture, host, item, row } = layers();
    expect(item('photo')).toBeDefined();
    host.open.set(['group', 'frame']);
    fixture.detectChanges();
    expect(item('shape')).toBeDefined();
    row('group').querySelector<HTMLElement>('.chev')!.click();
    fixture.detectChanges();
    expect(host.open()).toEqual(['frame']);
    expect(item('photo')).toBeUndefined();
  });

  it('Alt+Up/Down moves the focused node among its siblings, and stops at the ends', () => {
    const { fixture, host, item, press } = layers();
    item('photo').focus();
    expect(press('ArrowDown', { altKey: true }).defaultPrevented).toBe(true);
    expect(host.moves).toEqual([{ value: 'photo', parent: 'group', index: 1 }]);
    press('ArrowUp', { altKey: true }); // already first among group's children
    expect(host.moves.length).toBe(1);
    item('hidden').focus();
    press('ArrowUp', { altKey: true });
    expect(host.moves[1]).toEqual({ value: 'hidden', parent: null, index: 2 });
    // Not reorderable: Alt+Down is an ordinary Down.
    host.reorderable.set(false);
    fixture.detectChanges();
    item('title').focus();
    press('ArrowDown', { altKey: true });
    expect(host.moves.length).toBe(2);
    expect((document.activeElement as HTMLElement).dataset['value']).toBe('group');
  });

  it('dragging a row shows where it lands and emits nodeMove; a short move is still a click', () => {
    const { fixture, el, host, row } = layers();
    const restore = fakeLayout(el);
    try {
      // Rows: title 0, group 20, photo 40, frame 60, empty 80, hidden 100.
      const tree = el.querySelector<HTMLElement>('[role="tree"]')!;
      pointer('pointerdown', row('hidden'), 105);
      pointer('pointermove', tree, 103); // under the 4px threshold
      fixture.detectChanges();
      expect(row('hidden').classList).not.toContain('dragging');
      pointer('pointerup', tree, 103);
      row('hidden').click();
      fixture.detectChanges();
      expect(host.values()).toEqual(['hidden']);
      expect(host.moves).toEqual([]);

      // Upper half of title: before it.
      row('title').click();
      fixture.detectChanges();
      pointer('pointerdown', row('hidden'), 105);
      pointer('pointermove', tree, 4);
      fixture.detectChanges();
      expect(row('hidden').classList).toContain('dragging');
      expect(row('title').classList).toContain('drop-before');
      pointer('pointerup', tree, 4);
      row('hidden').click(); // the click that ends a drag doesn't select
      fixture.detectChanges();
      expect(host.moves).toEqual([{ value: 'hidden', parent: null, index: 0 }]);
      expect(host.values()).toEqual(['title']);
      expect(row('title').classList).not.toContain('drop-before');
      expect(row('hidden').classList).not.toContain('dragging');

      // Middle of an empty container: into it.
      pointer('pointerdown', row('title'), 5);
      pointer('pointermove', tree, 90);
      fixture.detectChanges();
      expect(row('empty').classList).toContain('drop-inside');
      pointer('pointerup', tree, 90);
      expect(host.moves[1]).toEqual({ value: 'title', parent: 'empty', index: 0 });

      // Lower part of an open parent: first child of it.
      pointer('pointerdown', row('hidden'), 105);
      pointer('pointermove', tree, 38);
      fixture.detectChanges();
      expect(row('group').classList).toContain('drop-first');
      pointer('pointerup', tree, 38);
      expect(host.moves[2]).toEqual({ value: 'hidden', parent: 'group', index: 0 });

      // A leaf has no inside: lower half of photo is after it.
      pointer('pointerdown', row('title'), 5);
      pointer('pointermove', tree, 55);
      fixture.detectChanges();
      expect(row('photo').classList).toContain('drop-after');
      pointer('pointerup', tree, 55);
      expect(host.moves[3]).toEqual({ value: 'title', parent: 'group', index: 1 });
    } finally {
      restore();
    }
  });

  it('never drops a node into itself or its descendants, nor where it already is', () => {
    const { fixture, el, host, row } = layers();
    const restore = fakeLayout(el);
    try {
      const tree = el.querySelector<HTMLElement>('[role="tree"]')!;
      pointer('pointerdown', row('group'), 25);
      for (const y of [30, 45, 65]) {
        pointer('pointermove', tree, y); // itself, then its children photo and frame
        fixture.detectChanges();
        expect(el.querySelector('[class*="drop-"]')).toBeNull();
      }
      pointer('pointerup', tree, 65);
      expect(host.moves).toEqual([]);
      // Just below title is where group already is.
      pointer('pointerdown', row('group'), 25);
      pointer('pointermove', tree, 18);
      fixture.detectChanges();
      expect(el.querySelector('[class*="drop-"]')).toBeNull();
      pointer('pointerup', tree, 18);
      expect(host.moves).toEqual([]);
    } finally {
      restore();
    }
  });

  it('Escape cancels a drag', () => {
    const { fixture, el, host, row } = layers();
    const restore = fakeLayout(el);
    try {
      const tree = el.querySelector<HTMLElement>('[role="tree"]')!;
      pointer('pointerdown', row('hidden'), 105);
      pointer('pointermove', tree, 4);
      fixture.detectChanges();
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
      fixture.detectChanges();
      expect(row('hidden').classList).not.toContain('dragging');
      pointer('pointerup', tree, 4);
      expect(host.moves).toEqual([]);
    } finally {
      restore();
    }
  });

  it('double click on a label, or F2, activates the node', () => {
    const { host, row, item, press } = layers();
    row('photo').querySelector<HTMLElement>('.label')!.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
    expect(host.activated).toEqual(['photo']);
    // Double clicks in the end slot don't.
    row('photo').querySelector<HTMLElement>('.eye')!.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
    expect(host.activated).toEqual(['photo']);
    item('title').focus();
    press('F2');
    expect(host.activated).toEqual(['photo', 'title']);
  });

  it('F2 and double click start a focused rename with all text selected and still activate', () => {
    const { fixture, host, row, item, press } = layers();
    item('title').focus();
    press('F2');
    fixture.detectChanges();
    let input = row('title').querySelector<HTMLInputElement>('.rename')!;
    expect(input).not.toBeNull();
    expect(input.maxLength).toBe(80);
    expect(input.getAttribute('aria-label')).toBe('Rename Title');
    expect(document.activeElement).toBe(input);
    expect([input.selectionStart, input.selectionEnd]).toEqual([0, 5]);
    expect(host.activated).toEqual(['title']);
    press('Escape', {}, input);
    row('photo').querySelector<HTMLElement>('.label')!.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
    fixture.detectChanges();
    input = row('photo').querySelector<HTMLInputElement>('.rename')!;
    expect(input).not.toBeNull();
    expect(host.activated).toEqual(['title', 'photo']);
  });

  it('Enter commits one trimmed changed label; unchanged and empty labels emit nothing', () => {
    const { fixture, host, item, row, press } = layers();
    const edit = (value: string, text: string) => {
      item(value).focus();
      press('F2');
      const input = row(value).querySelector<HTMLInputElement>('.rename')!;
      input.value = text;
      press('Enter', {}, input);
      fixture.detectChanges();
    };
    edit('title', '  New title  ');
    expect(host.renames).toEqual([{ value: 'title', label: 'New title' }]);
    edit('photo', ' Photo ');
    edit('hidden', '   ');
    expect(host.renames).toEqual([{ value: 'title', label: 'New title' }]);
  });

  it('blur commits a changed label', () => {
    const { fixture, host, item, row, press } = layers();
    item('title').focus();
    press('F2');
    const input = row('title').querySelector<HTMLInputElement>('.rename')!;
    input.value = '  Heading  ';
    input.dispatchEvent(new FocusEvent('blur'));
    fixture.detectChanges();
    expect(host.renames).toEqual([{ value: 'title', label: 'Heading' }]);
    expect(row('title').querySelector('.rename')).toBeNull();
  });

  it('Escape cancels and refocuses the row', () => {
    const { fixture, host, item, row, press } = layers();
    item('title').focus();
    press('F2');
    const input = row('title').querySelector<HTMLInputElement>('.rename')!;
    input.value = 'Changed';
    press('Escape', {}, input);
    fixture.detectChanges();
    expect(host.renames).toEqual([]);
    expect(row('title').querySelector('.rename')).toBeNull();
    expect(document.activeElement).toBe(item('title'));
  });

  it('editing owns Space and arrows, and clicking the input neither selects nor drags', () => {
    const { fixture, host, item, row, press } = layers();
    item('title').focus();
    press('F2');
    const input = row('title').querySelector<HTMLInputElement>('.rename')!;
    input.click();
    input.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, button: 0 }));
    press(' ', {}, input);
    press('ArrowDown', {}, input);
    fixture.detectChanges();
    expect(host.values()).toEqual([]);
    expect(host.selected()).toBeNull();
    expect(host.moves).toEqual([]);
    expect(document.activeElement).toBe(input);
    expect(row('title').querySelector('.rename')).toBe(input);
  });

  it('renamable=false never shows an input but activation still fires', () => {
    const { fixture, host, item, row, press } = layers();
    host.renamable.set(false);
    fixture.detectChanges();
    item('title').focus();
    press('F2');
    row('photo').querySelector<HTMLElement>('.label')!.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.rename')).toBeNull();
    expect(host.activated).toEqual(['title', 'photo']);
  });
});
