import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { Injectable, InjectionToken, PLATFORM_ID, type Provider, inject, signal } from '@angular/core';

export type UiTextSize = 'default' | 'large' | 'larger';

export interface UiAssistanceStorage {
  get(key: string): string | null;
  set(key: string, value: string): void;
}

export interface UiAssistanceOptions {
  storage?: UiAssistanceStorage;
}

const TEXT_SIZE_KEY = 'ui-assistance-text-size';
const TEXT_SIZES: readonly UiTextSize[] = ['default', 'large', 'larger'];

function isTextSize(v: string | null | undefined): v is UiTextSize {
  return v === 'default' || v === 'large' || v === 'larger';
}

function defaultStorage(): UiAssistanceStorage {
  return {
    get(key: string): string | null {
      try {
        return typeof localStorage !== 'undefined' ? localStorage.getItem(key) : null;
      } catch {
        return null;
      }
    },
    set(key: string, value: string): void {
      try {
        if (typeof localStorage !== 'undefined') localStorage.setItem(key, value);
      } catch {
        // Ignore storage errors (private browsing, quota, SSR)
      }
    },
  };
}

export const UI_ASSISTANCE_STORAGE = new InjectionToken<UiAssistanceStorage>('UI_ASSISTANCE_STORAGE');

/**
 * Configures persistence for {@link UiAssistanceService}. Defaults to `localStorage` wrapped in try/catch.
 */
export function provideUiAssistance(options: UiAssistanceOptions): Provider {
  return options.storage ? [{ provide: UI_ASSISTANCE_STORAGE, useValue: options.storage }] : [];
}

/**
 * Holds the user's text-size preference (`default | large | larger`), persists it via the configured
 * storage adapter, and applies `data-text-size` on `<html>`.
 */
@Injectable({ providedIn: 'root' })
export class UiAssistanceService {
  private readonly doc = inject(DOCUMENT);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly storage = inject(UI_ASSISTANCE_STORAGE, { optional: true }) ?? defaultStorage();

  private readonly _textSize = signal<UiTextSize>('default');
  readonly textSize = this._textSize.asReadonly();

  constructor() {
    const saved = this.storage.get(TEXT_SIZE_KEY);
    if (isTextSize(saved)) {
      this._textSize.set(saved);
      this.applyTextSize(saved);
    }
  }

  setTextSize(size: UiTextSize): void {
    this._textSize.set(size);
    this.applyTextSize(size);
    this.storage.set(TEXT_SIZE_KEY, size);
  }

  cycleTextSize(): UiTextSize {
    const idx = TEXT_SIZES.indexOf(this._textSize());
    const next = TEXT_SIZES[(idx + 1) % TEXT_SIZES.length];
    this.setTextSize(next);
    return next;
  }

  toQueryParams(): Record<string, string> {
    const size = this._textSize();
    return size === 'default' ? {} : { textSize: size };
  }

  fromQueryParams(params: URLSearchParams | Readonly<Record<string, string | null | undefined>> | string): void {
    let raw: string | null | undefined;
    if (typeof params === 'string') {
      raw = new URLSearchParams(params).get('textSize');
    } else if (params instanceof URLSearchParams) {
      raw = params.get('textSize');
    } else {
      raw = params['textSize'];
    }
    if (isTextSize(raw)) this.setTextSize(raw);
  }

  private applyTextSize(size: UiTextSize): void {
    if (!isPlatformBrowser(this.platformId) && !this.doc?.documentElement) return;
    const html = this.doc.documentElement;
    if (!html) return;
    if (size === 'default') html.removeAttribute('data-text-size');
    else html.setAttribute('data-text-size', size);
  }
}
