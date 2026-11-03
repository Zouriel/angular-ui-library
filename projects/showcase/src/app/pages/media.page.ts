import { Component, signal } from '@angular/core';
import { UiButton } from '@zouriel/ui/button';
import { UiCarousel, UiGallery, UiImagePicker, UiPosterDetails, UiPosterGrid, UiPosterView, UiScrim, type UiCarouselSlide, type UiGalleryImage, type UiImagePickerItem, type UiPoster } from '@zouriel/ui/media';
import { DocPage, DocSection, DocDemo, type ApiRow } from '../docs/docs-ui';

function grad(a: string, b: string): string {
  return 'data:image/svg+xml;utf8,' + encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="340"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs><rect width="600" height="340" fill="url(#g)"/></svg>`);
}

@Component({
  selector: 'page-media',
  imports: [UiButton, UiCarousel, UiGallery, UiImagePicker, UiPosterDetails, UiPosterGrid, UiPosterView, UiScrim, DocPage, DocSection, DocDemo],
  styles: `.note { margin: var(--ui-space-2) 0 0; font-size: var(--ui-font-size-sm); color: var(--ui-color-text-muted); }
    .scrim-demo { position: relative; max-width: 360px; aspect-ratio: 3 / 4; border-radius: var(--ui-radius); overflow: hidden; }
    .scrim-demo img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
    .scrim-demo ui-scrim { position: absolute; inset-inline: 0; bottom: 0; }
    .pv-title { margin: 0; font-size: var(--ui-font-size-lg); font-weight: 600; }
    .pv-meta { margin: 0; opacity: 0.9; }
    .pt-title { display: block; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .pt-line { display: block; font-size: var(--ui-font-size-sm); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .pv-actions { display: flex; flex-wrap: wrap; gap: var(--ui-space-2); margin-top: var(--ui-space-2); }`,
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
  protected readonly galleryApi: ApiRow[] = [
    { name: 'images', type: 'UiGalleryImage[]', default: '[]', desc: 'Images: the full src, an optional smaller thumb, and alt.' },
    { name: 'minThumb', type: 'string', default: "'120px'", desc: 'Min thumbnail width.' },
  ];
}
