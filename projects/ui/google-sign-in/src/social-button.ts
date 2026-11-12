import { Component, computed, input, output } from '@angular/core';
import { injectUiConfig, injectUiStrings } from '@zouriel/ui';
import { UiShutterLoader } from '@zouriel/ui/shutter-loader';

/** Which sign-in the button is for. */
export type UiSocialProvider = 'apple' | 'google';
/** The words: the same wording for every provider, so a stack of buttons reads alike. */
export type UiSocialButtonText = 'signIn' | 'continueWith' | 'signUp';
/**
 * 'light': Apple's white button with an outline and Google's light one. 'dark': Apple's black button
 * and Google's dark one. 'auto' (0.56.0) is 'light' on every theme: white buttons read well on light
 * and dark backgrounds alike (Apple: white with an outline on light backgrounds, white on dark ones;
 * Google's light style is allowed on any background).
 */
export type UiSocialButtonStyle = 'auto' | 'dark' | 'light';
/**
 * 'rounded' (0.56.0, the default): the theme's button corners (`--ui-radius`, as on `ui-button`), so
 * the pair matches the app's own buttons (Apple: match the corner radius of your other buttons).
 * 'rectangular': 4px (Google's rectangular shape). 'pill': fully rounded (Google's pill).
 */
export type UiSocialButtonShape = 'rounded' | 'rectangular' | 'pill';

/**
 * Apple's "Sign in with Apple - Left Aligned - Medium" logo artwork from Apple Design Resources
 * (Logo-Sign-in-with-Apple.dmg), unmodified: the path in its 31x44 box, which already holds Apple's
 * padding. Apple: match the file's height to the button's. The file's background rectangle is left
 * out (it is the button's own fill). Shared with Flutter's `UiSocialSignInButton`.
 */
export const UI_APPLE_LOGO_LEFT_MEDIUM_PATH =
  'M15.7099491,14.8846154 C16.5675461,14.8846154 17.642562,14.3048315 18.28274,13.5317864 C18.8625238,12.8312142 19.2852829,11.852829 19.2852829,10.8744437 C19.2852829,10.7415766 19.2732041,10.6087095 19.2490464,10.5 C18.2948188,10.5362365 17.1473299,11.140178 16.4588366,11.9494596 C15.9152893,12.56548 15.4200572,13.5317864 15.4200572,14.5222505 C15.4200572,14.6671964 15.4442149,14.8121424 15.4562937,14.8604577 C15.5166879,14.8725366 15.6133185,14.8846154 15.7099491,14.8846154 Z M12.6902416,29.5 C13.8618881,29.5 14.3812778,28.714876 15.8428163,28.714876 C17.3285124,28.714876 17.6546408,29.4758423 18.9591545,29.4758423 C20.2395105,29.4758423 21.0971074,28.292117 21.9063891,27.1325493 C22.8123013,25.8038779 23.1867451,24.4993643 23.2109027,24.4389701 C23.1263509,24.4148125 20.6743484,23.4122695 20.6743484,20.5979021 C20.6743484,18.1579784 22.6069612,17.0588048 22.7156707,16.974253 C21.4353147,15.1382708 19.490623,15.0899555 18.9591545,15.0899555 C17.5217737,15.0899555 16.3501271,15.9596313 15.6133185,15.9596313 C14.8161157,15.9596313 13.7652575,15.1382708 12.521138,15.1382708 C10.1536872,15.1382708 7.75,17.0950413 7.75,20.7911634 C7.75,23.0861411 8.64383344,25.513986 9.74300699,27.0842339 C10.6851558,28.4129053 11.5065162,29.5 12.6902416,29.5 Z';

/**
 * `ui-social-button` — "Sign in with Apple" and "Sign in with Google" as one matching pair: the same
 * height (40), corners (the theme's button radius by default), font (the system font, else Roboto; 17/20 Medium, Apple's 43% of the
 * height), padding and logo slot, so a stack of them lines up exactly. Each provider keeps its own
 * brand rules:
 *
 * - Apple (Human Interface Guidelines, "Creating a custom Sign in with Apple button"): Apple's own
 *   left-aligned logo artwork at the button's full height, logo and words in black or white only,
 *   a black or white button, titles "Sign in / Sign up / Continue with Apple", the logo inset to line
 *   up with the other logos (allowed), at least 8% of the width after the title.
 * - Google (https://developers.google.com/identity/branding-guidelines): the standard multicolour
 *   "G" at its 20px size, unaltered, 12px before it and at least 10px after it; Google's light and
 *   dark colours (fill, 1px stroke, text).
 *
 * The logo sits in a 44px slot at the start; the words centre in the space between that slot and an
 * equal one at the end, so the words of every provider line up too. A normal `<button>` that emits
 * `(pressed)`: apps wire it to their own sign-in. `loading` swaps the logo for a spinner (aria-busy,
 * not clickable). Twin of Flutter's `UiSocialSignInButton`.
 */
