import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import type { UiTier } from '@zouriel/ui';
import { UiPlanCard } from './plan-card';
import { UiPlanGrid } from './plan-grid';
import { UiPlanCompare, type UiPlanColumn, type UiPlanRow } from './plan-compare';

/* jsdom doesn't lay out or cascade, so layout and looks are asserted from each component's own
   rules (ɵcmp.styles); the showcase audit measures them at 390 and 1440px in a real browser. */
function styles(type: unknown): string {
  return ((type as { ɵcmp: { styles: string[] } }).ɵcmp.styles ?? []).join('\n')
    .replace(/\[_ngcontent-%COMP%\]/g, '').replace(/\[_nghost-%COMP%\]/g, ':host').replace(/\s+/g, ' ');
}
const rule = (type: unknown, selector: string) =>
  [...styles(type).matchAll(/([^{}]+)\{([^{}]*)\}/g)].filter((m) => m[1].trim() === selector.replace(/="([\w-]+)"\]/g, '=$1]')).map((m) => m[2]).join(';');

@Component({
  imports: [UiPlanCard],
  template: `
    <ui-plan-card [name]="name()" [price]="price()" [period]="period()" [note]="note()" [tagline]="tagline()"
      [features]="features()" [tier]="tier()" [highlight]="highlight()" [current]="current()">
      <button plan-action type="button">Choose</button>
      <span plan-fineprint>Prices include GST</span>
    </ui-plan-card>
  `,
})
class CardHost {
  name = signal('Gold pass');
  price = signal('MVR 499');
  period = signal<string | null>('per event');
  note = signal<string | null>('about $32');
  tagline = signal<string | null>('For parties');
  features = signal<string[]>(['25 GB of photos', 'RSVP and guest list']);
  tier = signal<UiTier | null>('gold');
  highlight = signal<string | null>(null);
  current = signal(false);
}

function card(patch: Partial<Record<keyof CardHost, unknown>> = {}) {
  const f = TestBed.createComponent(CardHost);
  for (const [k, v] of Object.entries(patch)) (f.componentInstance[k as keyof CardHost] as ReturnType<typeof signal>).set(v);
  f.detectChanges();
  const el = f.nativeElement as HTMLElement;
  return { f, el, root: el.querySelector('.card') as HTMLElement };
}

