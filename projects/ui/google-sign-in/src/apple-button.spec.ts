import { ApplicationRef, Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it } from 'vitest';
import { provideUiStrings, uiStringsDv } from '@zouriel/ui';
import { UiAppleButton, type UiAppleButtonShape, type UiAppleButtonText, type UiAppleButtonTheme } from './apple-button';

@Component({
  imports: [UiAppleButton],
  template: `<ui-apple-button [text]="text()" [theme]="theme()" [shape]="shape()" [loading]="loading()" [disabled]="disabled()"
    [expand]="expand()" [ariaLabel]="label()" (pressed)="presses.set(presses() + 1)" />`,
})
class Host {
  text = signal<UiAppleButtonText>('signIn');
  theme = signal<UiAppleButtonTheme>('black');
  shape = signal<UiAppleButtonShape>('rectangular');
  loading = signal(false);
  disabled = signal(false);
  expand = signal(false);
  label = signal<string | undefined>(undefined);
  presses = signal(0);
}

/** The exact logo path shared with Flutter's UiAppleSignInButton. */
const APPLE_PATH =
  'M 12.69475 8.90692 C 11.4825 8.90692 9.606 7.51471 7.62975 7.56524 C 5.0225 7.59872 2.63125 9.09168 1.28625 11.45667 C -1.42075 16.2037 0.58875 23.21528 3.229 27.07323 C 4.52425 28.95214 6.05225 31.06541 8.07825 30.99845 C 10.021 30.91444 10.75175 29.72373 13.10975 29.72373 C 15.45125 29.72373 16.1155 30.99845 18.17475 30.94823 C 20.26725 30.91444 21.59575 29.03584 22.8745 27.1405 C 24.35225 24.95965 24.96675 22.84638 25 22.72889 C 24.95025 22.71215 20.9315 21.15223 20.8815 16.45542 C 20.8485 12.5302 24.0535 10.6516 24.203 10.56759 C 22.37625 7.86718 19.56975 7.56524 18.59 7.49797 C 16.0325 7.29678 13.89025 8.90692 12.69475 8.90692 Z M 17.01225 4.94822 C 18.09175 3.64002 18.80575 1.81164 18.6065 0 C 17.06225 0.06696 15.20225 1.04005 14.08975 2.34825 C 13.09325 3.50579 12.22975 5.36765 12.46225 7.14581 C 14.17275 7.28004 15.933 6.25673 17.01225 4.94822 Z';

/** The compiled component styles (what the browser gets), as selector -> declarations. Encapsulation
 *  attributes are dropped and `[_nghost]` reads as `:host`, whitespace is collapsed. */
const rules = (() => {
  const css = ((UiAppleButton as unknown as { ɵcmp: { styles: string[] } }).ɵcmp.styles ?? []).join('\n');
  const map = new Map<string, string>();
  for (const m of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const sel = m[1].replace(/\[_nghost-[^\]]*\]/g, ':host').replace(/\[_ngcontent-[^\]]*\]/g, '').replace(/\s+/g, ' ').trim();
    const body = m[2].replace(/\s+/g, ' ').trim();
    map.set(sel, (map.get(sel) ?? '') + body);
  }
  return map;
})();
const rule = (sel: string) => rules.get(sel) ?? '';

function make() {
  const f = TestBed.createComponent(Host);
  f.detectChanges();
  const el = f.nativeElement as HTMLElement;
  const button = () => el.querySelector('button.ui-abtn') as HTMLButtonElement;
  return { f, h: f.componentInstance, button, el };
}

