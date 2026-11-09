import { describe, expect, it } from 'vitest';
import { UiImageEdit, brushFalloff, clampCrop, dragCrop, fitAspect, rleDecode, rleEncode } from './image-edit';

const blank = (width: number, height: number) => ({ width, height, data: new Uint8ClampedArray(width * height * 4).fill(255) });

describe('image edit helpers', () => {
  it('brushFalloff: full inside, none outside, smooth in between when soft', () => {
    expect(brushFalloff(0, 10, 0)).toBe(1);
    expect(brushFalloff(9, 10, 0)).toBe(1);
    expect(brushFalloff(10, 10, 0)).toBe(0.5);
    expect(brushFalloff(11, 10, 0)).toBe(0);
    expect(brushFalloff(0, 10, 1)).toBe(1);
    expect(brushFalloff(5, 10, 1)).toBeCloseTo(0.5, 6);
    expect(brushFalloff(10, 10, 1)).toBe(0);
    // Half soft: hard to the middle, then fading.
    expect(brushFalloff(5, 10, 0.5)).toBe(1);
    expect(brushFalloff(7.5, 10, 0.5)).toBeCloseTo(0.5, 6);
  });

  it('run-length encoding round-trips, and is small for a plain mask', () => {
    const bytes = new Uint8Array(4096).fill(255);
    bytes.fill(0, 100, 900);
    bytes[2000] = 17;
    const rle = rleEncode(bytes);
    expect(rle.length).toBeLessThan(100);
    expect([...rleDecode(rle, new Uint8Array(4096))]).toEqual([...bytes]);
  });

  it('clampCrop keeps a crop whole-pixel, inside and at least 8 px', () => {
    expect(clampCrop({ x: -5.4, y: 3.6, width: 300, height: 2 }, 200, 100)).toEqual({ x: 0, y: 4, width: 200, height: 8 });
  });

  it('fitAspect finds the largest frame of a shape, centred', () => {
    expect(fitAspect({ x: 0, y: 0, width: 200, height: 100 }, 1, 200, 100)).toEqual({ x: 50, y: 0, width: 100, height: 100 });
    expect(fitAspect({ x: 0, y: 0, width: 200, height: 100 }, 4, 200, 100)).toEqual({ x: 0, y: 25, width: 200, height: 50 });
  });

  it('dragCrop with an aspect keeps the opposite corner still and fits in the picture', () => {
    const start = { x: 50, y: 0, width: 100, height: 100 };
    const c = dragCrop(start, 'nw', 30, 10, 200, 100, 1);
    expect(c.x + c.width).toBe(150);
    expect(c.y + c.height).toBe(100);
    expect(c.width).toBe(c.height);
    const big = dragCrop(start, 'se', 500, 500, 200, 100, 1);
    expect(big).toEqual(start);
    const top = dragCrop({ x: 50, y: 20, width: 60, height: 60 }, 'n', 0, -15, 200, 100, 1);
    expect(top.width).toBe(top.height);
    expect(top.y + top.height).toBe(80);
    expect(Math.abs(top.x + top.width / 2 - 80)).toBeLessThanOrEqual(0.5);
  });

  it('cancelStroke puts the mask back', () => {
    const e = new UiImageEdit(blank(100, 100));
    e.beginStroke('erase', 50, 50, 20, 0);
    e.strokeTo(80, 50);
    expect(e.maskAt(50, 50)).toBe(0);
    e.cancelStroke();
    expect(e.maskAt(50, 50)).toBe(255);
    expect(e.canUndo).toBe(false);
    expect(e.dirty).toBe(false);
  });

  it('history keeps 100 steps, and stays small for strokes over a big picture', () => {
    const e = new UiImageEdit(blank(2000, 2000));
    for (let i = 0; i < 120; i++) {
      e.beginStroke(i % 2 ? 'restore' : 'erase', 0, (i * 16) % 2000, 300, 0.3);
      e.strokeTo(2000, (i * 16) % 2000);
      e.endStroke();
    }
    expect(e.stepCount).toBe(100);
    // Each stroke covers 2000 x 300 px; raw before/after copies would be over 100 MB.
    expect(e.historyBytes).toBeLessThan(8 * 1024 * 1024);
  });
});
