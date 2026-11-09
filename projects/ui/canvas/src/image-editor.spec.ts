import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { UI_IMAGE_EDITOR_BACKEND, UiImageEditor, stepBrush, type UiImageEditorBackend } from './image-editor';
import type { UiImageCrop, UiImageEditorMode, UiImageRaster } from './image-edit';

// jsdom has no ResizeObserver and no 2D canvas; the editor only uses them to measure and to show pixels.
globalThis.ResizeObserver ??= class { observe() {} disconnect() {} unobserve() {} } as unknown as typeof ResizeObserver;
HTMLCanvasElement.prototype.getContext = (() => null) as never;

const W = 200;
const H = 100;

/** A picture whose red channel is x and green is y, so an exported pixel says where it came from. */
function picture(width = W, height = H): UiImageRaster {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      data[i] = x & 255;
      data[i + 1] = y & 255;
      data[i + 2] = 7;
      data[i + 3] = 255;
    }
  }
  return { width, height, data };
}

/** Stands in for <img> + <canvas>: hands out `picture()` and keeps what it was asked to encode. */
class FakeBackend implements UiImageEditorBackend {
  loads: { src: string; maxSide: number }[] = [];
  encoded: { raster: UiImageRaster; type: string }[] = [];
  load(src: string, maxSide: number) {
    this.loads.push({ src, maxSide });
    return Promise.resolve(picture());
  }
  encode(raster: UiImageRaster, type: string) {
    this.encoded.push({ raster, type });
    return Promise.resolve(new Blob([new Uint8Array(raster.data)], { type }));
  }
}

@Component({
  imports: [UiImageEditor],
  template: `
    <ui-image-editor #ed src="data:image/png;base64,AAAA" [aspect]="aspect()" [(mode)]="mode" [(brushSize)]="size" [(brushSoftness)]="soft"
      [(crop)]="crop" [fingerDraws]="fingerDraws()" (changed)="changes = changes + 1" />
  `,
})
class Host {
  readonly mode = signal<UiImageEditorMode>('erase');
  readonly size = signal(20);
  readonly soft = signal(0);
  readonly aspect = signal<number | null>(null);
  readonly crop = signal<UiImageCrop | null>(null);
  readonly fingerDraws = signal<boolean | 'auto'>('auto');
  changes = 0;
}

interface P { x: number; y: number; id?: number; type?: 'mouse' | 'pen' | 'touch'; button?: number }

