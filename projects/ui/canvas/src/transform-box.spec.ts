import { Component, signal, viewChild } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { UI_ROTATE_CURSOR, UiTransformBox, uiResizeCursor, type UiBox, type UiTransformMode } from './transform-box';

function pointer(kind: string, id: number, x: number, y: number, type = 'touch'): Event {
  const e = new Event(kind, { bubbles: true, cancelable: true });
  Object.assign(e, { pointerId: id, pointerType: type, button: 0, clientX: x, clientY: y, shiftKey: false, altKey: false });
  return e;
}

@Component({
  imports: [UiTransformBox],
  template: `<ui-transform-box [box]="box()" (transformStart)="starts.push($event)" (transform)="moves.push($event)" (transformEnd)="ends.push($event)" [minSize]="10" />`,
})
class Host {
  readonly box = signal<UiBox>({ x: 100, y: 100, w: 80, h: 40, rotate: 15 });
  readonly tb = viewChild.required(UiTransformBox);
  starts: UiTransformMode[] = [];
  moves: UiBox[] = [];
  ends: UiBox[] = [];
}

describe('UiTransformBox pinch', () => {
  let fixture: ComponentFixture<Host>;
  let host: Host;
  const body = () => fixture.nativeElement.querySelector('.body') as HTMLElement;

  beforeEach(() => {
    fixture = TestBed.createComponent(Host);
    host = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('grows equally from every side about its centre, keeping proportions and rotation', () => {
    // Fingers either side of the centre (140, 120), spreading from 80 apart to 160.
    host.tb().startPinch({ pointerId: 1, clientX: 100, clientY: 120 }, { pointerId: 2, clientX: 180, clientY: 120 });
    window.dispatchEvent(pointer('pointermove', 2, 220, 120));
    window.dispatchEvent(pointer('pointermove', 1, 60, 120));
    window.dispatchEvent(pointer('pointerup', 2, 220, 120));
    expect(host.starts).toEqual(['resize']);
    const end = host.ends.at(-1)!;
    // Twice the size, same centre, same turn.
    expect(end.w).toBeCloseTo(160, 6);
    expect(end.h).toBeCloseTo(80, 6);
    expect(end.x + end.w / 2).toBeCloseTo(140, 6);
    expect(end.y + end.h / 2).toBeCloseTo(120, 6);
    expect(end.rotate).toBe(15);
    expect(host.ends).toHaveLength(1);
  });

  it('follows the point between the fingers', () => {
    host.tb().startPinch({ pointerId: 1, clientX: 100, clientY: 200 }, { pointerId: 2, clientX: 200, clientY: 200 });
    window.dispatchEvent(pointer('pointermove', 1, 130, 230));
    window.dispatchEvent(pointer('pointermove', 2, 230, 230));
    window.dispatchEvent(pointer('pointerup', 1, 130, 230));
    const end = host.ends.at(-1)!;
    expect(end.w).toBeCloseTo(80, 6);
    expect(end.x + end.w / 2).toBeCloseTo(170, 6);
    expect(end.y + end.h / 2).toBeCloseTo(150, 6);
  });

  it('zooms toward the fingers: the point between them stays under them', () => {
    // jsdom lays nothing out, so the stage sits at 0,0 and one unit is one pixel. The box is 100..180 × 100..140;
    // pinch about (110, 110), near its top-left corner, to twice the spread.
    host.tb().startPinch({ pointerId: 1, clientX: 100, clientY: 110 }, { pointerId: 2, clientX: 120, clientY: 110 });
    window.dispatchEvent(pointer('pointermove', 1, 90, 110));
    window.dispatchEvent(pointer('pointermove', 2, 130, 110));
    window.dispatchEvent(pointer('pointerup', 2, 130, 110));
    const end = host.ends.at(-1)!;
    expect(end.w).toBeCloseTo(160, 6);
    // (110, 110) was 30 left and 10 up of the centre (140, 120); twice as far now, from the same point.
    expect(end.x + end.w / 2).toBeCloseTo(170, 6);
    expect(end.y + end.h / 2).toBeCloseTo(130, 6);
  });

  it('never shrinks below the smallest size, on either side', () => {
    host.tb().startPinch({ pointerId: 1, clientX: 100, clientY: 200 }, { pointerId: 2, clientX: 200, clientY: 200 });
    window.dispatchEvent(pointer('pointermove', 2, 101, 200));
    window.dispatchEvent(pointer('pointerup', 2, 101, 200));
    const end = host.ends.at(-1)!;
    expect(end.h).toBeCloseTo(10, 6);
    expect(end.w).toBeCloseTo(20, 6);
  });

  it('a second finger while one drags the box turns the drag into a pinch', () => {
    body().dispatchEvent(pointer('pointerdown', 1, 140, 120));
    window.dispatchEvent(pointer('pointerdown', 2, 240, 120));
    window.dispatchEvent(pointer('pointermove', 2, 340, 120));
    window.dispatchEvent(pointer('pointerup', 1, 140, 120));
    window.dispatchEvent(pointer('pointerup', 2, 340, 120));
    expect(host.starts).toEqual(['move', 'resize']);
    expect(host.ends).toHaveLength(1);
    const end = host.ends[0];
    // The first finger held the centre while the second spread away: the box doubled toward the pair's
    // middle, and the point under the first finger — the centre — stayed put.
    expect(end.w).toBeCloseTo(160, 6);
    expect(end.x + end.w / 2).toBeCloseTo(140, 6);
  });

  it('two fingers that land and lift without moving change nothing', () => {
    host.tb().startPinch({ pointerId: 1, clientX: 100, clientY: 200 }, { pointerId: 2, clientX: 200, clientY: 200 });
    window.dispatchEvent(pointer('pointerup', 1, 100, 200));
    expect(host.starts).toEqual([]);
    expect(host.ends).toEqual([]);
  });

  it('a mouse drag is never turned into a pinch', () => {
    body().dispatchEvent(pointer('pointerdown', 1, 140, 120, 'mouse'));
    window.dispatchEvent(pointer('pointerdown', 2, 240, 120));
    expect(host.tb().pinching).toBe(false);
    window.dispatchEvent(pointer('pointerup', 1, 140, 120, 'mouse'));
  });
});

describe('UiTransformBox cursors', () => {
  let fixture: ComponentFixture<Host>;
  let host: Host;
  const el = (sel: string) => fixture.nativeElement.querySelector(sel) as HTMLElement;
  const held = () => document.getElementById('ui-transform-drag-cursor')?.textContent ?? null;

  function turn(rotate: number): void {
    host.box.set({ x: 100, y: 100, w: 80, h: 40, rotate });
    fixture.detectChanges();
  }

  beforeEach(() => {
    fixture = TestBed.createComponent(Host);
    host = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('points each resize handle the way it drags on screen, following the turn', () => {
    const cursors = () => Object.fromEntries(['n', 'ne', 'e', 'se', 's', 'sw', 'w', 'nw'].map((h) => [h, el(`.handle[data-h="${h}"]`).style.cursor]));
    turn(0);
    expect(cursors()).toEqual({ n: 'ns-resize', ne: 'nesw-resize', e: 'ew-resize', se: 'nwse-resize', s: 'ns-resize', sw: 'nesw-resize', w: 'ew-resize', nw: 'nwse-resize' });
    // Turned a quarter: the top handle now drags sideways.
    turn(90);
    expect(cursors()).toEqual({ n: 'ew-resize', ne: 'nwse-resize', e: 'ns-resize', se: 'nesw-resize', s: 'ew-resize', sw: 'nwse-resize', w: 'ns-resize', nw: 'nesw-resize' });
    // 40° is nearer 45° than 0°, so the side handle is diagonal; -170° is 10° off flat, so it is plain again.
    turn(40);
    expect(cursors()['e']).toBe('nwse-resize');
    expect(cursors()['n']).toBe('nesw-resize');
    turn(-170);
    expect(cursors()['e']).toBe('ew-resize');
    expect(uiResizeCursor(0, -1, 270)).toBe('ew-resize');
  });

  it('keeps the cursor a drag started with on the whole page until the drag ends', () => {
    turn(90);
    const n = el('.handle[data-h="n"]');
    n.dispatchEvent(pointer('pointerdown', 7, 140, 100, 'mouse'));
    expect(held()).toContain('cursor: ew-resize !important');
    // Over other handles and the body, and off the box: still the same.
    window.dispatchEvent(pointer('pointermove', 7, 140, 300, 'mouse'));
    expect(held()).toContain('cursor: ew-resize !important');
    window.dispatchEvent(pointer('pointerup', 7, 140, 300, 'mouse'));
    expect(held()).toBeNull();

    // Moving holds `move`; a cancelled drag lets go too.
    el('.body').dispatchEvent(pointer('pointerdown', 8, 140, 120, 'mouse'));
    expect(held()).toContain('cursor: move !important');
    window.dispatchEvent(pointer('pointercancel', 8, 140, 120, 'mouse'));
    expect(held()).toBeNull();
  });

  it('lets go of the cursor when destroyed mid-drag', () => {
    el('.handle[data-h="e"]').dispatchEvent(pointer('pointerdown', 9, 180, 120, 'mouse'));
    expect(held()).not.toBeNull();
    fixture.destroy();
    expect(held()).toBeNull();
  });

  it('holds no cursor for a finger', () => {
    el('.body').dispatchEvent(pointer('pointerdown', 10, 140, 120, 'touch'));
    expect(held()).toBeNull();
    window.dispatchEvent(pointer('pointerup', 10, 140, 120, 'touch'));
  });

  it('shows a rotate cursor on the knob, on hover and while turning', () => {
    expect(UI_ROTATE_CURSOR).toMatch(/^url\("data:image\/svg\+xml,.+"\) 12 12, grab$/);
    const knob = el('.rotate');
    expect(knob.style.cursor).toContain('data:image/svg+xml');
    knob.dispatchEvent(pointer('pointerdown', 11, 140, 70, 'mouse'));
    expect(held()).toContain(`cursor: ${UI_ROTATE_CURSOR} !important`);
    window.dispatchEvent(pointer('pointerup', 11, 140, 70, 'mouse'));
    expect(held()).toBeNull();
  });
});

describe('UiTransformBox pointer capture', () => {
  it('captures the pointer on the pressed handle for the whole drag, and lets it go at the end', () => {
    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    const handle = fixture.nativeElement.querySelector('.handle[data-h="e"]') as HTMLElement;
    const captured = new Set<number>();
    Object.assign(handle, {
      setPointerCapture: (id: number) => captured.add(id),
      releasePointerCapture: (id: number) => captured.delete(id),
      hasPointerCapture: (id: number) => captured.has(id),
    });
    handle.dispatchEvent(pointer('pointerdown', 12, 180, 120, 'mouse'));
    expect([...captured]).toEqual([12]);
    window.dispatchEvent(pointer('pointermove', 12, 260, 120, 'mouse'));
    expect([...captured]).toEqual([12]);
    window.dispatchEvent(pointer('pointerup', 12, 260, 120, 'mouse'));
    expect([...captured]).toEqual([]);
  });
});
