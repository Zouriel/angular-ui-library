import { Directionality } from '@angular/cdk/bidi';
import { Component, LOCALE_ID, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { afterEach, describe, expect, it } from 'vitest';
import { UiPagination } from '../../navigation/src/pagination';
import { UiSearchInput } from '../../form/src/search-input';
import { UiOtpInput } from '../../form/src/otp-input';
import { UiTabs, UiTab } from '../../tabs/src/tabs';
import { UiCalendar } from '../../datepicker/src/calendar';
import { UiDatePicker } from '../../datepicker/src/date-picker';
import { uiDateNames, uiFirstDayOfWeek, uiLeadingBlanks } from '../../datepicker/src/date-names';
import { UiDrawer } from '../../dialog/src/drawer';
import { UiToastHost } from '../../dialog/src/toast';
import { UiSplitter } from '../../layout/src/splitter';
import { UiCarousel } from '../../media/src/carousel';
import { UiBreadcrumbs } from '../../navigation/src/breadcrumbs';
import { UiCodeBlock } from '../../data/src/code-block';
// Components import the core as @zouriel/ui, so the services must come from there too.
import { UiDirectionService, UiStringsService, defaultUiStrings, provideUiStrings, uiFormatString, uiIsRtl, uiLogicalKey, uiStringsDv, type UiStrings } from '@zouriel/ui';

const placeholders = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

afterEach(() => {
  document.documentElement.removeAttribute('dir');
  document.documentElement.removeAttribute('lang');
});

describe('uiStringsDv (0.46.0)', () => {
  it('has every key, none empty, Thaana text, and the same placeholders as English', () => {
    const keys = Object.keys(defaultUiStrings) as (keyof UiStrings)[];
    expect(Object.keys(uiStringsDv).sort()).toEqual([...keys].sort());
    for (const k of keys) {
      const en = defaultUiStrings[k];
      const dv = uiStringsDv[k];
      if (typeof en === 'string') {
        if (k === 'locale' || k === 'dateFormat' || k === 'dateFormatShort' || k === 'monthYearFormat') continue;
        expect(typeof dv, k).toBe('string');
        expect((dv as string).length, k).toBeGreaterThan(0);
        expect(placeholders(dv as string), k).toEqual(placeholders(en));
        // Every word is Dhivehi: some Thaana in it (U+0780–U+07BF).
        expect(/[\u0780-\u07bf]/.test(dv as string), `${k}: ${dv}`).toBe(true);
      }
    }
    expect(uiStringsDv.locale).toBe('dv');
    expect(uiStringsDv.months).toHaveLength(12);
    expect(uiStringsDv.monthsShort).toHaveLength(12);
    expect(uiStringsDv.weekdays).toHaveLength(7);
    expect(uiStringsDv.weekdaysShort).toHaveLength(7);
    expect([...uiStringsDv.months, ...uiStringsDv.weekdays, ...uiStringsDv.weekdaysShort].every((n) => /[\u0780-\u07bf]/.test(n))).toBe(true);
    expect(uiStringsDv.months[0]).toBe('ޖަނަވަރީ');
    expect(uiStringsDv.weekdays[0]).toBe('އާދިއްތަ');
    expect(uiStringsDv.firstDayOfWeek).toBe(0);
  });

  it('uiFormatString fills placeholders and leaves unknown ones', () => {
    expect(uiFormatString('Remove {label}', { label: 'Tea' })).toBe('Remove Tea');
    expect(uiFormatString('{n} / {total} {x}', { n: 2, total: 5 })).toBe('2 / 5 {x}');
  });
});

@Component({
  imports: [UiPagination, UiSearchInput, UiOtpInput],
  template: `<ui-pagination [page]="2" [total]="5" /><ui-search-input /><ui-search-input id="own" placeholder="Find a nurse" /><ui-otp-input [length]="4" />`,
})
class Live {}

describe('switching the built-in words at runtime (0.46.0)', () => {
  it('UiStringsService.set changes rendered names and default placeholders in place, and back', () => {
    const f = TestBed.createComponent(Live);
    f.detectChanges();
    const el = f.nativeElement as HTMLElement;
    const prev = () => el.querySelector('ui-pagination button')!.getAttribute('aria-label');
    const ph = () => el.querySelector('ui-search-input:not(#own) input')!.getAttribute('placeholder');
    const otp = () => el.querySelector('.ui-otp')!.getAttribute('aria-label');
    expect([prev(), ph(), otp()]).toEqual(['Previous page', 'Search…', 'One-time code']);

    const service = TestBed.inject(UiStringsService);
    service.set(uiStringsDv);
    f.detectChanges();
    expect([prev(), ph(), otp()]).toEqual([uiStringsDv.previousPage, uiStringsDv.searchPlaceholder, uiStringsDv.otpLabel]);
    // The app's own placeholder stays.
    expect(el.querySelector('#own input')!.getAttribute('placeholder')).toBe('Find a nurse');
    expect(el.querySelector('ui-pagination button.pg:not(:first-child)')!.getAttribute('aria-label')).toBe('ޞަފްޙާ 1');

    service.patch({ previousPage: 'Back' });
    f.detectChanges();
    expect(prev()).toBe('Back');
    expect(ph()).toBe(uiStringsDv.searchPlaceholder);

    service.set({});
    f.detectChanges();
    expect([prev(), ph(), otp()]).toEqual(['Previous page', 'Search…', 'One-time code']);
  });

  it('provideUiStrings(uiStringsDv) starts in Dhivehi and the service can still switch', () => {
    TestBed.configureTestingModule({ providers: [provideUiStrings(uiStringsDv)] });
    const f = TestBed.createComponent(Live);
    f.detectChanges();
    const el = f.nativeElement as HTMLElement;
    expect(el.querySelector('ui-pagination button')!.getAttribute('aria-label')).toBe(uiStringsDv.previousPage);
    TestBed.inject(UiStringsService).set({});
    f.detectChanges();
    expect(el.querySelector('ui-pagination button')!.getAttribute('aria-label')).toBe('Previous page');
  });

  it('the OTP boxes stay left to right on an RTL page (a code is read that way)', () => {
    document.documentElement.setAttribute('dir', 'rtl');
    const f = TestBed.createComponent(Live);
    f.detectChanges();
    expect((f.nativeElement as HTMLElement).querySelector('.ui-otp')!.getAttribute('dir')).toBe('ltr');
  });
});

describe('date names (0.46.0)', () => {
  it('Dhivehi names, Sunday first, and formats from the strings', () => {
    const n = uiDateNames(uiStringsDv, 'en-US');
    expect(n.months[9]).toBe('އޮކްޓޫބަރު');
    expect(n.gridWeekdays).toEqual(['އާދި', 'ހޯމަ', 'އަން', 'ބުދަ', 'ބުރާ', 'ހުކު', 'ހޮނި']);
    expect(n.monthYear(2026, 9)).toBe('އޮކްޓޫބަރު 2026');
    expect(n.formatIso('2026-10-25')).toBe('25 އޮކްޓޫބަރު 2026');
  });

  it('the first weekday comes from the locale, or the strings', () => {
    expect(uiFirstDayOfWeek('en-US')).toBe(0);
    expect(uiFirstDayOfWeek('en-GB')).toBe(1);
    const gb = uiDateNames(defaultUiStrings, 'en-GB');
    expect(gb.firstDay).toBe(1);
    expect(gb.gridWeekdays[0]).toBe('Mon');
    expect(uiDateNames({ ...defaultUiStrings, firstDayOfWeek: 6 }, 'en-US').gridWeekdays[0]).toBe('Sat');
    // 1 October 2026 is a Thursday: 4 blanks from Sunday, 3 from Monday, 5 from Saturday.
    expect([uiLeadingBlanks(2026, 9, 0), uiLeadingBlanks(2026, 9, 1), uiLeadingBlanks(2026, 9, 6)]).toEqual([4, 3, 5]);
  });

  it('English names come from LOCALE_ID, not the browser', () => {
    expect(uiDateNames(defaultUiStrings, 'fr-FR').months[0].toLowerCase()).toBe('janvier');
  });
});

@Component({
  imports: [ReactiveFormsModule, UiCalendar],
  template: `<ui-calendar [formControl]="day" />`,
})
class Cal {
  day = new FormControl<string | null>('2026-10-25');
}

describe('ui-calendar language switch (0.46.0)', () => {
  it('switches its heading, weekdays and day names to Dhivehi at runtime', () => {
    const f = TestBed.createComponent(Cal);
    f.detectChanges();
    const el = f.nativeElement as HTMLElement;
    expect(el.querySelector('.month')!.textContent!.trim()).toBe('October 2026');
    expect(el.querySelector('.weekdays span')!.textContent!.trim()).toBe('Sun');
    expect(el.querySelectorAll('.grid .cell.empty')).toHaveLength(4);
    TestBed.inject(UiStringsService).set(uiStringsDv);
    f.detectChanges();
    expect(el.querySelector('.month')!.textContent!.trim()).toBe('އޮކްޓޫބަރު 2026');
    expect([...el.querySelectorAll('.weekdays span')].map((s) => s.textContent!.trim())).toEqual([...uiStringsDv.weekdaysShort]);
    expect(el.querySelector('.cell[aria-pressed="true"]')!.getAttribute('aria-label')).toBe('25 އޮކްޓޫބަރު 2026');
  });

  it('starts the grid on Monday for an en-GB app', () => {
    TestBed.configureTestingModule({ providers: [{ provide: LOCALE_ID, useValue: 'en-GB' }] });
    const f = TestBed.createComponent(Cal);
    f.detectChanges();
    const el = f.nativeElement as HTMLElement;
    expect(el.querySelector('.weekdays span')!.textContent!.trim()).toBe('Mon');
    expect(el.querySelectorAll('.grid .cell.empty')).toHaveLength(3);
  });
});

describe('direction (0.46.0)', () => {
  it('uiIsRtl reads the nearest dir; uiLogicalKey swaps left and right under it', () => {
    const outer = document.createElement('div');
    outer.dir = 'rtl';
    const inner = document.createElement('button');
    outer.appendChild(inner);
    document.body.appendChild(outer);
    expect(uiIsRtl(inner)).toBe(true);
    const key = (k: string, t: Element) => { const e = new KeyboardEvent('keydown', { key: k }); Object.defineProperty(e, 'target', { value: t }); return uiLogicalKey(e); };
    expect(key('ArrowLeft', inner)).toBe('ArrowRight');
    expect(key('ArrowRight', inner)).toBe('ArrowLeft');
    expect(key('ArrowUp', inner)).toBe('ArrowUp');
    outer.dir = 'ltr';
    expect(key('ArrowLeft', inner)).toBe('ArrowLeft');
    outer.remove();
  });

  it('UiDirectionService follows <html dir> and keeps the CDK Directionality in step', async () => {
    const dir = TestBed.inject(UiDirectionService);
    const cdk = TestBed.inject(Directionality);
    expect(dir.dir()).toBe('ltr');
    dir.set('rtl', 'dv');
    expect(document.documentElement.getAttribute('dir')).toBe('rtl');
    expect(document.documentElement.getAttribute('lang')).toBe('dv');
    expect([dir.rtl(), cdk.value]).toEqual([true, 'rtl']);
    // An app that sets the attribute itself is followed too (MutationObserver).
    document.documentElement.setAttribute('dir', 'ltr');
    await new Promise((r) => setTimeout(r));
    expect([dir.dir(), cdk.value]).toEqual(['ltr', 'ltr']);
  });
});

@Component({
  imports: [UiTabs, UiTab],
  template: `<div [attr.dir]="dir()"><ui-tabs><ui-tab label="One">1</ui-tab><ui-tab label="Two">2</ui-tab><ui-tab label="Three">3</ui-tab></ui-tabs></div>`,
})
class TabsHost {
  dir = signal<'ltr' | 'rtl'>('rtl');
}

describe('keyboard follows the reading direction (0.46.0)', () => {
  it('tabs: in RTL ArrowLeft goes to the next tab, ArrowRight to the previous', () => {
    const f = TestBed.createComponent(TabsHost);
    f.detectChanges();
    const tabs = () => [...(f.nativeElement as HTMLElement).querySelectorAll<HTMLButtonElement>('.tab')];
    const selected = () => tabs().findIndex((t) => t.getAttribute('aria-selected') === 'true');
    tabs()[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
    f.detectChanges();
    expect(selected()).toBe(1);
    tabs()[1].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    f.detectChanges();
    expect(selected()).toBe(0);
    f.componentInstance.dir.set('ltr');
    f.detectChanges();
    tabs()[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    f.detectChanges();
    expect(selected()).toBe(1);
  });
});

@Component({
  imports: [ReactiveFormsModule, UiDatePicker],
  template: `<div dir="rtl"><ui-date-picker [formControl]="date" /></div>`,
})
class PickerRtl {
  date = new FormControl<string | null>('2026-03-15');
}

describe('date picker in RTL (0.46.0)', () => {
  it('ArrowRight moves to the previous day and ArrowLeft to the next (the grid reads right to left)', async () => {
    document.documentElement.setAttribute('dir', 'rtl');
    const f = TestBed.createComponent(PickerRtl);
    f.detectChanges();
    await f.whenStable();
    const field = (f.nativeElement as HTMLElement).querySelector('ui-date-picker input') as HTMLInputElement;
    field.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    await f.whenStable();
    const active = () => document.activeElement as HTMLElement;
    expect(active().getAttribute('data-iso')).toBe('2026-03-15');
    active().dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    await f.whenStable();
    expect(active().getAttribute('data-iso')).toBe('2026-03-14');
    active().dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
    await f.whenStable();
    expect(active().getAttribute('data-iso')).toBe('2026-03-15');
  });
});

@Component({
  imports: [UiDrawer, UiToastHost],
  template: `<ui-drawer [open]="true" side="start" title="Menu">x</ui-drawer><ui-toast-host />`,
})
class Edges {}

describe('drawer and toast start/end (0.46.0)', () => {
  it('a start drawer slides from the inline start (the sign flips under dir="rtl"); toasts default to bottom-end', () => {
    const f = TestBed.createComponent(Edges);
    f.detectChanges();
    const panel = document.querySelector('ui-drawer .panel, .ui-layer .panel') as HTMLElement;
    expect(panel.getAttribute('data-side')).toBe('start');
    expect(panel.style.getPropertyValue('--ui-slide-from')).toBe('translateX(calc(-100% * var(--ui-inline-sign, 1)))');
    const host = document.querySelector('ui-toast-host .host') as HTMLElement;
    expect(host.getAttribute('data-position')).toBe('bottom-end');
  });

  it('toast motion: bottom-end slides in from the end edge, top-start from the start edge', () => {
    const f = TestBed.createComponent(UiToastHost);
    const motion = () => (f.componentInstance as unknown as { motion: () => { enter: string } }).motion().enter;
    f.componentRef.setInput('position', 'bottom-end');
    expect(motion()).toBe('ui-slide-from-end-enter');
    f.componentRef.setInput('position', 'top-start');
    expect(motion()).toBe('ui-slide-from-start-enter');
    f.componentRef.setInput('position', 'bottom-left');
    expect(motion()).toBe('ui-slide-right-enter');
  });
});

@Component({
  imports: [UiSplitter],
  template: `<div dir="rtl" style="width: 400px"><ui-splitter><div split-a>A</div><div split-b>B</div></ui-splitter></div>`,
})
class SplitRtl {}

describe('splitter in RTL (0.46.0)', () => {
  it('ArrowRight (toward the first pane, on the right) shrinks it; ArrowLeft grows it', () => {
    const f = TestBed.createComponent(SplitRtl);
    f.detectChanges();
    const gutter = (f.nativeElement as HTMLElement).querySelector('.gutter') as HTMLElement;
    gutter.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    f.detectChanges();
    expect(gutter.getAttribute('aria-valuenow')).toBe('48');
    gutter.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
    gutter.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
    f.detectChanges();
    expect(gutter.getAttribute('aria-valuenow')).toBe('52');
  });
});

@Component({
  imports: [UiCarousel],
  template: `<div dir="rtl"><ui-carousel [slides]="slides" [dots]="false" [arrows]="false" /></div>`,
})
class CarouselRtl {
  slides = [{ image: 'a.png' }, { image: 'b.png' }, { image: 'c.png' }];
}

describe('carousel in RTL (0.46.0)', () => {
  const touch = (el: Element, type: string, x: number, t: number) => {
    const ev = new Event(type, { bubbles: true, cancelable: true }) as unknown as TouchEvent;
    const pt = { identifier: 1, clientX: x, clientY: 100 };
    Object.defineProperty(ev, 'touches', { value: type === 'touchend' ? [] : [pt] });
    Object.defineProperty(ev, 'changedTouches', { value: [pt] });
    Object.defineProperty(ev, 'timeStamp', { value: t });
    el.dispatchEvent(ev);
  };

  it('a swipe to the right moves to the next slide; the track moves by +100% per slide', () => {
    const f = TestBed.createComponent(CarouselRtl);
    f.detectChanges();
    const host = (f.nativeElement as HTMLElement).querySelector('ui-carousel') as HTMLElement;
    Object.defineProperty(host, 'clientWidth', { value: 300 });
    touch(host, 'touchstart', 50, 0);
    touch(host, 'touchmove', 120, 50);
    touch(host, 'touchmove', 250, 100);
    touch(host, 'touchend', 250, 110);
    f.detectChanges();
    const track = host.querySelector('.track') as HTMLElement;
    expect(track.style.transform).toContain('-100% * var(--ui-inline-sign, 1)');
  });
});

@Component({
  imports: [UiBreadcrumbs],
  template: `<div dir="rtl"><ui-breadcrumbs separator="›" [items]="items" /></div>`,
})
class CrumbsRtl {
  items = [{ label: 'ހޯމް' }, { label: 'ޑޮކްޓަރުން' }];
}

describe('breadcrumbs in RTL (0.46.0)', () => {
  it('a directional separator points the way the trail reads', () => {
    const f = TestBed.createComponent(CrumbsRtl);
    f.detectChanges();
    expect((f.nativeElement as HTMLElement).querySelector('.sep')!.textContent!.trim()).toBe('‹');
  });
});

@Component({
  imports: [UiCodeBlock],
  template: `<div dir="rtl"><ui-code-block code="const a = 1;" language="ts" /></div>`,
})
class CodeRtl {}

describe('code block in RTL (0.46.0)', () => {
  it('keeps the code left to right', () => {
    const f = TestBed.createComponent(CodeRtl);
    f.detectChanges();
    expect((f.nativeElement as HTMLElement).querySelector('pre.code')!.getAttribute('dir')).toBe('ltr');
  });
});
