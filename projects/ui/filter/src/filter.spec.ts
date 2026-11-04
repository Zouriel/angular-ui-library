import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { provideUiStrings, uiStringsDv } from '@zouriel/ui';
import { UiFilter, UiFilterButton, UiFilterChips, UiFilterPanel } from './filter';
import {
  type UiFilterSection, type UiFilterValue,
  uiActiveFilters, uiFilterCount, uiFilterPrune, uiFilterRemove, uiFilterSet, uiFilterToggle,
} from './filter-model';

const PEOPLE: UiFilterSection = {
  id: 'who', title: 'Uploaded by', multiple: true, allLabel: 'Everyone', allCount: 12,
  options: [{ id: 'aisha', label: 'Aisha', count: 7 }, { id: 'ali', label: 'Ali', count: 5 }],
};
const KIND: UiFilterSection = {
  id: 'kind', title: 'Type',
  options: [{ id: 'photo', label: 'Photos', count: 9 }, { id: 'video', label: 'Videos', count: 3 }],
};
const MANY: UiFilterSection = {
  id: 'who', title: 'Uploaded by', multiple: true, allLabel: 'Everyone',
  options: Array.from({ length: 10 }, (_, i) => ({ id: `p${i}`, label: i === 3 ? 'Mariyam' : `Guest ${i}`, count: 1 })),
};

describe('filter model', () => {
  it('counts every chosen option', () => {
    expect(uiFilterCount({})).toBe(0);
    expect(uiFilterCount(null)).toBe(0);
    expect(uiFilterCount({ who: ['aisha', 'ali'], kind: ['video'] })).toBe(3);
  });

  it('lists active filters in the panel order, leaving out unknown ids', () => {
    expect(uiActiveFilters([PEOPLE, KIND], { kind: ['video'], who: ['ali', 'gone', 'aisha'] })).toEqual([
      { section: 'who', option: 'aisha', label: 'Aisha' },
      { section: 'who', option: 'ali', label: 'Ali' },
      { section: 'kind', option: 'video', label: 'Videos' },
    ]);
  });

  it('prunes choices the sections no longer offer, and empty sections', () => {
    expect(uiFilterPrune([PEOPLE, KIND], { who: ['gone'], kind: ['video'], other: ['x'] })).toEqual({ kind: ['video'] });
    // A single-choice section never keeps two.
    expect(uiFilterPrune([KIND], { kind: ['photo', 'video'] })).toEqual({ kind: ['photo'] });
  });

  it('toggles checkboxes and radios, and removes sections left empty', () => {
    let v: UiFilterValue = {};
    v = uiFilterToggle(PEOPLE, v, 'aisha');
    v = uiFilterToggle(PEOPLE, v, 'ali');
    expect(v).toEqual({ who: ['aisha', 'ali'] });
    v = uiFilterToggle(KIND, v, 'photo');
    v = uiFilterToggle(KIND, v, 'video');
    expect(v['kind']).toEqual(['video']);
    v = uiFilterToggle(KIND, v, 'video');
    expect('kind' in v).toBe(false);
    v = uiFilterRemove(v, 'who', 'aisha');
    expect(v).toEqual({ who: ['ali'] });
    expect(uiFilterSet(v, 'who', [])).toEqual({});
  });
});

@Component({
  imports: [UiFilterButton],
  template: `<ui-filter-button [count]="count()" />`,
})
class ButtonHost { count = signal(0); }

describe('ui-filter-button', () => {
  it('reads Filter, with a count bubble and "Filter, 2 on" while filters are on', () => {
    const fx = TestBed.createComponent(ButtonHost);
    fx.detectChanges();
    const btn = (fx.nativeElement as HTMLElement).querySelector('button')!;
    expect(btn.textContent).toContain('Filter');
    expect(btn.querySelector('.ui-badge')).toBeNull();
    fx.componentInstance.count.set(2);
    fx.detectChanges();
    expect(btn.querySelector('.ui-badge')!.textContent!.trim()).toBe('2');
    expect(btn.getAttribute('aria-label')).toBe('Filter, 2 on');
    fx.componentInstance.count.set(14);
    fx.detectChanges();
    expect(btn.querySelector('.ui-badge')!.textContent!.trim()).toBe('9+');
  });

  it('speaks Dhivehi with the Dhivehi strings', () => {
    TestBed.configureTestingModule({ providers: [provideUiStrings(uiStringsDv)] });
    const fx = TestBed.createComponent(ButtonHost);
    fx.componentInstance.count.set(1);
    fx.detectChanges();
    const btn = (fx.nativeElement as HTMLElement).querySelector('button')!;
    expect(btn.getAttribute('aria-label')).toBe(`${uiStringsDv.filter}, 1 ހިންގާފައި`);
  });
});

