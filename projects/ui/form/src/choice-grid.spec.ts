import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { UiChoiceGrid, type UiChoice } from './choice-grid';
import { UiAnchorPicker, type UiAnchor } from './anchor-picker';

@Component({
  imports: [UiChoiceGrid, UiAnchorPicker],
  template: `
    <ui-choice-grid [options]="options" [(value)]="value" (picked)="picks.push($event.value)">
      <ng-template #tile let-item let-selected="selected"><i class="pic">{{ item.value }}{{ selected ? '*' : '' }}</i></ng-template>
    </ui-choice-grid>
    <ui-anchor-picker [(value)]="anchor" />
  `,
})
class Host {
  options: UiChoice[] = [
    { value: 'fade', label: 'Fade', group: 'Basic' },
    { value: 'rise', label: 'Rise', group: 'Basic' },
    { value: 'drop', label: 'Drop', group: 'Bounce', disabled: true },
    { value: 'bounce', label: 'Bounce', group: 'Bounce', description: 'Playful' },
  ];
  value = signal<string | null>('rise');
  anchor = signal<UiAnchor | null>({ x: 0.5, y: 0.5 });
  picks: string[] = [];
}

describe('UiChoiceGrid', () => {
  function render() {
    const f = TestBed.createComponent(Host);
    f.detectChanges();
    const tiles = () => Array.from(f.nativeElement.querySelectorAll('ui-choice-grid [role=radio]')) as HTMLButtonElement[];
    return { f, tiles };
  }

  it('groups tiles under headings and draws the projected tile', () => {
    const { f, tiles } = render();
    const headings = Array.from(f.nativeElement.querySelectorAll('.heading')).map((h) => (h as HTMLElement).textContent);
    expect(headings).toEqual(['Basic', 'Bounce']);
    expect(tiles()[1].querySelector('.pic')?.textContent).toBe('rise*');
    expect(tiles()[3].textContent).toContain('Playful');
  });

  it('has one tab stop, on the chosen tile', () => {
    const { tiles } = render();
    expect(tiles().map((t) => t.tabIndex)).toEqual([-1, 0, -1, -1]);
    expect(tiles()[1].getAttribute('aria-checked')).toBe('true');
  });

  it('chooses on click, and reports every pick', () => {
    const { f, tiles } = render();
    tiles()[0].click();
    tiles()[0].click();
    expect(f.componentInstance.value()).toBe('fade');
    expect(f.componentInstance.picks).toEqual(['fade', 'fade']);
  });

  it('skips disabled tiles with the arrow keys', () => {
    const { f, tiles } = render();
    tiles()[1].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }));
    f.detectChanges();
    expect(f.componentInstance.value()).toBe('bounce');
  });
});

@Component({
  imports: [UiChoiceGrid],
  template: `<ui-choice-grid [options]="scale" [(value)]="value" [align]="align()" label="Satisfaction" />`,
})
class ScaleHost {
  scale: UiChoice[] = [
    { value: '5', label: 'Very satisfied', tone: 'success' },
    { value: '4', label: 'Satisfied', tone: 'info' },
    { value: '3', label: 'Neutral', tone: 'neutral' },
    { value: '2', label: 'Dissatisfied', tone: 'warning' },
    { value: '1', label: 'Very dissatisfied', tone: 'danger', description: 'Tell us why' },
    { value: 'x', label: 'Plain' },
  ];
  value = signal<string | null>('4');
  align = signal<'start' | 'center'>('center');
}