describe('UiPlanCard', () => {
  it('shows the name, price, period, note, tagline and features', () => {
    const { el } = card();
    expect(el.querySelector('h3.name')!.textContent!.trim()).toBe('Gold pass');
    expect(el.querySelector('.amount')!.textContent!.trim()).toBe('MVR 499');
    expect(el.querySelector('.period')!.textContent!.trim()).toBe('per event');
    expect(el.querySelector('.note')!.textContent!.trim()).toBe('about $32');
    expect(el.querySelector('.tagline')!.textContent!.trim()).toBe('For parties');
    const items = [...el.querySelectorAll('.features li')].map((li) => li.textContent!.trim());
    expect(items).toEqual(['25 GB of photos', 'RSVP and guest list']);
    expect(el.querySelectorAll('.features li hugeicons-icon[aria-hidden="true"]').length).toBe(2);
  });

  it('leaves out what is not given', () => {
    const { el } = card({ period: null, note: null, tagline: null, features: [] });
    expect(el.querySelector('.period')).toBeNull();
    expect(el.querySelector('.note')).toBeNull();
    expect(el.querySelector('.tagline')).toBeNull();
    expect(el.querySelector('.features')).toBeNull();
    expect(el.querySelector('.sr-only')!.textContent!.trim()).toBe('MVR 499');
  });

  it('is a group named by the plan, and reads the price as one phrase', () => {
    const { el, root } = card();
    expect(root.getAttribute('role')).toBe('group');
    const id = root.getAttribute('aria-labelledby')!;
    expect(el.querySelector(`#${id}`)!.textContent!.trim()).toBe('Gold pass');
    expect(el.querySelector('.price .sr-only')!.textContent!.trim()).toBe('MVR 499 per event');
    for (const part of el.querySelectorAll('.amount, .period')) expect(part.getAttribute('aria-hidden')).toBe('true');
  });

  it('gives each card its own name id', () => {
    const a = card().root.getAttribute('aria-labelledby');
    const b = card().root.getAttribute('aria-labelledby');
    expect(a).not.toBe(b);
  });

  it('draws the tier as a top strip and a metal dot, the body staying on the surface', () => {
    const { el, root } = card({ tier: 'platinum' });
    expect(root.getAttribute('data-tier')).toBe('platinum');
    expect(el.querySelector('.edge')).not.toBeNull();
    const dot = el.querySelector('ui-badge.dot')!;
    expect(dot.getAttribute('aria-hidden')).toBe('true');
    expect(dot.querySelector('.ui-badge')!.getAttribute('data-tone')).toBe('platinum');
    expect(rule(UiPlanCard, '.card')).toContain('background: var(--ui-color-surface)');
    expect(rule(UiPlanCard, '.edge')).toContain('background: var(--_sheen) top / 100% 4px no-repeat');
    expect(rule(UiPlanCard, '.edge')).toContain('border-radius: calc(var(--ui-radius-lg) - 1px)');
    for (const t of ['gold', 'platinum', 'premium']) expect(rule(UiPlanCard, `.card[data-tier="${t}"]`), t).toContain(`var(--ui-gradient-tier-${t})`);
  });

  it('has no strip or dot without a tier', () => {
    const { el, root } = card({ tier: null });
    expect(root.hasAttribute('data-tier')).toBe(false);
    expect(el.querySelector('.edge')).toBeNull();
    expect(el.querySelector('ui-badge.dot')).toBeNull();
  });

  it('shows the highlight label only when set, with a stronger border', () => {
    expect(card().el.querySelector('.ribbon')).toBeNull();
    expect(card().root.classList.contains('highlight')).toBe(false);
    const { el, root } = card({ highlight: 'For weddings' });
    expect(el.querySelectorAll('.ribbon').length).toBe(1);
    expect(el.querySelector('.ribbon')!.textContent!.trim()).toBe('For weddings');
    expect(root.classList.contains('highlight')).toBe(true);
    expect(rule(UiPlanCard, '.card.highlight')).toContain('inset 0 0 0 1px var(--_edge)');
    expect(rule(UiPlanCard, '.ribbon')).toContain('translate(-50%, -50%)');
  });

  it('shows "Your plan" only on the current plan', () => {
    expect(card().el.querySelector('ui-badge.current')).toBeNull();
    const badge = card({ current: true }).el.querySelector('ui-badge.current')!;
    expect(badge.textContent!.trim()).toBe('Your plan');
    expect(badge.querySelector('.ui-badge')!.getAttribute('data-tone')).toBe('primary');
  });

  it('projects the action and the fine print at the bottom', () => {
    const { el } = card();
    expect(el.querySelector('.foot .action button')!.textContent!.trim()).toBe('Choose');
    expect(el.querySelector('.foot .fineprint span')!.textContent!.trim()).toBe('Prices include GST');
    // The foot takes the slack, so actions sit at the bottom of equal-height cards.
    expect(rule(UiPlanCard, '.foot')).toContain('margin-top: auto');
    expect(rule(UiPlanCard, '.card')).toContain('height: 100%');
    expect(rule(UiPlanCard, '.card')).toContain('flex-direction: column');
  });
});

@Component({
  imports: [UiPlanCard],
  template: `
    <ui-plan-card name="Premium" price="MVR 77" period="a month" tier="premium" [features]="['3 GB per event']"
      [addOn]="addOn()" [addOnNote]="addOnNote()" [(addOnChecked)]="checked" [addOnDisabled]="disabled()">
      <button plan-action type="button">Get Premium · {{ checked() ? 'MVR 154' : 'MVR 77' }}</button>
    </ui-plan-card>
  `,
})
class AddOnHost {
  addOn = signal<string | null>('Add the AI designer');
  addOnNote = signal<string | null>('+MVR 77 a month, about $5');
  checked = signal(false);
  disabled = signal(false);
}