@Component({
  imports: [UiFilterPanel],
  template: `<ui-filter-panel [sections]="sections()" [(value)]="value" />`,
})
class PanelHost {
  sections = signal<UiFilterSection[]>([PEOPLE, KIND]);
  value = signal<UiFilterValue>({});
}

function rows(root: HTMLElement, legend: string): HTMLLabelElement[] {
  const set = [...root.querySelectorAll('fieldset')].find((f) => f.querySelector('legend')!.textContent!.trim() === legend)!;
  return [...set.querySelectorAll<HTMLLabelElement>('label.row')];
}
const input = (row: HTMLLabelElement) => row.querySelector('input')!;
const rowText = (row: HTMLLabelElement) => [...row.querySelectorAll('.lbl, .count')].map((e) => e.textContent!.trim()).join(' ');

describe('ui-filter-panel', () => {
  function make() {
    const fx = TestBed.createComponent(PanelHost);
    fx.detectChanges();
    return { fx, root: fx.nativeElement as HTMLElement, host: fx.componentInstance };
  }

  it('shows each section as a titled group with an "all" row and counts', () => {
    const { root } = make();
    const who = rows(root, 'Uploaded by');
    expect(who.map(rowText)).toEqual(['Everyone 12', 'Aisha 7', 'Ali 5']);
    expect(input(who[0]).type).toBe('checkbox');
    expect(input(who[0]).checked).toBe(true);
    const kind = rows(root, 'Type');
    expect(kind[0].textContent).toContain('All');
    expect(input(kind[1]).type).toBe('radio');
  });

  it('changes the value at once, several people at a time, and "all" clears the section', () => {
    const { fx, root, host } = make();
    input(rows(root, 'Uploaded by')[1]).click();
    fx.detectChanges();
    input(rows(root, 'Uploaded by')[2]).click();
    fx.detectChanges();
    expect(host.value()).toEqual({ who: ['aisha', 'ali'] });
    expect(input(rows(root, 'Uploaded by')[0]).checked).toBe(false);
    input(rows(root, 'Type')[2]).click();
    fx.detectChanges();
    expect(host.value()).toEqual({ who: ['aisha', 'ali'], kind: ['video'] });
    input(rows(root, 'Uploaded by')[0]).click();
    fx.detectChanges();
    expect(host.value()).toEqual({ kind: ['video'] });
    // Tapping "all" again leaves it ticked.
    input(rows(root, 'Uploaded by')[0]).click();
    fx.detectChanges();
    expect(input(rows(root, 'Uploaded by')[0]).checked).toBe(true);
    expect(host.value()).toEqual({ kind: ['video'] });
  });

  it('gets a search field from 8 options that narrows the rows', async () => {
    const { fx, root, host } = make();
    expect(root.querySelector('ui-search-input')).toBeNull();
    host.sections.set([MANY]);
    fx.detectChanges();
    const field = root.querySelector('ui-search-input input') as HTMLInputElement;
    expect(field).not.toBeNull();
    expect(field.getAttribute('aria-label')).toBe('Uploaded by');
    field.value = 'mari';
    field.dispatchEvent(new Event('input'));
    fx.detectChanges();
    await fx.whenStable();
    fx.detectChanges();
    expect(rows(root, 'Uploaded by').map(rowText)).toEqual(['Mariyam 1']);
    field.value = 'zzz';
    field.dispatchEvent(new Event('input'));
    fx.detectChanges();
    expect(rows(root, 'Uploaded by')).toEqual([]);
    expect(root.querySelector('.none')!.textContent).toContain('No results');
  });

  it('keeps rows at least a touch target tall', () => {
    const styles = (UiFilterPanel as unknown as { ɵcmp: { styles: string[] } }).ɵcmp.styles.join('\n');
    expect(styles).toMatch(/\.row\[[^\]]+\]\s*\{[^}]*min-height:\s*var\(--ui-size-touch\)/);
  });
});

