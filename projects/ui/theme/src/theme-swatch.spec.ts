import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { UiThemeSwatch, type UiThemeSwatchColors } from './theme-swatch';

@Component({
  imports: [UiThemeSwatch],
  template: `<ui-theme-swatch [colors]="colors" [accent]="accent()" [label]="label()" />`,
})
class Host {
  colors: UiThemeSwatchColors = { bg: 'rgb(1, 2, 3)', surface: 'rgb(4, 5, 6)', text: 'rgb(7, 8, 9)', muted: 'rgb(10, 11, 12)', accent: 'rgb(200, 0, 0)' };
  accent = signal<string | null>(null);
  label = signal<string | null>(null);
}

describe('UiThemeSwatch', () => {
  function render() {
    const f = TestBed.createComponent(Host);
    f.detectChanges();
    const el = f.nativeElement.querySelector('ui-theme-swatch') as HTMLElement;
    const v = (name: string) => el.style.getPropertyValue(name).trim();
    return { f, el, v, host: f.componentInstance };
  }

  it('paints with the given colours', () => {
    const { v } = render();
    expect(v('--ui-swatch-bg')).toBe('rgb(1, 2, 3)');
    expect(v('--ui-swatch-surface')).toBe('rgb(4, 5, 6)');
    expect(v('--ui-swatch-text')).toBe('rgb(7, 8, 9)');
    expect(v('--ui-swatch-muted')).toBe('rgb(10, 11, 12)');
    expect(v('--ui-swatch-accent')).toBe('rgb(200, 0, 0)');
  });

  it('lets accent replace the button colour', () => {
    const { f, v, host } = render();
    host.accent.set('rgb(0, 0, 200)');
    f.detectChanges();
    expect(v('--ui-swatch-accent')).toBe('rgb(0, 0, 200)');
  });

  it('is decorative unless labelled', () => {
    const { f, el, host } = render();
    expect(el.getAttribute('aria-hidden')).toBe('true');
    expect(el.getAttribute('role')).toBeNull();
    host.label.set('Oxblood');
    f.detectChanges();
    expect(el.getAttribute('aria-hidden')).toBeNull();
    expect(el.getAttribute('role')).toBe('img');
    expect(el.getAttribute('aria-label')).toBe('Oxblood');
  });
});
