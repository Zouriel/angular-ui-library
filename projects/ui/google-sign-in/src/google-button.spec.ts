import { ApplicationRef, Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { provideUiStrings } from '@zouriel/ui';
import { UiGoogleButton } from './google-button';
import { uiGoogleIsDarkTheme, type UiGoogleButtonShape, type UiGoogleButtonText, type UiGoogleButtonTheme } from './google-brand';

@Component({
  imports: [UiGoogleButton],
  template: `<ui-google-button [text]="text()" [theme]="theme()" [shape]="shape()" [loading]="loading()" [disabled]="disabled()"
    [expand]="expand()" [ariaLabel]="label()" (pressed)="presses.set(presses() + 1)" />`,
})
class Host {
  text = signal<UiGoogleButtonText>('signIn');
  theme = signal<UiGoogleButtonTheme>('light');
  shape = signal<UiGoogleButtonShape>('rectangular');
  loading = signal(false);
  disabled = signal(false);
  expand = signal(false);
  label = signal<string | undefined>(undefined);
  presses = signal(0);
}

const css = readFileSync(join(process.cwd(), 'projects/ui/google-sign-in/src/google-button.ts'), 'utf8');
const rule = (selector: string) => {
  const i = css.indexOf(`${selector} {`);
  return i < 0 ? '' : css.slice(i, css.indexOf('}', i));
};

function make() {
  const f = TestBed.createComponent(Host);
  f.detectChanges();
  const button = () => (f.nativeElement as HTMLElement).querySelector('button.ui-gbtn') as HTMLButtonElement;
  return { f, h: f.componentInstance, button };
}

describe('ui-google-button', () => {
  afterEach(() => document.documentElement.removeAttribute('data-theme'));

  it("uses Google's colours for each theme (branding guidelines)", () => {
    const host = rule(':host');
    for (const [k, v] of Object.entries({
      'light-fill': '#FFFFFF', 'light-stroke': '#747775', 'light-text': '#1F1F1F',
      'dark-fill': '#131314', 'dark-stroke': '#8E918F', 'dark-text': '#E3E3E3',
      'neutral-fill': '#F2F2F2', 'neutral-text': '#1F1F1F',
    })) expect(host).toContain(`--ui-google-${k}: ${v};`);
    expect(rule('.ui-gbtn[data-look="dark"]')).toContain('--g-fill: var(--ui-google-dark-fill); --g-stroke: var(--ui-google-dark-stroke); --g-text: var(--ui-google-dark-text);');
    expect(rule('.ui-gbtn[data-look="neutral"]')).toContain('--g-stroke: transparent');
    expect(rule('.ui-gbtn[data-look="neutral"]')).toContain('--g-fill: var(--ui-google-neutral-fill)');
  });

  it('is 40px high, 12px to the logo, 10px to the text, 12px after, Medium 14/20, 4px or pill corners', () => {
    const b = rule('    .ui-gbtn');
    expect(b).toContain('height: 40px;');
    expect(b).toContain('padding: 0 11px;'); // + the 1px stroke = 12px from the outer edge
    expect(b).toContain('border: 1px solid var(--g-stroke);');
    expect(b).toContain('gap: 10px;');
    expect(b).toContain('border-radius: 4px;');
    expect(b).toContain("font-family: 'Google Sans', Roboto, var(--ui-font-default);");
    expect(b).toContain('font-size: 14px;');
    expect(b).toContain('font-weight: 500;');
    expect(b).toContain('line-height: 20px;');
    expect(rule('.ui-gbtn[data-shape="pill"]')).toContain('border-radius: 20px;');
  });

  it('draws the four-colour G', () => {
    const { button } = make();
    const fills = [...button().querySelectorAll('svg path')].map((p) => p.getAttribute('fill'));
    expect(fills).toEqual(['#4285F4', '#34A853', '#FBBC04', '#E94235']);
    expect(button().querySelector('.logo')!.getAttribute('aria-hidden')).toBe('true');
  });

  it('shows the theme it was given', () => {
    const { f, h, button } = make();
    for (const t of ['light', 'dark', 'neutral'] as const) {
      h.theme.set(t);
      f.detectChanges();
      expect(button().getAttribute('data-look')).toBe(t);
    }
    h.shape.set('pill');
    f.detectChanges();
    expect(button().getAttribute('data-shape')).toBe('pill');
  });

  it('auto follows the library theme, and changes with it', async () => {
    document.documentElement.setAttribute('data-theme', 'maldives-dark');
    const { f, h, button } = make();
    h.theme.set('auto');
    TestBed.inject(ApplicationRef).tick();
    f.detectChanges();
    expect(button().getAttribute('data-look')).toBe('dark');
    document.documentElement.setAttribute('data-theme', 'maldives');
    await new Promise((r) => setTimeout(r));
    f.detectChanges();
    expect(button().getAttribute('data-look')).toBe('light');
  });

  it('knows which library themes are dark', () => {
    const el = document.createElement('div');
    document.body.appendChild(el);
    expect(uiGoogleIsDarkTheme(el)).toBe(true); // no data-theme: Winter Dark
    for (const [t, dark] of [['light', false], ['maldives', false], ['lightPink', false], ['dark', true], ['goldBlack', true], ['darkOrange', true], ['maldives-dark', true]] as const) {
      document.documentElement.setAttribute('data-theme', t);
      expect(uiGoogleIsDarkTheme(el), t).toBe(dark);
    }
    el.remove();
  });

  it('takes its words from the library strings, one per text', () => {
    const { f, h, button } = make();
    const words = { signIn: 'Sign in with Google', signUp: 'Sign up with Google', continueWith: 'Continue with Google', signInShort: 'Sign in' };
    for (const [k, v] of Object.entries(words)) {
      h.text.set(k as UiGoogleButtonText);
      f.detectChanges();
      expect(button().textContent!.trim()).toBe(v);
    }
  });

  it('can be translated with provideUiStrings', () => {
    TestBed.configureTestingModule({ providers: [provideUiStrings({ googleContinue: 'ގޫގުލް އިން ކުރިއަށް' })] });
    const { f, h, button } = make();
    h.text.set('continueWith');
    f.detectChanges();
    expect(button().textContent!.trim()).toBe('ގޫގުލް އިން ކުރިއަށް');
  });

  it('emits pressed on click; disabled does not', () => {
    const { f, h, button } = make();
    button().click();
    expect(h.presses()).toBe(1);
    h.disabled.set(true);
    f.detectChanges();
    expect(button().disabled).toBe(true);
    button().click();
    expect(h.presses()).toBe(1);
  });

  it('loading: a spinner instead of the G, aria-busy, not clickable', () => {
    const { f, h, button } = make();
    h.loading.set(true);
    f.detectChanges();
    expect(button().querySelector('svg')).toBeNull();
    expect(button().querySelector('.spin')).not.toBeNull();
    expect(button().getAttribute('aria-busy')).toBe('true');
    expect(button().disabled).toBe(true);
    button().click();
    expect(h.presses()).toBe(0);
    expect(button().textContent!.trim()).toBe('Sign in with Google'); // the words stay: same width
  });

  it('puts ariaLabel on the native button, and expand fills the width', () => {
    const { f, h, button } = make();
    expect(button().hasAttribute('aria-label')).toBe(false);
    h.label.set('Sign in to Dhirumi with Google');
    h.expand.set(true);
    f.detectChanges();
    expect(button().getAttribute('aria-label')).toBe('Sign in to Dhirumi with Google');
    expect((f.nativeElement as HTMLElement).querySelector('ui-google-button')!.hasAttribute('aria-label')).toBe(false);
    expect(button().classList).toContain('expand');
    expect((f.nativeElement as HTMLElement).querySelector('ui-google-button')!.classList).toContain('expand');
    expect(rule('.ui-gbtn.expand')).toContain('width: 100%');
  });
});
