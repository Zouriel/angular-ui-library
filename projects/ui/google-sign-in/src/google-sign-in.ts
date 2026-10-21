import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import {
  Component, DestroyRef, ElementRef, InjectionToken, NgZone, PLATFORM_ID, afterNextRender, computed, effect, inject, input, output, signal, untracked, viewChild,
} from '@angular/core';
import { UiGoogleButton } from './google-button';
import { uiGoogleObserveTheme, type UiGoogleButtonShape, type UiGoogleButtonText, type UiGoogleButtonTheme } from './google-brand';

/** The parts of Google Identity Services' `google.accounts.id` this component uses. */
export interface UiGoogleIdentity {
  initialize(config: UiGoogleIdConfig): void;
  renderButton(parent: HTMLElement, options: UiGoogleButtonOptions): void;
  /**
   * `google.accounts.oauth2`, for `UiGoogleAuthorization`. The real script keeps it beside
   * `google.accounts.id`, where it is read from when this is absent; a fake loader puts it here.
   */
  oauth2?: UiGoogleOAuth2;
}

/** The parts of Google Identity Services' `google.accounts.oauth2` that `UiGoogleAuthorization` uses. */
export interface UiGoogleOAuth2 {
  initTokenClient(config: UiGoogleTokenClientConfig): { requestAccessToken(overrides?: { prompt?: '' | 'consent' }): void };
  hasGrantedAllScopes?(response: UiGoogleTokenResponse, firstScope: string, ...restScopes: string[]): boolean;
}

/** What `google.accounts.oauth2.initTokenClient` is called with (GIS's own names). */
export interface UiGoogleTokenClientConfig {
  client_id: string;
  scope: string;
  callback: (response: UiGoogleTokenResponse) => void;
  error_callback?: (error: { type: 'popup_closed' | 'popup_failed_to_open' | 'unknown' | string; message?: string }) => void;
  hint?: string;
  prompt?: '' | 'consent';
  include_granted_scopes?: boolean;
}

/** GIS's token response. */
export interface UiGoogleTokenResponse {
  access_token?: string;
  expires_in?: number | string;
  scope?: string;
  token_type?: string;
  error?: string;
  error_description?: string;
}

/** What `google.accounts.id.initialize` is called with. */
export interface UiGoogleIdConfig {
  client_id: string;
  callback: (response: { credential: string; select_by?: string }) => void;
  nonce?: string;
  ux_mode: 'popup';
  use_fedcm_for_button: boolean;
}

/** What `google.accounts.id.renderButton` is called with (GIS's own names). */
export interface UiGoogleButtonOptions {
  type: 'standard';
  theme: 'outline' | 'filled_black';
  size: 'large';
  text: UiGoogleSignInText;
  shape: UiGoogleButtonShape;
  logo_alignment: 'left';
  width?: number;
  locale?: string;
}

/** GIS's wordings: "Sign in with Google", "Sign up with Google", "Continue with Google", "Sign in". */
export type UiGoogleSignInText = 'signin_with' | 'signup_with' | 'continue_with' | 'signin';

/** The GIS script the default loader adds to the page. */
export const UI_GOOGLE_GSI_SRC = 'https://accounts.google.com/gsi/client';

let shared: Promise<UiGoogleIdentity> | null = null;

/** Loads the GIS script once per page (a failed load can be retried by the next component). */
export function uiLoadGoogleIdentity(doc: Document): Promise<UiGoogleIdentity> {
  type GoogleWindow = Window & { google?: { accounts?: { id?: UiGoogleIdentity } } };
  const ready = () => (doc.defaultView as GoogleWindow | null)?.google?.accounts?.id;
  const now = ready();
  if (now) return Promise.resolve(now);
  shared ??= new Promise<UiGoogleIdentity>((resolve, reject) => {
    const fail = (why: string) => {
      shared = null;
      reject(new Error(why));
    };
    let script = doc.querySelector<HTMLScriptElement>(`script[src="${UI_GOOGLE_GSI_SRC}"]`);
    if (!script) {
      script = doc.createElement('script');
      script.src = UI_GOOGLE_GSI_SRC;
      script.async = true;
      script.defer = true;
      doc.head.appendChild(script);
    }
    script.addEventListener('load', () => {
      const id = ready();
      if (id) {
        shared = null; // from now on window.google answers directly
        resolve(id);
      }
      else fail('Google sign-in loaded but google.accounts.id is missing');
    });
    script.addEventListener('error', () => {
      script?.remove();
      fail('Google sign-in could not load (blocked or offline)');
    });
  });
  return shared;
}