describe('UiImageEditor', () => {
  let fixture: ComponentFixture<Host>;
  let host: Host;
  let backend: FakeBackend;
  let ed: UiImageEditor;
  const el = () => fixture.nativeElement.querySelector('ui-image-editor') as HTMLElement;

  /**
   * jsdom lays nothing out: the editor measures 0 × 0, so one screen pixel is one image pixel and the
   * view's centre sits at client (0, 0). `client()` turns image pixels into client coordinates.
   */
  const client = (x: number, y: number) => {
    const c = (ed as unknown as { center: () => { x: number; y: number } }).center();
    return { clientX: x - c.x, clientY: y - c.y };
  };
  const send = (kind: string, p: P, target: Element = el()) => {
    const e = new Event(kind, { bubbles: true, cancelable: true });
    Object.assign(e, { pointerId: p.id ?? 1, pointerType: p.type ?? 'mouse', button: p.button ?? 0, ...client(p.x, p.y) });
    target.dispatchEvent(e);
    fixture.detectChanges();
    return e;
  };
  const drag = (path: [number, number][], extra: Partial<P> = {}, target?: Element) => {
    send('pointerdown', { x: path[0][0], y: path[0][1], ...extra }, target);
    for (const [x, y] of path.slice(1)) send('pointermove', { x, y, ...extra });
    const [x, y] = path.at(-1)!;
    send('pointerup', { x, y, ...extra });
  };
  const handle = (id: string) => el().querySelector(`[data-handle="${id}"]`) as Element;
  const key = (k: string, init: KeyboardEventInit = {}) => {
    const e = new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true, ...init });
    el().dispatchEvent(e);
    fixture.detectChanges();
    return e;
  };
  /** Exports, and reads the alpha of the result at (x, y) (relative to the crop). */
  const exported = async () => {
    const blob = await ed.toBlob();
    const r = backend.encoded.at(-1)!.raster;
    return { blob, r, alpha: (x: number, y: number) => r.data[(y * r.width + x) * 4 + 3], at: (x: number, y: number) => [...r.data.slice((y * r.width + x) * 4, (y * r.width + x) * 4 + 4)] };
  };

  beforeEach(async () => {
    backend = new FakeBackend();
    await TestBed.configureTestingModule({ imports: [Host], providers: [{ provide: UI_IMAGE_EDITOR_BACKEND, useValue: backend }] }).compileComponents();
    fixture = TestBed.createComponent(Host);
    host = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    ed = fixture.debugElement.children[0].componentInstance as UiImageEditor;
  });

  it('loads the picture capped at 4096 px, with the whole picture as the crop', () => {
    expect(backend.loads).toEqual([{ src: 'data:image/png;base64,AAAA', maxSide: 4096 }]);
    expect(ed.loaded()).toBe(true);
    expect([ed.naturalWidth(), ed.naturalHeight()]).toEqual([W, H]);
    expect(host.crop()).toEqual({ x: 0, y: 0, width: W, height: H });
    expect(ed.dirty()).toBe(false);
    expect(ed.canUndo()).toBe(false);
    expect(el().getAttribute('role')).toBe('application');
    expect(el().getAttribute('aria-label')).toBe('Picture editor');
  });

  describe('erase and restore', () => {
    it('erasing makes the pixels it passes over transparent, and nothing else', async () => {
      drag([[20, 50], [60, 50], [100, 50], [140, 50], [180, 50]]);
      expect(host.changes).toBe(1);
      expect(ed.dirty()).toBe(true);
      const { r, alpha, at } = await exported();
      expect([r.width, r.height]).toEqual([W, H]);
      for (const x of [20, 50, 100, 150, 180]) expect(alpha(x, 50)).toBe(0);
      // Brush 20 wide: 10 px either side of the line, and past each end.
      expect(alpha(100, 30)).toBe(255);
      expect(alpha(100, 70)).toBe(255);
      expect(alpha(5, 50)).toBe(255);
      expect(alpha(195, 50)).toBe(255);
      expect(alpha(100, 10)).toBe(255);
      // Colour is kept where the alpha is.
      expect(at(100, 10)).toEqual([100, 10, 7, 255]);
    });

    it('restore paints the original back', async () => {
      drag([[20, 50], [180, 50]]);
      host.mode.set('restore');
      fixture.detectChanges();
      drag([[90, 50], [110, 50]]);
      const { alpha, at } = await exported();
      expect(alpha(100, 50)).toBe(255);
      expect(at(100, 50)).toEqual([100, 50, 7, 255]);
      expect(alpha(50, 50)).toBe(0);
      expect(alpha(150, 50)).toBe(0);
    });

    it('a soft brush leaves partial alpha towards its edge; a hard one does not', async () => {
      host.soft.set(1);
      host.size.set(40);
      fixture.detectChanges();
      drag([[100, 50], [100, 50]]);
      let { alpha } = await exported();
      expect(alpha(100, 50)).toBeLessThan(10);
      const edge = alpha(110, 50);
      expect(edge).toBeGreaterThan(60);
      expect(edge).toBeLessThan(200);
      expect(alpha(125, 50)).toBe(255);

      ed.undo();
      host.soft.set(0);
      fixture.detectChanges();
      drag([[100, 50], [100, 50]]);
      ({ alpha } = await exported());
      expect(alpha(100, 50)).toBe(0);
      expect(alpha(110, 50)).toBe(0);
      expect(alpha(125, 50)).toBe(255);
    });

    it('fills in between far-apart pointer events, so a fast stroke has no gaps', async () => {
      drag([[10, 20], [190, 80]]);
      const { alpha } = await exported();
      for (let x = 20; x <= 180; x += 10) {
        const y = Math.round(20 + ((x - 10) * 60) / 180);
        expect(alpha(x, y)).toBe(0);
      }
    });

    it('two fingers navigate and leave no paint, even after the first started a stroke', async () => {
      send('pointerdown', { x: 50, y: 50, id: 1, type: 'touch' });
      send('pointermove', { x: 60, y: 50, id: 1, type: 'touch' });
      send('pointerdown', { x: 120, y: 50, id: 2, type: 'touch' });
      send('pointermove', { x: 40, y: 50, id: 1, type: 'touch' });
      send('pointermove', { x: 140, y: 50, id: 2, type: 'touch' });
      send('pointerup', { x: 40, y: 50, id: 1, type: 'touch' });
      send('pointerup', { x: 140, y: 50, id: 2, type: 'touch' });
      expect(ed.canUndo()).toBe(false);
      expect(ed.dirty()).toBe(false);
      expect(host.changes).toBe(0);
      const { alpha } = await exported();
      expect(alpha(50, 50)).toBe(255);
      expect(alpha(60, 50)).toBe(255);
    });

    it('one finger paints until a pen is used; then fingers only move the view', async () => {
      drag([[30, 50], [40, 50]], { type: 'touch' });
      expect(ed.canUndo()).toBe(true);
      drag([[100, 20], [110, 20]], { type: 'pen', id: 3 });
      ed.undo();
      ed.undo();
      fixture.detectChanges();
      drag([[150, 50], [170, 50]], { type: 'touch', id: 4 });
      expect(ed.canUndo()).toBe(false);
      expect((await exported()).alpha(160, 50)).toBe(255);
    });

    it('Space + drag pans instead of painting', () => {
      key(' ');
      drag([[50, 50], [90, 50]]);
      el().dispatchEvent(new KeyboardEvent('keyup', { key: ' ', bubbles: true }));
      expect(ed.canUndo()).toBe(false);
    });
  });

  describe('crop', () => {
    beforeEach(() => {
      host.mode.set('crop');
      fixture.detectChanges();
    });

    it('handles resize the crop and the export is exactly that region', async () => {
      drag([[0, 0], [30, 20]], {}, handle('nw'));
      drag([[200, 100], [150, 90]], {}, handle('se'));
      expect(host.crop()).toEqual({ x: 30, y: 20, width: 120, height: 70 });
      expect(host.changes).toBe(2);
      const { r, at, blob } = await exported();
      expect([r.width, r.height]).toEqual([120, 70]);
      expect(blob.type).toBe('image/png');
      expect(at(0, 0)).toEqual([30, 20, 7, 255]);
      expect(at(119, 69)).toEqual([149, 89, 7, 255]);
    });

    it('dragging inside moves it, and it never leaves the picture', () => {
      drag([[0, 0], [40, 30]], {}, handle('nw'));
      drag([[100, 60], [400, 300]]);
      expect(host.crop()).toEqual({ x: 40, y: 30, width: 160, height: 70 });
      drag([[100, 60], [-400, -300]]);
      expect(host.crop()).toEqual({ x: 0, y: 0, width: 160, height: 70 });
    });

    it('stays at least 8 px', () => {
      drag([[200, 100], [-300, -300]], {}, handle('se'));
      expect(host.crop()).toEqual({ x: 0, y: 0, width: 8, height: 8 });
    });

    it('keeps the aspect while a corner or an edge is dragged', () => {
      host.aspect.set(1);
      fixture.detectChanges();
      expect(host.crop()).toEqual({ x: 50, y: 0, width: 100, height: 100 });
      drag([[150, 100], [110, 95]], {}, handle('se'));
      let c = host.crop()!;
      expect(c.width).toBe(c.height);
      expect([c.x, c.y]).toEqual([50, 0]);
      expect(c.width).toBeLessThan(100);
      drag([[c.x + c.width, c.y + c.height / 2], [c.x + c.width - 20, c.y + c.height / 2]], {}, handle('e'));
      c = host.crop()!;
      expect(c.width).toBe(c.height);
      host.aspect.set(16 / 9);
      fixture.detectChanges();
      c = host.crop()!;
      expect(Math.abs(c.width / c.height - 16 / 9)).toBeLessThan(0.05);
      drag([[c.x, c.y], [c.x - 500, c.y - 500]], {}, handle('nw'));
      c = host.crop()!;
      expect(Math.abs(c.width / c.height - 16 / 9)).toBeLessThan(0.05);
      expect(c.x).toBeGreaterThanOrEqual(0);
      expect(c.y).toBeGreaterThanOrEqual(0);
      expect(c.x + c.width).toBeLessThanOrEqual(W);
      expect(c.y + c.height).toBeLessThanOrEqual(H);
    });

    it('the thirds show only while dragging', () => {
      expect(el().querySelectorAll('.third').length).toBe(0);
      send('pointerdown', { x: 200, y: 100 }, handle('se'));
      expect(el().querySelectorAll('.third').length).toBe(4);
      send('pointerup', { x: 200, y: 100 });
      expect(el().querySelectorAll('.third').length).toBe(0);
    });

    it('resetCrop goes back to the whole picture as an undo step', () => {
      drag([[0, 0], [30, 20]], {}, handle('nw'));
      ed.resetCrop();
      expect(host.crop()).toEqual({ x: 0, y: 0, width: W, height: H });
      ed.undo();
      expect(host.crop()).toEqual({ x: 30, y: 20, width: 170, height: 80 });
    });
  });

  describe('history', () => {
    it('undo and redo step through strokes and crops in order', async () => {
      drag([[20, 50], [60, 50]]);
      host.mode.set('crop');
      fixture.detectChanges();
      drag([[0, 0], [10, 10]], {}, handle('nw'));
      host.mode.set('erase');
      fixture.detectChanges();
      drag([[150, 50], [180, 50]]);
      expect(host.changes).toBe(3);

      ed.undo();
      fixture.detectChanges();
      expect(host.crop()).toEqual({ x: 10, y: 10, width: 190, height: 90 });
      expect((await exported()).alpha(165 - 10, 40)).toBe(255);
      ed.undo();
      fixture.detectChanges();
      expect(host.crop()).toEqual({ x: 0, y: 0, width: W, height: H });
      expect((await exported()).alpha(40, 50)).toBe(0);
      ed.undo();
      fixture.detectChanges();
      expect(ed.canUndo()).toBe(false);
      expect(ed.dirty()).toBe(false);
      expect((await exported()).alpha(40, 50)).toBe(255);

      ed.redo();
      ed.redo();
      ed.redo();
      fixture.detectChanges();
      expect(ed.canRedo()).toBe(false);
      expect(host.crop()).toEqual({ x: 10, y: 10, width: 190, height: 90 });
      const { alpha } = await exported();
      expect(alpha(30, 40)).toBe(0);
      expect(alpha(165 - 10, 40)).toBe(0);
      expect(host.changes).toBe(9);
    });

    it('a new edit clears redo', () => {
      drag([[20, 50], [60, 50]]);
      ed.undo();
      expect(ed.canRedo()).toBe(true);
      drag([[100, 50], [120, 50]]);
      expect(ed.canRedo()).toBe(false);
    });

    it('keeps at least 30 steps', () => {
      for (let i = 0; i < 40; i++) drag([[5 + i * 4, 10 + (i % 8) * 10], [6 + i * 4, 12 + (i % 8) * 10]]);
      let n = 0;
      while (ed.canUndo()) { ed.undo(); n++; }
      expect(n).toBe(40);
    });

    it('Ctrl/⌘+Z undoes and Shift+Ctrl/⌘+Z redoes', () => {
      drag([[20, 50], [60, 50]]);
      expect(key('z', { ctrlKey: true }).defaultPrevented).toBe(true);
      expect(ed.canUndo()).toBe(false);
      key('z', { metaKey: true, shiftKey: true });
      expect(ed.canUndo()).toBe(true);
      key('z', { ctrlKey: true });
      key('y', { ctrlKey: true });
      expect(ed.canUndo()).toBe(true);
    });

    it('reset goes back to the original, and can be undone', async () => {
      drag([[20, 50], [180, 50]]);
      host.mode.set('crop');
      fixture.detectChanges();
      drag([[0, 0], [30, 20]], {}, handle('nw'));
      ed.reset();
      fixture.detectChanges();
      expect(ed.dirty()).toBe(false);
      expect(host.crop()).toEqual({ x: 0, y: 0, width: W, height: H });
      expect((await exported()).alpha(100, 50)).toBe(255);
      ed.undo();
      fixture.detectChanges();
      expect(ed.dirty()).toBe(true);
      expect(host.crop()).toEqual({ x: 30, y: 20, width: 170, height: 80 });
      expect((await exported()).alpha(70, 30)).toBe(0);
    });
  });

  it('[ and ] change the brush size', () => {
    expect(key(']').defaultPrevented).toBe(true);
    expect(host.size()).toBe(24);
    key('[');
    key('[');
    expect(host.size()).toBe(17);
    expect(stepBrush(3, -1)).toBe(2);
    expect(stepBrush(1, -1)).toBe(1);
  });

  it('leaves a plain wheel to the page, and zooms with Ctrl/⌘ + wheel', () => {
    const wheel = (init: WheelEventInit) => { const e = new WheelEvent('wheel', { bubbles: true, cancelable: true, deltaY: 100, ...init }); el().dispatchEvent(e); return e; };
    expect(wheel({}).defaultPrevented).toBe(false);
    expect(wheel({ ctrlKey: true }).defaultPrevented).toBe(true);
  });

  it('toBlob passes the type and gives the crop size', async () => {
    host.mode.set('crop');
    fixture.detectChanges();
    drag([[200, 100], [160, 75]], {}, handle('se'));
    const blob = await ed.toBlob('image/webp', 0.8);
    expect(blob.type).toBe('image/webp');
    expect(blob.size).toBe(160 * 75 * 4);
  });
});
