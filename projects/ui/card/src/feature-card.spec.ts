import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { HugeiconsIconComponent } from '@hugeicons/angular';
import StethoscopeIcon from '@hugeicons/core-free-icons/StethoscopeIcon';
import { UiFeatureCard, type UiFeatureLayout, type UiFeatureTone } from './feature-card';

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
