import { Component, computed, signal } from '@angular/core';
import { UiButton } from '@zouriel/ui/button';
import { UiCarousel, UiGallery, UiImagePicker, UiPosterDetails, UiPosterGrid, UiPosterView, UiScrim, UiSelectable, UiSelectionBar, UiMasonryGrid, UiMasonryTile, type UiCarouselSlide, type UiGalleryImage, type UiImagePickerItem, type UiPoster, type UiSelectionAction } from '@zouriel/ui/media';
import { UiTaskProgressDialog } from '@zouriel/ui/dialog';
import { UiFilter, UiFilterChips, uiFilterPrune, type UiFilterSection, type UiFilterValue } from '@zouriel/ui/filter';
import Delete02Icon from '@hugeicons/core-free-icons/Delete02Icon';
import Download04Icon from '@hugeicons/core-free-icons/Download04Icon';
import Share08Icon from '@hugeicons/core-free-icons/Share08Icon';
import { DocPage, DocSection, DocDemo, type ApiRow } from '../docs/docs-ui';

function grad(a: string, b: string): string {
  return 'data:image/svg+xml;utf8,' + encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="340"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs><rect width="600" height="340" fill="url(#g)"/></svg>`);
}

@Component({
  selector: 'page-media',
  imports: [UiButton, UiCarousel, UiGallery, UiImagePicker, UiPosterDetails, UiPosterGrid, UiPosterView, UiScrim, UiSelectable, UiSelectionBar, UiMasonryGrid, UiMasonryTile, UiTaskProgressDialog, UiFilter, UiFilterChips, DocPage, DocSection, DocDemo],
  styles: `.note { margin: var(--ui-space-2) 0 0; font-size: var(--ui-font-size-sm); color: var(--ui-color-text-muted); }
    .scrim-demo { position: relative; max-width: 360px; aspect-ratio: 3 / 4; border-radius: var(--ui-radius); overflow: hidden; }
    .scrim-demo img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
    .scrim-demo ui-scrim { position: absolute; inset-inline: 0; bottom: 0; }
    .pv-title { margin: 0; font-size: var(--ui-font-size-lg); font-weight: 600; }
    .pv-meta { margin: 0; opacity: 0.9; }
    .pt-title { display: block; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .pt-line { display: block; font-size: var(--ui-font-size-sm); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .pv-actions { display: flex; flex-wrap: wrap; gap: var(--ui-space-2); margin-top: var(--ui-space-2); }
    .sel-top { min-height: 56px; display: flex; align-items: center; margin-bottom: var(--ui-space-2); }
    .mg-buttons { display: flex; gap: var(--ui-space-2); margin-bottom: var(--ui-space-3); flex-wrap: wrap; }
    .mg-tile { display: grid; place-items: center; border-radius: var(--ui-radius-sm, 6px); color: #fff; font-weight: 600; font-size: var(--ui-font-size-sm); }
    .flt-bar { display: flex; flex-wrap: wrap; align-items: center; gap: var(--ui-space-2); margin-bottom: var(--ui-space-2); }
    .flt-note { font-size: var(--ui-font-size-sm); color: var(--ui-color-text-muted); }
    .flt-chips { margin-bottom: var(--ui-space-2); }
    .flt-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(72px, 1fr)); gap: 4px; }
    .flt-tile { aspect-ratio: 1; border-radius: var(--ui-radius-sm); display: grid; place-items: center; color: #fff; font: 600 12px var(--ui-font-default); text-align: center; padding: 4px; }
    .sel-top ui-selection-bar { flex: 1; min-width: 0; background: var(--ui-color-surface-raised); border: 1px solid var(--ui-color-border); border-radius: var(--ui-radius); }
    .sel-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: var(--ui-space-1); }
    @container (min-width: 544px) { .sel-grid { grid-template-columns: repeat(4, minmax(0, 1fr)); } }
    .sel-wrap { container-type: inline-size; }
    .sel-grid ui-selectable { aspect-ratio: 1; }
    .sel-grid img { display: block; width: 100%; height: 100%; object-fit: cover; }`,
  template: `
    <doc-page eyebrow="Components" title="Media"
      lead="Image components from @zouriel/ui/media: a carousel, a thumbnail gallery with a lightbox, and a picker for choosing an image. ui-device-frame, the phone frame from the same entry point, is documented on the Design tools page.">

      <doc-section name="Carousel" selector="ui-carousel" [api]="carouselApi"
        summary="Slides with arrows, dots, a swipe that follows the finger, and optional autoplay (ms; 0 disables). Autoplay pauses while hovered or while focus is inside, and is off under prefers-reduced-motion. Arrows (hidden on devices without hover) wrap around; a swipe stops at the first and last slide with a little resistance. Each arrow and dot is a labelled button, so the carousel works from the keyboard with Tab and Enter. A swipe that starts inside is the carousel's own and never reaches page-level swipe handlers. Projected content is laid over the slides."
        [shapes]="'interface UiCarouselSlide { image: string; alt?: string; caption?: string; }'">
        <doc-demo code="<ui-carousel [slides]=&quot;slides&quot; [autoplay]=&quot;4000&quot; [(index)]=&quot;slide&quot; />">
          <ui-carousel [slides]="slides" [autoplay]="4000" [(index)]="slide" />
          <p class="note">Showing slide {{ slide() + 1 }} of {{ slides.length }}</p>
        </doc-demo>
      </doc-section>

      <doc-section name="Gallery" selector="ui-gallery" [api]="galleryApi"
        summary="Responsive thumbnail grid (auto-fill columns at least minThumb wide). A thumbnail opens a full-screen lightbox with previous, next and close buttons. In the lightbox, Left/Right step (wrapping around), Esc or a click on the backdrop closes, and focus returns to the thumbnail. Thumbnails use alt as their accessible name, so give every image one."
        [shapes]="'interface UiGalleryImage { src: string; thumb?: string; alt?: string; }'">
        <doc-demo code="<ui-gallery [images]=&quot;images&quot; minThumb=&quot;90px&quot; />">
          <ui-gallery [images]="images" minThumb="90px" />
        </doc-demo>
      </doc-section>

      <doc-section name="Poster grid" selector="ui-poster-grid" [api]="posterGridApi" [outputs]="posterGridOut"
        summary="One grid of same-shape picture tiles (ratio): 2 columns on a phone, 3 from 544px, 4 from 992px and 5 from 1280px of the grid's own width (a container query, so it fits a sidebar too). With a uiPosterDetails template every tile carries its details over the bottom of its picture on a compact ui-scrim that fades from clear to dark, so the words stay readable on any picture; keep them short and non-interactive, since the whole tile is the target. Without the template a tile is the picture alone, named by its label. A tile with an href is a link; with handleClicks a plain click goes to (select) for client-side routing and a Ctrl/Cmd click still opens a new tab. No picture, or one that fails to load, shows a gradient of its colors (or the theme's primary and accent). A small dot (mark) can flag a tile; screen readers hear its label."
        [shapes]="posterShapes">
        <doc-demo [code]="posterGridCode">
          <ui-poster-grid [posters]="posters" focus="top" [handleClicks]="true" (select)="picked.set($event)">
            <ng-template uiPosterDetails let-p let-i="index">
              <span class="pt-title">{{ p.label }}</span>
              <span class="pt-line">{{ when[i % when.length] }}</span>
            </ng-template>
          </ui-poster-grid>
          <p class="note">Last picked: {{ posters[picked()].label }}</p>
        </doc-demo>
      </doc-section>

      <doc-section name="Poster view" selector="ui-poster-view" [api]="posterViewApi" [outputs]="posterViewOut"
        summary="One picture full-size, shown whole over a blurred copy of itself, with whatever you project laid over its bottom on a ui-scrim: the details and the buttons. A modal dialog: Tab stays inside, Esc or the close button closes it, focus returns to what opened it.">
        <doc-demo code="<ui-poster-view [(open)]=&quot;open&quot; [src]=&quot;src&quot; label=&quot;Aisha and Ali&quot;> <h3>Aisha and Ali</h3> <ui-button>Open invitation</ui-button> </ui-poster-view>">
          <ui-button (click)="viewOpen.set(true)">Open the poster view</ui-button>
          <ui-poster-view [(open)]="viewOpen" [src]="posters[0].src" [label]="posters[0].label">
            <p class="pv-title">{{ posters[0].label }}</p>
            <p class="pv-meta">Saturday 12 December, 7 pm · Malé</p>
            <div class="pv-actions"><ui-button (click)="viewOpen.set(false)">Open invitation</ui-button></div>
          </ui-poster-view>
        </doc-demo>
      </doc-section>

      <doc-section name="Scrim" selector="ui-scrim"
        summary="A see-through layer that fades from clear at its top to the media scrim colour at its bottom, for putting words on a picture. The fade reaches 60% before the content starts and 88% at the bottom, so its on-scrim text keeps at least 4.5:1 over any picture, white included. [compact]=&quot;true&quot; sizes it for a grid tile (a space8 fade, tighter padding), as ui-poster-grid uses it.">
        <doc-demo code="<div class=&quot;picture&quot;> <img ... /> <ui-scrim> <h3>Title</h3> <p>Details</p> </ui-scrim> </div>">
          <div class="scrim-demo">
            <img [src]="scrimPicture" alt="White to sky blue gradient" />
            <ui-scrim><p class="pv-title">Aisha and Ali</p><p class="pv-meta">Over a white picture, still readable.</p></ui-scrim>
          </div>
        </doc-demo>
      </doc-section>

      <doc-section name="Selectable" selector="ui-selectable" [api]="selectableApi" [outputs]="selectableOut"
        summary="Wraps one grid tile for long-press multi-select, like a phone gallery. A click, tap, Enter or Space emits (tap): the app opens the tile, or toggles it while selecting. Holding a finger or mouse down for 500ms emits (longPress) (with a short vibration where the browser allows it); moving more than 10px, any scroll, or a second finger going down anywhere (a pinch) cancels it, so a finger that scrolls or pinches never selects, and the click after a long press is swallowed. The phone's own long-press menu and callout are suppressed. From the keyboard, the context-menu key or Shift+F10 is the long press. While selecting, a round mark sits in the top corner: an empty ring over a small scrim, or filled with the primary colour and a check, readable on white and black pictures; a selected tile shrinks a little with a primary outline and tint. It is a button named by its label, and a checkbox while selecting. In the demo: press and hold a photo, tap more, then Save to gallery for a fake job.">
        <doc-demo code="<ui-selectable [label]=&quot;'Photo ' + (i + 1)&quot; [selected]=&quot;picked.has(i)&quot; [selecting]=&quot;picked.size > 0&quot;
  (tap)=&quot;picked.size ? toggle(i) : open(i)&quot; (longPress)=&quot;toggle(i)&quot;>
  <img [src]=&quot;photo.src&quot; alt=&quot;&quot; />
</ui-selectable>">
          <div class="sel-wrap">
            <div class="sel-top">
              @if (selPicked().size) {
                <ui-selection-bar [count]="selPicked().size" [total]="photos.length" [actions]="selActions"
                  (selectAll)="selectAllPhotos()" (clear)="clearPhotos()" (cancel)="clearPhotos()" (action)="act($event)" />
              } @else {
                <p class="note" style="margin: 0">{{ selNote() }}</p>
              }
            </div>
            <div class="sel-grid">
              @for (p of photos; track $index) {
                <ui-selectable [label]="'Photo ' + ($index + 1)" [selected]="selPicked().has($index)" [selecting]="selPicked().size > 0"
                  (tap)="selPicked().size ? togglePhoto($index) : selNote.set('Opened photo ' + ($index + 1) + '.')" (longPress)="togglePhoto($index)">
                  <img [src]="p" alt="" />
                </ui-selectable>
              }
            </div>
          </div>
          <ui-task-progress-dialog [(open)]="jobOpen" [title]="jobTitle()" [done]="jobDone()" [total]="jobTotal()" [detail]="jobDetail()"
            [(stopping)]="jobStopping" />
        </doc-demo>
      </doc-section>

      <doc-section name="Selection bar" selector="ui-selection-bar" [api]="selectionBarApi" [outputs]="selectionBarOut"
        summary="The bar shown while selecting: Cancel (an X) at the start, &quot;12 selected&quot;, a Select all toggle that reads Clear once count reaches total (canSelectAll / canClear false hide a side), then the actions. Actions are disabled while nothing is selected or when enabled is false; danger draws the destructive style. When the labels don't all fit (a 360px phone with three actions) the toggle and the actions with an icon become icon buttons that keep their label as their accessible name and tooltip, and if &quot;12 selected&quot; still doesn't fit the number shows alone, so nothing overflows at 320px. Count changes are announced politely. The demo is in Selectable above."
        [shapes]="'interface UiSelectionAction { id: string; label: string; icon?: IconSvgObject; danger?: boolean; enabled?: boolean; }'"></doc-section>

      <doc-section name="Filter" selector="ui-filter" [api]="filterApi"
        summary="One compact Filter button for a toolbar, however many filters there are: a filter icon, the words and, while filters are on, a count bubble (read as &quot;Filter, 2 on&quot;). It opens a panel of sections. On a screen under narrowAt (600px) the panel is a modal bottom sheet with its footer pinned; wider, a 340px popover under the button whose body scrolls between its title and footer. Each section is a titled group: its &quot;all&quot; row (allLabel, e.g. Everyone) first, then its options with counts; multiple sections have checkboxes (any chosen option passes), the others radios, and from searchAt options (8) a search field narrows the rows. Rows are 44px tall. Every tap changes [(value)] at once so the page behind updates; the footer's Show N (resultCount) or Done closes it, Clear all turns everything off. Escape and a tap outside close it too, focus goes back to the button. To add a filter, add a section: the toolbar keeps its one button. ui-filter-chips shows the filters that are on as removable chips with Clear all, for under the toolbar; uiFilterPrune drops choices the sections no longer offer, so a stale choice never empties the page. ui-filter-button, ui-filter-panel and ui-filter-footer are the parts, for your own container."
        [shapes]="'interface UiFilterOption { id: string; label: string; count?: number | null; }\ninterface UiFilterSection { id: string; title: string; options: UiFilterOption[]; multiple?: boolean; allLabel?: string; allCount?: number | null; searchAt?: number; }\ntype UiFilterValue = Record<string, string[]>;  // section id -> chosen option ids; missing or [] = everything\nuiFilterCount(value) · uiActiveFilters(sections, value) · uiFilterPrune(sections, value) · uiFilterToggle(section, value, id) · uiFilterSet(value, section, ids) · uiFilterRemove(value, section, id)'">
        <doc-demo code="<ui-filter [sections]=&quot;sections&quot; [(value)]=&quot;filter&quot; [resultCount]=&quot;shown().length&quot; />
<ui-filter-chips [sections]=&quot;sections&quot; [(value)]=&quot;filter&quot; />">
          <div class="flt-bar">
            <ui-filter [sections]="fltSections()" [(value)]="fltValue" [resultCount]="fltShown().length" />
            <span class="flt-note">{{ fltShown().length }} of {{ fltItems.length }}</span>
          </div>
          <ui-filter-chips class="flt-chips" [sections]="fltSections()" [(value)]="fltValue" />
          <div class="flt-grid">
            @for (it of fltShown(); track it.n) {
              <div class="flt-tile" [style.background]="masonryColours[it.n % masonryColours.length]">{{ it.who }}{{ it.video ? ' (video)' : '' }}</div>
            }
          </div>
        </doc-demo>
      </doc-section>

      <doc-section name="Masonry grid" selector="ui-masonry-grid" [api]="masonryApi" [outputs]="masonryOut"
        summary="A photo grid of columns of different heights, each picture in its own shape (ratios: height / width), like a phone's gallery. A two-finger pinch changes [(columns)] (apart: fewer, bigger; together: more), between minColumns and maxColumns. Every change animates: each tile on screen moves and grows or shrinks from where it was to its new place (duration, ease-out), and a second pinch mid-way carries on from where the tiles are. After a pinch the page scrolls so the picture under the fingers stays under them. Tiles off screen just take their new place, so a big album costs no more than one screenful. Reduced motion or animations off make it instant. keyOf keeps tiles' identity (so pictures don't reload). Pinch the demo on a phone, or use the buttons.">
        <doc-demo code="<ui-masonry-grid [ratios]=&quot;ratios&quot; [(columns)]=&quot;columns&quot; [keyOf]=&quot;keyOf&quot;>
  <ng-template uiMasonryTile let-i><img [src]=&quot;photos[i].thumb&quot; alt=&quot;&quot; /></ng-template>
</ui-masonry-grid>">
          <div class="mg-buttons">
            @for (n of [1, 2, 3, 4, 5]; track n) {
              <ui-button size="sm" [variant]="masonryColumns() === n ? 'primary' : 'outline'" (click)="masonryColumns.set(n)">{{ n }}</ui-button>
            }
          </div>
          <div>
            <ui-masonry-grid [ratios]="masonryRatios" [(columns)]="masonryColumns">
              <ng-template uiMasonryTile let-i><div class="mg-tile" [style.background]="masonryColours[i % masonryColours.length]">{{ i + 1 }}</div></ng-template>
            </ui-masonry-grid>
          </div>
        </doc-demo>
      </doc-section>

      <doc-section name="Task progress" selector="ui-task-progress" [api]="taskApi" [outputs]="taskOut"
        summary="Progress for a job over many files: the title, &quot;12 of 40&quot;, a detail line (the file in hand) and a bar that fills as files finish (it sweeps while total is 0). Cancel sets stopping (two-way) and emits (cancel); the button then reads Stopping, busy, until the job closes it. ui-task-progress-dialog shows it in a small modal ([(open)], the same inputs): the backdrop doesn't close it, Escape cancels like the button, and it closes only when the job sets open to false.">
        <doc-demo code="<ui-task-progress-dialog [(open)]=&quot;saving&quot; title=&quot;Saving photos&quot; [done]=&quot;done&quot; [total]=&quot;40&quot; [detail]=&quot;file&quot;
  [(stopping)]=&quot;stopping&quot; (cancel)=&quot;stopAfterThisFile()&quot; />">
          <ui-button (click)="runJob('Saving photos', 40)">Save 40 photos</ui-button>
        </doc-demo>
      </doc-section>

      <doc-section name="Image picker" selector="ui-image-picker" [api]="pickerApi" [outputs]="pickerOut"
        summary="A grid of tiles to choose from (search results, stock art). Each tile is a button named by its label; tap, click, Enter or Space picks it. While busyId is set, that tile shows a spinner and every other tile is disabled. With hasMore on, scrolling within 240px of the end emits (more), and it asks again after a page loads if the end is still in view. Thumbnails that fail to load fall back to the label. Tiles sit on a faint checkerboard so white or transparent art shows. With dragType set, tiles can be dragged (HTML drag and drop, so mouse only)."
        [shapes]="'interface UiImagePickerItem { id: string; src: string; label: string; badge?: string; disabled?: boolean; hint?: string; }'">
        <doc-demo code="<ui-image-picker [items]=&quot;items&quot; [busyId]=&quot;busy&quot; [hasMore]=&quot;true&quot; (pick)=&quot;choose($event)&quot; (more)=&quot;loadMore()&quot; />">
          <ui-image-picker [items]="pickerItems()" [busyId]="busy()" [hasMore]="pickerItems().length < 24" [captions]="true" minThumb="88px"
            (pick)="choose($event)" (more)="loadMore()" />
        </doc-demo>
      </doc-section>
    </doc-page>
  `,
})
export class MediaPage {
  protected readonly slides: UiCarouselSlide[] = [
    { image: grad('#3d5afe', '#e5484d'), alt: 'Blue to red gradient', caption: 'Slide one' },
    { image: grad('#2faa6e', '#d9a521'), alt: 'Green to amber gradient', caption: 'Slide two' },
    { image: grad('#8a8f98', '#3d5afe'), alt: 'Grey to blue gradient', caption: 'Slide three' },
  ];
  protected readonly images: UiGalleryImage[] = [
    { src: grad('#3d5afe', '#2faa6e'), alt: 'Blue to green gradient' }, { src: grad('#e5484d', '#d9a521'), alt: 'Red to amber gradient' },
    { src: grad('#8a8f98', '#3d5afe'), alt: 'Grey to blue gradient' }, { src: grad('#2faa6e', '#e5484d'), alt: 'Green to red gradient' },
  ];
  protected readonly slide = signal(0);
  protected readonly posters: UiPoster[] = [
    { src: grad('#3d5afe', '#e5484d'), label: 'Aisha and Ali', mark: { tone: 'primary', label: 'New' } },
    { src: grad('#2faa6e', '#d9a521'), label: 'Eid get-together' },
    { src: null, label: 'Hawwa turns 30', colors: ['#5b2a86', '#e5484d'], mark: { tone: 'warning', label: 'Not finished' } },
    { src: grad('#8a8f98', '#3d5afe'), label: 'Graduation' },
    { src: null, label: 'Office dinner' },
    { src: grad('#d9a521', '#3d5afe'), label: 'Housewarming' },
  ];
  protected readonly posterGridCode = `<ui-poster-grid [posters]="posters" focus="top" [handleClicks]="true" (select)="open($event)">
  <ng-template uiPosterDetails let-p>
    <strong>{{ p.label }}</strong> <span>Sat 12 Dec · Malé</span>
  </ng-template>
</ui-poster-grid>`;
  protected readonly posterShapes = "interface UiPoster { src?: string | null; label: string; href?: string | null; colors?: string[]; mark?: UiPosterMark | null; }\ninterface UiPosterMark { tone: 'primary' | 'warning' | 'neutral'; label: string; }";
  protected readonly viewOpen = signal(false);
  protected readonly picked = signal(0);
  protected readonly when = ['Sat 12 Dec · Malé', 'Sun 20 Dec · Hulhumalé', 'Not finished', 'Fri 1 Jan · Addu', '12 guests', 'Tue 5 Jan'];
  protected readonly scrimPicture = grad('#ffffff', '#cfe8ff');
  protected readonly posterGridApi: ApiRow[] = [
    { name: 'posters', type: 'UiPoster[]', default: '[]', desc: 'The tiles: picture, accessible label, fallback colours, optional dot.' },
    { name: 'ratio', type: 'number', default: '0.75', desc: 'Width / height of every tile.' },
    { name: 'focus', type: "'top' | 'center'", default: "'center'", desc: "Which part of a picture survives the crop; 'top' keeps a poster's heading." },
    { name: 'handleClicks', type: 'boolean', default: 'false', desc: 'A plain click on a link tile goes to (select) only (no browser navigation), for client-side routing.' },
    { name: '<ng-template uiPosterDetails>', type: 'slot', default: '—', desc: 'Details drawn on every tile over a compact scrim; context: the poster ($implicit) and index.' },
  ];
  protected readonly posterGridOut: ApiRow[] = [{ name: 'select', type: 'number', default: '—', desc: 'The index of the tile that was activated.' }];
  protected readonly posterViewApi: ApiRow[] = [
    { name: 'open', type: 'boolean', default: 'false', desc: 'Two-way (`[(open)]`). Whether the view is showing.' },
    { name: 'src', type: 'string | null', default: 'null', desc: 'The picture.' },
    { name: 'label', type: 'string', default: "''", desc: "The dialog's accessible name and the picture's alt text." },
    { name: 'colors', type: 'string[] | null', default: 'null', desc: 'Fallback gradient when there is no picture, as on ui-poster-grid.' },
    { name: '<ng-content>', type: 'slot', default: '—', desc: 'Details and buttons, laid over the bottom of the picture on a ui-scrim.' },
  ];
  protected readonly posterViewOut: ApiRow[] = [{ name: 'closed', type: 'void', default: '—', desc: 'Closed by Esc or the close button.' }];
  protected readonly pickerItems = signal<UiImagePickerItem[]>(this.page(0));
  protected readonly busy = signal<string | null>(null);

  private page(from: number): UiImagePickerItem[] {
    const colours = ['#3d5afe', '#e5484d', '#2faa6e', '#d9a521', '#8a8f98'];
    return Array.from({ length: 8 }, (_, i) => ({
      id: String(from + i), src: grad(colours[(from + i) % 5], colours[(from + i + 2) % 5]), label: `Art ${from + i + 1}`,
      badge: (from + i) % 3 === 0 ? 'Moves' : undefined, disabled: from + i === 5, hint: from + i === 5 ? 'Too large' : undefined,
    }));
  }

  protected choose(item: UiImagePickerItem): void {
    this.busy.set(item.id);
    setTimeout(() => this.busy.set(null), 1200);
  }

  protected loadMore(): void {
    this.pickerItems.update((items) => [...items, ...this.page(items.length)]);
  }

  protected readonly pickerApi: ApiRow[] = [
    { name: 'items', type: 'UiImagePickerItem[]', default: '[]', desc: 'The tiles.' },
    { name: 'busyId', type: 'string | null', default: 'null', desc: 'The tile being fetched; it shows a spinner and the others are disabled.' },
    { name: 'loading', type: 'boolean', default: 'false', desc: 'A page is loading (spinner under the grid).' },
    { name: 'hasMore', type: 'boolean', default: 'false', desc: 'Reaching the end emits (more), unless loading is on.' },
    { name: 'minThumb', type: 'string', default: "'96px'", desc: 'Min tile width.' },
    { name: 'captions', type: 'boolean', default: 'false', desc: 'Show each label under its tile.' },
    { name: 'emptyText', type: 'string', default: "''", desc: 'Shown when there are no items.' },
    { name: 'dragType', type: 'string | null', default: 'null', desc: 'Makes tiles draggable; drag data is the id under this type.' },
  ];
  protected readonly pickerOut: ApiRow[] = [
    { name: 'pick', type: 'UiImagePickerItem', default: '—', desc: 'A tile was chosen.' },
    { name: 'more', type: 'void', default: '—', desc: 'Scrolled near the end with hasMore on; the next page is wanted.' },
  ];
  protected readonly carouselApi: ApiRow[] = [
    { name: 'slides', type: 'UiCarouselSlide[]', default: '[]', desc: 'Slides: image, alt text and an optional caption (clamped to three lines).' },
    { name: 'autoplay', type: 'number', default: '0', desc: 'Auto-advance interval (ms); 0 = off.' },
    { name: 'index', type: 'number', default: '0', desc: 'Two-way (`[(index)]`). The slide showing; bind it to draw your own position marker.' },
    { name: 'dots', type: 'boolean', default: 'true', desc: 'Built-in dots. Turn off when drawing your own.' },
    { name: 'arrows', type: 'boolean', default: 'true', desc: 'Built-in arrows (shown only where there is a mouse).' },
    { name: '<ng-content>', type: 'slot', default: '—', desc: 'Laid over the slides, e.g. a title or counter.' },
  ];
  // Selectable demo: twelve photos, a selection bar, and a fake many-file job.
  protected readonly photos = Array.from({ length: 12 }, (_, i) => grad(['#3d5afe', '#2faa6e', '#8a8f98', '#7a4fa0', '#b34a3c', '#1f6f8b'][i % 6], ['#e5484d', '#d9a521', '#3d5afe', '#66c2a5', '#f2e1c2', '#99d8e2'][i % 6]));
  protected readonly selPicked = signal<ReadonlySet<number>>(new Set());
  protected readonly selNote = signal('Press and hold a photo to start selecting.');
  protected readonly selActions: UiSelectionAction[] = [
    { id: 'share', label: 'Share', icon: Share08Icon },
    { id: 'save', label: 'Save to gallery', icon: Download04Icon },
    { id: 'delete', label: 'Delete', icon: Delete02Icon, danger: true },
  ];
  protected togglePhoto(i: number): void {
    const next = new Set(this.selPicked());
    if (next.has(i)) next.delete(i);
    else next.add(i);
    this.selPicked.set(next);
  }
  protected selectAllPhotos(): void {
    this.selPicked.set(new Set(this.photos.map((_, i) => i)));
  }
  protected clearPhotos(): void {
    this.selPicked.set(new Set());
  }
  protected async act(id: string): Promise<void> {
    const n = this.selPicked().size;
    if (id === 'save') await this.runJob(`Saving ${n} photos`, n);
    this.selNote.set(id === 'share' ? `Shared ${n} photos.` : id === 'save' ? `Saved ${n} photos.` : `Deleted ${n} photos (not really).`);
    this.clearPhotos();
  }
  protected readonly jobOpen = signal(false);
  protected readonly jobTitle = signal('');
  protected readonly jobDone = signal(0);
  protected readonly jobTotal = signal(0);
  protected readonly jobDetail = signal<string | null>(null);
  protected readonly jobStopping = signal(false);
  /** One "file" every 120ms until done or cancelled; stopping takes a moment, as finishing the file in hand would. */
  protected async runJob(title: string, count: number): Promise<void> {
    const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
    this.jobTitle.set(title);
    this.jobTotal.set(count);
    this.jobDone.set(0);
    this.jobStopping.set(false);
    this.jobOpen.set(true);
    for (let i = 0; i < count && !this.jobStopping(); i++) {
      this.jobDetail.set(`IMG_${1000 + i}.jpg`);
      await wait(120);
      this.jobDone.set(i + 1);
    }
    if (this.jobStopping()) await wait(600);
    this.jobOpen.set(false);
    this.jobStopping.set(false);
  }
  protected readonly selectableApi: ApiRow[] = [
    { name: 'selected', type: 'boolean', default: 'false', desc: 'Whether this tile is selected.' },
    { name: 'selecting', type: 'boolean', default: 'false', desc: 'Selection mode: the marks show.' },
    { name: 'label', type: 'string | null', default: 'null', desc: "The tile's accessible name." },
    { name: 'borderRadius', type: 'string | null', default: 'null', desc: "The tile's corners (any CSS radius); the theme's radius when null." },
    { name: '<ng-content>', type: 'slot', default: '—', desc: 'The tile (a picture).' },
  ];
  protected readonly selectableOut: ApiRow[] = [
    { name: 'tap', type: 'void', default: '—', desc: 'A click, tap, Enter or Space (open, or toggle while selecting).' },
    { name: 'longPress', type: 'void', default: '—', desc: 'Held 500ms without moving 10px or scrolling; the context-menu key or Shift+F10.' },
  ];
  protected readonly masonryColumns = signal(3);
  protected readonly masonryRatios = Array.from({ length: 60 }, (_, i) => [1, 1.5, 0.66, 1.25, 0.8][(i * 7) % 5]);
  protected readonly masonryColours = ['#3d5afe', '#e5484d', '#2faa6e', '#d9a521', '#8a8f98', '#5b2a86'];
  protected readonly masonryApi: ApiRow[] = [
    { name: 'ratios', type: 'number[]', default: '[]', desc: "Each item's height / width; its length is the number of tiles. Bad values count as square." },
    { name: 'columns', type: 'number (model)', default: '2', desc: 'Columns shown, two-way: a pinch changes it, and any change animates.' },
    { name: 'gap', type: 'number', default: '4', desc: 'Space between tiles, px.' },
    { name: 'minColumns / maxColumns', type: 'number', default: '1 / 5', desc: 'How far a pinch can go.' },
    { name: 'pinchable', type: 'boolean', default: 'true', desc: 'Let a two-finger pinch change the count.' },
    { name: 'duration', type: 'number', default: '280', desc: 'How long the change between sizes takes, ms (ease-out).' },
    { name: 'keyOf', type: '(index) => unknown', default: 'index', desc: 'A stable identity per item, so tiles survive a change of order.' },
    { name: '<ng-template uiMasonryTile>', type: 'slot', default: '—', desc: 'One tile, filling its box; context: the index ($implicit).' },
  ];
  protected readonly masonryOut: ApiRow[] = [{ name: 'columnsChange', type: 'number', default: '—', desc: 'The new column count after a pinch.' }];
  protected readonly fltItems = Array.from({ length: 30 }, (_, n) => ({
    n, who: ['Aisha', 'Ali', 'Mariyam', 'Hassan', 'Shaina', 'Ibrahim', 'Fathimath', 'Ahmed', 'Zara', 'Moosa'][(n * 7) % (n < 12 ? 3 : 10)], video: n % 5 === 0,
  }));
  protected readonly fltValue = signal<UiFilterValue>({});
  protected readonly fltSections = computed<UiFilterSection[]>(() => {
    const counts = new Map<string, number>();
    for (const it of this.fltItems) counts.set(it.who, (counts.get(it.who) ?? 0) + 1);
    const videos = this.fltItems.filter((it) => it.video).length;
    return [
      { id: 'who', title: 'Uploaded by', multiple: true, allLabel: 'Everyone', allCount: this.fltItems.length,
        options: [...counts].sort((a, b) => b[1] - a[1]).map(([name, count]) => ({ id: name, label: name, count })) },
      { id: 'kind', title: 'Type', allLabel: 'Photos and videos',
        options: [{ id: 'photo', label: 'Photos', count: this.fltItems.length - videos }, { id: 'video', label: 'Videos', count: videos }] },
    ];
  });
  protected readonly fltShown = computed(() => {
    const v = uiFilterPrune(this.fltSections(), this.fltValue());
    return this.fltItems.filter((it) => (!v['who'] || v['who'].includes(it.who)) && (!v['kind'] || v['kind'].includes(it.video ? 'video' : 'photo')));
  });
  protected readonly filterApi: ApiRow[] = [
    { name: 'sections', type: 'UiFilterSection[]', default: '[]', desc: 'The panel, top to bottom. Add one to add a filter.' },
    { name: 'value', type: 'UiFilterValue (model)', default: '{}', desc: 'Chosen option ids by section id, two-way; changes on every tap.' },
    { name: 'resultCount', type: 'number | null', default: 'null', desc: 'How many pass: the footer reads Show N; null: Done.' },
    { name: 'label / title', type: 'string', default: "'' (Filter)", desc: "The button's words / the panel's title (default the label)." },
    { name: 'size', type: "'sm' | 'md'", default: "'sm'", desc: 'The button size (44px to the touch either way).' },
    { name: 'narrowAt', type: 'number', default: '600', desc: 'Below this width (px) the panel is a bottom sheet, else a popover.' },
    { name: 'open', type: 'boolean (model)', default: 'false', desc: 'Whether the panel is open.' },
    { name: 'disabled · glass · radius', type: 'boolean', default: 'false · UiConfig', desc: 'The button off; the popover see-through; square corners.' },
    { name: 'ui-filter-chips: sections, value (model), label', type: '', default: '', desc: 'The filters that are on as chips (× turns one off) and Clear all; nothing while none is on.' },
    { name: 'ui-filter-button: count, label, size, disabled', type: '', default: '', desc: 'Only the button, for your own panel.' },
    { name: 'ui-filter-panel: sections, value (model)', type: '', default: '', desc: 'Only the sections, for your own container.' },
    { name: 'ui-filter-footer: count, resultCount → clearAll, done', type: '', default: '', desc: 'Only the footer.' },
  ];
  protected readonly selectionBarApi: ApiRow[] = [
    { name: 'count', type: 'number', default: '0', desc: 'How many are selected.' },
    { name: 'total', type: 'number | null', default: 'null', desc: 'Everything there is; at count == total the toggle reads Clear.' },
    { name: 'actions', type: 'UiSelectionAction[]', default: '[]', desc: 'The buttons at the end.' },
    { name: 'canSelectAll', type: 'boolean', default: 'true', desc: 'Show Select all.' },
    { name: 'canClear', type: 'boolean', default: 'true', desc: 'Show Clear once everything is selected.' },
  ];
  protected readonly selectionBarOut: ApiRow[] = [
    { name: 'cancel', type: 'void', default: '—', desc: 'The X: leave selecting.' },
    { name: 'selectAll', type: 'void', default: '—', desc: 'Select all pressed.' },
    { name: 'clear', type: 'void', default: '—', desc: 'Clear pressed.' },
    { name: 'action', type: 'string', default: '—', desc: 'The id of the action pressed.' },
  ];
  protected readonly taskApi: ApiRow[] = [
    { name: 'title', type: 'string', default: '(required)', desc: 'What the job is; also names the bar and the dialog.' },
    { name: 'done', type: 'number', default: '0', desc: 'How many are finished.' },
    { name: 'total', type: 'number', default: '0', desc: 'How many there are; 0 sweeps the bar.' },
    { name: 'detail', type: 'string | null', default: 'null', desc: 'A line under the count, e.g. the file in hand.' },
    { name: 'cancelLabel', type: 'string', default: "strings.cancel", desc: 'The Cancel button.' },
    { name: 'stopping', type: 'boolean', default: 'false', desc: 'Two-way (`[(stopping)]`). Set by Cancel; shows Stopping until closed.' },
    { name: 'open', type: 'boolean', default: 'false', desc: 'ui-task-progress-dialog only. Two-way (`[(open)]`); the job sets it false to close.' },
  ];
  protected readonly taskOut: ApiRow[] = [{ name: 'cancel', type: 'void', default: '—', desc: 'Cancel pressed (or Escape in the dialog).' }];
  protected readonly galleryApi: ApiRow[] = [
    { name: 'images', type: 'UiGalleryImage[]', default: '[]', desc: 'Images: the full src, an optional smaller thumb, and alt.' },
    { name: 'minThumb', type: 'string', default: "'120px'", desc: 'Min thumbnail width.' },
  ];
}