@Component({
  imports: [UiFilter],
  template: `<ui-filter [sections]="sections" [(value)]="value" [(open)]="open" [resultCount]="7" />`,
})
class FilterHost {
  sections = [PEOPLE, KIND];
  value = signal<UiFilterValue>({ who: ['ali'] });
  open = signal(false);
}

describe('ui-filter', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    document.querySelectorAll('.cdk-overlay-container').forEach((c) => (c.innerHTML = ''));
  });

  function stubWidth(narrow: boolean) {
    vi.stubGlobal('matchMedia', (q: string) => ({ matches: narrow, media: q, addEventListener() {}, removeEventListener() {} }));
  }

  it('opens a popover under the button on a wide screen, with the panel and "Show 7"', async () => {
    stubWidth(false);
    const fx = TestBed.createComponent(FilterHost);
    fx.detectChanges();
    const btn = (fx.nativeElement as HTMLElement).querySelector('ui-filter-button button') as HTMLButtonElement;
    expect(btn.getAttribute('aria-label')).toBe('Filter, 1 on');
    btn.click();
    fx.detectChanges();
    await fx.whenStable();
    const pop = document.querySelector('.ui-filter-pop') as HTMLElement;
    expect(pop).not.toBeNull();
    expect(pop.getAttribute('role')).toBe('dialog');
    expect(pop.querySelector('ui-filter-panel')).not.toBeNull();
    const buttons = [...pop.querySelectorAll('ui-filter-footer button')].map((b) => b.textContent!.trim());
    expect(buttons).toEqual(['Clear all', 'Show 7']);
    expect((fx.nativeElement as HTMLElement).querySelector('ui-bottom-sheet')).toBeNull();
    (pop.querySelectorAll('ui-filter-footer button')[0] as HTMLButtonElement).click();
    fx.detectChanges();
    expect(fx.componentInstance.value()).toEqual({});
    (pop.querySelectorAll('ui-filter-footer button')[1] as HTMLButtonElement).click();
    fx.detectChanges();
    expect(fx.componentInstance.open()).toBe(false);
  });

  it('is a modal bottom sheet on a narrow screen', () => {
    stubWidth(true);
    const fx = TestBed.createComponent(FilterHost);
    fx.detectChanges();
    ((fx.nativeElement as HTMLElement).querySelector('ui-filter-button button') as HTMLButtonElement).click();
    fx.detectChanges();
    const sheet = (fx.nativeElement as HTMLElement).querySelector('ui-bottom-sheet') as HTMLElement;
    expect(sheet).not.toBeNull();
    expect(sheet.querySelector('ui-filter-panel')).not.toBeNull();
    expect(sheet.querySelector('ui-filter-footer')).not.toBeNull();
    expect(document.querySelector('.ui-filter-pop')).toBeNull();
    expect(fx.componentInstance.open()).toBe(true);
  });
});

@Component({
  imports: [UiFilterChips],
  template: `<ui-filter-chips [sections]="sections" [(value)]="value" />`,
})
class ChipsHost {
  sections = [PEOPLE, KIND];
  value = signal<UiFilterValue>({ who: ['aisha', 'ali'], kind: ['video'] });
}

describe('ui-filter-chips', () => {
  it('shows a removable chip for each filter that is on, then Clear all', () => {
    const fx = TestBed.createComponent(ChipsHost);
    fx.detectChanges();
    const root = fx.nativeElement as HTMLElement;
    const chips = () => [...root.querySelectorAll('ui-chip')].map((c) => c.textContent!.trim());
    expect(chips()).toEqual(['Aisha', 'Ali', 'Videos']);
    const x = root.querySelector('ui-chip button') as HTMLButtonElement;
    expect(x.getAttribute('aria-label')).toBe('Remove Aisha');
    x.click();
    fx.detectChanges();
    expect(fx.componentInstance.value()).toEqual({ who: ['ali'], kind: ['video'] });
    const clear = [...root.querySelectorAll('ui-button button')].find((b) => b.textContent!.trim() === 'Clear all') as HTMLButtonElement;
    clear.click();
    fx.detectChanges();
    expect(fx.componentInstance.value()).toEqual({});
    expect(root.querySelector('.chips')).toBeNull();
  });
});
