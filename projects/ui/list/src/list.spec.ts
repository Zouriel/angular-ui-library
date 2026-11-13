import { describe, expect, it } from 'vitest';
import { UiListItem } from './list';

/**
 * Row heights (2026-11-13 UI audit): the trailing slot was a block, so a chevron in it sat on a text line box
 * and its descender space made those rows 4px taller than rows with only a leading icon or none (38 / 35 / 34px
 * in one settings list). Both slots are flex boxes now. The measured heights are checked in a real browser
 * (jsdom has no layout); this pins the rule that makes them equal.
 */
describe('UiListItem slots', () => {
  const css = (UiListItem as unknown as { ɵcmp: { styles: string[] } }).ɵcmp.styles.join('').replace(/\s+/g, ' ');
  const rule = (sel: string) => css.match(new RegExp(`(?:^|\\} )\\.${sel}\\[[^\\]]*\\] \\{([^}]*)\\}`))?.[1] ?? '';

  it('lays the trailing slot out as a flex box, like the leading one', () => {
    expect(rule('trail')).toMatch(/display: inline-flex/);
    expect(rule('trail')).toMatch(/align-items: center/);
    expect(rule('lead')).toMatch(/display: inline-flex/);
  });

  it('still hides an empty slot', () => {
    expect(css).toMatch(/\.lead\[[^\]]*\]:empty, \.trail\[[^\]]*\]:empty \{ display: none; \}/);
  });
});
