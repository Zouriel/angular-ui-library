import { describe, expect, it } from 'vitest';
import { UiTourPanel } from './tour';

const css = () =>
  ((UiTourPanel as unknown as { ɵcmp: { styles: string[] } }).ɵcmp.styles ?? [])
    .join('\n')
    .replace(/\[_ngcontent-%COMP%\]/g, '')
    .replace(/\s+/g, ' ');

describe('UiTourPanel on a touch screen (0.82.0)', () => {
  it('gives every text action and button a hit area at least 44px tall without drawing it bigger', () => {
    // UI audit 2026-11-13: "Turn off tips" took a 33px finger. Half of 44px reaches above and below the middle.
    const coarse = css().match(/@media \(pointer: coarse\) \{(.*?)\}\s*\}/)?.[1] ?? '';
    expect(coarse).toMatch(/\.btn::before, \.link::before \{[^}]*inset: min\(-6px, calc\(50% - 22px\)\) -2px/);
    expect(css()).toMatch(/\.link \{[^}]*position: relative|button \{[^}]*position: relative/);
  });
});
