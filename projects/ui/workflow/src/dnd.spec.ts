import { describe, expect, it } from 'vitest';
import { wfDropIndex } from './dnd';

/** Where a dragged step lands among a list's cards (top to bottom). */
describe('wfDropIndex', () => {
  // Three cards, 56 tall with 32px between them (room for the + slot).
  const cards = [{ top: 0, bottom: 56 }, { top: 88, bottom: 144 }, { top: 176, bottom: 232 }];

  it('the top half of a card is before it, the bottom half after it', () => {
    expect(wfDropIndex(cards, 100)).toBe(1);
    expect(wfDropIndex(cards, 130)).toBe(2);
  });

  it('gaps and both ends', () => {
    expect(wfDropIndex(cards, -20)).toBe(0);
    expect(wfDropIndex(cards, 70)).toBe(1);
    expect(wfDropIndex(cards, 500)).toBe(3);
  });

  it('an empty list takes the drop at 0', () => {
    expect(wfDropIndex([], 40)).toBe(0);
  });
});
