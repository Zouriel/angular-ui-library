import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { beforeEach, describe, expect, it } from 'vitest';
import { App } from './app';
import { NAV } from './app.routes';
import { UiStringsService } from '@zouriel/ui';

describe('App shell', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [provideRouter([])],
    }).compileComponents();
  });

  it('offers a skip link to the main landmark first', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    const first = el.querySelector('a');
    expect(first?.textContent?.trim()).toBe('Skip to content');
    expect(el.querySelector('main#main')).toBeTruthy();
  });

  it('lists every page in the sidebar', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const labels = [...(fixture.nativeElement as HTMLElement).querySelectorAll('.sidebar .item .label')].map((e) => e.textContent?.trim());
    expect(labels).toEqual(NAV.flatMap((g) => g.items.map((i) => i.label)));
  });

  it('the RTL · ދިވެހި switch flips the page right to left with Dhivehi words, live, and back', async () => {
    try { localStorage?.removeItem('ui-showcase-language'); } catch { /* none */ }
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    const toggle = el.querySelector('.lang-toggle button') as HTMLButtonElement;
    expect(document.documentElement.getAttribute('dir')).toBe('ltr');
    toggle.click();
    await fixture.whenStable();
    expect(document.documentElement.getAttribute('dir')).toBe('rtl');
    expect(document.documentElement.getAttribute('lang')).toBe('dv');
    expect(TestBed.inject(UiStringsService).strings().close).toBe('ބަންދުކުރޭ');
    expect(toggle.getAttribute('aria-pressed')).toBe('true');
    toggle.click();
    await fixture.whenStable();
    expect(document.documentElement.getAttribute('dir')).toBe('ltr');
    expect(TestBed.inject(UiStringsService).strings().close).toBe('Close');
  });
});
