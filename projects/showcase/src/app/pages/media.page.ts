import { Component, signal } from '@angular/core';
import { UiCarousel, UiGallery, UiImagePicker, type UiCarouselSlide, type UiGalleryImage, type UiImagePickerItem } from '@zouriel/ui/media';
import { DocPage, DocSection, DocDemo, type ApiRow } from '../docs/docs-ui';

function grad(a: string, b: string): string {
  return 'data:image/svg+xml;utf8,' + encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="340"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs><rect width="600" height="340" fill="url(#g)"/></svg>`);
}

@Component({
  selector: 'page-media',
  imports: [UiCarousel, UiGallery, UiImagePicker, DocPage, DocSection, DocDemo],
  styles: `.note { margin: var(--ui-space-2) 0 0; font-size: var(--ui-font-size-sm); color: var(--ui-color-text-muted); }`,
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
