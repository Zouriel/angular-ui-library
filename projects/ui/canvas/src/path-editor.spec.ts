import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { rectContour, type UiPathItem, type UiPointRef } from './path';
import { UiPathEditor, type UiInkStroke, type UiPathEditorMode } from './path-editor';
import type { UiBrush } from './ink';

// jsdom has no ResizeObserver; the editor only uses it to learn its size.
globalThis.ResizeObserver ??= class { observe() {} disconnect() {} unobserve() {} } as unknown as typeof ResizeObserver;

/**
 * jsdom lays nothing out: the editor measures 0×0, so one pixel is one unit and the view is centred on
 * the artboard's middle (50, 50). `at(x, y)` turns artboard units into the client position for them.
 */
const at = (x: number, y: number) => ({ clientX: x - 50, clientY: y - 50 });

interface PointerInit { x: number; y: number; id?: number; type?: 'mouse' | 'pen' | 'touch'; pressure?: number; shift?: boolean; alt?: boolean }

function pointer(kind: string, p: PointerInit): Event {
  const e = new Event(kind, { bubbles: true, cancelable: true });
  const c = at(p.x, p.y);
  Object.assign(e, {
    pointerId: p.id ?? 1, pointerType: p.type ?? 'mouse', button: 0, clientX: c.clientX, clientY: c.clientY,
    pressure: p.pressure ?? (kind === 'pointerup' ? 0 : 0.5), shiftKey: !!p.shift, altKey: !!p.alt, ctrlKey: false, metaKey: false,
  });
  return e;
}

@Component({
  imports: [UiPathEditor],
  template: `
    <ui-path-editor #ed [items]="items()" [width]="100" [height]="100" [mode]="mode()" [brush]="brush()" fill="#123456"
      [(selectedId)]="selectedId" [(selectedPoint)]="selectedPoint" [(selectedPoints)]="selectedPoints"
      (itemsChange)="changes.push($event); items.set($event)" (stroke)="strokes.push($event)" (penDetected)="pens = pens + 1" />
  `,
})
class Host {
  readonly items = signal<UiPathItem[]>([]);
  readonly mode = signal<UiPathEditorMode>('pen');
  readonly brush = signal<UiBrush>({ kind: 'pen', size: 4 });
  readonly selectedId = signal<string | null>(null);
  readonly selectedPoint = signal<UiPointRef | null>(null);
  readonly selectedPoints = signal<UiPointRef[]>([]);
  readonly changes: UiPathItem[][] = [];
  readonly strokes: UiInkStroke[] = [];
  pens = 0;
}

