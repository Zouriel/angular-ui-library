import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { UiCard, type UiCardAlign, type UiCardGap } from './card';
import { UiGlassBackdrop } from './glass-backdrop';
import { UiCardActions } from './card-actions';
import { UI_LINK_NAVIGATOR } from '@zouriel/ui';
import { UI_LIQUID_REFRACTION, uiLiquidBand, uiLiquidDisplacementMap } from './liquid-glass';

@Component({
  imports: [UiCard],
  template: `
    <ui-card
      [interactive]="interactive()"
      [pressable]="pressable()"
      [disabled]="disabled()"
      [ariaLabel]="ariaLabel()"
      [href]="href()"
      [target]="target()"
      [gap]="gap()"
      [align]="align()"
      [radius]="radius()"
      (activate)="activations.set(activations() + 1)"
    >
      <span class="body-text">Body</span>
      <button type="button" class="inner-btn">Inner</button>
    </ui-card>
  `,
})
class Host {
  interactive = signal(false);
  pressable = signal(false);
  disabled = signal(false);
  ariaLabel = signal<string | null>(null);
  gap = signal<UiCardGap | null>(null);
  align = signal<UiCardAlign | null>(null);
  radius = signal<boolean | 'xl'>(true);
  href = signal<string | null>(null);
  target = signal<string | null>(null);
  activations = signal(0);
}

const css = () =>
  ((UiCard as unknown as { ɵcmp: { styles: string[] } }).ɵcmp.styles ?? []).join('\n');

