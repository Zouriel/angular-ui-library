import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { HugeiconsIconComponent } from '@hugeicons/angular';
import StethoscopeIcon from '@hugeicons/core-free-icons/StethoscopeIcon';
import { UI_CONFIG, defaultUiConfig } from '@zouriel/ui';
import { UiInput } from '@zouriel/ui/form';
import { UiFeatureCard, type UiFeatureLayout, type UiFeatureRadius, type UiFeatureSize, type UiFeatureSurface, type UiFeatureTone } from './feature-card';

@Component({
  imports: [UiFeatureCard, HugeiconsIconComponent],
  template: `
    <div [attr.dir]="dir()">
      <ui-feature-card id="c" title="Find a doctor" [description]="description()" eyebrow="Clinics" [actionLabel]="actionLabel()"
                       [href]="href()" [tone]="tone()" [layout]="layout()" [size]="size()" [disabled]="disabled()" (action)="hits.push($event)">
        <hugeicons-icon feature-icon [icon]="icon" />
      </ui-feature-card>
      <ui-feature-card id="s" title="Static" description="No action" [headingLevel]="2" />
      <ui-feature-card id="i" title="Img"><svg icon viewBox="0 0 24 24"></svg></ui-feature-card>
    </div>
  `,
})
class Host {
  readonly icon = StethoscopeIcon;
  readonly description = signal('Book a visit at a clinic near you.');
  readonly actionLabel = signal('Book now');
  readonly href = signal<string | undefined>(undefined);
  readonly tone = signal<UiFeatureTone>('primary');
  readonly layout = signal<UiFeatureLayout>('vertical');
  readonly size = signal<'md' | 'lg'>('md');
  readonly disabled = signal(false);
  readonly dir = signal<'ltr' | 'rtl'>('ltr');
  hits: MouseEvent[] = [];
}

const setup = () => {
  const f = TestBed.createComponent(Host);
  f.detectChanges();
  const el = f.nativeElement as HTMLElement;
  return { f, el, h: f.componentInstance, q: (s: string) => el.querySelector(s) as HTMLElement | null };
};
const controls = (root: Element) => root.querySelectorAll('button, a[href], [tabindex]:not([tabindex="-1"]), input, select, textarea');
const named = (el: Element, attr: string) => el.getAttribute(attr)!.split(' ').map((id) => document.getElementById(id)?.textContent?.trim() ?? `#${id}?`).join(', ');