describe('UiPathEditor', () => {
  let fixture: ComponentFixture<Host>;
  let host: Host;
  const svg = () => fixture.nativeElement.querySelector('svg.surface') as SVGSVGElement;
  const send = (target: Element, kind: string, p: PointerInit) => {
    target.dispatchEvent(pointer(kind, p));
    fixture.detectChanges();
  };
  const tap = (x: number, y: number, extra: Partial<PointerInit> = {}, target: Element = svg()) => {
    send(target, 'pointerdown', { x, y, ...extra });
    send(target, 'pointerup', { x, y, ...extra });
  };
  const dragFrom = (target: Element, path: [number, number][], extra: Partial<PointerInit> = {}) => {
    send(target, 'pointerdown', { x: path[0][0], y: path[0][1], ...extra });
    for (const [x, y] of path.slice(1)) send(svg(), 'pointermove', { x, y, ...extra });
    const [x, y] = path.at(-1)!;
    send(svg(), 'pointerup', { x, y, ...extra });
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [Host] }).compileComponents();
    fixture = TestBed.createComponent(Host);
    host = fixture.componentInstance;
    fixture.detectChanges();
  });
  afterEach(() => vi.useRealTimers());

  describe('pen', () => {
    it('taps place corners; tapping the first point closes the shape into a new item', () => {
      tap(10, 10);
      tap(90, 10);
      tap(50, 80);
      expect(host.changes).toHaveLength(0);
      tap(10.5, 10.5);
      const [item] = host.changes.at(-1)!;
      expect(item.contours[0].closed).toBe(true);
      expect(item.contours[0].points.map((p) => [p.x, p.y])).toEqual([[10, 10], [90, 10], [50, 80]]);
      expect(item.fill).toBe('#123456');
      expect(host.selectedId()).toBe(item.id);
    });

    it('dragging while placing a point makes it a curve with handles in line', () => {
      tap(10, 50);
      dragFrom(svg(), [[50, 20], [55, 20], [70, 20]]);
      tap(90, 50);
      tap(90, 50); // the last point again: finish as an open line
      const [item] = host.changes.at(-1)!;
      const mid = item.contours[0].points[1];
      expect(item.contours[0].closed).toBe(false);
      expect(mid.out).toEqual({ x: 70, y: 20 });
      expect(mid.in).toEqual({ x: 30, y: 20 });
    });

    it('Shift keeps the next segment to 45°', () => {
      tap(10, 10);
      tap(60, 14, { shift: true });
      tap(60, 14);
      const pts = host.changes.at(-1)![0].contours[0].points;
      expect(pts[1].y).toBeCloseTo(10, 6);
    });

    it('leaving the pen finishes the path', () => {
      tap(10, 10);
      tap(40, 40);
      host.mode.set('objects');
      fixture.detectChanges();
      expect(host.changes.at(-1)![0].contours[0].points).toHaveLength(2);
    });
  });

  describe('draw', () => {
    beforeEach(() => {
      host.mode.set('draw');
      fixture.detectChanges();
    });

    it('a stroke is reported with its samples and the area it paints', () => {
      dragFrom(svg(), [[10, 50], [20, 50], [30, 52], [40, 50], [60, 50]]);
      expect(host.strokes).toHaveLength(1);
      const s = host.strokes[0];
      expect(s.brush.kind).toBe('pen');
      expect(s.samples.length).toBeGreaterThan(2);
      expect(s.samples.at(-1)).toMatchObject({ x: 60, y: 50 });
      expect(s.pieces.length).toBe(s.samples.length - 1);
      expect(host.changes).toHaveLength(0);
    });

    it("a pen's pressure is used; once a pen is seen, a finger pans instead of drawing", () => {
      dragFrom(svg(), [[10, 10], [30, 10], [50, 10]], { type: 'pen', pressure: 0.9 });
      expect(host.pens).toBe(1);
      expect(host.strokes[0].samples.every((p) => p.pressure === 0.9)).toBe(true);
      dragFrom(svg(), [[10, 60], [40, 60], [70, 60]], { type: 'touch', id: 2 });
      expect(host.strokes).toHaveLength(1);
    });

    it('a hand resting on the screen while the pen draws is ignored', () => {
      send(svg(), 'pointerdown', { x: 10, y: 10, type: 'pen' });
      send(svg(), 'pointerdown', { x: 80, y: 80, type: 'touch', id: 7 });
      send(svg(), 'pointermove', { x: 40, y: 10, type: 'pen' });
      send(svg(), 'pointerup', { x: 40, y: 10, type: 'pen' });
      expect(host.strokes).toHaveLength(1);
      expect(host.strokes[0].samples.at(-1)).toMatchObject({ x: 40, y: 10 });
    });

    it('holding still at the end of a loop snaps it to a circle', () => {
      vi.useFakeTimers();
      const loop = Array.from({ length: 40 }, (_, i) => {
        const t = (i / 39) * Math.PI * 2;
        return [50 + 30 * Math.cos(t), 50 + 30 * Math.sin(t)] as [number, number];
      });
      send(svg(), 'pointerdown', { x: loop[0][0], y: loop[0][1] });
      for (const [x, y] of loop.slice(1)) send(svg(), 'pointermove', { x, y });
      vi.advanceTimersByTime(700);
      const [x, y] = loop.at(-1)!;
      send(svg(), 'pointerup', { x, y });
      expect(host.strokes[0].shape?.kind).toBe('ellipse');
    });
  });

  describe('points', () => {
    beforeEach(() => {
      host.items.set([{ id: 'a', contours: [rectContour(10, 10, 60, 60)] }]);
      host.selectedId.set('a');
      host.mode.set('points');
      fixture.detectChanges();
    });
    const knob = (i: number) => fixture.nativeElement.querySelector(`[data-point="0:${i}"]`) as Element;

    it('Shift-click selects several points, and dragging one moves them all', () => {
      tap(10, 10, {}, knob(0));
      tap(70, 10, { shift: true }, knob(1));
      expect(host.selectedPoints()).toEqual([{ contour: 0, point: 0 }, { contour: 0, point: 1 }]);
      dragFrom(knob(1), [[70, 10], [70, 20], [70, 30]]);
      const pts = host.items()[0].contours[0].points;
      expect(pts.map((p) => p.y)).toEqual([30, 30, 70, 70]);
    });

    it('a long press adds a point to the selection on a touch screen', () => {
      vi.useFakeTimers();
      tap(10, 10, { type: 'touch' }, knob(0));
      send(knob(2), 'pointerdown', { x: 70, y: 70, type: 'touch' });
      vi.advanceTimersByTime(500);
      send(svg(), 'pointerup', { x: 70, y: 70, type: 'touch' });
      expect(host.selectedPoints()).toHaveLength(2);
    });

    it('a double tap switches a point between corner and curve', () => {
      tap(70, 10, {}, knob(1));
      tap(70, 10, {}, knob(1));
      const p = host.items()[0].contours[0].points[1];
      expect(p.in).toBeTruthy();
      expect(p.out).toBeTruthy();
    });

    it('a mouse drag across empty space selects the points inside', () => {
      dragFrom(svg(), [[0, 50], [40, 80], [90, 90]]);
      expect(host.selectedPoints()).toEqual([{ contour: 0, point: 2 }, { contour: 0, point: 3 }]);
    });

    it('Delete removes every selected point', () => {
      tap(10, 10, {}, knob(0));
      tap(70, 10, { shift: true }, knob(1));
      const el = fixture.nativeElement.querySelector('ui-path-editor') as HTMLElement;
      el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete', bubbles: true }));
      fixture.detectChanges();
      expect(host.items()[0].contours[0].points).toHaveLength(2);
    });

    it('Alt-dragging a corner pulls curve handles out of it', () => {
      dragFrom(knob(1), [[70, 10], [75, 5], [80, 0]], { alt: true });
      const p = host.items()[0].contours[0].points[1];
      expect(p.out).toEqual({ x: 80, y: 0 });
      expect(p.in).toEqual({ x: 60, y: 20 });
    });
  });
});
