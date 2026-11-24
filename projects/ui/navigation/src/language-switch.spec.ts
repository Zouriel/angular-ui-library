import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it } from 'vitest';
import { UiDirectionService, UiStringsService, uiStringsDv } from '@zouriel/ui';
import { UiLanguageSwitch, type UiLanguage } from './language-switch';

const LANGS: UiLanguage[] = [
  { code: 'en', label: 'English', dir: 'ltr', strings: {} },
  { code: 'dv', label: 'ދިވެހި', dir: 'rtl', strings: uiStringsDv },
];

@Component({
  imports: [UiLanguageSwitch],
  template: `<ui-language-switch [languages]="langs" [(value)]="value" [appearance]="appearance()" />`,
})
class SwitchHost {
  langs = LANGS;
  value = signal('en');
  appearance = signal<'link' | 'segmented' | 'menu'>('link');
}

describe('UiLanguageSwitch', () => {
  afterEach(() => {
    document.documentElement.removeAttribute('dir');
    document.documentElement.removeAttribute('lang');
    TestBed.inject(UiStringsService).set({});
  });

  it('renders each option with its own lang attribute and switches direction + strings on click (link appearance)', () => {
    const f = TestBed.createComponent(SwitchHost);
    f.detectChanges();
    const el = f.nativeElement as HTMLElement;
    const dir = TestBed.inject(UiDirectionService);
    const strings = TestBed.inject(UiStringsService);

    const buttons = Array.from(el.querySelectorAll('button.link-opt')) as HTMLButtonElement[];
    expect(buttons.length).toBe(2);
    expect(buttons[0].getAttribute('lang')).toBe('en');
    expect(buttons[0].textContent?.trim()).toBe('English');
    expect(buttons[1].getAttribute('lang')).toBe('dv');
    expect(buttons[1].textContent?.trim()).toBe('ދިވެހި');

    buttons[1].click();
    f.detectChanges();

    expect(f.componentInstance.value()).toBe('dv');
    expect(document.documentElement.getAttribute('dir')).toBe('rtl');
    expect(document.documentElement.getAttribute('lang')).toBe('dv');
    expect(dir.dir()).toBe('rtl');
    expect(strings.strings().close).toBe(uiStringsDv.close);
  });

  it('supports segmented appearance with radiogroup semantics and arrow keys', () => {
    const f = TestBed.createComponent(SwitchHost);
    f.componentInstance.appearance.set('segmented');
    f.detectChanges();
    const el = f.nativeElement as HTMLElement;

    const group = el.querySelector('[role="radiogroup"]')!;
    expect(group).not.toBeNull();
    const radios = Array.from(el.querySelectorAll('[role="radio"]')) as HTMLButtonElement[];
    expect(radios.length).toBe(2);
    expect(radios[0].getAttribute('aria-checked')).toBe('true');
    expect(radios[1].getAttribute('lang')).toBe('dv');

    radios[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    f.detectChanges();
    expect(f.componentInstance.value()).toBe('dv');
    expect(radios[1].getAttribute('aria-checked')).toBe('true');
  });

  it('supports menu appearance with overlay options carrying lang attributes', () => {
    const f = TestBed.createComponent(SwitchHost);
    f.componentInstance.appearance.set('menu');
    f.detectChanges();
    const el = f.nativeElement as HTMLElement;

    const trigger = el.querySelector('button.menu-trigger') as HTMLButtonElement;
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    trigger.click();
    f.detectChanges();

    expect(trigger.getAttribute('aria-expanded')).toBe('true');
    const items = Array.from(document.querySelectorAll('.menu-panel [role="menuitemradio"]')) as HTMLButtonElement[];
    expect(items.length).toBe(2);
    expect(items[1].getAttribute('lang')).toBe('dv');

    items[1].click();
    f.detectChanges();
    expect(f.componentInstance.value()).toBe('dv');
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
  });
});
