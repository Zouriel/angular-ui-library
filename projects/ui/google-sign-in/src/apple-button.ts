import { isPlatformBrowser } from '@angular/common';
import { Component, DestroyRef, ElementRef, PLATFORM_ID, afterNextRender, computed, inject, input, output, signal } from '@angular/core';
import { injectUiStrings } from '@zouriel/ui';
import { uiGoogleObserveTheme } from './google-brand';

/** The words on the button (Apple's approved wordings; the words come from UI_STRINGS). */
export type UiAppleButtonText = 'signIn' | 'continueWith' | 'signUp';
/** Apple's three button styles, plus 'auto': white on a dark library theme, black otherwise. */
export type UiAppleButtonTheme = 'auto' | 'black' | 'white' | 'whiteOutline';
/** 6px corners or fully rounded. */
export type UiAppleButtonShape = 'rectangular' | 'pill';

/**
 * The Apple logo as drawn by the MIT-licensed sign_in_with_apple Flutter package
 * (Copyright 2019 sign_in_with_apple authors), scaled to a 25x31 box. Shared with Flutter's
 * `UiAppleSignInButton`.
 */
export const UI_APPLE_LOGO_PATH =
  'M 12.69475 8.90692 C 11.4825 8.90692 9.606 7.51471 7.62975 7.56524 C 5.0225 7.59872 2.63125 9.09168 1.28625 11.45667 C -1.42075 16.2037 0.58875 23.21528 3.229 27.07323 C 4.52425 28.95214 6.05225 31.06541 8.07825 30.99845 C 10.021 30.91444 10.75175 29.72373 13.10975 29.72373 C 15.45125 29.72373 16.1155 30.99845 18.17475 30.94823 C 20.26725 30.91444 21.59575 29.03584 22.8745 27.1405 C 24.35225 24.95965 24.96675 22.84638 25 22.72889 C 24.95025 22.71215 20.9315 21.15223 20.8815 16.45542 C 20.8485 12.5302 24.0535 10.6516 24.203 10.56759 C 22.37625 7.86718 19.56975 7.56524 18.59 7.49797 C 16.0325 7.29678 13.89025 8.90692 12.69475 8.90692 Z M 17.01225 4.94822 C 18.09175 3.64002 18.80575 1.81164 18.6065 0 C 17.06225 0.06696 15.20225 1.04005 14.08975 2.34825 C 13.09325 3.50579 12.22975 5.36765 12.46225 7.14581 C 14.17275 7.28004 15.933 6.25673 17.01225 4.94822 Z';

/**
 * `ui-apple-button` — a "Sign in with Apple" button drawn to Apple's Human Interface Guidelines
 * (https://developer.apple.com/design/human-interface-guidelines/sign-in-with-apple): the Apple
 * logo, Apple's black / white / white-with-outline styles, 40px high (lines up with
 * `ui-google-button`), the system font 17/20 Medium, 6px or pill corners. The logo and the words
 * are centred together, also when expanded; the logo comes first in reading order (also in RTL).
 * Twin of Flutter's `UiAppleSignInButton`.
 *
 * It only draws a normal `<button>` and emits `(pressed)`: apps wire it to their own Sign in with
 * Apple flow. `loading` swaps the logo for a spinner of the same size (aria-busy, not clickable).
 */
