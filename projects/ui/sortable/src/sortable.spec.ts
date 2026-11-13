import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { CdkDrag, CdkDropList } from '@angular/cdk/drag-drop';
import { UiSectionList, uiReorderKeepingLocked, type UiSectionListItem } from './section-list';
import { UiReorderGrid, type UiReorderGridItem } from './reorder-grid';

@Component({
  imports: [UiSectionList],
  template: `<ui-section-list [items]="items()" (reorder)="orders.push($event)" (toggleHidden)="hides.push($event)"
    (edit)="edits.push($event)" (remove)="removes.push($event)" />`,
})
class ListHost {
  items = signal<UiSectionListItem[]>([
    { id: 'cover', label: 'Cover', locked: true, removable: false, hideable: false },
    { id: 'about', label: 'About me', description: 'Who you are' },
    { id: 'gallery', label: 'Gallery', hidden: true },
    { id: 'contact', label: 'Contact', locked: true },
    { id: 'faq', label: 'Questions', editable: false },
  ]);
  orders: string[][] = [];
  hides: { id: string; hidden: boolean }[] = [];
  edits: string[] = [];
  removes: string[] = [];
}

function key(el: Element, k: string) {
  el.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true }));
}

describe('uiReorderKeepingLocked', () => {
  const items: UiSectionListItem[] = [
    { id: 'a', label: 'A', locked: true },
    { id: 'b', label: 'B' },
    { id: 'c', label: 'C', locked: true },
    { id: 'd', label: 'D' },
    { id: 'e', label: 'E' },
  ];
  it('keeps locked items in their slots', () => {
    expect(uiReorderKeepingLocked(items, 4, 0)).toEqual(['a', 'e', 'c', 'b', 'd']);
    expect(uiReorderKeepingLocked(items, 1, 4)).toEqual(['a', 'd', 'c', 'e', 'b']);
  });
});

describe('UiSectionList', () => {
  function render() {
    const f = TestBed.createComponent(ListHost);
    f.detectChanges();
    const rows = () => Array.from(f.nativeElement.querySelectorAll('.row')) as HTMLElement[];
    const ids = () => rows().map((r) => r.dataset['id']);
    const handle = (id: string) => f.nativeElement.querySelector(`.row[data-id="${id}"] .handle`) as HTMLButtonElement | null;
    const btn = (label: string) => f.nativeElement.querySelector(`button[aria-label="${label}"]`) as HTMLButtonElement | null;
    return { f, rows, ids, handle, btn, host: f.componentInstance };
  }

  it('names every control after its row and leaves out the buttons a row turns off', () => {
    const { handle, btn } = render();
    expect(handle('cover')).toBeNull();
    expect(handle('about')!.getAttribute('aria-label')).toBe('Drag to move About me');
    expect(btn('Hide About me')).not.toBeNull();
    expect(btn('Show Gallery')).not.toBeNull();
    expect(btn('Remove Cover')).toBeNull();
    expect(btn('Hide Cover')).toBeNull();
    expect(btn('Edit Questions')).toBeNull();
    expect(btn('Edit Cover')).not.toBeNull();
  });

  it('shows the Hidden badge only on hidden rows', () => {
    const { f } = render();
    const badges = Array.from(f.nativeElement.querySelectorAll('.row ui-badge')).map((b) => (b as HTMLElement).closest('.row')!.getAttribute('data-id'));
    expect(badges).toEqual(['gallery']);
  });

  it('reports hide with the new value, edit and remove', () => {
    const { f, btn, host } = render();
    btn('Hide About me')!.click();
    btn('Show Gallery')!.click();
    btn('Edit About me')!.click();
    btn('Remove Questions')!.click();
    f.detectChanges();
    expect(host.hides).toEqual([{ id: 'about', hidden: true }, { id: 'gallery', hidden: false }]);
    expect(host.edits).toEqual(['about']);
    expect(host.removes).toEqual(['faq']);
    expect(btn('Show About me')).not.toBeNull();
  });

  it('moves a row with the arrow keys, skipping locked slots, and keeps focus on its handle', async () => {
    const { f, ids, handle, host } = render();
    handle('gallery')!.focus();
    key(handle('gallery')!, 'ArrowDown');
    f.detectChanges();
    await f.whenStable();
    expect(ids()).toEqual(['cover', 'about', 'faq', 'contact', 'gallery']);
    expect(host.orders).toEqual([['cover', 'about', 'faq', 'contact', 'gallery']]);
    expect(document.activeElement).toBe(handle('gallery'));
    expect(f.nativeElement.querySelector('[aria-live]').textContent).toContain('Gallery moved to position 5 of 5');
  });

  it('never moves past the first or last unlocked slot and stays quiet then', () => {
    const { f, ids, handle, host } = render();
    key(handle('about')!, 'ArrowUp');
    key(handle('faq')!, 'ArrowDown');
    f.detectChanges();
    expect(ids()).toEqual(['cover', 'about', 'gallery', 'contact', 'faq']);
    expect(host.orders).toEqual([]);
  });

  it('puts locked rows back after a drag and only reports a real change', () => {
    const { f, ids, host } = render();
    const drop = f.debugElement.query(By.directive(CdkDropList)).injector.get(CdkDropList);
    drop.dropped.emit({ previousIndex: 4, currentIndex: 0 } as never);
    f.detectChanges();
    expect(ids()).toEqual(['cover', 'faq', 'about', 'contact', 'gallery']);
    drop.dropped.emit({ previousIndex: 2, currentIndex: 2 } as never);
    expect(host.orders).toEqual([['cover', 'faq', 'about', 'contact', 'gallery']]);
  });

  it('follows new items from the parent', () => {
    const { f, ids, host } = render();
    host.items.set([{ id: 'x', label: 'X' }]);
    f.detectChanges();
    expect(ids()).toEqual(['x']);
  });
});

