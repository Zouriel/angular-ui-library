import { describe, expect, it } from 'vitest';
import { fbDropIndex, type FbBox } from './builder-dnd';

const box = (left: number, top: number, width: number, height: number): FbBox => ({ left, top, width, height, bottom: top + height });

/** Choosing where a dragged card lands. */
describe('fbDropIndex', () => {
  // A phone: three full-width cards, 80 tall with 10px gaps. The grip is at the left edge.
  const column = [box(0, 0, 360, 80), box(0, 90, 360, 80), box(0, 180, 360, 80)];

  it('a card alone on its row: the top half is before it, the bottom half after it, wherever x is', () => {
    expect(fbDropIndex(column, 12, 100)).toBe(1); // top of the second card
    expect(fbDropIndex(column, 12, 150)).toBe(2); // bottom of the second card: after it
    expect(fbDropIndex(column, 340, 150)).toBe(2);
  });

  it('dragging the first card by its grip onto the lower half of the next moves it down one', () => {
    // Before the fix this was 1 (before the second card), i.e. where it already was.
    expect(fbDropIndex(column, 12, 160)).toBe(2);
  });

  it('gaps and the ends', () => {
    expect(fbDropIndex(column, 12, -5)).toBe(0);
    expect(fbDropIndex(column, 12, 85)).toBe(1);
    expect(fbDropIndex(column, 12, 400)).toBe(3);
  });

  it('cards sharing a row still split by their left and right halves', () => {
    const grid = [box(0, 0, 175, 80), box(185, 0, 175, 80), box(0, 90, 360, 80)];
    expect(fbDropIndex(grid, 40, 60)).toBe(0);  // left half of the first: before it
    expect(fbDropIndex(grid, 150, 60)).toBe(1); // right half of the first: before the second
    expect(fbDropIndex(grid, 300, 10)).toBe(2); // right half of the second: after it
  });
});