describe('UiCard', () => {
  it('uses a positioned static slice inside UiGlassBackdrop and keeps live glass outside it', async () => {
    @Component({
      imports: [UiCard, UiGlassBackdrop],
      template: `<ui-glass-backdrop><ui-card [glass]="true" glassStrength="liquid">Static</ui-card></ui-glass-backdrop>`,
    })
    class StaticHost {}
    const fixture = TestBed.createComponent(StaticHost);
    fixture.detectChanges();
    await fixture.whenStable();
    const card = fixture.nativeElement.querySelector('.ui-card') as HTMLElement;
    expect(card.classList.contains('static-glass')).toBe(true);
    const backdrop = fixture.nativeElement.querySelector('ui-glass-backdrop') as HTMLElement;
    vi.spyOn(backdrop, 'getBoundingClientRect').mockReturnValue({ left: 10, top: 20, width: 300, height: 200 } as DOMRect);
    vi.spyOn(card, 'getBoundingClientRect').mockReturnValue({ left: 35, top: 70, width: 100, height: 50 } as DOMRect);
    document.dispatchEvent(new Event('scroll'));
    expect(card.style.getPropertyValue('--_ui-glass-backdrop-x')).toBe('25px');
    expect(card.style.getPropertyValue('--_ui-glass-backdrop-y')).toBe('50px');
    expect(css()).toMatch(/static-glass[^}]*backdrop-filter:\s*none/);
    expect(css()).toContain('--_ui-glass-backdrop-x');
    expect(css()).toContain('var(--ui-glass-highlight)');
  });

  it('does not add a blur slice or refraction map when the static backdrop has no image', async () => {
    @Component({
      imports: [UiCard, UiGlassBackdrop],
      template: `<ui-glass-backdrop><ui-card [glass]="true" glassStrength="liquid">No image</ui-card></ui-glass-backdrop>`,
    })
    class EmptyStaticHost {}
    const fixture = TestBed.createComponent(EmptyStaticHost);
    fixture.detectChanges();
    await fixture.whenStable();
    const card = fixture.nativeElement.querySelector('.ui-card') as HTMLElement;
    expect(card.classList.contains('static-glass-empty')).toBe(true);
    expect(fixture.nativeElement.querySelector('.lq-defs')).toBeNull();
    expect(css()).toMatch(/static-glass-empty[^}]*::before[^}]*display:\s*none/);
  });

  it('projects ui-card-actions into the footer and keeps the body slack contract', () => {
    @Component({
      imports: [UiCard, UiCardActions],
      template: `<ui-card
        ><span>Short body</span><ui-card-actions><button>Go</button></ui-card-actions></ui-card
      >`,
    })
    class ActionsHost {}
    const fixture = TestBed.createComponent(ActionsHost);
    fixture.detectChanges();
    const card = fixture.nativeElement.querySelector('.ui-card') as HTMLElement;
    expect(card.querySelector('.ft ui-card-actions')).toBeTruthy();
    expect(card.querySelector('.bd')?.textContent).toContain('Short body');
    expect(css()).toMatch(/\.bd[^}]*\{[^}]*flex:\s*1 1 auto/);
    expect(css()).toMatch(/\.ft[^}]*\{[^}]*border-top/);
  });

  it('supports action alignment variants, wrapping, logical direction and equal stretch', () => {
    @Component({
      imports: [UiCardActions],
      template: `<ui-card-actions [align]="align()"
        ><button>A</button><button>B</button></ui-card-actions
      >`,
    })
    class ActionsOnlyHost {
      align = signal<'start' | 'center' | 'end' | 'stretch' | 'between'>('start');
    }
    const fixture = TestBed.createComponent(ActionsOnlyHost);
    fixture.detectChanges();
    const host = fixture.nativeElement.querySelector('ui-card-actions') as HTMLElement;
    expect(host.getAttribute('data-align')).toBe('start');
    fixture.componentInstance.align.set('center');
    fixture.detectChanges();
    expect(host.getAttribute('data-align')).toBe('center');
    fixture.componentInstance.align.set('between');
    fixture.detectChanges();
    expect(host.getAttribute('data-align')).toBe('between');
    fixture.componentInstance.align.set('stretch');
    fixture.detectChanges();
    expect(host.getAttribute('data-align')).toBe('stretch');
    const styles = (
      (UiCardActions as unknown as { ɵcmp: { styles: string[] } }).ɵcmp.styles ?? []
    ).join('\n');
    expect(styles).toContain('flex-wrap: wrap');
    expect(styles).toContain('justify-content: space-between');
    expect(styles).toMatch(/data-align="?center"?\][^{]*\{\s*justify-content: center/);
    expect(styles).toContain('flex: 1 1 0');
    expect(host.getAttribute('role')).toBeNull();
  });

  it('defaults to an undivided action footer and restores the footer band when divided', () => {
    @Component({
      imports: [UiCard, UiCardActions],
      template: `<ui-card
        ><span>Body</span
        ><ui-card-actions [divided]="divided()"><button>Go</button></ui-card-actions></ui-card
      >`,
    })
    class ActionsFooterHost {
      divided = signal(false);
    }
    const fixture = TestBed.createComponent(ActionsFooterHost);
    fixture.detectChanges();
    const actions = fixture.nativeElement.querySelector('ui-card-actions') as HTMLElement;
    expect(actions.hasAttribute('data-divided')).toBe(false);
    expect(css()).toMatch(
      /\.ft[^\{]*:has\(> ui-card-actions:not\(\[data-divided\]\)\)[^{]*\{[^}]*border-top:\s*0[^}]*padding-top:\s*0/,
    );
    fixture.componentInstance.divided.set(true);
    fixture.detectChanges();
    expect(actions.getAttribute('data-divided')).toBe('true');
  });

  it('keeps card-footer projection and collapses an empty footer', () => {
    @Component({
      imports: [UiCard],
      template: `<ui-card><span card-footer>Footer</span></ui-card>`,
    })
    class FooterHost {}
    const withFooter = TestBed.createComponent(FooterHost);
    withFooter.detectChanges();
    expect(withFooter.nativeElement.querySelector('.ft')?.textContent).toContain('Footer');
    @Component({ imports: [UiCard], template: `<ui-card></ui-card>` })
    class EmptyHost {}
    const empty = TestBed.createComponent(EmptyHost);
    empty.detectChanges();
    expect(css()).toMatch(/\.hd[^}]*:empty[^}]*,\s*\.ft[^}]*:empty[^}]*\{[^}]*display: none/);
  });
  it('leaves a static card non-interactive with default block body', () => {
    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    const card = (fixture.nativeElement as HTMLElement).querySelector('.ui-card') as HTMLElement;
    const bd = card.querySelector('.bd') as HTMLElement;
    expect(card.getAttribute('role')).toBeNull();
    expect(card.getAttribute('tabindex')).toBeNull();
    expect(card.getAttribute('aria-label')).toBeNull();
    expect(bd.classList.contains('bd-flex')).toBe(false);
    card.click();
    expect(fixture.componentInstance.activations()).toBe(0);
  });

  it('keeps an interactive card visual only, so it can sit inside a link or button', () => {
    const fixture = TestBed.createComponent(Host);
    fixture.componentInstance.interactive.set(true);
    fixture.detectChanges();
    const card = (fixture.nativeElement as HTMLElement).querySelector('.ui-card') as HTMLElement;
    expect(card.classList.contains('interactive')).toBe(true);
    expect(card.getAttribute('role')).toBeNull();
    expect(card.getAttribute('tabindex')).toBeNull();
    card.click();
    card.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', cancelable: true }));
    expect(fixture.componentInstance.activations()).toBe(0);
  });

  it('adds button semantics, ariaLabel, and click/Enter/Space activation when pressable', () => {
    const fixture = TestBed.createComponent(Host);
    fixture.componentInstance.pressable.set(true);
    fixture.componentInstance.ariaLabel.set('Aisha, 12 photos');
    fixture.detectChanges();
    const card = (fixture.nativeElement as HTMLElement).querySelector('.ui-card') as HTMLElement;

    expect(card.getAttribute('role')).toBe('button');
    expect(card.getAttribute('tabindex')).toBe('0');
    expect(card.getAttribute('aria-label')).toBe('Aisha, 12 photos');

    card.click();
    expect(fixture.componentInstance.activations()).toBe(1);

    const enter = new KeyboardEvent('keydown', { key: 'Enter', cancelable: true });
    card.dispatchEvent(enter);
    expect(fixture.componentInstance.activations()).toBe(2);

    const space = new KeyboardEvent('keydown', { key: ' ', cancelable: true });
    card.dispatchEvent(space);
    expect(space.defaultPrevented).toBe(true);
    expect(fixture.componentInstance.activations()).toBe(3);

    // Nested native buttons should not also fire card activate.
    (card.querySelector('.inner-btn') as HTMLButtonElement).click();
    expect(fixture.componentInstance.activations()).toBe(3);
  });

  it('renders href cards as focused, undecorated anchors and delegates plain internal clicks', () => {
    const navigate = vi.fn();
    TestBed.configureTestingModule({ providers: [{ provide: UI_LINK_NAVIGATOR, useValue: { navigate } }] });
    const fixture = TestBed.createComponent(Host);
    fixture.componentInstance.href.set('/categories/design');
    fixture.componentInstance.target.set('_blank');
    fixture.componentInstance.ariaLabel.set('Design, 12 items');
    fixture.detectChanges();
    const card = fixture.nativeElement.querySelector('a.ui-card') as HTMLAnchorElement;
    expect(card.getAttribute('href')).toBe('/categories/design');
    expect(card.getAttribute('target')).toBe('_blank');
    expect(card.getAttribute('rel')).toBe('noopener noreferrer');
    expect(card.getAttribute('aria-label')).toBe('Design, 12 items');
    expect(card.getAttribute('tabindex')).toBeNull();
    expect(css()).toMatch(/a\.ui-card[^}]*text-decoration:\s*none/);
    card.dispatchEvent(new MouseEvent('click', { bubbles: true, button: 0 }));
    expect(navigate).not.toHaveBeenCalled();
    fixture.componentInstance.target.set(null);
    fixture.detectChanges();
    card.dispatchEvent(new MouseEvent('click', { bubbles: true, button: 0 }));
    expect(navigate).toHaveBeenCalledWith('/categories/design', expect.any(MouseEvent));
    card.dispatchEvent(new MouseEvent('click', { bubbles: true, button: 0, ctrlKey: true }));
    expect(navigate).toHaveBeenCalledTimes(1);
  });

  it('disables focus, semantics and activation when disabled is true', () => {
    const fixture = TestBed.createComponent(Host);
    fixture.componentInstance.pressable.set(true);
    fixture.componentInstance.disabled.set(true);
    fixture.detectChanges();
    const card = (fixture.nativeElement as HTMLElement).querySelector('.ui-card') as HTMLElement;

    expect(card.getAttribute('tabindex')).toBeNull();
    expect(card.getAttribute('aria-disabled')).toBe('true');
    expect(card.classList.contains('disabled')).toBe(true);

    card.click();
    card.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', cancelable: true }));
    card.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', cancelable: true }));
    expect(fixture.componentInstance.activations()).toBe(0);
  });

  it('enables flex column body with gap and align tokens', () => {
    const fixture = TestBed.createComponent(Host);
    fixture.componentInstance.gap.set(2);
    fixture.componentInstance.align.set('center');
    fixture.detectChanges();
    const bd = (fixture.nativeElement as HTMLElement).querySelector('.bd') as HTMLElement;

    expect(bd.classList.contains('bd-flex')).toBe(true);
    expect(bd.getAttribute('data-gap')).toBe('2');
    expect(bd.getAttribute('data-align')).toBe('center');
    expect(css()).toMatch(/\.bd\[data-gap=["']?2["']?\][^{]*\{[^}]*var\(--ui-space-2\)/);
    expect(css()).toMatch(/\.bd\[data-align=["']?center["']?\][^{]*\{[^}]*align-items:\s*center/);
    expect(css()).toMatch(/\.bd\[data-align=["']?center["']?\][^{]*\{[^}]*text-align:\s*center/);
  });

  it('supports radius="xl" and card padding tokens', () => {
    const fixture = TestBed.createComponent(Host);
    fixture.componentInstance.radius.set('xl');
    fixture.detectChanges();
    const card = (fixture.nativeElement as HTMLElement).querySelector('.ui-card') as HTMLElement;
    expect(card.classList.contains('radius-xl')).toBe(true);
    expect(card.classList.contains('no-radius')).toBe(false);
    expect(css()).toContain('var(--ui-radius-xl)');
    expect(css()).toContain('var(--ui-card-pad-sm)');
    expect(css()).toContain('var(--ui-card-pad-md)');
    expect(css()).toContain('var(--ui-card-pad-lg)');
  });
});

@Component({
  imports: [UiCard],
  template: `<ui-card [glass]="glass()" [glassStrength]="strength()">Body</ui-card>`,
})
class GlassHost {
  glass = signal(true);
  strength = signal<'frosted' | 'clear'>('frosted');
}

describe('UiCard glassStrength', () => {
  it('is frosted by default and clear on request, only while glass is on', () => {
    const f = TestBed.createComponent(GlassHost);
    f.detectChanges();
    const card = f.nativeElement.querySelector('.ui-card') as HTMLElement;
    expect(card.classList).toContain('glass');
    expect(card.classList).not.toContain('clear');
    f.componentInstance.strength.set('clear');
    f.detectChanges();
    expect(card.classList).toContain('clear');
    f.componentInstance.glass.set(false);
    f.detectChanges();
    expect(card.classList).not.toContain('clear');
  });

  it('paints clear glass from the card tokens, solid without backdrop-filter or under reduced transparency', () => {
    const styles = css();
    expect(styles).toMatch(
      /\.ui-card\.glass\.clear[^{]*\{[^}]*background:\s*var\(--ui-glass-card-clear-bg\)[^}]*backdrop-filter:\s*var\(--ui-glass-card-clear-filter\)/,
    );
    expect(styles).toMatch(
      /@supports not[^{]*\{[^{}]*\.ui-card\.glass\.clear[^{]*\{\s*background:\s*var\(--ui-color-surface\)/,
    );
    expect(styles).toMatch(
      /prefers-reduced-transparency[^{]*\{[^{}]*\.ui-card\.glass\.clear[^{]*\{[^}]*backdrop-filter:\s*none/,
    );
    // The frosted look is unchanged.
    expect(styles).toMatch(/\.ui-card\.glass[^.{]*\{[^}]*background:\s*var\(--ui-glass-bg\)/);
  });
});

@Component({
  imports: [UiCard],
  template: `<ui-card [glass]="true" [glassStrength]="strength()" radius="xl"
    ><p>Body</p>
    <button type="button">Go</button></ui-card
  >`,
})
class LiquidHost {
  strength = signal<'frosted' | 'clear' | 'liquid'>('liquid');
}

describe('UiCard liquid glass', () => {
  // jsdom defines offsetWidth/offsetHeight on HTMLElement.prototype itself: restore the originals afterwards
  // (deleting them would remove them for every later spec in the same worker).
  const realOffsetWidth = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetWidth')!;
  const realOffsetHeight = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetHeight')!;
  const size = (w: number, h: number) => {
    Object.defineProperty(HTMLElement.prototype, 'offsetWidth', {
      configurable: true,
      get(this: HTMLElement) {
        return this.classList.contains('ui-card') ? w : 0;
      },
    });
    Object.defineProperty(HTMLElement.prototype, 'offsetHeight', {
      configurable: true,
      get(this: HTMLElement) {
        return this.classList.contains('ui-card') ? h : 0;
      },
    });
  };
  afterEach(() => {
    Object.defineProperty(HTMLElement.prototype, 'offsetWidth', realOffsetWidth);
    Object.defineProperty(HTMLElement.prototype, 'offsetHeight', realOffsetHeight);
    vi.unstubAllGlobals();
  });

  async function make(refract: boolean, opts: { canvas?: boolean } = {}) {
    let resize: (() => void) | null = null;
    vi.stubGlobal(
      'ResizeObserver',
      class {
        constructor(cb: () => void) {
          resize = cb;
        }
        observe() {}
        disconnect() {}
      },
    );
    if (opts.canvas !== false) {
      // jsdom has no 2D canvas: a minimal one that returns a data URL.
      vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(
        () =>
          ({
            createImageData: (w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }),
            putImageData: () => undefined,
          }) as unknown as CanvasRenderingContext2D,
      );
      vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockImplementation(
        () => 'data:image/png;base64,MAP',
      );
    }
    size(360, 240);
    TestBed.configureTestingModule({
      providers: [{ provide: UI_LIQUID_REFRACTION, useValue: () => refract }],
    });
    const f = TestBed.createComponent(LiquidHost);
    f.detectChanges();
    await f.whenStable();
    f.detectChanges();
    return { f, resize: () => resize?.() };
  }

  it('bends the backdrop at the edges in Chromium: an SVG displacement filter sized to the card, in backdrop-filter', async () => {
    const { f, resize } = await make(true);
    const card = f.nativeElement.querySelector('.ui-card') as HTMLElement;
    expect(card.classList).toContain('liquid');
    const filter = f.nativeElement.querySelector('svg.lq-defs filter') as SVGFilterElement;
    expect(filter).toBeTruthy();
    expect(filter.querySelector('feDisplacementMap')).toBeTruthy();
    expect(filter.querySelector('feImage')!.getAttribute('href')).toBe('data:image/png;base64,MAP');
    expect(filter.getAttribute('width')).toBe('360');
    expect(card.style.getPropertyValue('--_lq-url')).toBe(`url(#${filter.id})`);
    // A new size rebuilds the map at that size.
    size(500, 300);
    resize();
    f.detectChanges();
    expect(f.nativeElement.querySelector('svg.lq-defs filter')!.getAttribute('width')).toBe('500');
    expect(f.nativeElement.querySelector('svg.lq-defs feImage')!.getAttribute('height')).toBe(
      '300',
    );
  });

  it('falls back to blur, saturation, rim and sheen without the bend elsewhere (Safari, Firefox)', async () => {
    const { f } = await make(false);
    const card = f.nativeElement.querySelector('.ui-card') as HTMLElement;
    expect(card.classList).toContain('liquid');
    expect(f.nativeElement.querySelector('svg.lq-defs')).toBeNull();
    expect(card.style.getPropertyValue('--_lq-url')).toBe('');
  });

  it('is at least 80% transparent with no contrast or brightness squeeze, frosted under reduced transparency, solid without backdrop-filter', () => {
    const styles = css();
    const rule = /\.ui-card\.glass\.liquid\[[^\]]*\]\s*\{([^}]*)\}/.exec(styles)?.[1] ?? '';
    expect(rule).toContain('var(--ui-glass-liquid-bg)');
    expect(rule).toMatch(
      /backdrop-filter:\s*var\(--_lq-url,\s*\)\s*var\(--ui-glass-liquid-filter\)/,
    );
    expect(rule).not.toMatch(/contrast\(|brightness\(/);
    expect(rule).toContain('var(--ui-glass-liquid-text-halo)');
    expect(rule).toContain('var(--ui-glass-liquid-rim)');
    expect(styles).toMatch(
      /prefers-reduced-transparency[^{]*\{[^{}]*\.ui-card\.glass\.liquid[^{]*\{[^}]*background:\s*var\(--ui-glass-bg\)[^}]*backdrop-filter:\s*blur\(var\(--ui-glass-blur\)\)/,
    );
    expect(styles).toMatch(
      /@supports not[^{]*\{[^{}]*\.ui-card\.glass\.liquid[^{]*\{\s*background:\s*var\(--ui-color-surface\)/,
    );
    // The card's own controls keep their surfaces: no halo on them.
    expect(styles).toMatch(
      /\.ui-card\.glass\.liquid[^{]*:is\(button, input[^{]*\{\s*text-shadow:\s*none/,
    );
  });

  // Runs last in this block, after every stub above was undone by afterEach.
  it('leaves jsdom\'s own offsetWidth/offsetHeight getters in place for later specs', () => {
    expect(Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetWidth')?.get).toBe(realOffsetWidth.get);
    expect(Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetHeight')?.get).toBe(realOffsetHeight.get);
  });
});

describe('liquid displacement map', () => {
  it('leaves the middle undistorted and pulls inward near every edge, scaled to the card', () => {
    const w = 200,
      h = 100;
    const { data, width, height } = uiLiquidDisplacementMap(w, h, 24, uiLiquidBand(w, h), 1);
    expect([width, height]).toEqual([200, 100]);
    const at = (x: number, y: number) => {
      const o = (y * width + x) * 4;
      return [data[o], data[o + 1]];
    };
    expect(at(100, 50)).toEqual([128, 128]); // middle
    expect(at(199, 50)[0]).toBeLessThan(100); // right edge samples from the left
    expect(at(0, 50)[0]).toBeGreaterThan(156); // left edge samples from the right
    expect(at(100, 0)[1]).toBeGreaterThan(156); // top edge samples from below
    expect(at(100, 99)[1]).toBeLessThan(100); // bottom edge samples from above
    const corner = at(2, 2);
    expect(corner[0]).toBeGreaterThan(128);
    expect(corner[1]).toBeGreaterThan(128);
    expect(uiLiquidDisplacementMap(400, 300, 32, 20, 0.5).width).toBe(200);
  });
});
