import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { UiGallery, type UiGalleryImage } from './gallery';

@Component({
  imports: [UiGallery],
  template: `<ui-gallery [images]="images" />`,
})
class Host {
  images: UiGalleryImage[] = [{ src: 'a.png', alt: 'A' }, { src: 'b.png', alt: 'B' }];
}

describe('ui-gallery', () => {
  it('opens a focus-trapped lightbox and returns focus to the thumbnail on Escape', async () => {
    const fx = TestBed.createComponent(Host);
    fx.autoDetectChanges();
    await fx.whenStable();
    const el = fx.nativeElement as HTMLElement;
    document.body.appendChild(el);
    const thumb = el.querySelectorAll<HTMLButtonElement>('.thumb')[1];
    thumb.focus();
    thumb.click();
    await fx.whenStable();
    const lb = el.querySelector<HTMLElement>('[role=dialog]')!;
    expect(lb.getAttribute('aria-modal')).toBe('true');
    // The CDK trap brackets the dialog with focus anchors so Tab can't leave it.
    expect(lb.previousElementSibling?.classList.contains('cdk-focus-trap-anchor')).toBe(true);
    expect(lb.querySelector('img')!.getAttribute('src')).toBe('b.png');
    lb.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await fx.whenStable();
    expect(el.querySelector('[role=dialog]')).toBeNull();
    expect(document.activeElement).toBe(thumb);
    el.remove();
  });
});
