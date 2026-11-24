import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { UiStringsService, uiStringsDv } from '@zouriel/ui';
import type { UiLanguage } from '@zouriel/ui/navigation';
import { UiAssistanceBar } from './assistance-bar';
import { provideUiAssistance, UiAssistanceService, type UiAssistanceStorage } from './assistance.service';
import { UiReadAloud } from './read-aloud.directive';
import { provideUiReadAloud, UiReadAloudService, type UiReadAloudEngine } from './read-aloud.service';

describe('UiAssistanceService', () => {
  afterEach(() => {
    document.documentElement.removeAttribute('data-text-size');
    try { globalThis.localStorage?.clear?.(); } catch {}
    TestBed.resetTestingModule();
  });

  it('cycles textSize, sets data-text-size on <html>, and persists via custom storage', () => {
    const store = new Map<string, string>();
    const storage: UiAssistanceStorage = {
      get: (k) => store.get(k) ?? null,
      set: (k, v) => store.set(k, v),
    };
    TestBed.configureTestingModule({ providers: [provideUiAssistance({ storage })] });
    const svc = TestBed.inject(UiAssistanceService);

    expect(svc.textSize()).toBe('default');
    expect(document.documentElement.hasAttribute('data-text-size')).toBe(false);

    svc.cycleTextSize();
    expect(svc.textSize()).toBe('large');
    expect(document.documentElement.getAttribute('data-text-size')).toBe('large');
    expect(store.get('ui-assistance-text-size')).toBe('large');

    svc.cycleTextSize();
    expect(svc.textSize()).toBe('larger');
    expect(document.documentElement.getAttribute('data-text-size')).toBe('larger');

    svc.cycleTextSize();
    expect(svc.textSize()).toBe('default');
    expect(document.documentElement.hasAttribute('data-text-size')).toBe(false);
  });

  it('serializes and restores textSize via toQueryParams / fromQueryParams', () => {
    const svc = TestBed.inject(UiAssistanceService);
    expect(svc.toQueryParams()).toEqual({});

    svc.fromQueryParams('?textSize=larger&other=1');
    expect(svc.textSize()).toBe('larger');
    expect(document.documentElement.getAttribute('data-text-size')).toBe('larger');
    expect(svc.toQueryParams()).toEqual({ textSize: 'larger' });

    svc.fromQueryParams(new URLSearchParams('textSize=default'));
    expect(svc.textSize()).toBe('default');
    expect(document.documentElement.hasAttribute('data-text-size')).toBe(false);
  });
});

describe('UiReadAloudService & [uiReadAloud]', () => {
  it('speaks readable text skipping aria-hidden and nav without mutating the DOM', () => {
    const spoken: { text: string; lang?: string }[] = [];
    const engine: UiReadAloudEngine = {
      supported: true,
      canSpeak: (lang) => lang !== 'dv',
      speak: (text, lang, cb) => {
        spoken.push({ text, lang });
        // keep speaking until stopped or ended
        void cb;
      },
      pause: vi.fn(),
      resume: vi.fn(),
      stop: vi.fn(),
    };

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [provideUiReadAloud({ engine })] });

    @Component({
      imports: [UiReadAloud],
      template: `
        <div #box id="box">
          <nav>Skip nav</nav>
          <p>Hello world.</p>
          <span aria-hidden="true">Hidden text</span>
          <p>Second line.</p>
        </div>
        <button type="button" uiReadAloud [for]="box">Read</button>
      `,
    })
    class ReadHost {}

    const f = TestBed.createComponent(ReadHost);
    f.detectChanges();
    const svc = TestBed.inject(UiReadAloudService);
    const btn = f.nativeElement.querySelector('button') as HTMLButtonElement;
    const boxHtmlBefore = f.nativeElement.querySelector('#box')!.innerHTML;

    expect(svc.canSpeak('en')).toBe(true);
    expect(svc.canSpeak('dv')).toBe(false);

    btn.click();
    f.detectChanges();
    expect(svc.speaking()).toBe(true);
    expect(btn.getAttribute('aria-pressed')).toBe('true');
    expect(spoken).toEqual([{ text: 'Hello world. Second line.', lang: undefined }]);
    expect(f.nativeElement.querySelector('#box')!.innerHTML).toBe(boxHtmlBefore);

    btn.click();
    f.detectChanges();
    expect(svc.speaking()).toBe(false);
    expect(btn.getAttribute('aria-pressed')).toBe('false');
  });
});

describe('UiAssistanceBar', () => {
  const LANGS: UiLanguage[] = [
    { code: 'en', label: 'English', dir: 'ltr', strings: {} },
    { code: 'dv', label: 'ދިވެހި', dir: 'rtl', strings: uiStringsDv },
  ];

  afterEach(() => {
    document.documentElement.removeAttribute('data-text-size');
    document.documentElement.removeAttribute('dir');
    document.documentElement.removeAttribute('lang');
    TestBed.inject(UiStringsService).set({});
    try { globalThis.localStorage?.clear?.(); } catch {}
    TestBed.resetTestingModule();
  });

  it('renders toolbar with arrow-key navigation, cycles text size, hides readAloud for dv, and emits help/languageChange', () => {
    const engine: UiReadAloudEngine = {
      supported: true,
      canSpeak: (lang) => !lang?.startsWith('dv'),
      speak: vi.fn(),
      pause: vi.fn(),
      resume: vi.fn(),
      stop: vi.fn(),
    };

    @Component({
      imports: [UiAssistanceBar],
      template: `
        <main><p>Main content</p></main>
        <ui-assistance-bar [languages]="langs" (help)="helped = true" (languageChange)="lastLang = $event" />
      `,
    })
    class BarHost {
      langs = LANGS;
      helped = false;
      lastLang = '';
    }

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [provideUiReadAloud({ engine })] });
    document.documentElement.setAttribute('lang', 'en');
    const f = TestBed.createComponent(BarHost);
    f.detectChanges();
    const el = f.nativeElement as HTMLElement;

    const toolbar = el.querySelector('[role="toolbar"]')!;
    expect(toolbar).not.toBeNull();

    const textBtn = el.querySelector('button[data-ctrl="textSize"]') as HTMLButtonElement;
    expect(textBtn.getAttribute('aria-pressed')).toBe('false');
    expect(textBtn.textContent).toContain('Default');

    textBtn.click();
    f.detectChanges();
    expect(textBtn.getAttribute('aria-pressed')).toBe('true');
    expect(textBtn.textContent).toContain('Large');
    expect(document.documentElement.getAttribute('data-text-size')).toBe('large');

    // Read aloud is visible for 'en'
    expect(el.querySelector('button[data-ctrl="readAloud"]')).not.toBeNull();

    // Arrow key movement in toolbar
    textBtn.focus();
    toolbar.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    expect(document.activeElement).not.toBe(textBtn);

    // Help output
    const helpBtn = el.querySelector('button[data-ctrl="help"]') as HTMLButtonElement;
    helpBtn.click();
    expect(f.componentInstance.helped).toBe(true);

    // Switch language to 'dv' -> hides readAloud and emits languageChange
    const dvBtn = el.querySelector('ui-language-switch button[lang="dv"]') as HTMLButtonElement;
    dvBtn.click();
    f.detectChanges();
    expect(f.componentInstance.lastLang).toBe('dv');
    expect(el.querySelector('button[data-ctrl="readAloud"]')).toBeNull();
  });
});
