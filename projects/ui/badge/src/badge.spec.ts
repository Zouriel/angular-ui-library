import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { UiBadge } from './badge';

/** The component's own CSS: jsdom doesn't lay out or cascade, so a look is asserted from the rule itself. */
const css = () => ((UiBadge as unknown as { ɵcmp: { styles: string[] } }).ɵcmp.styles ?? []).join('\n');
const rule = (tone: string) => css().match(new RegExp(`\\.ui-badge\\[data-tone=["']?${tone}["']?\\][^{]*\\{([^}]*)\\}`))?.[1] ?? '';

function pill(inputs: Record<string, unknown>) {
  const fixture = TestBed.createComponent(UiBadge);
  for (const [k, v] of Object.entries(inputs)) fixture.componentRef.setInput(k, v);
  fixture.detectChanges();
  return (fixture.nativeElement as HTMLElement).querySelector('.ui-badge')!;
}

describe('UiBadge tier', () => {
  it('leaves a badge without a tier on its tone', () => {
    expect(pill({}).getAttribute('data-tone')).toBe('neutral');
    expect(pill({ tone: 'success' }).getAttribute('data-tone')).toBe('success');
  });

  it('draws the tier, and it wins over the tone', () => {
    expect(pill({ tier: 'gold' }).getAttribute('data-tone')).toBe('gold');
    expect(pill({ tier: 'platinum', tone: 'success' }).getAttribute('data-tone')).toBe('platinum');
    expect(pill({ tier: null, tone: 'danger' }).getAttribute('data-tone')).toBe('danger');
  });

  it('takes each metal from its own tokens', () => {
    for (const tier of ['gold', 'platinum']) {
      const r = rule(tier);
      expect(r).toContain(`var(--ui-gradient-tier-${tier})`);
      expect(r).toContain(`var(--ui-tier-${tier}-contrast)`);
      expect(r).toContain(`var(--ui-tier-${tier}-border)`);
    }
  });
});
