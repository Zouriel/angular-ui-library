import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { provideUiStrings, uiStringsDv } from '@zouriel/ui';
import { UiChecklist, type UiChecklistItem } from './checklist';
import { UiGuidance, UiMemoryGuidanceStore, UI_GUIDANCE } from './guidance';
import { UiHintOnce } from './hint-once';
import { UiOfferCard } from './offer-card';

@Component({
  imports: [UiOfferCard],
  template: `
    <ui-offer-card id="o" heading="New to invites.blog?" body="Take a quick tour." primaryLabel="Show me" secondaryLabel="Not now"
      [tipsOff]="true" (primaryClick)="log.push('primary')" (secondaryClick)="log.push('secondary')"
      (dismissed)="log.push('dismissed')" (tipsOffClick)="log.push('off')"><span offer-art>*</span></ui-offer-card>
    <ui-offer-card id="r" variant="role" heading="Aisha added you" [dismissible]="false" />
  `,
})
class Offers {
  log: string[] = [];
}

describe('ui-offer-card', () => {
  it('reports each action, names itself by its heading, and hides what it is not given', () => {
    const f = TestBed.createComponent(Offers);
    f.detectChanges();
    const el = f.nativeElement as HTMLElement;
    const o = el.querySelector('#o')!;
    const section = o.querySelector('section')!;
    expect(o.querySelector(`#${section.getAttribute('aria-labelledby')}`)!.textContent).toBe('New to invites.blog?');
    const buttons = [...o.querySelectorAll('ui-button button')] as HTMLButtonElement[];
    expect(buttons.map((b) => b.textContent!.trim())).toEqual(['Show me', 'Not now']);
    buttons[0].click();
    buttons[1].click();
    (o.querySelector('.off') as HTMLButtonElement).click();
    const x = o.querySelector('.x') as HTMLButtonElement;
    expect(x.getAttribute('aria-label')).toBe('Dismiss');
    x.click();
    expect(f.componentInstance.log).toEqual(['primary', 'secondary', 'off', 'dismissed']);
    expect(o.querySelector('.off')!.textContent!.trim()).toBe('Turn off tips');
    const r = el.querySelector('#r')!;
    expect(r.getAttribute('data-variant')).toBe('role');
    expect(r.querySelector('.x, .off, .actions, .body')).toBeNull();
  });
});

@Component({
  imports: [UiChecklist],
  template: `<ui-checklist heading="Getting started" [items]="items()" [dismissible]="true"
    (itemClick)="clicked.push($event.id)" (dismissed)="closed = true" />`,
})
class List {
  items = signal<UiChecklistItem[]>([
    { id: 'name', label: 'Add your name and photo', done: true },
    { id: 'event', label: 'Start an event', description: 'Pick a design', done: false },
    { id: 'guests', label: 'Add your guests', done: false },
  ]);
  clicked: string[] = [];
  closed = false;
}

describe('ui-checklist', () => {
  function setup() {
    const f = TestBed.createComponent(List);
    f.detectChanges();
    return { f, el: f.nativeElement as HTMLElement };
  }

  it('shows "1 of 3" and a matching progress bar, ticks done items, and reports taps', () => {
    const { f, el } = setup();
    expect(el.querySelector('.count')!.textContent!.trim()).toBe('1 of 3');
    const bar = el.querySelector('[role=progressbar]')!;
    expect(Number(bar.getAttribute('aria-valuenow'))).toBeCloseTo(33.33, 1);
    expect(bar.getAttribute('aria-label')).toBe('1 of 3');
    const rows = [...el.querySelectorAll('.item')] as HTMLButtonElement[];
    expect(rows.map((r) => r.classList.contains('done'))).toEqual([true, false, false]);
    expect(rows[0].querySelector('.tick svg')).not.toBeNull();
    expect(rows[1].querySelector('.tick svg')).toBeNull();
    expect(rows[0].textContent).toContain(', Done');
    expect(rows[1].textContent).toContain(', Not done yet');
    expect(rows[1].querySelector('.desc')!.textContent).toBe('Pick a design');
    rows[2].click();
    expect(f.componentInstance.clicked).toEqual(['guests']);
    (el.querySelector('.x') as HTMLButtonElement).click();
    expect(f.componentInstance.closed).toBe(true);
  });

  it('counts items done in any order, and shows the finished state when all are', () => {
    const { f, el } = setup();
    f.componentInstance.items.update((xs) => xs.map((x) => (x.id === 'guests' ? { ...x, done: true } : x)));
    f.detectChanges();
    expect(el.querySelector('.count')!.textContent!.trim()).toBe('2 of 3');
    expect(el.querySelector('.all')).toBeNull();
    f.componentInstance.items.update((xs) => xs.map((x) => ({ ...x, done: true })));
    f.detectChanges();
    expect(el.querySelector('.count')!.textContent!.trim()).toBe('3 of 3');
    expect(el.querySelector('.items')).toBeNull();
    const all = el.querySelector('.all')!;
    expect(all.getAttribute('role')).toBe('status');
    expect(all.textContent!.trim()).toBe('All set');
  });

  it('speaks Dhivehi with the built-in strings', () => {
    TestBed.configureTestingModule({ providers: [provideUiStrings(uiStringsDv)] });
    const { el } = setup();
    expect(el.querySelector('.count')!.textContent!.trim()).toBe('3 އިން 1');
  });
});