@Component({
  imports: [UiReorderGrid],
  template: `<ui-reorder-grid [items]="items" coverId="b" [removable]="removable()" (reorder)="orders.push($event)"
    (tileTap)="taps.push($event)" (remove)="removes.push($event)" />`,
})
class GridHost {
  items: UiReorderGridItem[] = [
    { id: 'a', src: 'data:,a', alt: 'Beach' },
    { id: 'b', src: 'data:,b' },
    { id: 'c', src: 'data:,c' },
  ];
  removable = signal(false);
  orders: string[][] = [];
  taps: string[] = [];
  removes: string[] = [];
}

describe('UiReorderGrid', () => {
  function render() {
    const f = TestBed.createComponent(GridHost);
    f.detectChanges();
    const tiles = () => Array.from(f.nativeElement.querySelectorAll('.tile')) as HTMLButtonElement[];
    const names = () => tiles().map((t) => t.getAttribute('aria-label'));
    return { f, tiles, names, host: f.componentInstance };
  }

  it('names tiles by alt or position, and marks the cover', () => {
    const { f, names } = render();
    expect(names()).toEqual(['Beach', 'Photo 2, Cover', 'Photo 3']);
    expect(f.nativeElement.querySelectorAll('.cover').length).toBe(1);
    expect(f.nativeElement.querySelector('.x')).toBeNull();
  });

  it('fires tileTap on a click', () => {
    const { tiles, host } = render();
    tiles()[2].click();
    expect(host.taps).toEqual(['c']);
  });

  it('moves a tile with the arrow keys and keeps focus on it', async () => {
    const { f, tiles, names, host } = render();
    tiles()[0].focus();
    key(tiles()[0], 'ArrowRight');
    f.detectChanges();
    await f.whenStable();
    expect(host.orders).toEqual([['b', 'a', 'c']]);
    expect(document.activeElement?.getAttribute('aria-label')).toBe('Beach');
    key(tiles()[0], 'ArrowLeft');
    f.detectChanges();
    expect(host.orders.length).toBe(1);
    expect(names()[1]).toBe('Beach');
    expect(f.nativeElement.querySelector('[aria-live]').textContent).toContain('Beach moved to position 2 of 3');
  });

  it('reports a drag drop, and nothing for a drop in place', () => {
    const { f, host } = render();
    const drop = f.debugElement.query(By.directive(CdkDropList)).injector.get(CdkDropList);
    drop.dropped.emit({ previousIndex: 2, currentIndex: 0 } as never);
    drop.dropped.emit({ previousIndex: 1, currentIndex: 1 } as never);
    expect(host.orders).toEqual([['c', 'a', 'b']]);
  });

  it('does not count the click that ends a drag as a tap', async () => {
    const { f, tiles, host } = render();
    const drag = f.debugElement.queryAll(By.directive(CdkDrag))[0].injector.get(CdkDrag);
    drag.started.emit({} as never);
    tiles()[0].click();
    drag.ended.emit({} as never);
    tiles()[0].click();
    expect(host.taps).toEqual([]);
    await new Promise((r) => setTimeout(r));
    tiles()[0].click();
    expect(host.taps).toEqual(['a']);
  });

  it('removes from the x without tapping the tile', () => {
    const { f, host } = render();
    host.removable.set(true);
    f.detectChanges();
    const xs = Array.from(f.nativeElement.querySelectorAll('.x')) as HTMLButtonElement[];
    expect(xs.map((x) => x.getAttribute('aria-label'))).toEqual(['Remove Beach', 'Remove photo 2', 'Remove photo 3']);
    xs[1].click();
    expect(host.removes).toEqual(['b']);
    expect(host.taps).toEqual([]);
  });
});