@Component({
  selector: 'ui-social-button',
  imports: [UiShutterLoader],
  host: { class: 'ui-social-button', '[class.expand]': 'expand()' },
  template: `
    <button
      type="button"
      class="ui-sbtn"
      [attr.data-provider]="provider()"
      [attr.data-look]="look()"
      [attr.data-shape]="shape()"
      [class.expand]="expand()"
      [disabled]="disabled() || loading()"
      [attr.aria-busy]="loading() || null"
      [attr.aria-label]="ariaLabel() ?? null"
      (click)="pressed.emit()">
      <span class="slot" aria-hidden="true">
        @if (loading()) {
          @if (shutterSpin) { <ui-shutter-loader class="shutter" [size]="16" decorative /> }
          @else { <span class="spin"></span> }
        } @else if (provider() === 'apple') {
          <svg class="apple" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 31 44" focusable="false" aria-hidden="true">
            <path [attr.d]="appleLogo" fill="currentColor" fill-rule="nonzero"/>
          </svg>
        } @else {
          <!-- Google's standard "G", unmodified (paths verbatim from the guideline's sample SVG). -->
          <svg class="g" xmlns="http://www.w3.org/2000/svg" viewBox="10 10 20 20" width="20" height="20" focusable="false" aria-hidden="true">
            <path d="M29.6 20.2273C29.6 19.5182 29.5364 18.8364 29.4182 18.1818H20V22.05H25.3818C25.15 23.3 24.4455 24.3591 23.3864 25.0682V27.5773H26.6182C28.5091 25.8364 29.6 23.2727 29.6 20.2273Z" fill="#4285F4"/>
            <path d="M20 30C22.7 30 24.9636 29.1045 26.6181 27.5773L23.3863 25.0682C22.4909 25.6682 21.3454 26.0227 20 26.0227C17.3954 26.0227 15.1909 24.2636 14.4045 21.9H11.0636V24.4909C12.7091 27.7591 16.0909 30 20 30Z" fill="#34A853"/>
            <path d="M14.4045 21.9C14.2045 21.3 14.0909 20.6591 14.0909 20C14.0909 19.3409 14.2045 18.7 14.4045 18.1V15.5091H11.0636C10.3864 16.8591 10 18.3864 10 20C10 21.6136 10.3864 23.1409 11.0636 24.4909L14.4045 21.9Z" fill="#FBBC04"/>
            <path d="M20 13.9773C21.4681 13.9773 22.7863 14.4818 23.8227 15.4727L26.6909 12.6045C24.9591 10.9909 22.6954 10 20 10C16.0909 10 12.7091 12.2409 11.0636 15.5091L14.4045 18.1C15.1909 15.7364 17.3954 13.9773 20 13.9773Z" fill="#E94235"/>
          </svg>
        }
      </span>
      <span class="label">{{ words() }}</span>
      <span class="end" aria-hidden="true"></span>
    </button>
  `,
  styles: `
    /* The brands' own colours: Apple's black and white (HIG), Google's light and dark (branding
       guidelines, "Colors"). Fixed in every theme; the style-contract spec allows this file. Apple's
       button takes the same 1px stroke as Google's beside it (Apple allows a stroke on the bezel). */
    :host {
      --ui-social-apple-dark-fill: #000000;
      --ui-social-apple-dark-text: #FFFFFF;
      --ui-social-apple-light-fill: #FFFFFF;
      --ui-social-apple-light-text: #000000;
      --ui-social-google-dark-fill: #131314;
      --ui-social-google-dark-text: #E3E3E3;
      --ui-social-google-light-fill: #FFFFFF;
      --ui-social-google-light-text: #1F1F1F;
      --ui-social-dark-stroke: #8E918F;
      --ui-social-light-stroke: #747775;
      display: inline-flex;
      max-width: 100%;
      vertical-align: middle;
    }
    :host(.expand) { display: flex; width: 100%; }
    /* 40px high, the theme's button corners; a 44px logo slot at each end (the stroke sits inside the box). */
    .ui-sbtn {
      --s-fill: var(--ui-social-apple-dark-fill);
      --s-stroke: var(--ui-social-dark-stroke);
      --s-text: var(--ui-social-apple-dark-text);
      position: relative;
      box-sizing: border-box;
      display: inline-flex;
      align-items: center;
      height: 40px;
      min-width: 140px;
      max-width: 100%;
      margin: 0;
      padding: 0;
      border: 1px solid var(--s-stroke);
      border-radius: var(--ui-radius);
      background: var(--s-fill);
      color: var(--s-text);
      font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", Roboto, "Segoe UI", system-ui, sans-serif, var(--ui-font-default);
      font-size: 17px;
      font-weight: 500;
      line-height: 20px;
      letter-spacing: normal;
      white-space: nowrap;
      cursor: pointer;
      transition: transform var(--ui-motion-fast) var(--ui-ease-standard), opacity var(--ui-motion-base) var(--ui-ease-standard);
    }
    .ui-sbtn[data-provider="apple"][data-look="light"] { --s-fill: var(--ui-social-apple-light-fill); --s-stroke: var(--ui-social-light-stroke); --s-text: var(--ui-social-apple-light-text); }
    .ui-sbtn[data-provider="google"][data-look="dark"] { --s-fill: var(--ui-social-google-dark-fill); --s-stroke: var(--ui-social-dark-stroke); --s-text: var(--ui-social-google-dark-text); }
    .ui-sbtn[data-provider="google"][data-look="light"] { --s-fill: var(--ui-social-google-light-fill); --s-stroke: var(--ui-social-light-stroke); --s-text: var(--ui-social-google-light-text); }
    .ui-sbtn[data-shape="rectangular"] { border-radius: 4px; }
    .ui-sbtn[data-shape="pill"] { border-radius: 20px; }
    .ui-sbtn.expand { width: 100%; }
    /* State layer in the button's own text colour (8% hover, 12% press). */
    .ui-sbtn::after {
      content: '';
      position: absolute;
      inset: 0;
      border-radius: inherit;
      background: currentColor;
      opacity: 0;
      pointer-events: none;
      transition: opacity var(--ui-motion-fast) var(--ui-ease-standard);
    }
    .ui-sbtn:hover:not(:disabled)::after { opacity: 0.08; }
    .ui-sbtn:active:not(:disabled)::after { opacity: 0.12; }
    .ui-sbtn:active:not(:disabled) { transform: scale(var(--ui-scale-press)); }
    .ui-sbtn:focus-visible { outline: none; box-shadow: var(--ui-focus-ring); }
    .ui-sbtn:disabled { opacity: 0.5; cursor: not-allowed; }
    .ui-sbtn[aria-busy="true"] { opacity: 1; cursor: progress; }
    /* The slots: 43px inside the 1px stroke = 44px from the outer edge. The "G" (20px) centres in
       its slot: 12px before it, 12px after. Apple's artwork is as tall as the button (38px inside the
       stroke, 40 * 31 / 44 wide) and centres the same way, so both logos share one centre line. */
    .slot, .end { flex: none; width: 43px; height: 100%; display: inline-flex; align-items: center; justify-content: center; }
    /* The logo centres 22px from the outer edge: 12px before the "G" and 12px after it. */
    .slot { box-sizing: border-box; padding-inline-end: 1px; }
    .slot .apple { display: block; height: 40px; width: calc(40px * 31 / 44); flex: none; margin: -1px 0; }
    .slot .g { display: block; width: 20px; height: 20px; }
    .label { flex: 1 1 auto; min-width: 0; overflow: hidden; text-overflow: ellipsis; text-align: center; }
    .spin {
      width: 16px; height: 16px; box-sizing: border-box; border-radius: 50%;
      border: 2px solid currentColor; border-right-color: transparent;
      animation: ui-sbtn-spin var(--ui-motion-slow) linear infinite;
    }
    @keyframes ui-sbtn-spin { to { transform: rotate(360deg); } }
    /* Touch: the hit area grows to 44px tall on coarse pointers, never sideways. */
    @media (pointer: coarse) {
      .ui-sbtn::before { content: ''; position: absolute; left: 0; right: 0; top: 50%; height: var(--ui-size-touch); transform: translateY(-50%); }
    }
  `,
})
export class UiSocialButton {
  /** `provideUiConfig({ spinner: 'shutter' })`: the busy mark is the shutter instead of the ring. */
  protected readonly shutterSpin = injectUiConfig().spinner === 'shutter';
  /** Apple or Google. */
  provider = input.required<UiSocialProvider>();
  /** Which wording; use the same one for every button in a stack. */
  text = input<UiSocialButtonText>('signIn');
  /** 'auto' is 'light' (white, outlined) on every theme. */
  buttonStyle = input<UiSocialButtonStyle>('auto');
  /** 'rounded' follows the theme's button corners. */
  shape = input<UiSocialButtonShape>('rounded');
  /** Waiting for sign-in: a spinner in place of the logo, the same size, aria-busy, not clickable. */
  loading = input(false);
  disabled = input(false);
  /** Fill the width (the logo stays at the start, the words centre). */
  expand = input(false);
  /** Accessible name when the visible words aren't enough. */
  ariaLabel = input<string>();

  readonly pressed = output<void>();

  protected readonly appleLogo = UI_APPLE_LOGO_LEFT_MEDIUM_PATH;
  private readonly strings = injectUiStrings();
  protected readonly look = computed(() => {
    const s = this.buttonStyle();
    return s === 'auto' ? 'light' : s;
  });

  protected readonly words = computed(() => {
    const s = this.strings;
    const apple = this.provider() === 'apple';
    switch (this.text()) {
      case 'signUp': return apple ? s.appleSignUp : s.googleSignUp;
      case 'continueWith': return apple ? s.appleContinue : s.googleContinue;
      default: return apple ? s.appleSignIn : s.googleSignIn;
    }
  });

}