describe('UiPlanCard add-on', () => {
  function addOnCard(patch: Partial<Record<keyof AddOnHost, unknown>> = {}) {
    const f = TestBed.createComponent(AddOnHost);
    for (const [k, v] of Object.entries(patch)) (f.componentInstance[k as keyof AddOnHost] as ReturnType<typeof signal>).set(v);
    f.detectChanges();
    const el = f.nativeElement as HTMLElement;
    return { f, el, row: el.querySelector('.addon') as HTMLLabelElement | null, box: el.querySelector('.addon input[type="checkbox"]') as HTMLInputElement | null };
  }

  it('is not rendered without addOn, nor on a card that never set it', () => {
    expect(addOnCard({ addOn: null }).row).toBeNull();
    expect(card().el.querySelector('.addon')).toBeNull();
  });

  it('shows the label and the muted note between the features and the action', () => {
    const { el, row } = addOnCard();
    expect(row!.querySelector('.addon-label')!.textContent!.trim()).toBe('Add the AI designer');
    expect(row!.querySelector('.addon-note')!.textContent!.trim()).toBe('+MVR 77 a month, about $5');
    expect(rule(UiPlanCard, '.addon-note')).toContain('color: var(--ui-color-text-muted)');
    const order = [...el.querySelectorAll('.features, .addon, .foot')].map((n) => n.className.split(' ')[0]);
    expect(order).toEqual(['features', 'addon', 'foot']);
    expect(addOnCard({ addOnNote: null }).row!.querySelector('.addon-note')).toBeNull();
  });

  it('is one native checkbox named by the label and the note', () => {
    const { row, box } = addOnCard();
    expect(row!.querySelectorAll('input').length).toBe(1);
    expect(box!.getAttribute('aria-label')).toBe('Add the AI designer, +MVR 77 a month, about $5');
    expect(row!.querySelector('.box')!.getAttribute('aria-hidden')).toBe('true');
    expect(row!.querySelector('.addon-text')!.getAttribute('aria-hidden')).toBe('true');
    expect(addOnCard({ addOnNote: null }).box!.getAttribute('aria-label')).toBe('Add the AI designer');
  });

  it('toggles from anywhere on the row and binds two-way, so the caller can change its total', () => {
    const { f, el, row, box } = addOnCard();
    expect(box!.checked).toBe(false);
    expect(el.querySelector('button')!.textContent).toContain('MVR 77');
    (row!.querySelector('.addon-note') as HTMLElement).click();
    f.detectChanges();
    expect(f.componentInstance.checked()).toBe(true);
    expect(box!.checked).toBe(true);
    expect(row!.classList.contains('on')).toBe(true);
    expect(el.querySelector('button')!.textContent).toContain('MVR 154');
    row!.click();
    f.detectChanges();
    expect(f.componentInstance.checked()).toBe(false);
    expect(row!.classList.contains('on')).toBe(false);
    // From the caller's side too.
    f.componentInstance.checked.set(true);
    f.detectChanges();
    expect(box!.checked).toBe(true);
  });

  it('when disabled, does not toggle and is greyed out', () => {
    const { f, row, box } = addOnCard({ disabled: true });
    expect(box!.disabled).toBe(true);
    expect(row!.classList.contains('disabled')).toBe(true);
    row!.click();
    f.detectChanges();
    expect(f.componentInstance.checked()).toBe(false);
    expect(rule(UiPlanCard, '.addon.disabled')).toContain('opacity: .5');
  });

  it('is a bordered, rounded row; ticked, the border takes the tier colour; keyboard focus rings the row', () => {
    const row = rule(UiPlanCard, '.addon');
    expect(row).toContain('border: 1px solid var(--ui-color-border)');
    expect(row).toContain('border-radius: var(--ui-radius)');
    expect(row).toContain('background: var(--ui-color-surface-subtle)');
    expect(rule(UiPlanCard, '.addon.on')).toContain('border-color: var(--_edge)');
    expect(rule(UiPlanCard, '.addon:has(.native:focus-visible)')).toContain('box-shadow: var(--ui-focus-ring)');
  });
});

describe('UiPlanGrid', () => {
  const css = () => rule(UiPlanGrid, ':host');

  it('is a grid of stretched cells with room on top for a highlight label', () => {
    expect(css()).toContain('display: grid');
    expect(css()).toContain('align-items: stretch');
    expect(css()).toContain('gap: var(--ui-space-6)');
    expect(css()).toContain('padding-top: var(--ui-space-3)');
  });

  it('never has more than three columns, and fits two from 600px', () => {
    expect(css()).toContain('repeat(auto-fit, minmax(min(100%, max(288px, calc((100% - 2 * var(--ui-space-6)) / 3))), 1fr))');
    // 2 x 288 + the 24px gap = 600: one column below that.
    expect(2 * 288 + 24).toBe(600);
  });
});

@Component({
  imports: [UiPlanCompare],
  template: `<ui-plan-compare [plans]="plans" [rows]="rows" [highlight]="highlight()" caption="Compare plans" />`,
})
class CompareHost {
  plans: UiPlanColumn[] = [
    { key: 'free', name: 'Free' },
    { key: 'gold', name: 'Gold pass', tier: 'gold' },
    { key: 'platinum', name: 'Platinum pass', tier: 'platinum' },
  ];
  rows: UiPlanRow[] = [
    { label: 'Photo space', values: { free: '1 GB', gold: '25 GB', platinum: '50 GB' } },
    { label: 'Guest camera', values: { free: false, gold: true, platinum: true } },
    { label: 'Keep photos', values: { free: null, gold: false, platinum: true } },
  ];
  highlight = signal<string | null>('platinum');
}

