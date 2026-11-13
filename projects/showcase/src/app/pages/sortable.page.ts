import { Component, signal } from '@angular/core';
import Image02Icon from '@hugeicons/core-free-icons/Image02Icon';
import UserSquareIcon from '@hugeicons/core-free-icons/UserSquareIcon';
import Mail01Icon from '@hugeicons/core-free-icons/Mail01Icon';
import Home01Icon from '@hugeicons/core-free-icons/Home01Icon';
import { UiSectionList, UiReorderGrid, type UiSectionListItem, type UiReorderGridItem } from '@zouriel/ui/sortable';
import { DocPage, DocSection, DocDemo, type ApiRow } from '../docs/docs-ui';

const LIST_SHAPE = `interface UiSectionListItem {
  id: string;
  label: string;
  description?: string;     // a second, smaller line
  icon?: IconSvgObject;     // a hugeicons icon before the label
  hidden?: boolean;         // dimmed, with a Hidden badge
  locked?: boolean;         // can't be dragged and keeps its place
  editable?: boolean;       // pencil button, default true
  removable?: boolean;      // bin button, default true
  hideable?: boolean;       // eye button, default true
}`;
const GRID_SHAPE = `interface UiReorderGridItem {
  id: string;
  src: string;
  alt?: string;             // names the tile; else "Photo N"
}`;

/** A small coloured square as an SVG data URL, so the demo needs no image files. */
function tile(hue: number, n: number): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" fill="hsl(${hue} 55% 55%)"/><text x="50" y="62" font-size="34" text-anchor="middle" fill="white" font-family="sans-serif">${n}</text></svg>`;
  return 'data:image/svg+xml,' + encodeURIComponent(svg);
}

@Component({
  selector: 'page-sortable',
  imports: [UiSectionList, UiReorderGrid, DocPage, DocSection, DocDemo],
  template: `
    <doc-page eyebrow="Components" title="Sortable"
      lead="Lists and photo grids that people put in order with a finger, a mouse or the keyboard. Built on the CDK's drag and drop, with big touch targets for phones.">

      <doc-section name="Section list" selector="ui-section-list" [api]="listApi" [outputs]="listOut" [shapes]="LIST_SHAPE"
        summary="The parts of a page (or any named things) in order, one card-like row each: a drag handle, an optional icon, the name and a second line, then Hide or Show, Edit and Remove buttons. Drag a row by its handle; it picks up at once with a finger or a mouse, and the list scrolls when you reach its edge. A locked row (a Cover that always comes first) has no handle and keeps its place: the others move round it. Keyboard: Tab to a handle, then the up and down arrows move that row one place; focus stays on it and the new position is read out. A hidden row is dimmed and shows a Hidden badge. The list shows the new order straight away and follows items whenever you change them; every control is 44px and named after its row (Hide About me).">
        <doc-demo [code]="listCode">
          <ui-section-list [items]="sections()" (reorder)="onReorder($event)" (toggleHidden)="onHide($event)"
            (edit)="log.set('edit ' + $event)" (remove)="onRemove($event)" />
          <span class="muted">{{ log() }}</span>
        </doc-demo>
      </doc-section>

      <doc-section name="Reorder grid" selector="ui-reorder-grid" [api]="gridApi" [outputs]="gridOut" [shapes]="GRID_SHAPE"
        summary="Square photo tiles in as many columns as fit (each at least minTile wide). With a finger, hold a tile for a moment, then drag it; a quick swipe still scrolls the page. With a mouse, press and move. A tap that didn't move fires tileTap, for your own menu (Make cover, Remove). coverId puts a star on one tile. removable adds a small x in each tile's corner (44px to tap) that never starts a drag or a tap. Keyboard: the arrows move the focused tile one place, up and down one row; Enter or Space taps it.">
        <doc-demo [code]="gridCode">
          <ui-reorder-grid [items]="photos()" [coverId]="cover()" [removable]="true" (reorder)="onPhotos($event)"
            (tileTap)="cover.set($event)" (remove)="onRemovePhoto($event)" />
          <span class="muted">Tap a tile to make it the cover.</span>
        </doc-demo>
      </doc-section>
    </doc-page>
  `,
  styles: `
    .muted { color: var(--ui-color-text-muted); font: var(--ui-font-size-sm) var(--ui-font-mono); overflow-wrap: anywhere; }
  `,
})
export class SortablePage {
  protected readonly LIST_SHAPE = LIST_SHAPE;
  protected readonly GRID_SHAPE = GRID_SHAPE;
  protected readonly log = signal('Drag a row, or Tab to a handle and press the arrows.');

  protected readonly sections = signal<UiSectionListItem[]>([
    { id: 'cover', label: 'Cover', description: 'Your name and a big photo', icon: Home01Icon, locked: true, removable: false, hideable: false },
    { id: 'about', label: 'About me', description: 'A few lines about your work', icon: UserSquareIcon },
    { id: 'gallery', label: 'Gallery of weddings, birthdays and everything in between', description: '24 photos', icon: Image02Icon },
    { id: 'contact', label: 'Contact', description: 'How people reach you', icon: Mail01Icon, hidden: true },
  ]);

