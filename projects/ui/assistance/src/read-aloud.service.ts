import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { DestroyRef, Injectable, InjectionToken, PLATFORM_ID, type Provider, inject, signal } from '@angular/core';

export interface UiReadAloudCallbacks {
  onEnd: () => void;
  onError: () => void;
}

export interface UiReadAloudEngine {
  readonly supported: boolean;
  canSpeak(lang?: string): boolean;
  speak(text: string, lang: string | undefined, callbacks: UiReadAloudCallbacks): void;
  pause(): void;
  resume(): void;
  stop(): void;
}

export const UI_READ_ALOUD_ENGINE = new InjectionToken<UiReadAloudEngine>('UI_READ_ALOUD_ENGINE');

/**
 * Provides a custom read-aloud engine (e.g. a server-side Dhivehi TTS adapter).
 */
export function provideUiReadAloud(options: { engine: UiReadAloudEngine | (() => UiReadAloudEngine) }): Provider {
  return typeof options.engine === 'function'
    ? { provide: UI_READ_ALOUD_ENGINE, useFactory: options.engine }
    : { provide: UI_READ_ALOUD_ENGINE, useValue: options.engine };
}

/**
 * Reads text from an element or selector in document order, skipping `aria-hidden` and `nav` subtrees
 * without modifying the DOM. Uses the browser's `speechSynthesis` by default or a custom engine via
 * `provideUiReadAloud`.
 */
@Injectable({ providedIn: 'root' })
export class UiReadAloudService {
  private readonly doc = inject(DOCUMENT);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly customEngine = inject(UI_READ_ALOUD_ENGINE, { optional: true });
  private readonly voicesTick = signal(0);

  private readonly _speaking = signal(false);
  private readonly _paused = signal(false);

  readonly speaking = this._speaking.asReadonly();
  readonly paused = this._paused.asReadonly();
  readonly supported = signal(false);

  private readonly engine: UiReadAloudEngine;

  constructor() {
    this.engine = this.customEngine ?? this.createBrowserEngine();
    this.supported.set(this.engine.supported);
  }

  canSpeak(lang?: string): boolean {
    this.voicesTick();
    if (!this.engine.supported) return false;
    const effectiveLang = lang ?? (this.doc.documentElement?.getAttribute('lang') || 'en');
    return this.engine.canSpeak(effectiveLang);
  }

  speak(target: HTMLElement | string, lang?: string): void {
    if (!this.engine.supported) return;
    const el = typeof target === 'string' ? this.doc.querySelector<HTMLElement>(target) : target;
    if (!el) return;
    const text = extractReadableText(this.doc, el);
    if (!text) return;

    const effectiveLang = lang ?? (this.doc.documentElement?.getAttribute('lang') || undefined);
    this.engine.stop();
    this._speaking.set(true);
    this._paused.set(false);
    this.engine.speak(text, effectiveLang, {
      onEnd: () => {
        this._speaking.set(false);
        this._paused.set(false);
      },
      onError: () => {
        this._speaking.set(false);
        this._paused.set(false);
      },
    });
  }

  pause(): void {
    if (!this._speaking()) return;
    this.engine.pause();
    this._paused.set(true);
  }

  resume(): void {
    if (!this._speaking() || !this._paused()) return;
    this.engine.resume();
    this._paused.set(false);
  }

  stop(): void {
    this.engine.stop();
    this._speaking.set(false);
    this._paused.set(false);
  }

  private createBrowserEngine(): UiReadAloudEngine {
    const isBrowser = isPlatformBrowser(this.platformId);
    const synth = isBrowser && typeof window !== 'undefined' ? window.speechSynthesis : undefined;
    const hasUtterance = isBrowser && typeof SpeechSynthesisUtterance !== 'undefined';
    const supported = Boolean(synth && hasUtterance);

    if (supported && synth?.addEventListener) {
      const onVoices = () => this.voicesTick.update((n) => n + 1);
      synth.addEventListener('voiceschanged', onVoices);
      inject(DestroyRef).onDestroy(() => synth.removeEventListener?.('voiceschanged', onVoices));
    }

    return {
      supported,
      canSpeak: (lang?: string) => {
        if (!supported || !synth) return false;
        const voices = synth.getVoices?.() ?? [];
        const norm = (lang || 'en').toLowerCase();
        const base = norm.split('-')[0];
        if (!voices.length) return false;
        return voices.some((v) => {
          const vl = v.lang.toLowerCase();
          return vl === norm || vl === base || vl.startsWith(`${base}-`);
        });
      },
      speak: (text: string, lang: string | undefined, callbacks: UiReadAloudCallbacks) => {
        if (!supported || !synth) return;
        const utterance = new SpeechSynthesisUtterance(text);
        if (lang) utterance.lang = lang;
        utterance.onend = () => callbacks.onEnd();
        utterance.onerror = () => callbacks.onError();
        synth.speak(utterance);
      },
      pause: () => synth?.pause?.(),
      resume: () => synth?.resume?.(),
      stop: () => synth?.cancel?.(),
    };
  }
}

function extractReadableText(doc: Document, root: HTMLElement): string {
  if (root.closest('[aria-hidden="true"], nav, [role="navigation"], [hidden]')) return '';
  const walker = doc.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const parts: string[] = [];
  let node: Node | null;
  while ((node = walker.nextNode())) {
    const parent = node.parentElement;
    if (!parent) continue;
    const skip = parent.closest('[aria-hidden="true"], nav, [role="navigation"], script, style, noscript, [hidden]');
    if (skip && root.contains(skip)) continue;
    const t = node.textContent?.trim();
    if (t) parts.push(t);
  }
  return parts.join(' ');
}
