import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { UiMediaLightbox, type UiMediaItem } from './media-lightbox';

/** doubleTap="emit" (0.63.0): a double tap likes instead of zooming, and the heart can pop there. */
describe('UiMediaLightbox double tap', () => {
  let fixture: ComponentFixture<UiMediaLightbox>;
  let box: UiMediaLightbox;
  const items: UiMediaItem[] = [{ src: 'a.jpg', caption: 'One' }, { src: 'b.mp4', kind: 'video', caption: 'Two' }];
  const stage = () => fixture.nativeElement.querySelector('.stage') as HTMLElement;
  const zoomChip = () => fixture.nativeElement.querySelector('.chip');

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [UiMediaLightbox] }).compileComponents();
    fixture = TestBed.createComponent(UiMediaLightbox);
    box = fixture.componentInstance;
    fixture.componentRef.setInput('items', items);
    box.open.set(true);
    box.index.set(0);
    fixture.detectChanges();
  });

  it('zooms by default', () => {
    stage().dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
    fixture.detectChanges();
    expect(zoomChip()).not.toBeNull();
  });

  it('with doubleTap="emit" reports the item and the point instead, on photos and clips, and does not zoom', () => {
    fixture.componentRef.setInput('doubleTap', 'emit');
    const got: { index: number; x: number; y: number; src: string }[] = [];
    box.doubleTapped.subscribe((e) => got.push({ index: e.index, x: e.x, y: e.y, src: e.item.src }));
    stage().dispatchEvent(new MouseEvent('dblclick', { bubbles: true, clientX: 30, clientY: 40 }));
    fixture.detectChanges();
    expect(zoomChip()).toBeNull();
    box.index.set(1);
    fixture.detectChanges();
    stage().dispatchEvent(new MouseEvent('dblclick', { bubbles: true, clientX: 5, clientY: 6 }));
    expect(got).toEqual([{ index: 0, x: 30, y: 40, src: 'a.jpg' }, { index: 1, x: 5, y: 6, src: 'b.mp4' }]);
  });

  it('playHeart pops a heart over the stage', () => {
    box.playHeart(10, 20);
    fixture.detectChanges();
    expect(stage().querySelector('ui-heart-burst .burst')).not.toBeNull();
  });
});
