import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideUiConfig } from '@zouriel/ui';
import {
  UI_DRAG_MOUSE_SLOP,
  UI_LONG_PRESS_MS,
  UI_LONG_PRESS_SLOP,
  UiDragItem,
  UiDragService,
  UiDropTarget,
} from './public-api';

interface EventTile {
  id: string;
  title: string;
  locked?: boolean;
}

function rect(left: number, top: number, width: number, height: number): DOMRect {
  return {
    left,
    top,
    width,
    height,
    right: left + width,
    bottom: top + height,
    x: left,
    y: top,
    toJSON: () => ({}),
  } as DOMRect;
}

function pointer(type: string, opts: { clientX?: number; clientY?: number; pointerType?: string; pointerId?: number; button?: number } = {}): Event {
  const e = new Event(type, { bubbles: true, cancelable: true }) as PointerEvent;
  Object.defineProperties(e, {
    clientX: { value: opts.clientX ?? 0 },
    clientY: { value: opts.clientY ?? 0 },
    pointerType: { value: opts.pointerType ?? 'mouse' },
    pointerId: { value: opts.pointerId ?? 1 },
    button: { value: opts.button ?? 0 },
  });
  return e;
}

function key(target: EventTarget, k: string): KeyboardEvent {
  const e = new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true });
  target.dispatchEvent(e);
  return e;
}

@Component({
  imports: [UiDragItem, UiDropTarget],
  template: `
    @for (ev of events(); track ev.id) {
      <div
        class="tile"
        [attr.data-id]="ev.id"
        [uiDragItem]="ev"
        [uiDragLabel]="ev.title"
        [uiDragDisabled]="disabledId() === ev.id"
        [uiDropTarget]="ev.title"
        [uiDropAccepts]="canMerge(ev)"
        [uiDropDisabled]="dropDisabledId() === ev.id"
        (dragStart)="starts.push($event.id)"
        (dragCancel)="cancels.push($event.id)"
        (dragEnd)="ends.push($event.id)"
        (dropped)="drops.push({ from: $event.id, onto: ev.id })"
      >
        {{ ev.title }}
      </div>
    }
  `,
})
class MergeHost {
  events = signal<EventTile[]>([
    { id: 'a', title: 'Dinner' },
    { id: 'b', title: 'Locked party', locked: true },
    { id: 'c', title: 'Beach trip' },
  ]);
  disabledId = signal<string | null>(null);
  dropDisabledId = signal<string | null>(null);
  starts: string[] = [];
  cancels: string[] = [];
  ends: string[] = [];
  drops: { from: string; onto: string }[] = [];

  canMerge = (target: EventTile) => (payload: EventTile) => payload.id !== target.id && !target.locked;
}

