import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { UiStatCard } from './stat-card';

@Component({
  imports: [UiStatCard],
  template: `<ui-stat-card
    label="Breaching in 48 hours"
    value="4"
    [tone]="tone()"
    [glass]="glass()"
  />`,
})
class Host {
  tone = signal<'default' | 'danger' | 'warning' | 'success' | 'info'>('default');
  glass = signal(false);
}

describe('UiStatCard tone', () => {
  const css = () =>
    ((UiStatCard as unknown as { ɵcmp: { styles: string[] } }).ɵcmp.styles ?? [])
      .join('\n')
      .replace(/\[_ng(?:host|content)-%COMP%\]/g, '');

  it('keeps the default card appearance and exposes the default tone', () => {
    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    const stat = fixture.nativeElement.querySelector('.stat') as HTMLElement;
    expect(stat.dataset['tone']).toBe('default');
    expect(stat.classList.contains('tone-danger')).toBe(false);
    expect(css()).toMatch(
      /\.stat\s*\{[^}]*background:\s*var\(--ui-color-surface\)[^}]*border:\s*1px solid var\(--ui-color-border\)/,
    );
  });

  it('applies each status tone class and its subtle fill/family border', () => {
    const fixture = TestBed.createComponent(Host);
    for (const tone of ['danger', 'warning', 'success', 'info'] as const) {
      fixture.componentInstance.tone.set(tone);
      fixture.detectChanges();
      const stat = fixture.nativeElement.querySelector('.stat') as HTMLElement;
      expect(stat.dataset['tone']).toBe(tone);
      expect(stat.classList.contains(`tone-${tone}`)).toBe(true);
      expect(css()).toMatch(
        new RegExp(
          `\\.stat\\[data-tone=${tone}\\][^}]*background: var\\(--ui-color-${tone}-subtle\\)`,
        ),
      );
      expect(css()).toMatch(
        new RegExp(`\\.stat\\[data-tone=${tone}\\][^}]*border-color: var\\(--ui-color-${tone}\\)`),
      );
    }
  });

  it('ignores tone styling when glass is enabled', () => {
    const fixture = TestBed.createComponent(Host);
    fixture.componentInstance.tone.set('danger');
    fixture.componentInstance.glass.set(true);
    fixture.detectChanges();
    expect(
      (fixture.nativeElement.querySelector('.stat') as HTMLElement).classList.contains('glass'),
    ).toBe(true);
    expect(css().indexOf('.stat.glass')).toBeGreaterThan(css().indexOf('.stat[data-tone=danger]'));
  });
});