@Component({
  imports: [UiHintOnce],
  template: `
    <button id="a" type="button" uiHintOnce="tip.me.settings" uiHintOnceText="Your settings live here." [uiHintOnceWhen]="ready()"
      [uiHintOnceSkipWhen]="skip()" (uiHintOnceDone)="done.push($event)">Settings</button>
  `,
})
class Once {
  ready = signal(false);
  skip = signal(false);
  done: (string | null)[] = [];
}

describe('uiHintOnce', () => {
  let store: UiMemoryGuidanceStore;
  let guidance: UiGuidance;
  beforeEach(() => {
    store = new UiMemoryGuidanceStore();
    guidance = new UiGuidance(store);
    TestBed.configureTestingModule({ providers: [{ provide: UI_GUIDANCE, useValue: guidance }] });
  });
  afterEach(() => document.querySelectorAll('.cdk-overlay-container').forEach((c) => (c.innerHTML = '')));

  async function flush(f: { detectChanges(): void }) {
    for (let i = 0; i < 5; i++) {
      await new Promise((r) => setTimeout(r, 10));
      f.detectChanges();
    }
  }

  it('waits for "when", shows once through the guidance, and is seen for good once closed', async () => {
    const f = TestBed.createComponent(Once);
    document.body.appendChild(f.nativeElement);
    f.detectChanges();
    await flush(f);
    expect(document.querySelector('.ui-hint')).toBeNull();
    f.componentInstance.ready.set(true);
    f.detectChanges();
    await flush(f);
    expect(document.querySelector('.ui-hint')).not.toBeNull();
    expect(guidance.active()).toBe('tip.me.settings');
    (document.querySelector('#a') as HTMLButtonElement).click();
    f.detectChanges();
    await flush(f);
    expect(document.querySelector('.ui-hint')).toBeNull();
    expect(f.componentInstance.done).toEqual(['closed']);
    expect(store.seen('tip.me.settings')).toBe(true);
    expect(guidance.active()).toBeNull();
    // A second visit to the screen: never again.
    f.destroy();
    const g = TestBed.createComponent(Once);
    document.body.appendChild(g.nativeElement);
    g.componentInstance.ready.set(true);
    g.detectChanges();
    await flush(g);
    expect(document.querySelector('.ui-hint')).toBeNull();
    expect(g.componentInstance.done).toEqual([null]);
  });

  it('is refused while another tip is on screen, and marks itself seen silently with skipWhen', async () => {
    let finish!: () => void;
    void guidance.requestTip('tour.welcome', () => new Promise((r) => (finish = () => r('finished'))), { kind: 'tour' });
    const f = TestBed.createComponent(Once);
    document.body.appendChild(f.nativeElement);
    f.componentInstance.ready.set(true);
    f.detectChanges();
    await flush(f);
    expect(document.querySelector('.ui-hint')).toBeNull();
    expect(f.componentInstance.done).toEqual([null]);
    expect(store.seen('tip.me.settings')).toBe(false);
    finish();
    await flush(f);

    const g = TestBed.createComponent(Once);
    document.body.appendChild(g.nativeElement);
    g.componentInstance.skip.set(true);
    g.componentInstance.ready.set(true);
    g.detectChanges();
    await flush(g);
    expect(document.querySelector('.ui-hint')).toBeNull();
    expect(store.seen('tip.me.settings')).toBe(true);
  });

  it('never shows without a guidance provider', async () => {
    TestBed.resetTestingModule();
    const f = TestBed.createComponent(Once);
    document.body.appendChild(f.nativeElement);
    f.componentInstance.ready.set(true);
    f.detectChanges();
    await flush(f);
    expect(document.querySelector('.ui-hint')).toBeNull();
    vi.restoreAllMocks();
  });
});
