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

/** A width in px as GIS takes it: whole pixels within its 200–400 range. */
export function uiGoogleButtonWidth(px: number): number {
  return Math.max(GIS_MIN_WIDTH, Math.min(GIS_MAX_WIDTH, Math.round(px)));
}

/**
 * `ui-google-sign-in` — Google's own "Sign in with Google" button (Google Identity Services), for
 * getting a Google ID token in the browser without a client secret. Emits the token as
 * `(credential)`; send it to your API, which verifies it against the same client ID.
 *
 * Loads the GIS script once on first use (shows a skeleton of the button's height meanwhile), then
 * `initialize`s with `ux_mode: 'popup'` and FedCM and renders the button. Without `width` the button
 * follows the host's width (GIS allows 200–400px): it is measured with a ResizeObserver, so a host that
 * was hidden or not laid out yet when the button first rendered (behind a gate, in a closed panel) gets
 * the full width once it shows, and the button sits centred in a host wider than 400px. GIS draws its
 * button in an iframe that is 0px wide until Google's page loads; the skeleton stays under it until
 * then, so the button doesn't pop in narrow and stretch. `theme` 'auto' is
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
      <div class="slot skeleton" aria-hidden="true" [class.pill]="shape() === 'pill'" [style.width.px]="width() ?? null"></div>
    }
    @if (state() === 'failed') {
      <div class="slot"><ui-google-button [text]="fallbackText()" [theme]="theme()" [shape]="shape()" [disabled]="true" [expand]="true" /></div>
    }
    <div class="slot gis" #gis [hidden]="state() !== 'ready'" [class.skeleton]="painting()" [class.pill]="shape() === 'pill'"
      [style.width.px]="options().width ?? null"></div>
  `,
  styles: `
    /* The host takes its container's width; the button (at most GIS's 400px) is centred in it. */
    :host { display: block; min-height: 40px; }
    .slot { width: 100%; max-width: 400px; margin-inline: auto; }
    .skeleton {
      height: 40px;
      border-radius: 4px;
      background: linear-gradient(90deg, var(--ui-skeleton-base) 25%, var(--ui-skeleton-highlight) 37%, var(--ui-skeleton-base) 63%);
      background-size: 400% 100%;
      animation: ui-gsi-shimmer 1.4s ease infinite;
    }
    .skeleton.pill { border-radius: 20px; }
    @keyframes ui-gsi-shimmer { 0% { background-position: 100% 0; } 100% { background-position: 0 0; } }
    @media (prefers-reduced-motion: reduce) { .skeleton { animation: none; } }
    .gis { min-height: 40px; display: flex; justify-content: center; }
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
  /** GIS's iframe is still 0px wide (Google's page hasn't loaded): the skeleton shows in its place. */
  protected readonly painting = signal(false);
  private readonly dark = signal(false);
  private readonly gisRef = viewChild<ElementRef<HTMLElement>>('gis');
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private readonly load = inject(UI_GOOGLE_IDENTITY);
  private readonly zone = inject(NgZone);
  private id: UiGoogleIdentity | null = null;
  private destroyed = false;
  private resize?: ResizeObserver;
  private frame?: ResizeObserver;
  private paintTimer?: ReturnType<typeof setTimeout>;

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
    if (w) o.width = uiGoogleButtonWidth(w);
    const locale = this.locale();
    if (locale) o.locale = locale;
    return o;
  });
  /**
   * The host's width when no `width` is given (0: not laid out yet, GIS sizes itself), clamped to
   * GIS's range so a host wider than 400px doesn't render the button again on every resize.
   */
  private readonly fill = signal(0);

  constructor() {
    const browser = isPlatformBrowser(inject(PLATFORM_ID));
    const destroy = inject(DestroyRef);
    // Registered before anything is awaited: the component can be destroyed while the script
    // loads (leaving the page at once), and onDestroy on a destroyed view throws NG0911.
    destroy.onDestroy(() => {
      this.destroyed = true;
      this.id = null;
      this.resize?.disconnect();
      this.stopPainting();
      const el = this.gisRef()?.nativeElement;
      if (el) el.replaceChildren();
    });
    afterNextRender(() => {
      if (!browser || this.destroyed) return;
      this.measure(this.host.clientWidth);
      if (typeof ResizeObserver !== 'undefined') {
        this.resize = new ResizeObserver(([entry]) => this.zone.run(() => this.measure(entry.contentRect.width)));
        this.resize.observe(this.host);
      }
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

  /** A new host width: kept only when it changes the button (0, hidden, keeps the last real width). */
  private measure(px: number): void {
    if (px > 0) this.fill.set(uiGoogleButtonWidth(px));
  }

  private render(options: UiGoogleButtonOptions): void {
    const el = this.gisRef()?.nativeElement;
    if (!el) return;
    el.replaceChildren();
    this.id!.renderButton(el, options);
    this.watchPaint(el);
  }

  /**
   * GIS's iframe starts 0px wide and takes the button's width once Google's page has loaded; until
   * then the skeleton shows in the button's place. Given up after 3s (a blocked frame stays as GIS left it).
   */
  private watchPaint(el: HTMLElement): void {
    this.stopPainting();
    const frame = el.querySelector('iframe');
    if (!frame || frame.getBoundingClientRect().width > 0 || typeof ResizeObserver === 'undefined') return;
    this.painting.set(true);
    this.frame = new ResizeObserver(([entry]) => {
      if (entry.contentRect.width > 0) this.zone.run(() => this.stopPainting());
    });
    this.frame.observe(frame);
    this.paintTimer = setTimeout(() => this.zone.run(() => this.stopPainting()), 3000);
  }

  private stopPainting(): void {
    this.frame?.disconnect();
    this.frame = undefined;
    clearTimeout(this.paintTimer);
    this.painting.set(false);
  }

  private fail(e: unknown): void {
    this.state.set('failed');
    this.failed.emit({ message: e instanceof Error ? e.message : String(e) });
  }
}
