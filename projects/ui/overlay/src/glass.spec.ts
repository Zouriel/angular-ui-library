import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = join(process.cwd(), 'projects/ui');
const read = (f: string) => readFileSync(join(root, f), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\s+/g, ' ');

/**
 * Floating panels open over arbitrary content, usually text. The blur isn't drawn everywhere (no GPU,
 * some WebViews) and the 6% glass tint let the page's text print straight through menus. They use the
 * glass panel recipe, mostly opaque, so they stay readable with or without the blur.
 */
describe('glass on floating panels', () => {
  const panels = ['overlay/src/menu.ts', 'overlay/src/popover.ts', 'overlay/src/context-menu.ts',
    'command-palette/src/command-palette.ts', 'dialog/src/modal.ts', 'dialog/src/drawer.ts'];

  it('every floating panel uses --ui-glass-panel-bg, not the thin --ui-glass-bg', () => {
    for (const f of panels) {
      const glass = read(f).match(/\.glass \{[^}]*\}/)?.[0] ?? '';
      expect(glass, f).toContain('var(--ui-glass-panel-bg)');
      expect(glass, f).not.toContain('var(--ui-glass-bg)');
    }
  });

  it('the panel recipe is at least 85% the raised surface, in every theme', () => {
    const tokens = read('styles/tokens.css');
    const m = tokens.match(/--ui-glass-panel-bg: color-mix\(in srgb, var\(--ui-color-surface-raised\) (\d+)%, transparent\);/);
    expect(m).not.toBeNull();
    expect(+m![1]).toBeGreaterThanOrEqual(85);
    // Declared on every [data-theme], so a theme island mixes its own surface.
    expect(tokens).toMatch(/:root, \[data-theme\] \{[^}]*--ui-glass-panel-bg:/);
    // No theme overrides it with something thinner.
    for (const f of ['styles/theme-palettes.css', 'styles/theme-dark-orange.css']) expect(read(f)).not.toContain('--ui-glass-panel-bg');
  });

  it('glass inside a theme island uses the panel recipe, since the ground behind is another theme', () => {
    expect(read('styles/tokens.css')).toMatch(/\[data-theme\] \[data-theme\] \{ --ui-glass-bg: var\(--ui-glass-panel-bg\); \}/);
  });
});