/**
 * How `ui-google-sign-in` gets Google Identity Services: by default it adds
 * `https://accounts.google.com/gsi/client` to the page once and resolves `window.google.accounts.id`.
 * Provide another loader to test without the network (a fake with `initialize` / `renderButton`).
 */
export const UI_GOOGLE_IDENTITY = new InjectionToken<() => Promise<UiGoogleIdentity>>('UI_GOOGLE_IDENTITY', {
  providedIn: 'root',
  factory: () => {
    const doc = inject(DOCUMENT);
    return () => uiLoadGoogleIdentity(doc);
  },
});

/** GIS's own maximum button width. */
const GIS_MAX_WIDTH = 400;
/** GIS's smallest button width. */
const GIS_MIN_WIDTH = 200;

/**
 * `ui-google-sign-in` — Google's own "Sign in with Google" button (Google Identity Services), for
 * getting a Google ID token in the browser without a client secret. Emits the token as
 * `(credential)`; send it to your API, which verifies it against the same client ID.
 *
 * Loads the GIS script once on first use (shows a skeleton of the button's height meanwhile), then
 * `initialize`s with `ux_mode: 'popup'` and FedCM and renders the button. `theme` 'auto' is
 * 'filled_black' on a dark library theme and 'outline' otherwise, and re-renders when the theme
 * changes; GIS has no neutral theme, so 'neutral' renders as 'outline'. If the script can't load
 * (blocked, offline) it shows a disabled drawn button with the library's words and emits `(failed)`.
 *
 * GIS's initialize is page-wide: show one of these per page.
 */
@Component({
  selector: 'ui-google-sign-in',
  imports: [UiGoogleButton],
  host: { class: 'ui-google-sign-in', '[attr.data-state]': 'state()' },
  template: `
    @if (state() === 'loading') {
      <div class="skeleton" aria-hidden="true" [class.pill]="shape() === 'pill'" [style.width.px]="width() ?? null"></div>
    }
    @if (state() === 'failed') {
      <ui-google-button [text]="fallbackText()" [theme]="theme()" [shape]="shape()" [disabled]="true" />
    }
    <div class="gis" #gis [hidden]="state() !== 'ready'"></div>
  `,
  styles: `
    :host { display: block; max-width: 400px; min-height: 40px; }
    .skeleton {
      height: 40px;
      max-width: 100%;
      border-radius: 4px;
      background: linear-gradient(90deg, var(--ui-skeleton-base) 25%, var(--ui-skeleton-highlight) 37%, var(--ui-skeleton-base) 63%);
      background-size: 400% 100%;
      animation: ui-gsi-shimmer 1.4s ease infinite;
    }
    .skeleton.pill { border-radius: 20px; }
    @keyframes ui-gsi-shimmer { 0% { background-position: 100% 0; } 100% { background-position: 0 0; } }
    @media (prefers-reduced-motion: reduce) { .skeleton { animation: none; } }
    .gis { min-height: 40px; }
    .gis[hidden] { display: none; }
  `,
})
export class UiGoogleSignIn {
  /** The OAuth web client ID (from Google Cloud console). Required. */
  clientId = input.required<string>();
  text = input<UiGoogleSignInText>('signin_with');
  /** 'auto' follows the library theme: dark → 'filled_black', else 'outline'. 'neutral' renders as 'outline'. */
  theme = input<UiGoogleButtonTheme>('auto');
  shape = input<UiGoogleButtonShape>('rectangular');
  /** Button width in px (GIS allows 200–400). Without it the button fills the host, up to 400. */
  width = input<number>();
  /** The button's language (GIS `locale`, e.g. 'dv'); defaults to the browser's. */
  locale = input<string>();
  /** A nonce to bind the ID token to this sign-in (checked by your server). */
  nonce = input<string>();

