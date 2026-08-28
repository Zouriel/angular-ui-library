import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { UiImageViewer } from './image-viewer';

/**
 * Swiping between images, and the gestures it must not steal.
 *
 * <p>The viewer captures every pointer that lands on it, so navigation had to be built into the same
 * handlers that already do pan and pinch. That overlap is the whole risk: the tests below are mostly
 * about a swipe NOT happening — while zoomed in, mid-pinch, on a vertical drag, toward an image that
 * is not there. A viewer that navigates when it should pan is worse than one that never navigates.</p>
 *
 * <p>jsdom reports every element as 0x0, so the stage has no width here. That is deliberate rather
 * than tolerated: with no width the distance threshold falls back to its floor, which is the same
 * branch a genuinely narrow stage takes.</p>
 */
describe('UiImageViewer swipe navigation', () => {
  let fixture: ComponentFixture<UiImageViewer>;
  let stage: HTMLElement;
  let went: string[];

  /** An event whose timeStamp we control — jsdom stamps them all at construction otherwise. */
  function at(type: string, init: PointerEventInit, time: number): PointerEvent {
    const event = new PointerEvent(type, { bubbles: true, ...init });
    Object.defineProperty(event, 'timeStamp', { value: time });
    return event;
  }

  /** One finger down, across, and up. `ms` is how long the whole gesture took. */
  function drag(dx: number, dy = 0, ms = 500, pointerId = 1): void {
    const from = { x: 200, y: 200 };
    stage.dispatchEvent(at('pointerdown', { pointerId, clientX: from.x, clientY: from.y }, 0));
    stage.dispatchEvent(
      at('pointermove', { pointerId, clientX: from.x + dx, clientY: from.y + dy }, ms),
    );
    stage.dispatchEvent(
      at('pointerup', { pointerId, clientX: from.x + dx, clientY: from.y + dy }, ms),
    );
    fixture.detectChanges();
  }

  /** What the picture — image or clip, whichever is showing — is translated by, horizontally. */
  function translateX(): number {
    const shown = fixture.nativeElement.querySelector('img, video') as HTMLElement;
    return Number(/translate\((-?[\d.]+)px/.exec(shown.style.transform)?.[1] ?? NaN);
  }

  function bar(label: string): HTMLButtonElement | null {
    return fixture.nativeElement.querySelector(`button[aria-label="${label}"]`);
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [UiImageViewer] }).compileComponents();
    fixture = TestBed.createComponent(UiImageViewer);
    fixture.componentRef.setInput('src', 'a.jpg');
    fixture.detectChanges();

    went = [];
    fixture.componentInstance.next.subscribe(() => went.push('next'));
    fixture.componentInstance.previous.subscribe(() => went.push('previous'));
    stage = fixture.nativeElement.querySelector('.stage');
  });

  /** Both neighbours exist unless a test says otherwise. */
  function surroundedByOthers(): void {
    fixture.componentRef.setInput('hasPrevious', true);
    fixture.componentRef.setInput('hasNext', true);
    fixture.detectChanges();
  }

  // ----- the gesture itself ----------------------------------------------------------------------

  it('goes forward on a swipe left and back on a swipe right', () => {
    surroundedByOthers();

    drag(-120);
    expect(went).toEqual(['next']);

    drag(120);
    expect(went).toEqual(['next', 'previous']);
  });

  it('follows the finger, then lets the image fall back to rest', () => {
    surroundedByOthers();

    stage.dispatchEvent(at('pointerdown', { pointerId: 1, clientX: 200, clientY: 200 }, 0));
    stage.dispatchEvent(at('pointermove', { pointerId: 1, clientX: 140, clientY: 200 }, 50));
    fixture.detectChanges();
    expect(translateX()).toBe(-60);

    stage.dispatchEvent(at('pointerup', { pointerId: 1, clientX: 140, clientY: 200 }, 50));
    fixture.detectChanges();
    expect(translateX()).toBe(0);
  });

  /** Short and slow is someone resting a thumb on the picture, not asking for the next one. */
  it('ignores a drag that is neither far enough nor fast enough', () => {
    surroundedByOthers();
    drag(-20, 0, 800);
    expect(went).toEqual([]);
  });

  it('accepts a flick that is short but fast', () => {
    surroundedByOthers();
    drag(-30, 0, 40);
    expect(went).toEqual(['next']);
  });

  it('ignores a drag that travelled further down the screen than across it', () => {
    surroundedByOthers();
    drag(-60, 200);
    expect(went).toEqual([]);
  });

  // ----- what it must not steal -------------------------------------------------------------------

  /** The default. A lone photograph behaves exactly as it did before any of this existed. */
  it('does nothing at all when the host has not said there are neighbours', () => {
    drag(-200);
    expect(went).toEqual([]);
    expect(translateX()).toBe(0);
  });

  it('pans instead of navigating once the image is zoomed in', () => {
    surroundedByOthers();
    bar('Zoom in')!.click();
    fixture.detectChanges();

    drag(-200);
    expect(went).toEqual([]);
  });

  /** Landing a second finger turns the gesture into a pinch; the release must not still count. */
  it('does not navigate out of a pinch', () => {
    surroundedByOthers();

    stage.dispatchEvent(at('pointerdown', { pointerId: 1, clientX: 200, clientY: 200 }, 0));
    stage.dispatchEvent(at('pointermove', { pointerId: 1, clientX: 80, clientY: 200 }, 40));
    stage.dispatchEvent(at('pointerdown', { pointerId: 2, clientX: 300, clientY: 200 }, 45));
    stage.dispatchEvent(at('pointerup', { pointerId: 2, clientX: 300, clientY: 200 }, 60));
    stage.dispatchEvent(at('pointerup', { pointerId: 1, clientX: 80, clientY: 200 }, 60));
    fixture.detectChanges();

    expect(went).toEqual([]);
  });

  // ----- the ends of the list ---------------------------------------------------------------------

  it('refuses to go past the last image', () => {
    fixture.componentRef.setInput('hasPrevious', true);
    fixture.detectChanges();

    drag(-200);
    expect(went).toEqual([]);
  });

  it('gives a little and springs back when there is nothing that way', () => {
    fixture.componentRef.setInput('hasPrevious', true);
    fixture.detectChanges();

    stage.dispatchEvent(at('pointerdown', { pointerId: 1, clientX: 200, clientY: 200 }, 0));
    stage.dispatchEvent(at('pointermove', { pointerId: 1, clientX: 100, clientY: 200 }, 50));
    fixture.detectChanges();

    // Moved, but nothing like the 100px the finger did.
    expect(translateX()).toBe(-25);
  });

  // ----- the other two ways to ask ----------------------------------------------------------------

  it('navigates by arrow key', () => {
    surroundedByOthers();

    stage.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    stage.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
    expect(went).toEqual(['next', 'previous']);
  });

  it('leaves arrow keys alone at the ends, so the page still handles them', () => {
    fixture.componentRef.setInput('hasNext', true);
    fixture.detectChanges();

    const goingNowhere = new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true, cancelable: true });
    stage.dispatchEvent(goingNowhere);
    expect(went).toEqual([]);
    expect(goingNowhere.defaultPrevented).toBe(false);
  });

  it('shows step buttons only when there is somewhere to step, and disables the dead end', () => {
    expect(bar('Next image')).toBeNull();
    expect(bar('Previous image')).toBeNull();

    fixture.componentRef.setInput('hasNext', true);
    fixture.detectChanges();

    expect(bar('Next image')!.disabled).toBe(false);
    expect(bar('Previous image')!.disabled).toBe(true);

    bar('Next image')!.click();
    expect(went).toEqual(['next']);
  });

  /** The stage only enters the tab order when there is something the keyboard can do there. */
  it('is only focusable while it can navigate', () => {
    expect(stage.getAttribute('tabindex')).toBeNull();
    surroundedByOthers();
    expect(stage.getAttribute('tabindex')).toBe('0');
  });

  // ----- clips ------------------------------------------------------------------------------------

  describe('showing a clip', () => {
    beforeEach(() => {
      fixture.componentRef.setInput('kind', 'video');
      surroundedByOthers();
    });

    function clip(): HTMLVideoElement {
      return fixture.nativeElement.querySelector('video');
    }

    /**
     * jsdom lays nothing out, so every element measures 0x0 and the control strip has no position
     * to be at. The clip is given a plausible rect so the boundary being tested is a real one.
     */
    function laidOut(): DOMRect {
      const box = { left: 0, top: 0, right: 400, bottom: 300, width: 400, height: 300, x: 0, y: 0 };
      const rect = { ...box, toJSON: () => box } as DOMRect;
      clip().getBoundingClientRect = () => rect;
      return rect;
    }

    it('plays it rather than drawing it, and leaves the controls to the browser', () => {
      expect(clip()).not.toBeNull();
      expect(fixture.nativeElement.querySelector('img')).toBeNull();
      expect(clip().hasAttribute('controls')).toBe(true);
      // Inline, or an iPhone takes the clip fullscreen and out of the gallery it was opened from.
      expect(clip().hasAttribute('playsinline')).toBe(true);
    });

    it('drops the zoom controls, which mean nothing here, and keeps the steps, which do', () => {
      expect(bar('Zoom in')).toBeNull();
      expect(bar('Reset view')).toBeNull();
      expect(bar('Next image')).not.toBeNull();
    });

    it('is swiped like anything else in the gallery', () => {
      laidOut();
      drag(-120);
      expect(went).toEqual(['next']);
    });

    /**
     * The case that would break scrubbing. Events from the video's own controls reach us too, so a
     * drag along the seek bar looks exactly like a swipe unless the bottom of the clip is excluded.
     */
    it('does not read a drag along the scrubber as a swipe', () => {
      const box = laidOut();
      const onSeekBar = box.bottom - 10;

      stage.dispatchEvent(at('pointerdown', { pointerId: 1, clientX: 200, clientY: onSeekBar }, 0));
      stage.dispatchEvent(at('pointermove', { pointerId: 1, clientX: 60, clientY: onSeekBar }, 60));
      stage.dispatchEvent(at('pointerup', { pointerId: 1, clientX: 60, clientY: onSeekBar }, 60));
      fixture.detectChanges();

      expect(went).toEqual([]);
    });

    /**
     * The zoom left behind by the picture before this one. Swiping from a photograph someone had
     * zoomed into straight onto a clip leaves the old zoom in place until the clip's metadata
     * arrives and resets it — and for that moment a drag would pan a video instead of moving on.
     */
    it('does not pan on a zoom inherited from the image it replaced', () => {
      fixture.componentRef.setInput('kind', 'image');
      fixture.detectChanges();
      bar('Zoom in')!.click();
      fixture.detectChanges();

      fixture.componentRef.setInput('kind', 'video');
      fixture.detectChanges();
      laidOut();

      drag(-120);
      expect(went).toEqual(['next']);
    });

    it('never zooms, so a double tap belongs to the clip', () => {
      stage.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
      fixture.detectChanges();
      expect(translateX()).toBe(0);
      // Still at rest, so the gesture layer never took it over.
      expect(clip().style.transform).toContain('scale(1)');
    });
  });
});
