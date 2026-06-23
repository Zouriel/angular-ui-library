import { Component } from '@angular/core';
import { UiCarousel, UiGallery, type UiCarouselSlide, type UiGalleryImage } from 'ui/media';
import { DocPage, DocSection, DocDemo, type ApiRow } from '../docs/docs-ui';

function grad(a: string, b: string): string {
  return 'data:image/svg+xml;utf8,' + encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="340"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs><rect width="600" height="340" fill="url(%23g)"/></svg>`);
}

@Component({
  selector: 'page-media',
  imports: [UiCarousel, UiGallery, DocPage, DocSection, DocDemo],
  template: `
    <doc-page eyebrow="Components" title="Media"
      lead="Image-centric components: a carousel slideshow and a thumbnail gallery with a lightbox.">

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
  protected readonly carouselApi: ApiRow[] = [
    { name: 'slides', type: 'UiCarouselSlide[]', default: '[]', desc: 'Slides (image + caption).' },
    { name: 'autoplay', type: 'number', default: '0', desc: 'Auto-advance interval (ms); 0 = off.' },
  ];
  protected readonly galleryApi: ApiRow[] = [
    { name: 'images', type: 'UiGalleryImage[]', default: '[]', desc: 'Images (full + optional thumb).' },
    { name: 'minThumb', type: 'string', default: "'120px'", desc: 'Min thumbnail width.' },
  ];
}