describe('UiPlanCompare', () => {
  function compare() {
    const f = TestBed.createComponent(CompareHost);
    f.detectChanges();
    return { f, el: f.nativeElement as HTMLElement };
  }

  it('is a semantic table with column and row headers', () => {
    const { el } = compare();
    const cols = [...el.querySelectorAll('thead th[scope="col"]')].map((th) => th.querySelector('.plan')!.textContent!.trim());
    expect(cols).toEqual(['Free', 'Gold pass', 'Platinum pass']);
    const rows = [...el.querySelectorAll('tbody th[scope="row"]')].map((th) => th.textContent!.trim());
    expect(rows).toEqual(['Photo space', 'Guest camera', 'Keep photos']);
    expect(el.querySelector('caption')!.textContent!.trim()).toBe('Compare plans');
  });

  it('shows strings as text, true as a check read "Included", false and null as a dash read "Not included"', () => {
    const { el } = compare();
    const cells = (r: number) => [...el.querySelectorAll(`tbody tr:nth-child(${r}) td`)] as HTMLElement[];
    expect(cells(1).map((c) => c.textContent!.trim())).toEqual(['1 GB', '25 GB', '50 GB']);
    expect(cells(1).some((c) => c.querySelector('hugeicons-icon'))).toBe(false);
    const camera = cells(2);
    expect(camera[0].querySelector('.no')).not.toBeNull();
    expect(camera[0].querySelector('.sr-only')!.textContent!.trim()).toBe('Not included');
    expect(camera[1].querySelector('.yes')).not.toBeNull();
    expect(camera[1].querySelector('.sr-only')!.textContent!.trim()).toBe('Included');
    expect(cells(3)[0].querySelector('.sr-only')!.textContent!.trim()).toBe('Not included');
    expect(cells(3)[2].querySelector('.sr-only')!.textContent!.trim()).toBe('Included');
    for (const icon of el.querySelectorAll('td hugeicons-icon')) expect(icon.getAttribute('aria-hidden')).toBe('true');
  });

  it('tints only the highlighted column', () => {
    const { f, el } = compare();
    const tinted = () => [...el.querySelectorAll('.hl')];
    expect(tinted().length).toBe(4);
    expect(tinted().every((c) => c.matches('th:nth-child(4), td:nth-child(4)'))).toBe(true);
    expect(rule(UiPlanCompare, '.hl')).toContain('background: var(--ui-color-selected)');
    f.componentInstance.highlight.set(null);
    f.detectChanges();
    expect(tinted().length).toBe(0);
  });

  it('underlines each column header in its tier metal, plain ones in the border colour', () => {
    const { el } = compare();
    const tiers = [...el.querySelectorAll('thead th[scope="col"]')].map((th) => th.getAttribute('data-tier'));
    expect(tiers).toEqual([null, 'gold', 'platinum']);
    expect(rule(UiPlanCompare, '.bar')).toContain('background: var(--ui-color-border)');
    expect(rule(UiPlanCompare, '.bar')).toContain('height: 3px');
    for (const t of ['gold', 'platinum', 'premium']) expect(rule(UiPlanCompare, `th[data-tier="${t}"] .bar`)).toContain(`var(--ui-gradient-tier-${t})`);
  });

  it('scrolls sideways inside itself with the feature column pinned, narrower on a phone', () => {
    const { el } = compare();
    expect(el.querySelector('.scroll')!.getAttribute('tabindex')).toBe('0');
    expect(rule(UiPlanCompare, '.scroll')).toContain('overflow-x: auto');
    // The positioned screen-reader text must stay inside the scroller, not widen the page.
    expect(rule(UiPlanCompare, '.scroll')).toContain('position: relative');
    const pinned = rule(UiPlanCompare, 'th[scope="row"], .corner');
    expect(pinned).toContain('position: sticky');
    expect(pinned).toContain('inset-inline-start: 0');
    expect(pinned).toContain('background: var(--ui-color-surface)');
    // The narrow override comes after the base rule it overrides.
    const all = styles(UiPlanCompare);
    expect(all.indexOf('@container (max-width: 599px)')).toBeGreaterThan(all.indexOf('--_label: 220px'));
    expect(rule(UiPlanCompare, ':host')).toContain('container-type: inline-size');
  });
});
