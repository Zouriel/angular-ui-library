import { describe, expect, it } from 'vitest';
import { UiWorkflowStateBadge } from './runtime';
import { WF_SHARED_STYLES } from './styles';

const css = (c: unknown) => (c as { ɵcmp: { styles: string[] } }).ɵcmp.styles.join('\n');

describe('workflow look', () => {
  it('text links are as wide as their text (never stretched and centred in a column) and 24px tall to hit', () => {
    const link = /\.wf-link\s*\{([^}]*)\}/.exec(WF_SHARED_STYLES)?.[1] ?? '';
    expect(link).toMatch(/width:\s*fit-content/);
    expect(link).toMatch(/min-height:\s*24px/);
  });

  it('has no native select styling left: every dropdown is a ui-select', () => {
    expect(WF_SHARED_STYLES).not.toContain('.wf-select');
  });

  it('the state badge has ui-badge metrics, and neutral is not drawn in the secondary text colour (primary on light themes)', () => {
    const s = css(UiWorkflowStateBadge);
    expect(s).toMatch(/\.badge[^{]*\{[^}]*height:\s*20px[^}]*padding:\s*0 var\(--ui-space-2\)[^}]*border-radius:\s*var\(--ui-radius-pill\)/);
    expect(s).toMatch(/\[data-tone="?neutral"?\][^{]*\{\s*--wf-c:\s*var\(--ui-color-text-muted\)/);
  });
});