  protected readonly photos = signal<UiReorderGridItem[]>(
    Array.from({ length: 7 }, (_, i) => ({ id: `p${i + 1}`, src: tile(i * 47, i + 1), alt: i === 0 ? 'Beach at sunset' : undefined })),
  );
  protected readonly cover = signal<string | null>('p1');

  protected onReorder(ids: string[]): void {
    const byId = new Map(this.sections().map((s) => [s.id, s]));
    this.sections.set(ids.map((id) => byId.get(id)!));
    this.log.set('reorder ' + ids.join(', '));
  }
  protected onHide(e: { id: string; hidden: boolean }): void {
    this.sections.update((list) => list.map((s) => (s.id === e.id ? { ...s, hidden: e.hidden } : s)));
    this.log.set(`toggleHidden ${e.id} → ${e.hidden}`);
  }
  protected onRemove(id: string): void {
    this.sections.update((list) => list.filter((s) => s.id !== id));
    this.log.set('remove ' + id);
  }
  protected onPhotos(ids: string[]): void {
    const byId = new Map(this.photos().map((p) => [p.id, p]));
    this.photos.set(ids.map((id) => byId.get(id)!));
  }
  protected onRemovePhoto(id: string): void {
    this.photos.update((list) => list.filter((p) => p.id !== id));
  }

  protected readonly listCode = `<ui-section-list [items]="sections()" (reorder)="onReorder($event)"
  (toggleHidden)="onHide($event)" (edit)="openEditor($event)" (remove)="onRemove($event)" />

sections = signal<UiSectionListItem[]>([
  { id: 'cover', label: 'Cover', icon: Home01Icon, locked: true, removable: false, hideable: false },
  { id: 'about', label: 'About me', description: 'A few lines about your work', icon: UserIcon },
  { id: 'contact', label: 'Contact', icon: Mail01Icon, hidden: true },
]);
onReorder(ids: string[]) { /* save the new order */ }`;
  protected readonly gridCode = `<ui-reorder-grid [items]="photos()" [coverId]="coverId()" [removable]="true"
  (reorder)="savePhotoOrder($event)" (tileTap)="openPhotoMenu($event)" (remove)="removePhoto($event)" />`;

  protected readonly listApi: ApiRow[] = [
    { name: 'items', type: 'UiSectionListItem[] (required)', default: '—', desc: 'The rows, in order.' },
    { name: 'ariaLabel', type: 'string', default: "'Sections'", desc: 'Names the list.' },
    { name: 'moveLabel', type: 'string', default: "'Drag to move'", desc: 'The handle’s name, followed by the row’s label.' },
    { name: 'hideLabel', type: 'string', default: "'Hide'", desc: 'The eye button’s name on a shown row.' },
    { name: 'showLabel', type: 'string', default: "'Show'", desc: 'The eye button’s name on a hidden row.' },
    { name: 'editLabel', type: 'string', default: "'Edit'", desc: 'The pencil button’s name.' },
    { name: 'removeLabel', type: 'string', default: "'Remove'", desc: 'The bin button’s name.' },
    { name: 'hiddenLabel', type: 'string', default: "'Hidden'", desc: 'The badge on a hidden row.' },
  ];
  protected readonly listOut: ApiRow[] = [
    { name: 'reorder', type: 'string[]', desc: 'The full new id order, only when it changed. Locked rows are in their old places.' },
    { name: 'toggleHidden', type: '{ id: string; hidden: boolean }', desc: 'The eye button; hidden is the new value.' },
    { name: 'edit', type: 'string', desc: 'The pencil button, with the row’s id.' },
    { name: 'remove', type: 'string', desc: 'The bin button, with the row’s id. Ask before you delete.' },
  ];
  protected readonly gridApi: ApiRow[] = [
    { name: 'items', type: 'UiReorderGridItem[] (required)', default: '—', desc: 'The photos, in order.' },
    { name: 'minTile', type: 'number', default: '96', desc: 'Narrowest a tile may get, in px; the columns fill the width.' },
    { name: 'coverId', type: 'string | null', default: 'null', desc: 'The tile that shows the star.' },
    { name: 'removable', type: 'boolean', default: 'false', desc: 'A small x in each tile’s corner.' },
    { name: 'ariaLabel', type: 'string', default: "'Photos'", desc: 'Names the grid.' },
    { name: 'moveLabel', type: 'string', default: "'Hold and drag to move'", desc: 'Read as each tile’s description.' },
    { name: 'coverLabel', type: 'string', default: "'Cover'", desc: 'Read after the cover tile’s name.' },
    { name: 'removeLabel', type: 'string', default: "'Remove'", desc: 'The x button’s name, followed by the alt or "photo N".' },
  ];
  protected readonly gridOut: ApiRow[] = [
    { name: 'reorder', type: 'string[]', desc: 'The full new id order, only when it changed.' },
    { name: 'tileTap', type: 'string', desc: 'A tap, click, Enter or Space on a tile; not after a drag.' },
    { name: 'remove', type: 'string', desc: 'The x button, with the tile’s id.' },
  ];
}
