import { describe, expect, it } from 'vitest';
import { normalizeRuns } from './token-input';

describe('normalizeRuns', () => {
  it('merges neighbouring text with the same marks and keeps tokens atomic', () => {
    expect(normalizeRuns([
      { text: 'Join ' }, { text: 'us on ' }, { token: 'event.date' }, { text: '!', bold: true }, { text: '!', bold: true },
    ])).toEqual([{ text: 'Join us on ' }, { token: 'event.date' }, { text: '!!', bold: true }]);
  });

  it('drops empty text and never merges across a change of marks', () => {
    expect(normalizeRuns([{ text: '' }, { text: 'a' }, { text: 'b', italic: true }]))
      .toEqual([{ text: 'a' }, { text: 'b', italic: true }]);
  });
});
