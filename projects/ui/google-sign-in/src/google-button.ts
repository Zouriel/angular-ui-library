import { isPlatformBrowser } from '@angular/common';
import { Component, DestroyRef, ElementRef, PLATFORM_ID, afterNextRender, computed, inject, input, output, signal } from '@angular/core';
import { injectUiStrings } from '@zouriel/ui';
import { uiGoogleObserveTheme, type UiGoogleButtonShape, type UiGoogleButtonText, type UiGoogleButtonTheme } from './google-brand';

/**
 * `ui-google-button` — a "Sign in with Google" button drawn to Google's branding guidelines
 * (https://developers.google.com/identity/branding-guidelines): the official multicolour "G",
 * Google's light / dark / neutral colours, 40px high, Google Sans (else Roboto, else the library
 * font) Medium 14/20, rectangular or pill. Twin of Flutter's `UiGoogleSignInButton`.
 *
 * It only draws a normal `<button>` and emits `(pressed)`: for apps that run their own OAuth flow.
 * To get a Google ID token in the browser without a client secret, use `ui-google-sign-in`, which
 * shows Google's own button. `loading` swaps the "G" for a spinner at the same width (aria-busy,
 * not clickable); the logo stays at the inline start in RTL.
 */
@Component({
  selector: 'ui-google-button',
  host: { class: 'ui-google-button', '[class.expand]': 'expand()' },
  template: `
    <button
      type="button"
      class="ui-gbtn"
      [attr.data-look]="look()"
      [attr.data-shape]="shape()"
      [class.expand]="expand()"
      [disabled]="disabled() || loading()"
      [attr.aria-busy]="loading() || null"
      [attr.aria-label]="ariaLabel() ?? null"
      (click)="pressed.emit()">
      <span class="logo" aria-hidden="true">
        @if (loading()) {
          <span class="spin"></span>
        } @else {
          <!-- Google's standard "G", unmodified (paths verbatim from the guideline's sample SVG). -->
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="10 10 20 20" width="20" height="20" focusable="false">
            <path d="M29.6 20.2273C29.6 19.5182 29.5364 18.8364 29.4182 18.1818H20V22.05H25.3818C25.15 23.3 24.4455 24.3591 23.3864 25.0682V27.5773H26.6182C28.5091 25.8364 29.6 23.2727 29.6 20.2273Z" fill="#4285F4"/>
            <path d="M20 30C22.7 30 24.9636 29.1045 26.6181 27.5773L23.3863 25.0682C22.4909 25.6682 21.3454 26.0227 20 26.0227C17.3954 26.0227 15.1909 24.2636 14.4045 21.9H11.0636V24.4909C12.7091 27.7591 16.0909 30 20 30Z" fill="#34A853"/>
            <path d="M14.4045 21.9C14.2045 21.3 14.0909 20.6591 14.0909 20C14.0909 19.3409 14.2045 18.7 14.4045 18.1V15.5091H11.0636C10.3864 16.8591 10 18.3864 10 20C10 21.6136 10.3864 23.1409 11.0636 24.4909L14.4045 21.9Z" fill="#FBBC04"/>
            <path d="M20 13.9773C21.4681 13.9773 22.7863 14.4818 23.8227 15.4727L26.6909 12.6045C24.9591 10.9909 22.6954 10 20 10C16.0909 10 12.7091 12.2409 11.0636 15.5091L14.4045 18.1C15.1909 15.7364 17.3954 13.9773 20 13.9773Z" fill="#E94235"/>
          </svg>
        }
      </span>
      <span class="label">{{ words() }}</span>
    </button>
  `,
  styles: `
    /* Google's brand colours, from https://developers.google.com/identity/branding-guidelines
       ("Colors", the same on Android, iOS and Web). The only literal colours in the library outside
       the theme files: the brand looks the same in every theme. The style-contract spec allows this
       entry point only. */
    :host {
      --ui-google-light-fill: #FFFFFF;
      --ui-google-light-stroke: #747775;
      --ui-google-light-text: #1F1F1F;
      --ui-google-dark-fill: #131314;
      --ui-google-dark-stroke: #8E918F;
      --ui-google-dark-text: #E3E3E3;
      --ui-google-neutral-fill: #F2F2F2;
      --ui-google-neutral-text: #1F1F1F;
      display: inline-flex;
      max-width: 100%;
      vertical-align: middle;
    }
    :host(.expand) { display: flex; width: 100%; }
    /* 40px high; 12px before the logo, 10px between logo and text, 12px after the text, measured
       from the outer edge (the 1px stroke sits inside, so the padding is 11px). */
    .ui-gbtn {
      --g-fill: var(--ui-google-light-fill);
      --g-stroke: var(--ui-google-light-stroke);
      --g-text: var(--ui-google-light-text);
      position: relative;
      box-sizing: border-box;
      display: inline-flex;
      align-items: center;
      gap: 10px;
      height: 40px;
      max-width: 100%;
      margin: 0;
      padding: 0 11px;
      border: 1px solid var(--g-stroke);
      border-radius: 4px;
      background: var(--g-fill);
      color: var(--g-text);
      font-family: 'Google Sans', Roboto, var(--ui-font-default);
      font-size: 14px;
      font-weight: 500;
      line-height: 20px;
      letter-spacing: normal;
      white-space: nowrap;
      cursor: pointer;
      transition: transform var(--ui-motion-fast) var(--ui-ease-standard), opacity var(--ui-motion-base) var(--ui-ease-standard);
    }
    .ui-gbtn[data-look="dark"] { --g-fill: var(--ui-google-dark-fill); --g-stroke: var(--ui-google-dark-stroke); --g-text: var(--ui-google-dark-text); }
    .ui-gbtn[data-look="neutral"] { --g-fill: var(--ui-google-neutral-fill); --g-stroke: transparent; --g-text: var(--ui-google-neutral-text); }
    .ui-gbtn[data-shape="pill"] { border-radius: 20px; }
    .ui-gbtn.expand { width: 100%; }
    .ui-gbtn.expand .label { flex: 1; text-align: center; padding-inline-end: 30px; }
    /* State layer in the button's own text colour (8% hover, 12% press). */
    .ui-gbtn::after {
      content: '';
      position: absolute;
      inset: 0;
      border-radius: inherit;
      background: currentColor;
      opacity: 0;
      pointer-events: none;
      transition: opacity var(--ui-motion-fast) var(--ui-ease-standard);
    }
    .ui-gbtn:hover:not(:disabled)::after { opacity: 0.08; }
    .ui-gbtn:active:not(:disabled)::after { opacity: 0.12; }
    .ui-gbtn:active:not(:disabled) { transform: scale(var(--ui-scale-press)); }
    .ui-gbtn:focus-visible { outline: none; box-shadow: var(--ui-focus-ring); }
    .ui-gbtn:disabled { opacity: 0.5; cursor: not-allowed; }
    .ui-gbtn[aria-busy="true"] { opacity: 1; cursor: progress; }
    .logo { display: inline-flex; align-items: center; justify-content: center; flex: none; width: 20px; height: 20px; }
    .logo svg { display: block; width: 20px; height: 20px; }
    .label { min-width: 0; overflow: hidden; text-overflow: ellipsis; }
    .spin {
      width: 16px; height: 16px; box-sizing: border-box; border-radius: 50%;
      border: 2px solid currentColor; border-right-color: transparent;
      animation: ui-gbtn-spin var(--ui-motion-slow) linear infinite;
    }
    @keyframes ui-gbtn-spin { to { transform: rotate(360deg); } }
    /* Touch: the hit area grows to 44px tall on coarse pointers, never sideways. */
    @media (pointer: coarse) {
      .ui-gbtn::before { content: ''; position: absolute; left: 0; right: 0; top: 50%; height: var(--ui-size-touch); transform: translateY(-50%); }
    }
  `,
})
export class UiGoogleButton {
  /** Which approved wording to show. */
  text = input<UiGoogleButtonText>('signIn');
  /** Google's theme; 'auto' is dark on a dark library theme, light otherwise, and follows theme changes. */
  theme = input<UiGoogleButtonTheme>('auto');
  shape = input<UiGoogleButtonShape>('rectangular');
  /** Waiting for sign-in: a spinner in place of the "G", the same width, aria-busy, not clickable. */
  loading = input(false);
  disabled = input(false);
  /** Fill the width (the logo stays at the start, the words centre). */
  expand = input(false);
  /** Accessible name when the visible words aren't enough. */
  ariaLabel = input<string>();

  readonly pressed = output<void>();

  private readonly strings = injectUiStrings();
  /** The library theme at the button is dark (for 'auto'). */
  private readonly dark = signal(false);

  protected readonly look = computed(() => {
    const t = this.theme();
    return t === 'auto' ? (this.dark() ? 'dark' : 'light') : t;
  });

  protected readonly words = computed(() => {
    const s = this.strings;
    switch (this.text()) {
      case 'signUp': return s.googleSignUp;
      case 'continueWith': return s.googleContinue;
      case 'signInShort': return s.googleSignInShort;
      default: return s.googleSignIn;
    }
  });

  constructor() {
    const host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
    const destroy = inject(DestroyRef);
    const browser = isPlatformBrowser(inject(PLATFORM_ID));
    let destroyed = false;
    destroy.onDestroy(() => (destroyed = true));
    afterNextRender(() => {
      if (!browser || destroyed) return;
      uiGoogleObserveTheme(host, destroy, (d) => this.dark.set(d));
    });
  }
}
