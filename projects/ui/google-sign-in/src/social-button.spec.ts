import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it } from 'vitest';
import { provideUiStrings } from '@zouriel/ui';
import {
  UI_APPLE_LOGO_LEFT_MEDIUM_PATH,
  UiSocialButton,
  type UiSocialButtonShape,
  type UiSocialButtonStyle,
  type UiSocialButtonText,
  type UiSocialProvider,
} from './social-button';

@Component({ imports: [UiSocialButton], template: `<ui-social-button provider="google" />` })
class DefaultsHost {}

@Component({
  imports: [UiSocialButton],
  template: `
    <ui-social-button class="a" provider="apple" [text]="text()" [buttonStyle]="look()" [shape]="shape()" [expand]="true" />
    <ui-social-button class="one" [provider]="provider()" [text]="text()" [buttonStyle]="look()" [shape]="shape()" [loading]="loading()"
      [disabled]="disabled()" [expand]="expand()" [ariaLabel]="label()" (pressed)="presses.set(presses() + 1)" />
    <ui-social-button class="g" provider="google" [text]="text()" [buttonStyle]="look()" [shape]="shape()" [expand]="true" />`,
})
class Host {
  provider = signal<UiSocialProvider>('apple');
  text = signal<UiSocialButtonText>('signIn');
  look = signal<UiSocialButtonStyle>('dark');
  shape = signal<UiSocialButtonShape>('rectangular');
  loading = signal(false);
  disabled = signal(false);
  expand = signal(false);
  label = signal<string | undefined>(undefined);
  presses = signal(0);
}

/** Apple's left-aligned Medium artwork path, verbatim from Apple Design Resources (shared with Flutter). */
const APPLE_MEDIUM =
  'M15.7099491,14.8846154 C16.5675461,14.8846154 17.642562,14.3048315 18.28274,13.5317864 C18.8625238,12.8312142 19.2852829,11.852829 19.2852829,10.8744437 C19.2852829,10.7415766 19.2732041,10.6087095 19.2490464,10.5 C18.2948188,10.5362365 17.1473299,11.140178 16.4588366,11.9494596 C15.9152893,12.56548 15.4200572,13.5317864 15.4200572,14.5222505 C15.4200572,14.6671964 15.4442149,14.8121424 15.4562937,14.8604577 C15.5166879,14.8725366 15.6133185,14.8846154 15.7099491,14.8846154 Z M12.6902416,29.5 C13.8618881,29.5 14.3812778,28.714876 15.8428163,28.714876 C17.3285124,28.714876 17.6546408,29.4758423 18.9591545,29.4758423 C20.2395105,29.4758423 21.0971074,28.292117 21.9063891,27.1325493 C22.8123013,25.8038779 23.1867451,24.4993643 23.2109027,24.4389701 C23.1263509,24.4148125 20.6743484,23.4122695 20.6743484,20.5979021 C20.6743484,18.1579784 22.6069612,17.0588048 22.7156707,16.974253 C21.4353147,15.1382708 19.490623,15.0899555 18.9591545,15.0899555 C17.5217737,15.0899555 16.3501271,15.9596313 15.6133185,15.9596313 C14.8161157,15.9596313 13.7652575,15.1382708 12.521138,15.1382708 C10.1536872,15.1382708 7.75,17.0950413 7.75,20.7911634 C7.75,23.0861411 8.64383344,25.513986 9.74300699,27.0842339 C10.6851558,28.4129053 11.5065162,29.5 12.6902416,29.5 Z';

/** The compiled component styles (what the browser gets), as selector -> declarations. */
const rules = (() => {
  const css = ((UiSocialButton as unknown as { ɵcmp: { styles: string[] } }).ɵcmp.styles ?? []).join('\n');
  const map = new Map<string, string>();
  for (const m of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const sel = m[1].replace(/\[_nghost-[^\]]*\]/g, ':host').replace(/\[_ngcontent-[^\]]*\]/g, '').replace(/\s+/g, ' ').trim();
    const body = m[2].replace(/\s+/g, ' ').trim();
    map.set(sel, (map.get(sel) ?? '') + body);
  }
  return map;
})();
const rule = (sel: string) => rules.get(sel) ?? '';
/** The value of `--var` declared on :host. */
const hostVar = (name: string) => new RegExp(`${name}:\\s*([^;]+);`).exec(rule(':host'))?.[1]?.trim();

