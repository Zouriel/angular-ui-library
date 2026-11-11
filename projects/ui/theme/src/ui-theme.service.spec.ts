import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { TestBed } from '@angular/core/testing';
import { UI_CURRENT_THEMES, UI_LEGACY_THEMES, UiThemeService, isLegacyTheme } from './ui-theme.service';

/** Every theme name a library stylesheet defines a [data-theme="…"] block for. */
function stylesheetThemes(): string[] {
  const dir = join(process.cwd(), 'projects/ui/styles');
  const names = new Set<string>();
  for (const file of readdirSync(dir).filter((f) => /^(tokens|theme-[\w-]+)\.css$/.test(f) && f !== 'theme-animations.css')) {
    const text = readFileSync(join(dir, file), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
    for (const m of text.matchAll(/\[data-theme="([\w-]+)"\]/g)) names.add(m[1]);
  }
  return [...names].sort();
}

describe('UiThemeService', () => {
  let service: UiThemeService;
  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(UiThemeService);
  });

  it('defaults to dark (Navy Dark) and writes data-theme on <html>', () => {
    expect(service.theme()).toBe('dark');
    TestBed.tick();
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    service.set('glacier');
    TestBed.tick();
    expect(document.documentElement.getAttribute('data-theme')).toBe('glacier');
  });

  for (const day of ['navy', 'maldives', 'rugged', 'glacier', 'oxblood', 'graphite', 'cocoa', 'violet']) {
    it(`toggles ${day} <-> ${day}-dark`, () => {
      service.set(day);
      service.toggle();
      expect(service.theme()).toBe(`${day}-dark`);
      service.toggle();
      expect(service.theme()).toBe(day);
    });
  }

  it('flips dark and light, and the deprecated Winter names', () => {
    service.set('dark');
    service.toggle();
    expect(service.theme()).toBe('light');
    service.toggle();
    expect(service.theme()).toBe('dark');
    service.set('winterLight');
    service.toggle();
    expect(service.theme()).toBe('winterDark');
    service.toggle();
    expect(service.theme()).toBe('winterLight');
  });

  it('goes to dark from a theme with no pair (a legacy skin, an app theme, an unknown -dark name)', () => {
    for (const t of ['lightTeal', 'darkOrange', 'my-brand', 'brand-dark']) {
      service.set(t);
      service.toggle();
      expect(service.theme(), t).toBe('dark');
    }
  });
});

describe('theme roster', () => {
  it('splits every built-in theme into current and legacy, with none in both', () => {
    const current = [...UI_CURRENT_THEMES];
    const legacy = [...UI_LEGACY_THEMES];
    expect(current.filter((t) => (legacy as string[]).includes(t))).toEqual([]);
    expect([...current, ...legacy].sort()).toEqual(stylesheetThemes());
    expect(current.length + legacy.length).toBe(31);
  });

  it('names exactly the old palette skins and the Winter aliases as legacy', () => {
    expect([...UI_LEGACY_THEMES].sort()).toEqual(
      ['darkPink', 'darkPurple', 'darkTeal', 'goldBlack', 'goldRed', 'lightOrange', 'lightPink', 'lightPurple', 'lightPurpleGold', 'lightTeal', 'winterDark', 'winterLight'].sort(),
    );
    expect([...UI_CURRENT_THEMES].slice(0, 4)).toEqual(['dark', 'light', 'navy', 'navy-dark']);
    for (const t of UI_LEGACY_THEMES) expect(isLegacyTheme(t)).toBe(true);
    for (const t of UI_CURRENT_THEMES) expect(isLegacyTheme(t)).toBe(false);
    expect(isLegacyTheme('my-brand')).toBe(false);
  });

  it('pairs every liquid day theme with a -dark twin', () => {
    for (const day of ['rugged', 'glacier', 'oxblood', 'graphite', 'cocoa', 'violet']) {
      expect(UI_CURRENT_THEMES).toContain(day);
      expect(UI_CURRENT_THEMES).toContain(`${day}-dark`);
    }
  });
});
