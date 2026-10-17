import { WF_ICONS, WF_STEP_ICONS, WF_TRIGGER_ICONS } from './icons';

describe('workflow icons', () => {
  // The icon component only draws <path> elements; an icon made of <circle>s renders blank.
  it('only uses icons the icon component can draw', () => {
    const all = { ...WF_ICONS, ...WF_STEP_ICONS, ...WF_TRIGGER_ICONS };
    const broken = Object.entries(all)
      .filter(([, icon]) => (icon as unknown as readonly (readonly [string, unknown])[]).some(([tag]) => tag !== 'path'))
      .map(([name]) => name);
    expect(broken).toEqual([]);
  });
});