describe('UiFeatureCard', () => {
  it('a card with an action has exactly one control, named "title, action" and described by the description', () => {
    const { f, el, q } = setup();
    document.body.appendChild(el);
    try {
      const card = q('#c')!;
      expect(controls(card).length).toBe(1);
      const btn = card.querySelector('button.hit')!;
      expect(btn.getAttribute('type')).toBe('button');
      expect(named(btn, 'aria-labelledby')).toBe('Find a doctor, Book now');
      expect(named(btn, 'aria-describedby')).toBe('Book a visit at a clinic near you.');
      expect(q('#c .fc')!.classList.contains('interactive')).toBe(true);
      f.componentInstance.description.set('');
      f.detectChanges();
      expect(btn.hasAttribute('aria-describedby')).toBe(false);
    } finally {
      el.remove();
    }
  });

  it('stretches the one control over the whole card, so a click anywhere activates it', () => {
    const { q } = setup();
    expect(getComputedStyle(q('#c .fc')!).position).toBe('relative');
    const rules = [...document.styleSheets].flatMap((s) => [...s.cssRules]).filter((r): r is CSSStyleRule => r instanceof CSSStyleRule);
    const after = rules.find((r) => /\.hit\S*::after/.test(r.selectorText));
    expect(after).toBeDefined();
    expect(after!.style.position).toBe('absolute');
    expect(after!.style.inset || after!.style.top).toMatch(/^0(px)?$/);
  });

  it('emits action on click, and not while disabled', () => {
    const { f, h, q } = setup();
    q('#c button')!.click();
    expect(h.hits.length).toBe(1);
    h.disabled.set(true);
    f.detectChanges();
    const btn = q('#c button') as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
    expect(q('#c .fc')!.classList.contains('disabled')).toBe(true);
    btn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(h.hits.length).toBe(1);
  });

  it('with href the action is a link; disabled drops the href and says so', () => {
    const { f, h, q } = setup();
    h.href.set('/doctors');
    f.detectChanges();
    expect(q('#c button')).toBeNull();
    const a = q('#c a.hit')!;
    expect(a.getAttribute('href')).toBe('/doctors');
    a.addEventListener('click', (e) => e.preventDefault()); // keep jsdom from navigating
    a.click();
    expect(h.hits.length).toBe(1);
    h.disabled.set(true);
    f.detectChanges();
    expect(a.hasAttribute('href')).toBe(false);
    expect(a.getAttribute('aria-disabled')).toBe('true');
    a.click();
    expect(h.hits.length).toBe(1);
  });

  it('with href and no action label the title is the link (named by the title)', () => {
    const { f, h, q } = setup();
    h.href.set('/doctors');
    h.actionLabel.set('');
    f.detectChanges();
    const card = q('#c')!;
    expect(controls(card).length).toBe(1);
    const a = card.querySelector('.title a.hit')!;
    expect(a.textContent!.trim()).toBe('Find a doctor');
    expect(card.querySelector('.act-row')).toBeNull();
  });

  it('without an action or href it is a static card with a heading', () => {
    const { q } = setup();
    const card = q('#s')!;
    expect(controls(card).length).toBe(0);
    expect(card.querySelector('.fc')!.classList.contains('interactive')).toBe(false);
    const title = card.querySelector('.title')!;
    expect([title.getAttribute('role'), title.getAttribute('aria-level')]).toEqual(['heading', '2']);
    expect(q('#c .title')!.getAttribute('aria-level')).toBe('3');
    // No icon projected: the badge collapses.
    expect(getComputedStyle(card.querySelector('.badge')!).display).toBe('none');
    expect(getComputedStyle(q('#c .badge')!).display).not.toBe('none');
    expect(q('#c .badge')!.getAttribute('aria-hidden')).toBe('true');
    expect(q('#i .badge svg')).not.toBeNull();
  });

  it('tone drives the badge and surface; brand puts the brand gradient on the edge', () => {
    const { f, h, q } = setup();
    const fc = () => getComputedStyle(q('#c .fc')!);
    expect(q('#c .fc')!.getAttribute('data-tone')).toBe('primary');
    expect(fc().getPropertyValue('--fc-badge-fg').trim()).toBe('var(--ui-color-primary)');
    h.tone.set('accent');
    f.detectChanges();
    expect(fc().getPropertyValue('--fc-badge-bg').trim()).toBe('var(--ui-color-accent)');
    expect(fc().getPropertyValue('--fc-badge-fg').trim()).toBe('var(--ui-color-accent-contrast)');
    h.tone.set('neutral');
    f.detectChanges();
    expect(fc().getPropertyValue('--fc-wash').trim()).toBe('var(--ui-color-surface)');
    h.tone.set('brand');
    f.detectChanges();
    expect(fc().borderTopColor).toMatch(/^(transparent|rgba\(0, 0, 0, 0\))$/);
    expect(fc().background || fc().backgroundImage).toContain('var(--ui-gradient-brand)');
  });

  it('size lg is roomier with a bigger badge; horizontal puts the badge beside the text', () => {
    const { f, h, q } = setup();
    const fc = () => getComputedStyle(q('#c .fc')!);
    expect([fc().padding || fc().paddingTop, fc().getPropertyValue('--fc-badge').trim()]).toEqual(['var(--ui-space-6)', '48px']);
    expect(fc().flexDirection).toBe('column');
    h.size.set('lg');
    h.layout.set('horizontal');
    f.detectChanges();
    expect([fc().padding || fc().paddingTop, fc().getPropertyValue('--fc-badge').trim()]).toEqual(['var(--ui-space-8)', '56px']);
    expect(fc().flexDirection).toBe('row');
  });

  it('points the action arrow the reading way in RTL', () => {
    const { f, h, q } = setup();
    expect(getComputedStyle(q('#c .arrow')!).transform).not.toBe('scaleX(-1)');
    h.dir.set('rtl');
    f.detectChanges();
    expect(getComputedStyle(q('#c .arrow')!).transform).toBe('scaleX(-1)');
  });
});

