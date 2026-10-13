import { FB_ICONS, FIELD_ICONS, GROUP_ICON, REPEAT_ICON, STATIC_ICONS } from './builder-icons';

describe('form builder icons', () => {
  // The icon component only draws <path> elements, so an icon made of <circle>s
  // or <rect>s renders blank (or half-drawn) without any error.
  it('only uses icons the icon component can draw', () => {
    const all = { ...FB_ICONS, ...FIELD_ICONS, ...STATIC_ICONS, GROUP_ICON, REPEAT_ICON };
    const broken = Object.entries(all)
      .filter(([, icon]) => (icon as readonly (readonly [string, unknown])[]).some(([tag]) => tag !== 'path'))
      .map(([name]) => name);
    expect(broken).toEqual([]);
  });
});