describe('UiChoiceGrid align and tone', () => {
  const styles = () => ((UiChoiceGrid as unknown as { ɵcmp: { styles: string[] } }).ɵcmp.styles ?? []).join('\n');
  function render() {
    const f = TestBed.createComponent(ScaleHost);
    f.detectChanges();
    const tiles = () => Array.from(f.nativeElement.querySelectorAll('[role=radio]')) as HTMLButtonElement[];
    return { f, tiles };
  }

  it('centres compact tiles across and down when align is center, and only then', () => {
    const { f, tiles } = render();
    expect(tiles().every((t) => t.classList.contains('center'))).toBe(true);
    const rule = styles().match(/\.tile\.compact\.center[^{]*\{([^}]*)\}/)?.[1] ?? '';
    expect(rule).toContain('align-items: center');
    expect(rule).toContain('justify-content: center');
    expect(rule).toContain('text-align: center');
    f.componentInstance.align.set('start');
    f.detectChanges();
    expect(tiles().some((t) => t.classList.contains('center'))).toBe(false);
  });

  it('marks each toned tile with its tone and a tick badge; an untoned tile stays as it was', () => {
    const { tiles } = render();
    expect(tiles().map((t) => t.dataset['tone'] ?? null)).toEqual(['success', 'info', 'neutral', 'warning', 'danger', null]);
    expect(tiles().map((t) => !!t.querySelector('.check'))).toEqual([true, true, true, true, true, false]);
    expect(tiles()[5].classList.contains('toned')).toBe(false);
    expect(tiles()[0].querySelector('.check')?.getAttribute('aria-hidden')).toBe('true');
    expect(tiles()[1].classList.contains('on')).toBe(true);
    expect(tiles()[1].textContent?.trim()).toBe('Satisfied');
  });

  it('gives every tone its own colour, ink and subtle fill, and shows the tick only when chosen', () => {
    const css = styles();
    for (const [tone, color, ink] of [
      ['primary', 'primary', 'primary-contrast'],
      ['success', 'success', 'success-contrast'],
      ['info', 'info', 'info-contrast'],
      ['warning', 'warning', 'warning-contrast'],
      ['danger', 'danger', 'danger-contrast'],
      ['neutral', 'text-muted', 'surface'],
    ]) {
      const rule = css.match(new RegExp(`\\.tile\\[data-tone=['"]?${tone}['"]?\\][^{]*\\{([^}]*)\\}`))?.[1] ?? '';
      expect(rule, tone).toContain(`--ui-choice-tone: var(--ui-color-${color})`);
      expect(rule, tone).toContain(`--ui-choice-ink: var(--ui-color-${ink})`);
      expect(rule, tone).toContain('--ui-choice-subtle:');
    }
    // At rest a toned tile is tinted, not plain surface; chosen it takes the tone's edge and subtle fill.
    expect(css.match(/\.tile\.toned[^{:.]*\{([^}]*)\}/)?.[1]).toContain('color-mix(in srgb, var(--ui-choice-tone) 5%, var(--ui-color-surface))');
    expect(css).toMatch(/\.tile\.toned\.on[^{]*\{[^}]*border-color: var\(--ui-choice-tone\)[^}]*background: var\(--ui-choice-subtle\)/);
    expect(css.match(/\.check[^{]*\{([^}]*)\}/)?.[1]).toContain('opacity: 0');
    // The tick follows the badge's ink, not a theme's icon colour (liquid themes set --ui-color-icon).
    expect(css.match(/\.check[^{]*\{([^}]*)\}/)?.[1]).toContain('--ui-color-icon: currentColor');
    // The description leans a quarter toward the ink on a toned tile, so it holds 4.5:1 on the washes.
    expect(css.match(/\.tile\.toned \.desc[^{]*\{([^}]*)\}/)?.[1] ?? css.match(/\.tile\.toned[^{,]*\.desc[^{]*\{([^}]*)\}/)?.[1]).toContain('color-mix(in srgb, var(--ui-color-text-muted) 75%, var(--ui-color-text))');
    expect(css.match(/\.tile\.on[^{,]*\.check[^{]*\{([^}]*)\}/)?.[1]).toContain('opacity: 1');
  });

  it('still chooses toned tiles with the keyboard', () => {
    const { f, tiles } = render();
    tiles()[1].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }));
    f.detectChanges();
    expect(f.componentInstance.value()).toBe('3');
    expect(tiles()[2].classList.contains('on')).toBe(true);
  });
});

describe('UiAnchorPicker', () => {
  it('names each dot and moves the point with arrow keys', () => {
    const f = TestBed.createComponent(Host);
    f.detectChanges();
    const dots = Array.from(f.nativeElement.querySelectorAll('ui-anchor-picker [role=radio]')) as HTMLButtonElement[];
    expect(dots.length).toBe(9);
    expect(dots[4].getAttribute('aria-checked')).toBe('true');
    expect(dots[1].getAttribute('aria-label')).toBe('Top');
    dots[4].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp' }));
    expect(f.componentInstance.anchor()).toEqual({ x: 0.5, y: 0 });
    dots[6].click();
    expect(f.componentInstance.anchor()).toEqual({ x: 0, y: 1 });
  });
});
