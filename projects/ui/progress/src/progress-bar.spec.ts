import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import type { UiStatus } from '@zouriel/ui';
import { UiProgressBar } from './progress-bar';

@Component({
  imports: [UiProgressBar],
  template: `<ui-progress-bar [value]="value()" [tone]="tone()" />`,
})
class Host {
  value = signal<number | null>(40);
  tone = signal<UiStatus>('neutral');
}

describe('UiProgressBar', () => {
  it('has a fill rule for every tone, so none silently falls back to primary', () => {
    // Read the source the same way the style-contract spec does (compiled styles are rewritten).
    const css = readFileSync(join(process.cwd(), 'projects/ui/progress/src/progress-bar.ts'), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '').replace(/\s+/g, ' ');
    for (const tone of ['neutral', 'success', 'warning', 'danger'] as UiStatus[]) {
      expect(css, tone).toMatch(new RegExp(`\\[data-tone="?${tone}"?\\][^{]*\\.fill[^{]*\\{[^}]*background`));
    }
    expect(css).toMatch(/\[data-tone="?neutral"?\][^{]*\.fill[^{]*\{[^}]*var\(--ui-progress-neutral\)/);
  });

  it('reflects tone and value on the progressbar', () => {
    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    const bar = (fixture.nativeElement as HTMLElement).querySelector('[role="progressbar"]')!;
    expect(bar.getAttribute('data-tone')).toBe('neutral');
    expect(bar.getAttribute('aria-valuenow')).toBe('40');
    fixture.componentInstance.value.set(null);
    fixture.detectChanges();
    expect(bar.hasAttribute('aria-valuenow')).toBe(false);
  });
});