describe('ui-apple-button', () => {
  afterEach(() => document.documentElement.removeAttribute('data-theme'));

  it('takes its words from the library strings, one per text', () => {
    const { f, h, button } = make();
    const words = { signIn: 'Sign in with Apple', continueWith: 'Continue with Apple', signUp: 'Sign up with Apple' };
    for (const [k, v] of Object.entries(words)) {
      h.text.set(k as UiAppleButtonText);
      f.detectChanges();
      expect(button().textContent!.trim()).toBe(v);
    }
  });

  it('has Dhivehi wordings and can be translated with provideUiStrings', () => {
    expect(uiStringsDv.appleSignIn).toBe('އެޕަލްއިން ސައިން އިން ކުރޭ');
    expect(uiStringsDv.appleSignUp).toBe('އެޕަލްއިން ސައިން އަޕް ކުރޭ');
    expect(uiStringsDv.appleContinue).toBe('އެޕަލްއިން ކުރިއަށް');
    TestBed.configureTestingModule({ providers: [provideUiStrings({ appleContinue: 'އެޕަލްއިން ކުރިއަށް' })] });
    const { f, h, button } = make();
    h.text.set('continueWith');
    f.detectChanges();
    expect(button().textContent!.trim()).toBe('އެޕަލްއިން ކުރިއަށް');
  });

  it('auto is black on a light theme and white on a dark one, and follows theme changes', async () => {
    document.documentElement.setAttribute('data-theme', 'light');
    const { f, h, button } = make();
    h.theme.set('auto');
    TestBed.inject(ApplicationRef).tick();
    f.detectChanges();
    expect(button().getAttribute('data-look')).toBe('black');
    document.documentElement.setAttribute('data-theme', 'maldives-dark');
    await new Promise((r) => setTimeout(r));
    f.detectChanges();
    expect(button().getAttribute('data-look')).toBe('white');
  });

  it('shows the appearance it was given', () => {
    const { f, h, button } = make();
    for (const t of ['black', 'white', 'whiteOutline'] as const) {
      h.theme.set(t);
      f.detectChanges();
      expect(button().getAttribute('data-look')).toBe(t);
    }
  });

  it("uses Apple's colours: black/white, white/black, white/black with a 1px black outline", () => {
    const host = rule(':host');
    for (const [k, v] of Object.entries({
      'black-fill': '#000000', 'black-text': '#FFFFFF', 'white-fill': '#FFFFFF', 'white-text': '#000000', 'outline-stroke': '#000000',
    })) expect(host).toContain(`--ui-apple-${k}: ${v};`);
    const base = rule('.ui-abtn');
    expect(base).toContain('--a-fill: var(--ui-apple-black-fill);');
    expect(base).toContain('--a-text: var(--ui-apple-black-text);');
    expect(base).toContain('--a-stroke: transparent;');
    expect(base).toContain('border: 1px solid var(--a-stroke);');
    expect(base).toContain('background: var(--a-fill);');
    expect(base).toContain('color: var(--a-text);');
    const white = rule('.ui-abtn[data-look=white]');
    expect(white).toContain('--a-fill: var(--ui-apple-white-fill);');
    expect(white).toContain('--a-text: var(--ui-apple-white-text);');
    expect(white).toContain('--a-stroke: transparent;'); // no border
    const outline = rule('.ui-abtn[data-look=whiteOutline]');
    expect(outline).toContain('--a-fill: var(--ui-apple-white-fill);');
    expect(outline).toContain('--a-text: var(--ui-apple-white-text);');
    expect(outline).toContain('--a-stroke: var(--ui-apple-outline-stroke);'); // the border
  });

  it('is 40px high, 16px each side, logo and words centred together with a 6px gap, system font Medium 17/20', () => {
    const b = rule('.ui-abtn');
    expect(b).toContain('height: 40px;');
    expect(b).toContain('padding: 0 15px;'); // + the 1px stroke = 16px from the outer edge
    expect(b).toContain('gap: 6px;');
    expect(b).toContain('justify-content: center;');
    expect(b).toContain('border-radius: 6px;');
    expect(b).toContain('font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", Roboto, system-ui, sans-serif, var(--ui-font-default);');
    expect(b).toContain('font-size: 17px;');
    expect(b).toContain('font-weight: 500;');
    expect(b).toContain('line-height: 20px;');
    expect(b).toContain('white-space: nowrap;');
    expect(rule('.label')).toContain('text-overflow: ellipsis;');
    expect(rule('.logo')).toContain('height: 17px;');
    expect(rule('.logo')).toContain('width: calc(17px * 25 / 31);');
  });

  it('pill corners are half the height', () => {
    const { f, h, button } = make();
    h.shape.set('pill');
    f.detectChanges();
    expect(button().getAttribute('data-shape')).toBe('pill');
    expect(rule('.ui-abtn[data-shape=pill]')).toContain('border-radius: 20px;');
  });

  it('hover and press wash in the ink colour (8% / 12%), disabled at half opacity, the focus ring', () => {
    expect(rule('.ui-abtn::after')).toContain('background: currentColor;');
    expect(rule('.ui-abtn:hover:not(:disabled)::after')).toContain('opacity: 0.08;');
    expect(rule('.ui-abtn:active:not(:disabled)::after')).toContain('opacity: 0.12;');
    expect(rule('.ui-abtn:disabled')).toContain('opacity: 0.5;');
    expect(rule('.ui-abtn:focus-visible')).toContain('box-shadow: var(--ui-focus-ring);');
  });

  it('draws the Apple logo with the shared path, in currentColor, hidden from assistive technology, before the words', () => {
    const { button } = make();
    const svg = button().querySelector('svg')!;
    expect(svg.getAttribute('viewBox')).toBe('0 0 25 31');
    const path = svg.querySelector('path')!;
    expect(path.getAttribute('d')).toBe(APPLE_PATH);
    expect(path.getAttribute('fill')).toBe('currentColor');
    const logo = button().querySelector('.logo')!;
    expect(logo.getAttribute('aria-hidden')).toBe('true');
    expect(button().firstElementChild).toBe(logo);
    expect(logo.nextElementSibling!.classList).toContain('label');
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

  it('loading: a spinner the size of the logo instead of it, aria-busy, not clickable, the words stay', () => {
    const { f, h, button } = make();
    h.loading.set(true);
    f.detectChanges();
    expect(button().querySelector('svg')).toBeNull();
    expect(button().querySelector('.logo .spin')).not.toBeNull();
    expect(rule('.spin')).toContain('width: 100%;');
    expect(rule('.spin')).toContain('aspect-ratio: 1;');
    expect(button().getAttribute('aria-busy')).toBe('true');
    expect(button().disabled).toBe(true);
    button().click();
    expect(h.presses()).toBe(0);
    expect(button().textContent!.trim()).toBe('Sign in with Apple');
  });

  it('the accessible name is the words unless ariaLabel is given, on the native button; expand fills the width', () => {
    const { f, h, button, el } = make();
    expect(button().hasAttribute('aria-label')).toBe(false);
    expect(button().textContent!.trim()).toBe('Sign in with Apple'); // the name from content; the logo is aria-hidden
    h.label.set('Sign in to Dhirumi with Apple');
    h.expand.set(true);
    f.detectChanges();
    expect(button().getAttribute('aria-label')).toBe('Sign in to Dhirumi with Apple');
    expect(el.querySelector('ui-apple-button')!.hasAttribute('aria-label')).toBe(false);
    expect(button().classList).toContain('expand');
    expect(el.querySelector('ui-apple-button')!.classList).toContain('expand');
    expect(rule('.ui-abtn.expand')).toContain('width: 100%;');
  });
});
