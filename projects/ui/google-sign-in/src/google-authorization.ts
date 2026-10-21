import { DOCUMENT } from '@angular/common';
import { Injectable, inject } from '@angular/core';
import { UI_GOOGLE_IDENTITY, type UiGoogleOAuth2, type UiGoogleTokenResponse } from './google-sign-in';

/** What `UiGoogleAuthorization.requestAccessToken` asks for. */
export interface UiGoogleAccessRequest {
  /** The OAuth client ID (the same web client ID as sign-in). */
  clientId: string;
  /** OAuth scopes, e.g. `https://www.googleapis.com/auth/user.birthday.read`. */
  scopes: string[];
  /** The signed-in user's email or ID-token `sub`, so Google skips the account chooser. */
  hint?: string;
  /** `'consent'` always shows the consent screen; `''` (Google's default) only when needed. */
  prompt?: '' | 'consent';
}

/** A granted access token. */
export interface UiGoogleAccessToken {
  accessToken: string;
  /** The scopes Google says were granted: the user can untick some, so check before calling an API. */
  grantedScopes: string[];
  /** Seconds until the token expires. */
  expiresIn: number;
}

/**
 * Why a request failed: `cancelled` (the user closed the popup or declined), `popup_blocked` (the
 * browser blocked the popup: call `requestAccessToken` straight from a click, after `preload()`),
 * `unavailable` (the script could not load) or `failed` (anything else Google reported).
 */
export type UiGoogleAuthorizationErrorKind = 'cancelled' | 'popup_blocked' | 'unavailable' | 'failed';

export class UiGoogleAuthorizationError extends Error {
  constructor(readonly kind: UiGoogleAuthorizationErrorKind, message: string, readonly googleError?: string) {
    super(message);
    this.name = 'UiGoogleAuthorizationError';
  }
}

/**
 * Asks the signed-in user for more Google data (an OAuth access token for extra scopes, such as the
 * People API's birthday or phone number) through Google Identity Services' token client, in a popup.
 * Sign-in (`ui-google-sign-in`) only gives an ID token with name, email and picture; this is the
 * separate, incremental step. It loads GIS through the same `UI_GOOGLE_IDENTITY` loader, so tests
 * provide a fake with an `oauth2` part.
 *
 * Browsers only allow the popup from a user gesture: call `preload()` early (e.g. when the page
 * opens) and `requestAccessToken()` directly in the click handler.
 */
@Injectable({ providedIn: 'root' })
export class UiGoogleAuthorization {
  private readonly loader = inject(UI_GOOGLE_IDENTITY);
  private readonly doc = inject(DOCUMENT);

  /** Loads GIS ahead of the click that requests a token. */
  async preload(): Promise<void> {
    await this.oauth2();
  }

  /** Opens Google's popup for `scopes` and resolves with the token, or rejects with a `UiGoogleAuthorizationError`. */
  async requestAccessToken(req: UiGoogleAccessRequest): Promise<UiGoogleAccessToken> {
    if (!req.scopes.length) throw new UiGoogleAuthorizationError('failed', 'No scopes requested');
    const oauth2 = await this.oauth2();
    return new Promise<UiGoogleAccessToken>((resolve, reject) => {
      const client = oauth2.initTokenClient({
        client_id: req.clientId,
        scope: req.scopes.join(' '),
        include_granted_scopes: true,
        ...(req.hint ? { hint: req.hint } : {}),
        ...(req.prompt !== undefined ? { prompt: req.prompt } : {}),
        callback: (r: UiGoogleTokenResponse) => {
          if (r.error || !r.access_token) {
            const declined = r.error === 'access_denied';
            reject(new UiGoogleAuthorizationError(declined ? 'cancelled' : 'failed', r.error_description || r.error || 'No access token', r.error));
            return;
          }
          resolve({ accessToken: r.access_token, grantedScopes: granted(oauth2, r, req.scopes), expiresIn: Number(r.expires_in) || 0 });
        },
        error_callback: (e) => {
          const kind = e.type === 'popup_closed' ? 'cancelled' : e.type === 'popup_failed_to_open' ? 'popup_blocked' : 'failed';
          reject(new UiGoogleAuthorizationError(kind, e.message || e.type, e.type));
        },
      });
      client.requestAccessToken(req.prompt !== undefined ? { prompt: req.prompt } : undefined);
    });
  }

  private async oauth2(): Promise<UiGoogleOAuth2> {
    let identity;
    try {
      identity = await this.loader();
    } catch (e) {
      throw new UiGoogleAuthorizationError('unavailable', e instanceof Error ? e.message : String(e));
    }
    type GoogleWindow = Window & { google?: { accounts?: { oauth2?: UiGoogleOAuth2 } } };
    const oauth2 = identity.oauth2 ?? (this.doc.defaultView as GoogleWindow | null)?.google?.accounts?.oauth2;
    if (!oauth2) throw new UiGoogleAuthorizationError('unavailable', 'Google Identity Services has no oauth2 client');
    return oauth2;
  }
}

/** The granted scopes: Google's `scope` list, or (when it sends none) the requested scopes that `hasGrantedAllScopes` confirms. */
function granted(oauth2: UiGoogleOAuth2, r: UiGoogleTokenResponse, requested: string[]): string[] {
  const listed = (r.scope ?? '').split(/\s+/).filter(Boolean);
  if (listed.length) return listed;
  return oauth2.hasGrantedAllScopes ? requested.filter((s) => oauth2.hasGrantedAllScopes!(r, s)) : [];
}
