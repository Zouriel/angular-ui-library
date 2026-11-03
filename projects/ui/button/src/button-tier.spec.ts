import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { UiButton } from './button';

/* jsdom doesn't cascade custom properties or paint gradients, so the look is asserted from the
   component's own rules (ɵcmp.styles); the showcase audit measures it in a real browser. */
const css = () => ((UiButton as unknown as { ɵcmp: { styles: string[] } }).ɵcmp.styles ?? []).join('\n').replace(/\[_ngcontent-%COMP%\]/g, '').replace(/\s+/g, ' ');
const rules = (selector: string) =>
  [...css().matchAll(/([^{}]+)\{([^{}]*)\}/g)].filter((m) => m[1].trim() === unquote(selector)).map((m) => m[2]).join(';');
/** The compiler drops the quotes around attribute values in selectors. */
function unquote(selector: string) { return selector.replace(/="([\w-]+)"\]/g, '=$1]'); }

function button(inputs: Record<string, unknown>) {
  const fixture = TestBed.createComponent(UiButton);
  for (const [k, v] of Object.entries(inputs)) fixture.componentRef.setInput(k, v);
  fixture.detectChanges();
  return (fixture.nativeElement as HTMLElement).querySelector('button')!;
}

describe('UiButton tier', () => {
  it('marks the tier, and the tier wins over the variant', () => {
    const b = button({ tier: 'gold', variant: 'destructive' });
    expect(b.getAttribute('data-tier')).toBe('gold');
    expect(b.hasAttribute('data-variant')).toBe(false);
    const plain = button({ variant: 'secondary' });
    expect(plain.hasAttribute('data-tier')).toBe(false);
    expect(plain.getAttribute('data-variant')).toBe('secondary');
    expect(button({ tier: null }).getAttribute('data-variant')).toBe('primary');
  });

  it('takes each metal from its own tokens', () => {
    for (const tier of ['gold', 'platinum', 'premium']) {
      const r = rules(`.ui-btn[data-tier="${tier}"]`);
      expect(r, tier).toContain(`var(--ui-tier-${tier})`);
      expect(r, tier).toContain(`var(--ui-tier-${tier}-light)`);
      expect(r, tier).toContain(`var(--ui-tier-${tier}-border)`);
      expect(r, tier).toContain(`var(--ui-tier-${tier}-contrast)`);
      expect(r, tier).toContain(`var(--ui-gradient-tier-${tier})`);
    }
  });

  it('fills with the sheen, labels in the contrast colour and edges in the tier border', () => {
    const r = rules('.ui-btn[data-tier]');
    expect(r).toMatch(/background: var\(--_tier-sheen\)/);
    expect(r).toMatch(/color: var\(--_tier-on\)/);
    expect(r).toMatch(/border-color: var\(--_tier-edge\)/);
  });

  it('brightens toward the light stop on hover and darkens toward the base on press', () => {
    expect(rules('.ui-btn[data-tier]')).toMatch(/--_tier-hover: color-mix\(in srgb, var\(--_tier-light\) 35%, transparent\)/);
    expect(rules('.ui-btn[data-tier]')).toMatch(/--_tier-press: color-mix\(in srgb, var\(--_tier\) 45%, transparent\)/);
    expect(rules('.ui-btn[data-tier]:hover:not(:disabled)')).toContain('var(--_tier-hover)');
    expect(rules('.ui-btn[data-tier]:active:not(:disabled)')).toContain('var(--_tier-press)');
  });

  it('rings keyboard focus in the tier edge colour', () => {
    expect(rules('.ui-btn[data-tier]:focus-visible:not(:disabled)')).toContain('0 0 0 4px var(--_tier-edge)');
  });

  it('sweeps light across platinum on hover, but not under reduced motion', () => {
    expect(rules('.ui-btn[data-tier="platinum"]')).toContain('var(--_tier-band) 100% 0');
    expect(rules('.ui-btn[data-tier="platinum"]:hover:not(:disabled)')).toContain('var(--_tier-band) 0% 0');
    const reduced = css().match(/@media \(prefers-reduced-motion: reduce\) \{(.*?\})\s*\}/)?.[1] ?? '';
    expect(reduced).toContain(unquote('.ui-btn[data-tier="platinum"]:hover:not(:disabled)'));
    expect(reduced).not.toContain('--_tier-band');
    expect(reduced).toContain('transition: none');
    // Gold and premium don't sweep.
    expect(css()).not.toMatch(/data-tier=(gold|premium)\][^{]*\{[^}]*--_tier-band/);
  });

  it('is disabled like other buttons, and loading keeps the metal with a spinner in the label colour', () => {
    const off = button({ tier: 'premium', disabled: true });
    expect(off.disabled).toBe(true);
    expect(off.getAttribute('data-tier')).toBe('premium');
    expect(rules('.ui-btn:disabled')).toContain('opacity: 0.5');
    const busy = button({ tier: 'gold', loading: true });
    expect(busy.disabled).toBe(true);
    expect(busy.getAttribute('aria-busy')).toBe('true');
    expect(busy.querySelector('.spin')).not.toBeNull();
    expect(rules('.spin')).toContain('currentColor');
    expect(rules('.ui-btn[aria-busy="true"]')).toContain('opacity: 1');
  });

  it('keeps size and block with a tier', () => {
    const b = button({ tier: 'platinum', size: 'lg', block: true });
    expect(b.getAttribute('data-size')).toBe('lg');
    expect(b.classList.contains('block')).toBe(true);
  });
});
