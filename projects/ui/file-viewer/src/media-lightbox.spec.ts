import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { UiMediaLightbox, type UiMediaItem } from './media-lightbox';

/**
 * What a drag over the stage means.
 *
 * <p>One set of handlers has to tell four gestures apart — swipe to the next thing, drag down to
 * dismiss, pan a zoomed photograph, and tap — and the cost of getting it wrong is that the lightbox
 * closes itself while someone is looking through a wedding. So most of what follows is about a
 * gesture NOT firing: a diagonal drag, a drag toward nothing, a dismiss that stopped short.</p>
 *
 * <p>jsdom implements neither `showModal` nor layout, so the dialog falls back to the `open`
 * property and the stage reports 0px wide. Both are deliberate here rather than tolerated: the
 * fallback is the same branch an old engine takes, and a stage with no width takes the same branch a
 * genuinely narrow one does — the swipe distance floor.</p>
 */
describe('UiMediaLightbox', () => {
  let fixture: ComponentFixture<UiMediaLightbox>;
  let box: UiMediaLightbox;

  const items: UiMediaItem[] = [
    { src: 'a.jpg', thumb: 'a-t.jpg', caption: 'One' },
    { src: 'b.mp4', thumb: 'b-t.jpg', kind: 'video', caption: 'Two' },
    { src: 'c.jpg', thumb: 'c-t.jpg', caption: 'Three' },
  ];

  function stage(): HTMLElement {
    return fixture.nativeElement.querySelector('.stage') as HTMLElement;
  }

  /** An event whose timeStamp we control — jsdom stamps them all at construction otherwise. */
  function at(type: string, init: PointerEventInit, time: number): PointerEvent {
    const event = new PointerEvent(type, { bubbles: true, ...init });
    Object.defineProperty(event, 'timeStamp', { value: time });
    return event;
  }

  /** One finger down, across and up, from the middle of the stage. */
  function drag(dx: number, dy = 0, ms = 400, target: Element = stage()): void {
    const from = { x: 200, y: 300 };
    target.dispatchEvent(at('pointerdown', { pointerId: 1, clientX: from.x, clientY: from.y }, 0));
    target.dispatchEvent(
      at('pointermove', { pointerId: 1, clientX: from.x + dx, clientY: from.y + dy }, ms),
    );
    target.dispatchEvent(
      at('pointerup', { pointerId: 1, clientX: from.x + dx, clientY: from.y + dy }, ms),
    );
    fixture.detectChanges();
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [UiMediaLightbox] }).compileComponents();
    fixture = TestBed.createComponent(UiMediaLightbox);
    box = fixture.componentInstance;
    fixture.componentRef.setInput('items', items);
    box.open.set(true);
    box.index.set(0);
    fixture.detectChanges();
  });

  it('shows the item at the index it was given', () => {
    expect(fixture.nativeElement.querySelector('img.media').getAttribute('src')).toBe('a.jpg');
    expect(fixture.nativeElement.querySelector('.meta__line').textContent).toContain('One');
    expect(fixture.nativeElement.querySelector('.meta__count').textContent).toContain('1 of 3');
  });

  it('plays a clip rather than showing it, when the item is one', () => {
    box.index.set(1);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('video.media')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('img.media')).toBeNull();
  });

  it('swipes to the next item and back', () => {
    drag(-120);
    expect(box.index()).toBe(1);
    drag(120);
    expect(box.index()).toBe(0);
  });

  it('stays put at the ends of the list', () => {
    drag(120);
    expect(box.index()).toBe(0);
    box.index.set(2);
    fixture.detectChanges();
    drag(-120);
    expect(box.index()).toBe(2);
  });

  it('ignores a drag that went further down than across', () => {
    drag(-60, 90);
    expect(box.index()).toBe(0);
  });

  it('closes on a long drag downward, and does not on a short one', () => {
    drag(0, 40);
    expect(box.open()).toBe(true);

    drag(0, 200);
    expect(box.open()).toBe(false);
  });

  it('closes on a tap outside the picture, and not on one over it', () => {
    const picture = fixture.nativeElement.querySelector('img.media') as HTMLElement;
    drag(0, 0, 100, picture);
    expect(box.open()).toBe(true);

    drag(0, 0, 100, stage());
    expect(box.open()).toBe(false);
  });

  it('steps with the arrow keys', () => {
    const dialog = fixture.nativeElement.querySelector('dialog') as HTMLElement;
    dialog.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    fixture.detectChanges();
    expect(box.index()).toBe(1);

    dialog.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
    fixture.detectChanges();
    expect(box.index()).toBe(0);
  });

  it('leaves the sliders their own arrow keys', () => {
    box.index.set(1);
    fixture.detectChanges();
    const seek = fixture.nativeElement.querySelector('.scrub__input') as HTMLElement;
    seek.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    fixture.detectChanges();
    expect(box.index()).toBe(1);
  });

  it('offers only the actions that apply to the item under them', () => {
    fixture.componentRef.setInput('actions', [
      { id: 'save', label: 'Download', href: (item: UiMediaItem) => item.src },
      { id: 'remove', label: 'Remove', tone: 'danger', when: (_: UiMediaItem, at: number) => at > 0 },
    ]);
    fixture.detectChanges();
    expect([...fixture.nativeElement.querySelectorAll('.act')].map((a: Element) => a.textContent?.trim()))
      .toEqual(['Download']);

    box.index.set(1);
    fixture.detectChanges();
    expect([...fixture.nativeElement.querySelectorAll('.act')].map((a: Element) => a.textContent?.trim()))
      .toEqual(['Download', 'Remove']);
  });

  it('reports which action was pressed, over which item', () => {
    const fired: string[] = [];
    box.action.subscribe((e) => fired.push(`${e.id}:${e.index}:${e.item.src}`));
    fixture.componentRef.setInput('actions', [{ id: 'remove', label: 'Remove' }]);
    box.index.set(2);
    fixture.detectChanges();

    (fixture.nativeElement.querySelector('.act') as HTMLElement).click();
    expect(fired).toEqual(['remove:2:c.jpg']);
  });

  it('shows nothing at all once closed', () => {
    box.open.set(false);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.sheet')).toBeNull();
  });
});
