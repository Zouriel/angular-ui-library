import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { UiAlert } from '../../alert/src/alert';
import { UiInput } from '../../form/src/input';
import { UiSelect } from '../../form/src/select';
import { UiGrid } from '../../layout/src/grid';
import { UiStack } from '../../layout/src/stack';

@Component({
  imports: [UiAlert, UiStack, UiGrid, UiInput, UiSelect],
  template: `
    <ui-alert tone="warning" [appearance]="alertApp()">Careful</ui-alert>
    <ui-stack [gap]="gap()"><div class="item">A</div></ui-stack>
    <ui-grid [gap]="gridGap()"><div class="item">B</div></ui-grid>
    <ui-input aria-label="Name" />
    <ui-select aria-label="Role" [options]="[]" />
  `,
})
class Host {
  alertApp = signal<'outline' | 'soft'>('soft');
  gap = signal<0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 10 | 12 | 20>(5);
  gridGap = signal<1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 10 | 12 | 20>(10);
}

const stylesOf = (c: unknown) => ((c as { ɵcmp: { styles: string[] } }).ɵcmp.styles ?? []).join('\n');

describe('addu tokens and component updates', () => {
  it('supports appearance="soft" on ui-alert', () => {
    const f = TestBed.createComponent(Host);
    f.detectChanges();
    const alert = (f.nativeElement as HTMLElement).querySelector('.ui-alert')!;
    expect(alert.getAttribute('data-appearance')).toBe('soft');
    expect(stylesOf(UiAlert)).toContain('var(--ui-color-warning-subtle)');
  });

  it('accepts gap 5, 7 and 10 on ui-stack and ui-grid', () => {
    const f = TestBed.createComponent(Host);
    f.detectChanges();
    const stack = (f.nativeElement as HTMLElement).querySelector('.ui-stack') as HTMLElement;
    const grid = (f.nativeElement as HTMLElement).querySelector('.ui-grid') as HTMLElement;
    expect(stack.style.gap).toContain('--ui-space-5');
    expect(grid.style.gap).toContain('--ui-space-10');

    f.componentInstance.gap.set(7);
    f.componentInstance.gridGap.set(7);
    f.detectChanges();
    expect(stack.style.gap).toContain('--ui-space-7');
    expect(grid.style.gap).toContain('--ui-space-7');
  });

  it('reads --ui-field-size, --ui-field-radius and --ui-control-border-width on input and select', () => {
    for (const cmp of [UiInput, UiSelect]) {
      const s = stylesOf(cmp);
      expect(s).toContain('var(--ui-field-size)');
      expect(s).toContain('var(--ui-field-radius)');
      expect(s).toContain('var(--ui-control-border-width)');
    }
  });

  it('defines [data-text-size="large"] and [data-text-size="larger"] in tokens.css with higher specificity than [data-theme]', () => {
    const tokens = readFileSync(join(process.cwd(), 'projects/ui/styles/tokens.css'), 'utf8');
    expect(tokens).toMatch(/\[data-theme\]\[data-text-size="large"\]/);
    expect(tokens).toMatch(/\[data-theme\]\[data-text-size="larger"\]/);
    expect(tokens).toContain('--ui-font-scale: 1.15;');
    expect(tokens).toContain('--ui-font-scale: 1.3;');
    expect(tokens).toContain('--ui-font-size-display-xl: calc(3.5rem * 1.15);');
    expect(tokens).not.toContain('data-contrast');
  });

  it('sets addu field size 48px, button radius pill, and compact density override', () => {
    const addu = readFileSync(join(process.cwd(), 'projects/ui/styles/theme-addu.css'), 'utf8');
    expect(addu).toContain('--ui-field-size: 48px;');
    expect(addu).toContain('--ui-button-radius: var(--ui-radius-pill);');
    expect(addu).toMatch(/\[data-theme="addu"\]\[data-density="compact"\][\s\S]*--ui-field-size:\s*44px;/);
  });
});