@Component({
  selector: 'ui-apple-button',
  host: { class: 'ui-apple-button', '[class.expand]': 'expand()' },
  template: `
    <button
      type="button"
      class="ui-abtn"
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
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 25 31" focusable="false" aria-hidden="true">
            <path [attr.d]="logo" fill="currentColor"/>
          </svg>
        }
      </span>
      <span class="label">{{ words() }}</span>
    </button>
  `,
  styles: `
    /* Apple's button colours, from the Human Interface Guidelines ("Sign in with Apple", Buttons):
       black with white, white with black, and white with black and a black outline. Fixed in every
       theme; the style-contract spec allows this file. */
    :host {
      --ui-apple-black-fill: #000000;
      --ui-apple-black-text: #FFFFFF;
      --ui-apple-white-fill: #FFFFFF;
      --ui-apple-white-text: #000000;
      --ui-apple-outline-stroke: #000000;
      display: inline-flex;
      max-width: 100%;
      vertical-align: middle;
    }
    :host(.expand) { display: flex; width: 100%; }
    /* 40px high; 16px each side measured from the outer edge (the 1px stroke, transparent unless
       whiteOutline, sits inside, so the padding is 15px); logo, 6px, words, centred as one group. */
    .ui-abtn {
      --a-fill: var(--ui-apple-black-fill);
      --a-stroke: transparent;
      --a-text: var(--ui-apple-black-text);
      position: relative;
      box-sizing: border-box;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      height: 40px;
      max-width: 100%;
      margin: 0;
      padding: 0 15px;
      border: 1px solid var(--a-stroke);
      border-radius: 6px;
      background: var(--a-fill);
      color: var(--a-text);
      font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", Roboto, system-ui, sans-serif, var(--ui-font-default);
      font-size: 17px;
      font-weight: 500;
      line-height: 20px;
      letter-spacing: normal;
      white-space: nowrap;
      cursor: pointer;
      transition: transform var(--ui-motion-fast) var(--ui-ease-standard), opacity var(--ui-motion-base) var(--ui-ease-standard);
    }
    .ui-abtn[data-look="white"] { --a-fill: var(--ui-apple-white-fill); --a-stroke: transparent; --a-text: var(--ui-apple-white-text); }
    .ui-abtn[data-look="whiteOutline"] { --a-fill: var(--ui-apple-white-fill); --a-stroke: var(--ui-apple-outline-stroke); --a-text: var(--ui-apple-white-text); }
    .ui-abtn[data-shape="pill"] { border-radius: 20px; }
    .ui-abtn.expand { width: 100%; }
    /* State layer in the button's own text colour (8% hover, 12% press). */
    .ui-abtn::after {
      content: '';
      position: absolute;
      inset: 0;
      border-radius: inherit;
      background: currentColor;
      opacity: 0;
      pointer-events: none;
      transition: opacity var(--ui-motion-fast) var(--ui-ease-standard);
    }
    .ui-abtn:hover:not(:disabled)::after { opacity: 0.08; }
    .ui-abtn:active:not(:disabled)::after { opacity: 0.12; }
    .ui-abtn:active:not(:disabled) { transform: scale(var(--ui-scale-press)); }
    .ui-abtn:focus-visible { outline: none; box-shadow: var(--ui-focus-ring); }
    .ui-abtn:disabled { opacity: 0.5; cursor: not-allowed; }
    .ui-abtn[aria-busy="true"] { opacity: 1; cursor: progress; }
    /* The logo is 17px tall in its 25x31 box (17 * 25 / 31 wide); the spinner fills the same box. */
    .logo { display: inline-flex; align-items: center; justify-content: center; flex: none; width: calc(17px * 25 / 31); height: 17px; }
    .logo svg { display: block; width: 100%; height: 100%; }
    .label { min-width: 0; overflow: hidden; text-overflow: ellipsis; }
    .spin {
      width: 100%; aspect-ratio: 1; box-sizing: border-box; border-radius: 50%;
      border: 2px solid currentColor; border-right-color: transparent;
      animation: ui-abtn-spin var(--ui-motion-slow) linear infinite;
    }
    @keyframes ui-abtn-spin { to { transform: rotate(360deg); } }
    /* Touch: the hit area grows to 44px tall on coarse pointers, never sideways. */
    @media (pointer: coarse) {
      .ui-abtn::before { content: ''; position: absolute; left: 0; right: 0; top: 50%; height: var(--ui-size-touch); transform: translateY(-50%); }
    }
  `,
})
export class UiAppleButton {
  /** Which approved wording to show. */
  text = input<UiAppleButtonText>('signIn');
  /** Apple's style; 'auto' is white on a dark library theme, black otherwise, and follows theme changes. */
  theme = input<UiAppleButtonTheme>('auto');
  shape = input<UiAppleButtonShape>('rectangular');
  /** Waiting for sign-in: a spinner in place of the logo, the same width, aria-busy, not clickable. */
  loading = input(false);
  disabled = input(false);
  /** Fill the width (the logo and words stay centred together). */
  expand = input(false);
  /** Accessible name when the visible words aren't enough. */
  ariaLabel = input<string>();

  readonly pressed = output<void>();

  protected readonly logo = UI_APPLE_LOGO_PATH;
  private readonly strings = injectUiStrings();
  /** The library theme at the button is dark (for 'auto'). */
  private readonly dark = signal(false);

  protected readonly look = computed(() => {
    const t = this.theme();
    return t === 'auto' ? (this.dark() ? 'white' : 'black') : t;
  });

  protected readonly words = computed(() => {
    const s = this.strings;
    switch (this.text()) {
      case 'signUp': return s.appleSignUp;
      case 'continueWith': return s.appleContinue;
      default: return s.appleSignIn;
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
