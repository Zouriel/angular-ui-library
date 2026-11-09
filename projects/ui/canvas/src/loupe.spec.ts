import { describe, expect, it } from 'vitest';
import { UI_LOUPE_SIZE, uiLoupePlace } from './loupe';

describe('uiLoupePlace', () => {
  const clear = (p: { x: number; y: number; size: number }, fx: number, fy: number) => Math.hypot(p.x - fx, p.y - fy) - p.size / 2;

  it('sits up and to the left of the finger, clear of it, inside the surface', () => {
    const p = uiLoupePlace(300, 400, 400, 700);
    expect(p.size).toBe(UI_LOUPE_SIZE);
    expect(p.x).toBeLessThan(300);
    expect(p.y).toBeLessThan(400);
    expect(clear(p, 300, 400)).toBeGreaterThanOrEqual(39);
  });

  it('flips to the right near the left edge, below near the top, and both in the top-left corner', () => {
    const left = uiLoupePlace(30, 400, 400, 700);
    expect(left.x).toBeGreaterThan(30);
    expect(left.y).toBeLessThan(400);
    const top = uiLoupePlace(300, 30, 400, 700);
    expect(top.x).toBeLessThan(300);
    expect(top.y).toBeGreaterThan(30);
    const corner = uiLoupePlace(20, 20, 400, 700);
    expect(corner.x).toBeGreaterThan(20);
    expect(corner.y).toBeGreaterThan(20);
    for (const p of [left, top, corner]) {
      expect(p.x - p.size / 2).toBeGreaterThanOrEqual(0);
      expect(p.y - p.size / 2).toBeGreaterThanOrEqual(0);
    }
  });

  it('keeps inside the surface near the right and bottom edges', () => {
    const p = uiLoupePlace(395, 695, 400, 700);
    expect(p.x + p.size / 2).toBeLessThanOrEqual(400);
    expect(p.y + p.size / 2).toBeLessThanOrEqual(700);
  });

  it('shrinks on a small surface, but not below 64 px', () => {
    expect(uiLoupePlace(100, 100, 200, 200).size).toBe(84);
    expect(uiLoupePlace(50, 50, 100, 100).size).toBe(64);
  });
});
