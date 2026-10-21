import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { UiGoogleAuthorization, UiGoogleAuthorizationError } from './google-authorization';
import { UI_GOOGLE_IDENTITY, type UiGoogleIdentity, type UiGoogleTokenClientConfig, type UiGoogleTokenResponse } from './google-sign-in';

type Outcome = { response: UiGoogleTokenResponse } | { error: { type: string; message?: string } };

/** A stand-in for google.accounts.{id,oauth2}: records the token client config and answers with `outcome`. */
function fake(outcome: Outcome, hasGranted?: (r: UiGoogleTokenResponse, s: string) => boolean) {
  const configs: UiGoogleTokenClientConfig[] = [];
  const requests: unknown[] = [];
  const id: UiGoogleIdentity = {
    initialize: () => {},
    renderButton: () => {},
    oauth2: {
      initTokenClient: (c) => {
        configs.push(c);
        return {
          requestAccessToken: (o) => {
            requests.push(o);
            if ('response' in outcome) c.callback(outcome.response);
            else c.error_callback?.(outcome.error);
          },
        };
      },
      ...(hasGranted ? { hasGrantedAllScopes: (r: UiGoogleTokenResponse, s: string) => hasGranted(r, s) } : {}),
    },
  };
  return { id, configs, requests };
}

const service = (loader: () => Promise<UiGoogleIdentity>) => {
  TestBed.configureTestingModule({ providers: [{ provide: UI_GOOGLE_IDENTITY, useValue: loader }] });
  return TestBed.inject(UiGoogleAuthorization);
};
const BDAY = 'https://www.googleapis.com/auth/user.birthday.read';
const PHONE = 'https://www.googleapis.com/auth/user.phonenumbers.read';

describe('UiGoogleAuthorization', () => {
  it('passes the client ID, the scopes, the hint and the prompt to the token client', async () => {
    const g = fake({ response: { access_token: 'ya29.x', expires_in: 3599, scope: `${BDAY} ${PHONE}` } });
    const auth = service(() => Promise.resolve(g.id));
    await auth.requestAccessToken({ clientId: '123.apps.googleusercontent.com', scopes: [BDAY, PHONE], hint: 'aminath@example.com', prompt: 'consent' });
    expect(g.configs).toHaveLength(1);
    const c = g.configs[0];
    expect([c.client_id, c.scope, c.hint, c.prompt, c.include_granted_scopes]).toEqual(['123.apps.googleusercontent.com', `${BDAY} ${PHONE}`, 'aminath@example.com', 'consent', true]);
    expect(g.requests).toEqual([{ prompt: 'consent' }]);
  });

  it('leaves hint and prompt out when not given', async () => {
    const g = fake({ response: { access_token: 'ya29.x', expires_in: 60, scope: BDAY } });
    await service(() => Promise.resolve(g.id)).requestAccessToken({ clientId: 'c', scopes: [BDAY] });
    expect('hint' in g.configs[0]).toBe(false);
    expect('prompt' in g.configs[0]).toBe(false);
  });

  it('returns the token, its lifetime and the scopes Google granted (which can be fewer than asked)', async () => {
    const g = fake({ response: { access_token: 'ya29.x', expires_in: '3599', scope: `openid ${BDAY}` } });
    const t = await service(() => Promise.resolve(g.id)).requestAccessToken({ clientId: 'c', scopes: [BDAY, PHONE] });
    expect(t).toEqual({ accessToken: 'ya29.x', grantedScopes: ['openid', BDAY], expiresIn: 3599 });
  });

  it('falls back to hasGrantedAllScopes when the response lists no scopes', async () => {
    const g = fake({ response: { access_token: 'ya29.x', expires_in: 10 } }, (_r, s) => s === PHONE);
    const t = await service(() => Promise.resolve(g.id)).requestAccessToken({ clientId: 'c', scopes: [BDAY, PHONE] });
    expect(t.grantedScopes).toEqual([PHONE]);
  });

  it('tells a cancel (popup closed, or consent declined) apart from other errors', async () => {
    const kind = async (o: Outcome) => {
      TestBed.resetTestingModule();
      const g = fake(o);
      return service(() => Promise.resolve(g.id)).requestAccessToken({ clientId: 'c', scopes: [BDAY] }).then(
        () => 'resolved',
        (e: unknown) => (e instanceof UiGoogleAuthorizationError ? e.kind : 'untyped'),
      );
    };
    expect(await kind({ error: { type: 'popup_closed', message: 'Popup window closed' } })).toBe('cancelled');
    expect(await kind({ response: { error: 'access_denied' } })).toBe('cancelled');
    expect(await kind({ error: { type: 'popup_failed_to_open' } })).toBe('popup_blocked');
    expect(await kind({ error: { type: 'unknown', message: 'boom' } })).toBe('failed');
    expect(await kind({ response: { error: 'invalid_scope', error_description: 'Bad scope' } })).toBe('failed');
  });

  it('rejects as unavailable when the script cannot load, without opening anything', async () => {
    const auth = service(() => Promise.reject(new Error('Google sign-in could not load (blocked or offline)')));
    const err = await auth.requestAccessToken({ clientId: 'c', scopes: [BDAY] }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(UiGoogleAuthorizationError);
    expect((err as UiGoogleAuthorizationError).kind).toBe('unavailable');
    await expect(auth.preload()).rejects.toBeInstanceOf(UiGoogleAuthorizationError);
  });
});
