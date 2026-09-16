import { describe, expect, it } from 'vitest';
import { uiRotatedBounds, uiSnap } from './snap';

describe('uiSnap', () => {
  const target = { x: 100, y: 100, w: 50, h: 50 };

  it('snaps the nearest edge within the threshold and reports a guide', () => {
    const r = uiSnap({ x: 153, y: 300, w: 20, h: 20 }, [target], 5);
    expect(r.dx).toBe(-3); // left edge onto the target's right edge
    expect(r.dy).toBe(0);
    expect(r.guides).toEqual([{ orientation: 'vertical', at: 150, from: 100, to: 320 }]);
  });

  it('snaps centres to centres', () => {
    const r = uiSnap({ x: 116, y: 116, w: 20, h: 20 }, [target], 2);
    expect(r.dx).toBe(-1);
    expect(r.dy).toBe(-1);
  });

  it('leaves things alone outside the threshold', () => {
    const r = uiSnap({ x: 400, y: 400, w: 20, h: 20 }, [target], 5);
    expect(r).toEqual({ dx: 0, dy: 0, guides: [] });
  });

  it('snaps to extra lines such as the stage centre', () => {
    const r = uiSnap({ x: 182, y: 0, w: 20, h: 20 }, [], 4, { vertical: [195] });
    expect(r.dx).toBe(3);
  });
});

describe('uiRotatedBounds', () => {
  it('is the box itself when unrotated', () => {
    expect(uiRotatedBounds({ x: 1, y: 2, w: 3, h: 4 })).toEqual({ x: 1, y: 2, w: 3, h: 4 });
  });

  it('swaps width and height at 90° about the same centre', () => {
    const b = uiRotatedBounds({ x: 0, y: 0, w: 100, h: 20, rotate: 90 });
    expect(b.w).toBeCloseTo(20);
    expect(b.h).toBeCloseTo(100);
    expect(b.x + b.w / 2).toBeCloseTo(50);
    expect(b.y + b.h / 2).toBeCloseTo(10);
  });
});
