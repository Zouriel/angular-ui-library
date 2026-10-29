import { ApplicationRef, Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { UiGoogleButtonShape, UiGoogleButtonTheme } from './google-brand';
import {
  UI_GOOGLE_GSI_SRC, UI_GOOGLE_IDENTITY, UiGoogleSignIn, uiLoadGoogleIdentity,
  type UiGoogleButtonOptions, type UiGoogleIdConfig, type UiGoogleIdentity, type UiGoogleSignInText,
} from './google-sign-in';

/** A stand-in for google.accounts.id that records its calls and renders a marker. */
function fakeGis() {
  const init: UiGoogleIdConfig[] = [];
  const render: UiGoogleButtonOptions[] = [];
  const id: UiGoogleIdentity = {
    initialize: (c) => init.push(c),
    renderButton: (el, o) => {
      render.push(o);
      const b = document.createElement('div');
      b.className = 'fake-gis';
      el.appendChild(b);
    },
  };
  return { id, init, render };
}

@Component({
  imports: [UiGoogleSignIn],
  template: `@if (show()) {
    <ui-google-sign-in clientId="123.apps.googleusercontent.com" [text]="text()" [theme]="theme()" [shape]="shape()"
      [width]="width()" [locale]="locale()" [nonce]="nonce()" (credential)="tokens.push($event)" (failed)="errors.push($event.message)" />
  }`,
})
class Host {
  show = signal(true);
  text = signal<UiGoogleSignInText>('signin_with');
  theme = signal<UiGoogleButtonTheme>('light');
  shape = signal<UiGoogleButtonShape>('rectangular');
  width = signal<number | undefined>(undefined);
  locale = signal<string | undefined>(undefined);
  nonce = signal<string | undefined>(undefined);
  tokens: string[] = [];
  errors: string[] = [];
}

const settle = () => new Promise((r) => setTimeout(r, 10));

async function make(loader: () => Promise<UiGoogleIdentity>, setup?: (h: Host) => void) {
  TestBed.configureTestingModule({ providers: [{ provide: UI_GOOGLE_IDENTITY, useValue: loader }] });
  const f = TestBed.createComponent(Host);
  setup?.(f.componentInstance);
  f.detectChanges();
  TestBed.inject(ApplicationRef).tick(); // afterNextRender: the load starts
  await settle();
  f.detectChanges();
  const el = f.nativeElement as HTMLElement;
  return { f, h: f.componentInstance, el };
}

describe('ui-google-sign-in', () => {
  afterEach(() => document.documentElement.removeAttribute('data-theme'));

  it('initializes GIS (popup, FedCM, nonce) and renders the button with the mapped options', async () => {
    const g = fakeGis();
    const { el } = await make(() => Promise.resolve(g.id), (h) => {
      h.text.set('continue_with');
      h.theme.set('dark');
      h.shape.set('pill');
      h.width.set(260);
      h.locale.set('dv');
      h.nonce.set('n-1');
    });
    expect(g.init).toHaveLength(1);
    expect(g.init[0]).toMatchObject({ client_id: '123.apps.googleusercontent.com', nonce: 'n-1', ux_mode: 'popup', use_fedcm_for_button: true });
    expect(g.render.at(-1)).toEqual({ type: 'standard', theme: 'filled_black', size: 'large', text: 'continue_with', shape: 'pill', logo_alignment: 'left', width: 260, locale: 'dv' });
    expect(el.querySelector('.fake-gis')).not.toBeNull();
    expect(el.querySelector('.skeleton')).toBeNull();
  });

  it("maps light and neutral to 'outline' (GIS has no neutral) and keeps widths within 200–400", async () => {
    const g = fakeGis();
    const { f, h } = await make(() => Promise.resolve(g.id), (x) => x.width.set(900));
    expect(g.render.at(-1)).toMatchObject({ theme: 'outline', width: 400 });
    h.theme.set('neutral');
    h.width.set(120);
    f.detectChanges();
    TestBed.tick();
    expect(g.render.at(-1)).toMatchObject({ theme: 'outline', width: 200 });
  });

  it('emits the credential from the GIS callback', async () => {
    const g = fakeGis();
    const { h } = await make(() => Promise.resolve(g.id));
    g.init[0].callback({ credential: 'eyJ.header.payload', select_by: 'btn' });
    expect(h.tokens).toEqual(['eyJ.header.payload']);
  });

  it('auto renders filled_black on a dark theme and re-renders outline when the theme turns light', async () => {
    document.documentElement.setAttribute('data-theme', 'maldives-dark');
    const g = fakeGis();
    const { f, el } = await make(() => Promise.resolve(g.id), (h) => h.theme.set('auto'));
    expect(g.render.at(-1)!.theme).toBe('filled_black');
    const before = g.render.length;
    document.documentElement.setAttribute('data-theme', 'maldives');
    await settle();
    f.detectChanges();
    TestBed.tick();
    expect(g.render.length).toBeGreaterThan(before);
    expect(g.render.at(-1)!.theme).toBe('outline');
    expect(el.querySelectorAll('.fake-gis')).toHaveLength(1); // the old button was cleared first
  });

  describe('width', () => {
    /** A ResizeObserver that the test drives: report(el, width) calls every observer watching el. */
    const observers: { cb: ResizeObserverCallback; targets: Element[] }[] = [];
    const real = globalThis.ResizeObserver;
    const report = (target: Element, width: number) => {
      for (const o of observers.filter((x) => x.targets.includes(target))) {
        o.cb([{ target, contentRect: { width, height: 40 } } as unknown as ResizeObserverEntry], o as unknown as ResizeObserver);
      }
    };
    beforeEach(() => {
      observers.length = 0;
      globalThis.ResizeObserver = class {
        private o = { cb: null as unknown as ResizeObserverCallback, targets: [] as Element[] };
        constructor(cb: ResizeObserverCallback) {
          this.o.cb = cb;
          observers.push(this.o);
        }
        observe(t: Element) { this.o.targets.push(t); }
        unobserve() {}
        disconnect() { this.o.targets.length = 0; }
      } as unknown as typeof ResizeObserver;
    });
    afterEach(() => {
      globalThis.ResizeObserver = real;
    });

    it('a host that was hidden (0 wide) when the button rendered renders it again at its width once it shows', async () => {
      const g = fakeGis();
      const { f, el } = await make(() => Promise.resolve(g.id));
      // jsdom has no layout: the host measured 0, as behind a location gate, so GIS sized itself.
      expect(g.render.at(-1)!.width).toBeUndefined();
      const host = el.querySelector('ui-google-sign-in')!;
      report(host, 358);
      f.detectChanges();
      TestBed.tick();
      expect(g.render.at(-1)!.width).toBe(358);
      // Hidden again (0): the last real width stays.
      const count = g.render.length;
      report(host, 0);
      f.detectChanges();
      TestBed.tick();
      expect(g.render).toHaveLength(count);
    });

    it('in a host wider than 400 the button is 400 and centred, and widening further renders nothing new', async () => {
      const g = fakeGis();
      const { f, el } = await make(() => Promise.resolve(g.id));
      const host = el.querySelector('ui-google-sign-in')!;
      report(host, 608);
      f.detectChanges();
      TestBed.tick();
      expect(g.render.at(-1)!.width).toBe(400);
      const count = g.render.length;
      report(host, 900);
      f.detectChanges();
      TestBed.tick();
      expect(g.render).toHaveLength(count);
      expect((el.querySelector('.gis') as HTMLElement).style.width).toBe('400px');
      const src = readFileSync(join(process.cwd(), 'projects/ui/google-sign-in/src/google-sign-in.ts'), 'utf8');
      const rule = (sel: string) => src.slice(src.indexOf(`    ${sel} {`), src.indexOf('}', src.indexOf(`    ${sel} {`)));
      expect(rule(':host')).not.toContain('max-width');
      expect(rule('.slot')).toContain('margin-inline: auto;');
      expect(rule('.gis')).toContain('justify-content: center;');
    });

    it("keeps the skeleton in the button's place until GIS's iframe has a width", async () => {
      const g = fakeGis();
      let frame: HTMLIFrameElement | null = null;
      const id: UiGoogleIdentity = {
        ...g.id,
        renderButton: (parent, o) => {
          g.render.push(o);
          frame = document.createElement('iframe');
          parent.appendChild(frame);
        },
      };
      const { f, el } = await make(() => Promise.resolve(id));
      const gis = el.querySelector('.gis') as HTMLElement;
      expect(gis.classList).toContain('skeleton');
      report(frame!, 0);
      f.detectChanges();
      expect(gis.classList).toContain('skeleton');
      report(frame!, 378);
      f.detectChanges();
      expect(gis.classList).not.toContain('skeleton');
    });
  });

  it('shows a 40px skeleton while the script loads', async () => {
    const { el } = await make(() => new Promise<UiGoogleIdentity>(() => {}));
    expect(el.querySelector('.skeleton')).not.toBeNull();
    expect(el.querySelector('ui-google-sign-in')!.getAttribute('data-state')).toBe('loading');
    // Same height as Google's large button, so nothing moves when it arrives.
    const src = readFileSync(join(process.cwd(), 'projects/ui/google-sign-in/src/google-sign-in.ts'), 'utf8');
    const skeleton = src.slice(src.indexOf('    .skeleton {'), src.indexOf('}', src.indexOf('    .skeleton {')));
    expect(skeleton).toContain('height: 40px;');
  });

  it('can be destroyed while the script loads, without an error, and then sets nothing up', async () => {
    let release!: (id: UiGoogleIdentity) => void;
    const gate = new Promise<UiGoogleIdentity>((r) => (release = r));
    const g = fakeGis();
    const errors: unknown[] = [];
    const onRejection = (e: unknown) => errors.push(e);
    globalThis.addEventListener?.('unhandledrejection', onRejection as EventListener);
    const { f, h } = await make(() => gate);
    h.show.set(false);
    f.detectChanges();
    f.destroy();
    release(g.id);
    await settle();
    expect(g.init).toHaveLength(0);
    expect(g.render).toHaveLength(0);
    expect(errors).toEqual([]);
    globalThis.removeEventListener?.('unhandledrejection', onRejection as EventListener);
  });

  it('when the script fails: a disabled drawn button with the library words, and (failed)', async () => {
    const { h, el } = await make(() => Promise.reject(new Error('Google sign-in could not load (blocked or offline)')), (x) => x.text.set('continue_with'));
    expect(h.errors).toEqual(['Google sign-in could not load (blocked or offline)']);
    const fallback = el.querySelector('ui-google-button button') as HTMLButtonElement;
    expect(fallback).not.toBeNull();
    expect(fallback.disabled).toBe(true);
    expect(fallback.textContent!.trim()).toBe('Continue with Google');
    expect(el.querySelector('.skeleton')).toBeNull();
  });

  it('reports GIS throwing during setup as failed too', async () => {
    const id: UiGoogleIdentity = { initialize: () => { throw new Error('bad client'); }, renderButton: () => {} };
    const { h, el } = await make(() => Promise.resolve(id));
    expect(h.errors).toEqual(['bad client']);
    expect(el.querySelector('ui-google-button')).not.toBeNull();
  });
});

describe('uiLoadGoogleIdentity (the default loader)', () => {
  type W = Window & { google?: unknown };
  afterEach(() => {
    document.querySelectorAll(`script[src="${UI_GOOGLE_GSI_SRC}"]`).forEach((s) => s.remove());
    delete (window as W).google;
  });

  it('adds the GIS script once and resolves google.accounts.id when it loads', async () => {
    const a = uiLoadGoogleIdentity(document);
    const b = uiLoadGoogleIdentity(document);
    expect(a).toBe(b);
    const scripts = document.querySelectorAll(`script[src="${UI_GOOGLE_GSI_SRC}"]`);
    expect(scripts).toHaveLength(1);
    const id = fakeGis().id;
    (window as W).google = { accounts: { id } };
    scripts[0].dispatchEvent(new Event('load'));
    await expect(a).resolves.toBe(id);
  });

  it('rejects when the script is blocked, and a later call tries again', async () => {
    const a = uiLoadGoogleIdentity(document);
    document.querySelector(`script[src="${UI_GOOGLE_GSI_SRC}"]`)!.dispatchEvent(new Event('error'));
    await expect(a).rejects.toThrow(/could not load/);
    const b = uiLoadGoogleIdentity(document);
    expect(b).not.toBe(a);
    expect(document.querySelectorAll(`script[src="${UI_GOOGLE_GSI_SRC}"]`)).toHaveLength(1);
    b.catch(() => {});
  });

  it('resolves at once when GIS is already on the page', async () => {
    const id = fakeGis().id;
    (window as W).google = { accounts: { id } };
    await expect(uiLoadGoogleIdentity(document)).resolves.toBe(id);
    expect(document.querySelector(`script[src="${UI_GOOGLE_GSI_SRC}"]`)).toBeNull();
  });
});