describe('UiDragItem & UiDropTarget', () => {
  // Other specs in the same worker may have left a drag ghost or live region on the page.
  beforeEach(() => document.querySelectorAll('.ui-drag-ghost, .ui-drag-live').forEach((el) => el.remove()));
  afterEach(() => {
    vi.useRealTimers();
    document.querySelectorAll('.ui-drag-ghost, .ui-drag-live').forEach((el) => el.remove());
  });

  function setup(providers: unknown[] = []) {
    if (providers.length) TestBed.configureTestingModule({ providers });
    const f = TestBed.createComponent(MergeHost);
    f.detectChanges();
    const tiles = Array.from(f.nativeElement.querySelectorAll('.tile')) as HTMLElement[];
    tiles[0].getBoundingClientRect = () => rect(0, 0, 120, 80);
    tiles[1].getBoundingClientRect = () => rect(0, 100, 120, 80);
    tiles[2].getBoundingClientRect = () => rect(0, 200, 120, 80);
    const service = TestBed.inject(UiDragService);
    return { f, host: f.componentInstance, tiles, service };
  }

  it('starts a mouse drag only after moving past slop, dims source, shows ghost, and drops on valid target', () => {
    const { f, host, tiles } = setup();

    // Small click below slop does not start a drag.
    tiles[0].dispatchEvent(pointer('pointerdown', { clientX: 20, clientY: 20 }));
    document.dispatchEvent(pointer('pointermove', { clientX: 20 + UI_DRAG_MOUSE_SLOP - 2, clientY: 20 }));
    expect(host.starts).toEqual([]);
    expect(document.querySelector('.ui-drag-ghost')).toBeNull();
    document.dispatchEvent(pointer('pointerup', { clientX: 20, clientY: 20 }));

    // Moving past slop starts the drag.
    tiles[0].dispatchEvent(pointer('pointerdown', { clientX: 20, clientY: 20 }));
    document.dispatchEvent(pointer('pointermove', { clientX: 20 + UI_DRAG_MOUSE_SLOP + 2, clientY: 20 }));
    f.detectChanges();

    expect(host.starts).toEqual(['a']);
    expect(tiles[0].classList.contains('ui-drag-item--dragging')).toBe(true);
    expect(document.querySelector('.ui-drag-ghost')).not.toBeNull();

    // Move over valid target C (0, 200..280) and drop.
    document.dispatchEvent(pointer('pointermove', { clientX: 50, clientY: 240 }));
    f.detectChanges();
    expect(tiles[2].classList.contains('ui-drop-target--over')).toBe(true);

    document.dispatchEvent(pointer('pointerup', { clientX: 50, clientY: 240 }));
    f.detectChanges();

    expect(host.drops).toEqual([{ from: 'a', onto: 'c' }]);
    expect(host.ends).toEqual(['a']);
    expect(host.cancels).toEqual([]);
    expect(tiles[0].classList.contains('ui-drag-item--dragging')).toBe(false);
    expect(tiles[2].classList.contains('ui-drop-target--over')).toBe(false);
    expect(document.querySelector('.ui-drag-ghost')).toBeNull();
    expect(document.querySelector('.ui-drag-live')?.textContent).toBe('Dropped Dinner on Beach trip');
  });

  it('ignores invalid drop targets (predicate false or self) without highlighting or dropping', () => {
    const { f, host, tiles } = setup();

    tiles[0].dispatchEvent(pointer('pointerdown', { clientX: 20, clientY: 20 }));
    document.dispatchEvent(pointer('pointermove', { clientX: 20 + UI_DRAG_MOUSE_SLOP + 2, clientY: 20 }));
    f.detectChanges();
    // Over self (rejected by predicate): no highlight.
    expect(tiles[0].classList.contains('ui-drop-target--over')).toBe(false);

    // Over locked tile B (0, 100..180): rejected by predicate, no highlight, no drop.
    document.dispatchEvent(pointer('pointermove', { clientX: 50, clientY: 140 }));
    f.detectChanges();
    expect(tiles[1].classList.contains('ui-drop-target--over')).toBe(false);

    document.dispatchEvent(pointer('pointerup', { clientX: 50, clientY: 140 }));
    f.detectChanges();
    expect(host.drops).toEqual([]);
    expect(host.cancels).toEqual(['a']);
    expect(host.ends).toEqual(['a']);
  });

  it('cancels an active pointer drag on Escape without dropping', () => {
    const { f, host, tiles } = setup();

    tiles[0].dispatchEvent(pointer('pointerdown', { clientX: 20, clientY: 20 }));
    document.dispatchEvent(pointer('pointermove', { clientX: 50, clientY: 240 }));
    f.detectChanges();
    expect(tiles[2].classList.contains('ui-drop-target--over')).toBe(true);

    key(document, 'Escape');
    f.detectChanges();

    expect(host.drops).toEqual([]);
    expect(host.cancels).toEqual(['a']);
    expect(host.ends).toEqual(['a']);
    expect(tiles[2].classList.contains('ui-drop-target--over')).toBe(false);
    expect(document.querySelector('.ui-drag-ghost')).toBeNull();
  });

  it('touch requires a long press and cancels if the finger moves (scrolling a list never starts a drag)', () => {
    vi.useFakeTimers();
    const { f, host, tiles } = setup();

    // Touch move past slop before UI_LONG_PRESS_MS cancels the hold (scroll wins).
    tiles[0].dispatchEvent(pointer('pointerdown', { clientX: 20, clientY: 20, pointerType: 'touch' }));
    document.dispatchEvent(pointer('pointermove', { clientX: 20, clientY: 20 + UI_LONG_PRESS_SLOP + 4, pointerType: 'touch' }));
    vi.advanceTimersByTime(UI_LONG_PRESS_MS + 50);
    f.detectChanges();
    expect(host.starts).toEqual([]);
    expect(document.querySelector('.ui-drag-ghost')).toBeNull();

    // Holding still for UI_LONG_PRESS_MS starts the drag and drops on C.
    tiles[0].dispatchEvent(pointer('pointerdown', { clientX: 20, clientY: 20, pointerType: 'touch' }));
    vi.advanceTimersByTime(UI_LONG_PRESS_MS - 1);
    expect(host.starts).toEqual([]);
    vi.advanceTimersByTime(2);
    f.detectChanges();
    expect(host.starts).toEqual(['a']);
    expect(document.querySelector('.ui-drag-ghost')).not.toBeNull();

    document.dispatchEvent(pointer('pointermove', { clientX: 50, clientY: 240, pointerType: 'touch' }));
    document.dispatchEvent(pointer('pointerup', { clientX: 50, clientY: 240, pointerType: 'touch' }));
    f.detectChanges();
    expect(host.drops).toEqual([{ from: 'a', onto: 'c' }]);
  });

  it('auto-scrolls a scroll container when the pointer nears its edges', () => {
    const { service } = setup();
    const container = document.createElement('div');
    container.style.overflowY = 'auto';
    Object.defineProperty(container, 'scrollHeight', { value: 1000 });
    Object.defineProperty(container, 'clientHeight', { value: 200 });
    container.scrollTop = 100;
    container.getBoundingClientRect = () => rect(0, 0, 300, 200);
    const child = document.createElement('div');
    container.appendChild(child);
    document.body.appendChild(container);

    try {
      // Middle: no scroll.
      expect(service.autoScrollStep(child, 50, 100)).toBe(false);
      expect(container.scrollTop).toBe(100);

      // Near bottom edge: scrolls down.
      expect(service.autoScrollStep(child, 50, 190)).toBe(true);
      expect(container.scrollTop).toBeGreaterThan(100);

      // Near top edge: scrolls up.
      const afterDown = container.scrollTop;
      expect(service.autoScrollStep(child, 50, 10)).toBe(true);
      expect(container.scrollTop).toBeLessThan(afterDown);
    } finally {
      container.remove();
    }
  });

  it('supports keyboard pick-up, target cycling, drop announcement, and Escape cancel', () => {
    const { f, host, tiles } = setup();

    // Accessible description is set on enabled draggables.
    expect(tiles[0].getAttribute('aria-description')).toContain('Space or Enter');

    // Focus tile A and press Space to pick up; only C is valid (A is self, B is locked).
    tiles[0].focus();
    key(tiles[0], ' ');
    f.detectChanges();

    expect(host.starts).toEqual(['a']);
    expect(tiles[2].classList.contains('ui-drop-target--over')).toBe(true);
    expect(tiles[1].classList.contains('ui-drop-target--over')).toBe(false);
    expect(document.querySelector('.ui-drag-live')?.textContent).toContain('Over Beach trip');

    // Press Enter to drop.
    key(document, 'Enter');
    f.detectChanges();
    expect(host.drops).toEqual([{ from: 'a', onto: 'c' }]);
    expect(document.querySelector('.ui-drag-live')?.textContent).toBe('Dropped Dinner on Beach trip');

    // Pick up again and press Escape to cancel.
    key(tiles[0], 'Enter');
    f.detectChanges();
    key(document, 'Escape');
    f.detectChanges();
    expect(host.cancels).toEqual(['a']);
    expect(host.drops.length).toBe(1);
  });

  it('skips the lift animation when animations are disabled (reduced motion)', () => {
    const { f, tiles } = setup([provideUiConfig({ animations: false })]);

    tiles[0].dispatchEvent(pointer('pointerdown', { clientX: 20, clientY: 20 }));
    document.dispatchEvent(pointer('pointermove', { clientX: 20 + UI_DRAG_MOUSE_SLOP + 2, clientY: 20 }));
    f.detectChanges();

    const ghost = document.querySelector('.ui-drag-ghost') as HTMLElement;
    expect(ghost).not.toBeNull();
    expect(ghost.classList.contains('ui-drag-ghost--reduced')).toBe(true);
    expect(ghost.classList.contains('ui-drag-ghost--lifted')).toBe(false);

    key(document, 'Escape');
  });

  it('respects disabled state on both draggable and drop target', () => {
    const { f, host, tiles } = setup();
    host.disabledId.set('a');
    f.detectChanges();
    expect(tiles[0].getAttribute('aria-description')).toBeNull();

    tiles[0].dispatchEvent(pointer('pointerdown', { clientX: 20, clientY: 20 }));
    document.dispatchEvent(pointer('pointermove', { clientX: 50, clientY: 240 }));
    expect(host.starts).toEqual([]);

    host.disabledId.set(null);
    host.dropDisabledId.set('c');
    f.detectChanges();

    tiles[0].dispatchEvent(pointer('pointerdown', { clientX: 20, clientY: 20 }));
    document.dispatchEvent(pointer('pointermove', { clientX: 50, clientY: 240 }));
    f.detectChanges();
    expect(tiles[2].classList.contains('ui-drop-target--over')).toBe(false);
    document.dispatchEvent(pointer('pointerup', { clientX: 50, clientY: 240 }));
    expect(host.drops).toEqual([]);
  });
});

describe('UiDragService cleanup', () => {
  it('keeps a single drag live region on the page, reusing one a previous service left behind', () => {
    const stale = document.createElement('div');
    stale.className = 'ui-drag-live';
    stale.textContent = 'Cancelled dragging x';
    document.body.appendChild(stale);

    TestBed.inject(UiDragService).announce('Picked up Dinner');

    const regions = document.querySelectorAll('.ui-drag-live');
    expect(regions.length).toBe(1);
    expect(regions[0].textContent).toBe('Picked up Dinner');
    stale.remove();
  });

  it('removes its live region when its injector is destroyed, so no stale announcement stays on the page', () => {
    const service = TestBed.inject(UiDragService);
    service.announce('Cancelled dragging x');
    expect(document.querySelectorAll('.ui-drag-live').length).toBe(1);

    TestBed.resetTestingModule();

    expect(document.querySelector('.ui-drag-live')).toBeNull();
  });
});
