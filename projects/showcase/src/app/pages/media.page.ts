import { Component, signal } from '@angular/core';
import { UiCarousel, UiGallery, UiImagePicker, type UiCarouselSlide, type UiGalleryImage, type UiImagePickerItem } from '@zouriel/ui/media';
import { DocPage, DocSection, DocDemo, type ApiRow } from '../docs/docs-ui';

function grad(a: string, b: string): string {
  return 'data:image/svg+xml;utf8,' + encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="340"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs><rect width="600" height="340" fill="url(%23g)"/></svg>`);
}

@Component({
  selector: 'page-media',
  imports: [UiCarousel, UiGallery, UiImagePicker, DocPage, DocSection, DocDemo],
  template: `
    <doc-page eyebrow="Components" title="Media"
      lead="Image-centric components: a carousel slideshow, a thumbnail gallery with a lightbox, and a picker for choosing an image.">

      <doc-section name="Carousel" selector="ui-carousel" [api]="carouselApi"
        summary="Slides with arrows, dots, edge fade, optional autoplay (ms; 0 disables); pauses on hover."
        [shapes]="'interface UiCarouselSlide { image: string; alt?: string; caption?: string; }'">
        <doc-demo code="<ui-carousel [slides]=&quot;slides&quot; [autoplay]=&quot;4000&quot; />">
          <ui-carousel [slides]="slides" [autoplay]="4000" />
        </doc-demo>
      </doc-section>

      <doc-section name="Gallery" selector="ui-gallery" [api]="galleryApi"
        summary="Responsive thumbnail grid; click opens a lightbox with prev/next + Esc."
        [shapes]="'interface UiGalleryImage { src: string; thumb?: string; alt?: string; }'">
        <doc-demo code="<ui-gallery [images]=&quot;images&quot; minThumb=&quot;90px&quot; />">
          <ui-gallery [images]="images" minThumb="90px" />
        </doc-demo>
      </doc-section>

      <doc-section name="Image picker" selector="ui-image-picker" [api]="pickerApi"
        summary="A grid of tiles to choose from (search results, stock art). One tile can be busy while its choice loads; reaching the end asks for the next page; broken thumbnails fall back to their label."
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
    { image: grad('%233d5afe', '%23e5484d'), caption: 'Slide one' },
    { image: grad('%232faa6e', '%23d9a521'), caption: 'Slide two' },
    { image: grad('%238a8f98', '%233d5afe'), caption: 'Slide three' },
  ];
  protected readonly images: UiGalleryImage[] = [
    { src: grad('%233d5afe', '%232faa6e'), alt: 'a' }, { src: grad('%23e5484d', '%23d9a521'), alt: 'b' },
    { src: grad('%238a8f98', '%233d5afe'), alt: 'c' }, { src: grad('%232faa6e', '%23e5484d'), alt: 'd' },
  ];
  protected readonly pickerItems = signal<UiImagePickerItem[]>(this.page(0));
  protected readonly busy = signal<string | null>(null);

  private page(from: number): UiImagePickerItem[] {
    const colours = ['%233d5afe', '%23e5484d', '%232faa6e', '%23d9a521', '%238a8f98'];
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
    { name: 'busyId', type: 'string | null', default: 'null', desc: 'The tile being fetched; the others wait.' },
    { name: 'loading', type: 'boolean', default: 'false', desc: 'A page is loading (spinner under the grid).' },
    { name: 'hasMore', type: 'boolean', default: 'false', desc: 'Reaching the end emits (more).' },
    { name: 'minThumb', type: 'string', default: "'96px'", desc: 'Min tile width.' },
    { name: 'captions', type: 'boolean', default: 'false', desc: 'Show each label under its tile.' },
    { name: 'emptyText', type: 'string', default: "''", desc: 'Shown when there are no items.' },
    { name: 'dragType', type: 'string | null', default: 'null', desc: 'Makes tiles draggable; drag data is the id under this type.' },
    { name: '(pick)', type: 'UiImagePickerItem', default: '', desc: 'A tile was chosen.' },
    { name: '(more)', type: 'void', default: '', desc: 'The next page is wanted.' },
  ];
  protected readonly carouselApi: ApiRow[] = [
    { name: 'slides', type: 'UiCarouselSlide[]', default: '[]', desc: 'Slides (image + caption).' },
    { name: 'autoplay', type: 'number', default: '0', desc: 'Auto-advance interval (ms); 0 = off.' },
  ];
  protected readonly galleryApi: ApiRow[] = [
    { name: 'images', type: 'UiGalleryImage[]', default: '[]', desc: 'Images (full + optional thumb).' },
    { name: 'minThumb', type: 'string', default: "'120px'", desc: 'Min thumbnail width.' },
  ];
}