function make() {
  const f = TestBed.createComponent(Host);
  f.detectChanges();
  const el = f.nativeElement as HTMLElement;
  const button = (cls = 'one') => el.querySelector(`ui-social-button.${cls} button.ui-sbtn`) as HTMLButtonElement;
  return { f, h: f.componentInstance, button, el };
}

describe('ui-social-button', () => {
  afterEach(() => document.documentElement.removeAttribute('data-theme'));

  it('uses one wording for both providers', () => {
    const { f, h, button } = make();
    const words: Record<UiSocialButtonText, [string, string]> = {
      signIn: ['Sign in with Apple', 'Sign in with Google'],
      continueWith: ['Continue with Apple', 'Continue with Google'],
      signUp: ['Sign up with Apple', 'Sign up with Google'],
    };
    for (const [k, [apple, google]] of Object.entries(words)) {
      h.text.set(k as UiSocialButtonText);
      f.detectChanges();
      expect(button('a').textContent!.trim()).toBe(apple);
      expect(button('g').textContent!.trim()).toBe(google);
    }
  });

  it('takes its words from the library strings', () => {
    TestBed.configureTestingModule({ providers: [provideUiStrings({ appleContinue: 'A!', googleContinue: 'G!' })] });
    const { f, h, button } = make();
    h.text.set('continueWith');
    f.detectChanges();
    expect(button('a').textContent!.trim()).toBe('A!');
    expect(button('g').textContent!.trim()).toBe('G!');
  });

  it('draws the logo in the same slot at the start for both: Apple artwork and the Google "G"', () => {
    const { button } = make();
    const a = button('a');
    const g = button('g');
    // Same structure, same order: logo slot, words, end slot.
    expect([...a.children].map((c) => c.className)).toEqual(['slot', 'label', 'end']);
    expect([...g.children].map((c) => c.className)).toEqual(['slot', 'label', 'end']);
    const apple = a.querySelector('.slot svg.apple')!;
    expect(apple.getAttribute('viewBox')).toBe('0 0 31 44');
    expect(apple.querySelector('path')!.getAttribute('d')).toBe(APPLE_MEDIUM);
    expect(UI_APPLE_LOGO_LEFT_MEDIUM_PATH).toBe(APPLE_MEDIUM);
    expect(apple.querySelector('path')!.getAttribute('fill')).toBe('currentColor');
    const gPaths = [...g.querySelectorAll('.slot svg.g path')].map((p) => p.getAttribute('fill'));
    expect(gPaths).toEqual(['#4285F4', '#34A853', '#FBBC04', '#E94235']);
    // No typed glyphs: the words are the only text.
    expect(a.querySelector('.slot')!.textContent!.trim()).toBe('');
  });

  it('both providers get the same size: no provider- or look-specific rule touches geometry or type', () => {
    const geometry = /(^|;)\s*(height|width|min-width|max-width|padding[a-z-]*|margin[a-z-]*|border-radius|border-width|font-size|font-weight|font-family|line-height|gap|letter-spacing)\s*:/;
    const scoped = [...rules.keys()].filter((sel) => /data-provider|data-look/.test(sel));
    expect(scoped.length).toBeGreaterThanOrEqual(3);
    for (const sel of scoped) expect(rule(sel), sel).not.toMatch(geometry);
    const base = rule('.ui-sbtn');
    expect(base).toMatch(/height: 40px/);
    expect(base).toMatch(/border-radius: var\(--ui-radius\)/);
    expect(base).toMatch(/font-size: 17px/);
    expect(base).toMatch(/font-weight: 500/);
    expect(base).toMatch(/line-height: 20px/);
    expect(base).toMatch(/border: 1px solid/);
    expect(base).toMatch(/min-width: 140px/);
    // The slots are the same at both ends, and the Apple artwork matches the button height.
    expect(rule('.slot, .end')).toMatch(/width: 43px/);
    expect(rule('.slot .apple')).toMatch(/height: 40px/);
    expect(rule('.slot .apple')).toMatch(/width: calc\(40px \* 31 \/ 44\)/);
    expect(rule('.slot .g')).toMatch(/width: 20px; height: 20px/);
    expect(rule('.ui-sbtn[data-shape=pill]')).toMatch(/border-radius: 20px/);
  });

  it('brand colours: Apple black/white with a matching stroke, Google light/dark', () => {
    expect(hostVar('--ui-social-apple-dark-fill')).toBe('#000000');
    expect(hostVar('--ui-social-apple-dark-text')).toBe('#FFFFFF');
    expect(hostVar('--ui-social-apple-light-fill')).toBe('#FFFFFF');
    expect(hostVar('--ui-social-apple-light-text')).toBe('#000000');
    expect(hostVar('--ui-social-google-dark-fill')).toBe('#131314');
    expect(hostVar('--ui-social-google-dark-text')).toBe('#E3E3E3');
    expect(hostVar('--ui-social-google-light-fill')).toBe('#FFFFFF');
    expect(hostVar('--ui-social-google-light-text')).toBe('#1F1F1F');
    expect(hostVar('--ui-social-dark-stroke')).toBe('#8E918F');
    expect(hostVar('--ui-social-light-stroke')).toBe('#747775');
    expect(rule('.ui-sbtn[data-provider=apple][data-look=light]')).toMatch(/--s-fill: var\(--ui-social-apple-light-fill\).*--s-text: var\(--ui-social-apple-light-text\)/);
    expect(rule('.ui-sbtn[data-provider=google][data-look=dark]')).toMatch(/--s-fill: var\(--ui-social-google-dark-fill\)/);
    expect(rule('.ui-sbtn[data-provider=google][data-look=light]')).toMatch(/--s-fill: var\(--ui-social-google-light-fill\)/);
  });

  it('auto is white (light) for both on light and dark themes', async () => {
    for (const theme of ['winterLight', 'light', 'winterDark', 'maldives-dark']) {
      document.documentElement.setAttribute('data-theme', theme);
      const { f, h, button } = make();
      h.look.set('auto');
      f.detectChanges();
      await new Promise((r) => setTimeout(r, 10));
      f.detectChanges();
      expect(button('a').getAttribute('data-look'), theme).toBe('light');
      expect(button('g').getAttribute('data-look'), theme).toBe('light');
      f.destroy();
    }
  });

  it('defaults to the theme button corners (rounded), like ui-button', () => {
    const f = TestBed.createComponent(DefaultsHost);
    f.detectChanges();
    const b = (f.nativeElement as HTMLElement).querySelector('button.ui-sbtn')!;
    expect(b.getAttribute('data-shape')).toBe('rounded');
    expect(b.getAttribute('data-look')).toBe('light');
    expect(rule('.ui-sbtn')).toMatch(/border-radius: var\(--ui-radius\)/);
    expect(rule('.ui-sbtn[data-shape=rectangular]')).toMatch(/border-radius: 4px/);
  });

  it('emits pressed; disabled and loading block it; loading swaps the logo for a spinner', () => {
    const { f, h, button } = make();
    button().click();
    expect(h.presses()).toBe(1);
    h.disabled.set(true);
    f.detectChanges();
    expect(button().disabled).toBe(true);
    h.disabled.set(false);
    h.loading.set(true);
    f.detectChanges();
    expect(button().disabled).toBe(true);
    expect(button().getAttribute('aria-busy')).toBe('true');
    expect(button().querySelector('.slot .spin')).not.toBeNull();
    expect(button().querySelector('.slot svg')).toBeNull();
  });

  it('takes an accessible name and an expand class; pill shape', () => {
    const { f, h, button, el } = make();
    h.label.set('Use Apple');
    h.expand.set(true);
    h.shape.set('pill');
    f.detectChanges();
    expect(button().getAttribute('aria-label')).toBe('Use Apple');
    expect(el.querySelector('ui-social-button.one')!.classList.contains('expand')).toBe(true);
    expect(button().getAttribute('data-shape')).toBe('pill');
  });
});