  /** The Google ID token (a JWT) after the person signed in. */
  readonly credential = output<string>();
  /** The script could not load or GIS threw while setting up. */
  readonly failed = output<{ message: string }>();

  protected readonly state = signal<'loading' | 'ready' | 'failed'>('loading');
  private readonly dark = signal(false);
  private readonly gisRef = viewChild<ElementRef<HTMLElement>>('gis');
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private readonly load = inject(UI_GOOGLE_IDENTITY);
  private readonly zone = inject(NgZone);
  private id: UiGoogleIdentity | null = null;
  private destroyed = false;

  /** The drawn fallback's wording for the GIS text. */
  protected readonly fallbackText = computed<UiGoogleButtonText>(() => {
    switch (this.text()) {
      case 'signup_with': return 'signUp';
      case 'continue_with': return 'continueWith';
      case 'signin': return 'signInShort';
      default: return 'signIn';
    }
  });

  /** The options renderButton gets. */
  readonly options = computed<UiGoogleButtonOptions>(() => {
    const t = this.theme();
    const filled = t === 'dark' || (t === 'auto' && this.dark());
    const o: UiGoogleButtonOptions = {
      type: 'standard',
      theme: filled ? 'filled_black' : 'outline',
      size: 'large',
      text: this.text(),
      shape: this.shape(),
      logo_alignment: 'left',
    };
    const w = this.width() ?? this.fill();
    if (w) o.width = Math.max(GIS_MIN_WIDTH, Math.min(GIS_MAX_WIDTH, Math.round(w)));
    const locale = this.locale();
    if (locale) o.locale = locale;
    return o;
  });
  /** The host's width when no `width` is given (0: let GIS size itself). */
  private readonly fill = signal(0);

  constructor() {
    const browser = isPlatformBrowser(inject(PLATFORM_ID));
    const destroy = inject(DestroyRef);
    // Registered before anything is awaited: the component can be destroyed while the script
    // loads (leaving the page at once), and onDestroy on a destroyed view throws NG0911.
    destroy.onDestroy(() => {
      this.destroyed = true;
      this.id = null;
      const el = this.gisRef()?.nativeElement;
      if (el) el.replaceChildren();
    });
    afterNextRender(() => {
      if (!browser || this.destroyed) return;
      this.fill.set(this.host.clientWidth);
      uiGoogleObserveTheme(this.host, destroy, (d) => this.dark.set(d));
      void this.start();
    });
    // Client ID or nonce changed: initialize again. Then (and on any option change) render again.
    effect(() => {
      const config = { client: this.clientId(), nonce: this.nonce() };
      untracked(() => this.id && this.initialize(config.client, config.nonce));
    });
    effect(() => {
      const o = this.options();
      untracked(() => this.id && this.render(o));
    });
  }

  private async start(): Promise<void> {
    let id: UiGoogleIdentity;
    try {
      id = await this.load();
    } catch (e) {
      if (!this.destroyed) this.fail(e);
      return;
    }
    if (this.destroyed) return;
    this.id = id;
    try {
      this.initialize(this.clientId(), this.nonce());
      this.render(this.options());
    } catch (e) {
      this.id = null;
      this.fail(e);
      return;
    }
    this.state.set('ready');
  }

  private initialize(client: string, nonce: string | undefined): void {
    const config: UiGoogleIdConfig = {
      client_id: client,
      callback: (r) => this.zone.run(() => !this.destroyed && r?.credential && this.credential.emit(r.credential)),
      ux_mode: 'popup',
      use_fedcm_for_button: true,
    };
    if (nonce) config.nonce = nonce;
    this.id!.initialize(config);
  }

  private render(options: UiGoogleButtonOptions): void {
    const el = this.gisRef()?.nativeElement;
    if (!el) return;
    el.replaceChildren();
    this.id!.renderButton(el, options);
  }

  private fail(e: unknown): void {
    this.state.set('failed');
    this.failed.emit({ message: e instanceof Error ? e.message : String(e) });
  }
}