/* ── 0.38: the compact tinted tile (size sm, card action, clamp, tinted surface, control radius) ── */

@Component({
  imports: [UiFeatureCard, UiInput, HugeiconsIconComponent],
  template: `
    <div [attr.dir]="dir()">
      <ui-input id="field" ariaLabel="Ask" />
      <ui-feature-card id="t" title="Find a doctor" [description]="description()" [size]="size()" [surface]="surface()" [tone]="tone()"
                       [trailingArrow]="arrow()" [actionLabel]="actionLabel()" [href]="href()" [descriptionLines]="lines()" [radius]="radius()"
                       [disabled]="disabled()" (action)="hits.push($event)">
        <hugeicons-icon feature-icon [icon]="icon" />
      </ui-feature-card>
      <ui-feature-card id="attr" title="Attr" radius="control" trailingArrow descriptionLines="2" />
    </div>
  `,
})
class CompactHost {
  readonly icon = StethoscopeIcon;
  readonly description = signal('Book a visit at a clinic near you.');
  readonly size = signal<UiFeatureSize>('sm');
  readonly surface = signal<UiFeatureSurface>('tinted');
  readonly tone = signal<UiFeatureTone>('primary');
  readonly arrow = signal(true);
  readonly actionLabel = signal('');
  readonly href = signal<string | undefined>(undefined);
  readonly lines = signal(2);
  readonly radius = signal<UiFeatureRadius>('control');
  readonly disabled = signal(false);
  readonly dir = signal<'ltr' | 'rtl'>('ltr');
  hits: MouseEvent[] = [];
}

const compact = () => {
  const f = TestBed.createComponent(CompactHost);
  f.detectChanges();
  const el = f.nativeElement as HTMLElement;
  const q = (s: string) => el.querySelector(s) as HTMLElement | null;
  return { f, el, h: f.componentInstance, q, fc: () => getComputedStyle(q('#t .fc')!) };
};
const cssRules = () => [...document.styleSheets].flatMap((s) => [...s.cssRules]).filter((r): r is CSSStyleRule => r instanceof CSSStyleRule);

