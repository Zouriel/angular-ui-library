import { DOCUMENT } from '@angular/common';
import { Injectable, effect, inject, signal, untracked } from '@angular/core';
import { UiDirectionService, UiStringsService, uiStringsDv } from '@zouriel/ui';
import { UiThemeService } from '@zouriel/ui/theme';

export type ShowcaseLanguage = 'en' | 'dv';

/**
 * The showcase's RTL / Dhivehi switch (0.46.0): Dhivehi flips the whole page right to left
 * (`<html dir="rtl" lang="dv">`, through UiDirectionService) and switches the library's built-in words
 * to `uiStringsDv`, at runtime, the way an app's language toggle does. Remembered in this browser;
 * `?lang=dv` or `?lang=en` in the URL wins (screenshots and audits use it).
 */
@Injectable({ providedIn: 'root' })
export class ShowcaseLanguageService {
  private static readonly KEY = 'ui-showcase-language';
  private readonly dir = inject(UiDirectionService);
  private readonly strings = inject(UiStringsService);
  private readonly doc = inject(DOCUMENT);
  readonly language = signal<ShowcaseLanguage>(this.initial());

  private readonly theme = inject(UiThemeService);

  constructor() {
    this.apply(this.language());
    // Each theme has its own font: put the Thaana fonts in front of it again after a theme change.
    effect(() => {
      this.theme.theme();
      untracked(() => setTimeout(() => this.applyFont(this.language())));
    });
  }

  set(lang: ShowcaseLanguage): void {
    this.language.set(lang);
    this.apply(lang);
    try { localStorage.setItem(ShowcaseLanguageService.KEY, lang); } catch { /* storage blocked: still applies for this visit */ }
  }

  toggle(): void {
    this.set(this.language() === 'dv' ? 'en' : 'dv');
  }

  private apply(lang: ShowcaseLanguage): void {
    this.dir.set(lang === 'dv' ? 'rtl' : 'ltr', lang);
    this.strings.set(lang === 'dv' ? uiStringsDv : {});
    this.applyFont(lang);
  }

  /** Thaana in an app font first (Faruma when the device has it), then the theme's own font for Latin:
   *  what an app does by setting --ui-font-default (README, "Right to left and Dhivehi"). */
  private applyFont(lang: ShowcaseLanguage): void {
    const html = this.doc.documentElement;
    html.style.removeProperty('--ui-font-default');
    html.style.removeProperty('--ui-font-display');
    if (lang !== 'dv' || typeof getComputedStyle === 'undefined') return;
    const css = getComputedStyle(html);
    const thaana = "Faruma, 'MV Faruma', 'Noto Sans Thaana'";
    html.style.setProperty('--ui-font-default', `${thaana}, ${css.getPropertyValue('--ui-font-default').trim() || 'system-ui, sans-serif'}`);
    html.style.setProperty('--ui-font-display', `${thaana}, ${css.getPropertyValue('--ui-font-display').trim() || 'system-ui, sans-serif'}`);
  }

  private initial(): ShowcaseLanguage {
    const fromUrl = new URLSearchParams(this.doc.defaultView?.location.search ?? '').get('lang');
    if (fromUrl === 'dv' || fromUrl === 'en') return fromUrl;
    try {
      if (localStorage.getItem(ShowcaseLanguageService.KEY) === 'dv') return 'dv';
    } catch { /* no storage */ }
    return 'en';
  }
}