describe('UiFeatureCard 0.38 (compact tinted tile)', () => {
  it('size sm: 40px badge, 20px icon, --ui-space-4 padding, body-strong title, small description', () => {
    const { f, h, q, fc } = compact();
    expect(q('#t .fc')!.getAttribute('data-size')).toBe('sm');
    expect([fc().padding || fc().paddingTop, fc().getPropertyValue('--fc-badge').trim(), fc().getPropertyValue('--fc-icon').trim()]).toEqual(['var(--ui-space-4)', '40px', '20px']);
    expect(fc().gap || fc().rowGap).toBe('var(--ui-space-3)');
    const title = getComputedStyle(q('#t .title')!);
    expect([title.fontSize, title.fontWeight]).toEqual(['var(--ui-font-size-md)', '600']);
    expect(getComputedStyle(q('#t .desc')!).fontSize).toBe('var(--ui-font-size-sm)');
    h.size.set('md');
    f.detectChanges();
    expect([fc().padding || fc().paddingTop, fc().getPropertyValue('--fc-badge').trim()]).toEqual(['var(--ui-space-6)', '48px']);
  });

  it('trailingArrow without an action label: the whole card is one button named "title, description", nothing nested', () => {
    const { f, el, h, q } = compact();
    document.body.appendChild(el);
    try {
      const card = q('#t')!;
      expect(controls(card).length).toBe(1);
      const btn = card.querySelector('button.hit')!;
      expect(btn.querySelectorAll('button, a, input, [tabindex]').length).toBe(0);
      expect(named(btn, 'aria-labelledby')).toBe('Find a doctor, Book a visit at a clinic near you.');
      expect(btn.hasAttribute('aria-describedby')).toBe(false);
      expect(q('#t .fc')!.classList.contains('interactive')).toBe(true);
      (btn as HTMLElement).click();
      expect(h.hits.length).toBe(1);
      // The arrow is decorative and sits last in the title row.
      const trail = q('#t .trail')!;
      expect(trail.getAttribute('aria-hidden')).toBe('true');
      expect(trail.parentElement!.classList.contains('title-row')).toBe(true);
      expect(trail.parentElement!.lastElementChild).toBe(trail);
      // No description: the title alone names it.
      h.description.set('');
      f.detectChanges();
      expect(named(btn, 'aria-labelledby')).toBe('Find a doctor');
      // With href it is one link instead.
      h.href.set('/doctors');
      f.detectChanges();
      expect(controls(card).length).toBe(1);
      expect(card.querySelector('a.hit')!.getAttribute('href')).toBe('/doctors');
      // An action label wins: the action row has its own arrow, no trailing one.
      h.href.set(undefined);
      h.actionLabel.set('Book now');
      f.detectChanges();
      expect(q('#t .trail')).toBeNull();
      expect(named(card.querySelector('button.hit')!, 'aria-labelledby')).toBe('Find a doctor, Book now');
      // Without trailingArrow (and no label or href) it is a static card again.
      h.actionLabel.set('');
      h.arrow.set(false);
      f.detectChanges();
      expect(controls(card).length).toBe(0);
      expect(q('#t .trail')).toBeNull();
    } finally {
      el.remove();
    }
  });

  it('the card action does nothing while disabled', () => {
    const { f, h, q } = compact();
    h.disabled.set(true);
    f.detectChanges();
    const btn = q('#t button.hit') as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
    btn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(h.hits.length).toBe(0);
  });

  it('the trailing arrow sits at the end of the row and points the reading way in RTL', () => {
    const { f, h, q } = compact();
    expect(getComputedStyle(q('#t .title-row')!).flexDirection).not.toBe('row-reverse');
    expect(getComputedStyle(q('#t .trail')!).transform).not.toBe('scaleX(-1)');
    h.dir.set('rtl');
    f.detectChanges();
    expect(getComputedStyle(q('#t .trail')!).transform).toBe('scaleX(-1)');
    // Vertical with an icon: pinned to the end of the badge row by a logical offset, so it moves to the left in RTL.
    const pin = cssRules().find((r) => /data-layout="vertical"\]\[data-size="sm"\].*:has\(.*\.trail/.test(r.selectorText))!;
    expect(pin).toBeDefined();
    expect(pin.style.getPropertyValue('inset-inline-end')).toBe('var(--ui-space-4)');
    expect(pin.style.top).toBe('calc(var(--ui-space-4) + 12px)');
    expect(cssRules().some((r) => /\.trail/.test(r.selectorText) && (r.style.left || r.style.right))).toBe(false);
  });

  it("the badge icon follows the badge colour, not a theme's icon tint", () => {
    const { q } = compact();
    expect(getComputedStyle(q('#t .badge')!).getPropertyValue('--ui-color-icon').trim()).toBe('currentColor');
  });

  it('descriptionLines clamps the description with an ellipsis; 0 shows it all', () => {
    const { f, h, q } = compact();
    const desc = q('#t .desc')!;
    expect(desc.classList.contains('clamp')).toBe(true);
    expect(desc.style.getPropertyValue('--fc-lines')).toBe('2');
    const rule = cssRules().find((r) => /\.desc\.clamp/.test(r.selectorText))!;
    expect(rule).toBeDefined();
    expect(rule.style.getPropertyValue('-webkit-line-clamp')).toBe('var(--fc-lines)');
    expect(rule.style.overflow).toBe('hidden');
    expect(rule.style.getPropertyValue('-webkit-box-orient')).toBe('vertical');
    expect(q('#attr .fc')).not.toBeNull();
    h.lines.set(0);
    f.detectChanges();
    expect(desc.classList.contains('clamp')).toBe(false);
    expect(desc.style.getPropertyValue('--fc-lines')).toBe('');
  });

  it('tinted: a wash in the tone, no border, no shadow until hover; deeper words on the wash', () => {
    const { f, h, q, fc } = compact();
    expect(q('#t .fc')!.getAttribute('data-surface')).toBe('tinted');
    expect(fc().borderTopColor).toMatch(/^(transparent|rgba\(0, 0, 0, 0\))$/);
    expect(fc().boxShadow).toBe('none');
    expect(fc().getPropertyValue('--fc-wash').trim()).toBe('color-mix(in srgb, var(--fc-tone) 8%, color-mix(in srgb, var(--ui-color-text) 4%, var(--ui-color-surface)))');
    expect(fc().getPropertyValue('--fc-desc').trim()).toContain('var(--ui-color-text-muted) 75%');
    // Scoped selectors carry [_ngcontent-…] attributes, so match the parts.
    const hover = cssRules().find((r) => /\.fc\.interactive.*:not\(\.disabled\).*:hover$/.test(r.selectorText) && !!r.style.boxShadow);
    expect(hover?.style.boxShadow).toBe('var(--ui-shadow-2)');
    // The hover border rule leaves the tinted surface borderless.
    const border = cssRules().find((r) => r.style.borderColor === 'var(--ui-color-border-strong)' && r.selectorText.includes('.fc.interactive'))!;
    expect(border.selectorText).toContain(':not([data-surface="tinted"])');
    h.tone.set('accent');
    f.detectChanges();
    expect(fc().getPropertyValue('--fc-badge-bg').trim()).toBe('var(--ui-color-accent)');
    h.tone.set('brand');
    f.detectChanges();
    expect(fc().borderTopColor).toMatch(/^(transparent|rgba\(0, 0, 0, 0\))$/);
    expect(fc().backgroundImage || '').not.toContain('gradient-brand');
    expect(fc().background).toBe('var(--fc-wash)');
    h.surface.set('default');
    f.detectChanges();
    expect(q('#t .fc')!.getAttribute('data-surface')).toBe('default');
    expect(fc().getPropertyValue('--fc-desc').trim()).toBe('');
  });

  it("radius 'control' gives the card and its badge an input's radius; booleans still work", () => {
    const { f, h, q, fc } = compact();
    const input = getComputedStyle(q('#field .ui-input')!).borderRadius;
    expect(input).toBe('var(--ui-radius)');
    expect(fc().borderRadius).toBe(input);
    expect(getComputedStyle(q('#t .badge')!).borderRadius).toBe(input);
    expect(q('#attr .fc')!.getAttribute('data-radius')).toBe('control');
    h.radius.set(false);
    f.detectChanges();
    expect(q('#t .fc')!.classList.contains('no-radius')).toBe(true);
    expect(fc().borderRadius).toMatch(/^0(px)?$/);
    h.radius.set(true);
    f.detectChanges();
    expect(q('#t .fc')!.hasAttribute('data-radius')).toBe(false);
    expect(fc().borderRadius).toBe('var(--ui-radius-lg)');
  });

  it("radius 'control' is square when UiConfig.radius is off, like the input it matches", () => {
    TestBed.configureTestingModule({ providers: [{ provide: UI_CONFIG, useValue: { ...defaultUiConfig, radius: false } }] });
    const { q, fc } = compact();
    expect(q('#field .ui-input')!.classList.contains('no-radius')).toBe(true);
    expect(q('#t .fc')!.classList.contains('no-radius')).toBe(true);
    expect(fc().borderRadius).toMatch(/^0(px)?$/);
    expect(getComputedStyle(q('#t .badge')!).borderRadius).toMatch(/^0(px)?$/);
  });
});
