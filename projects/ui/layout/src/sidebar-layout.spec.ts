import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { UiSidebarLayout } from './sidebar-layout';
// Components import the core as @zouriel/ui, so the token must come from there too.
import { provideUiStrings } from '@zouriel/ui';

@Component({
  imports: [UiSidebarLayout],
  template: `<ui-sidebar-layout [mainLandmark]="landmark()"><nav sidebar>nav</nav><p>page</p></ui-sidebar-layout>`,
})
class Host {
  readonly landmark = signal(true);
}

@Component({
  imports: [UiSidebarLayout],
  template: `
    <div [attr.dir]="dir()">
      <ui-sidebar-layout #shell [bar]="bar()" [fill]="fill()" [(open)]="open">
        <nav sidebar><a href="#a">Chats</a></nav>
        <strong header>Title</strong>
        @if (shell.compact()) { <button id="menu" type="button" (click)="shell.toggle()">Menu</button> }
        <p>page</p>
      </ui-sidebar-layout>
    </div>
  `,
})
class Shell {
  readonly bar = signal(true);
  readonly fill = signal(false);
  readonly open = signal(false);
  readonly dir = signal<'ltr' | 'rtl'>('ltr');
}

describe('UiSidebarLayout', () => {
  const original = window.matchMedia;
  let narrow = false;
  beforeEach(() => {
    narrow = false;
    window.matchMedia = ((q: string) => ({ matches: narrow, media: q, addEventListener() {}, removeEventListener() {} })) as unknown as typeof window.matchMedia;
  });
  afterEach(() => { window.matchMedia = original; });

  const make = () => {
    const f = TestBed.createComponent(Shell);
    f.detectChanges();
    const el = f.nativeElement as HTMLElement;
    const layout = f.debugElement.children[0].children[0].componentInstance as UiSidebarLayout;
    return { f, el, layout, q: (s: string) => el.querySelector(s) as HTMLElement | null };
  };

  it('makes the content region the main landmark unless told not to', () => {
    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    const content = fixture.nativeElement.querySelector('.content') as HTMLElement;
    expect(content.getAttribute('role')).toBe('main');
    expect(fixture.nativeElement.querySelector('main')).toBeNull();
    fixture.componentInstance.landmark.set(false);
    fixture.detectChanges();
    expect(content.hasAttribute('role')).toBe(false);
    expect(content.textContent).toContain('page');
  });

  it('exposes compact publicly, so the app shows its own menu button only in drawer mode', () => {
    const wide = make();
    expect(wide.layout.compact()).toBe(false);
    expect(wide.q('#menu')).toBeNull();
    expect(wide.q('.burger')).toBeNull();
    narrow = true;
    const small = make();
    expect(small.layout.compact()).toBe(true);
    expect(small.q('#menu')).not.toBeNull();
    expect(small.q('.burger')).not.toBeNull();
  });

  it('bar=false renders no built-in bar or burger; the app opens the drawer through open/toggle()', () => {
    narrow = true;
    const { f, layout, q } = make();
    f.componentInstance.bar.set(false);
    f.detectChanges();
    expect(q('header.bar')).toBeNull();
    expect(q('.burger')).toBeNull();
    expect(q('strong[header]')).toBeNull(); // the [header] slot goes with the bar
    q('#menu')!.click();
    f.detectChanges();
    expect(f.componentInstance.open()).toBe(true);
    expect(q('ui-sidebar-layout')!.classList.contains('ui-open')).toBe(true);
    layout.close();
    f.detectChanges();
    expect(f.componentInstance.open()).toBe(false);
  });

  it('names the burger and the drawer close control from the built-in strings', () => {
    narrow = true;
    const { q } = make();
    expect(q('.burger')!.getAttribute('aria-label')).toBe('Toggle navigation');
    expect(q('.skip-close')!.textContent!.trim()).toBe('Close navigation');
    expect(q('aside')!.getAttribute('aria-label')).toBe('Navigation');
  });

  it('takes the app language for those words from provideUiStrings', () => {
    TestBed.configureTestingModule({ providers: [provideUiStrings({ sidebarToggle: 'މެނޫ', sidebarClose: 'ބަންދުކުރޭ', sidebarLabel: 'ނެވިގޭޝަން' })] });
    narrow = true;
    const { q } = make();
    expect(q('.burger')!.getAttribute('aria-label')).toBe('މެނޫ');
    expect(q('.skip-close')!.textContent!.trim()).toBe('ބަންދުކުރޭ');
    expect(q('aside')!.getAttribute('aria-label')).toBe('ނެވިގޭޝަން');
  });

  it('keeps a closed drawer inert and hidden from screen readers, and the page inert while it is open', () => {
    narrow = true;
    const { f, q } = make();
    const aside = q('aside')!;
    expect(aside.hasAttribute('inert')).toBe(true);
    expect(aside.getAttribute('aria-hidden')).toBe('true');
    expect(q('.main')!.hasAttribute('inert')).toBe(false);
    f.componentInstance.open.set(true);
    f.detectChanges();
    expect(aside.hasAttribute('inert')).toBe(false);
    expect(aside.hasAttribute('aria-hidden')).toBe(false);
    expect(aside.getAttribute('role')).toBe('dialog');
    expect(aside.getAttribute('aria-modal')).toBe('true');
    expect(q('.main')!.hasAttribute('inert')).toBe(true);
    expect(q('.burger')!.getAttribute('aria-expanded')).toBe('true');
  });

  it('a docked sidebar on desktop is a plain, reachable region', () => {
    const { q } = make();
    const aside = q('aside')!;
    expect(aside.hasAttribute('inert')).toBe(false);
    expect(aside.hasAttribute('role')).toBe(false);
    expect(aside.hasAttribute('aria-hidden')).toBe(false);
    expect(q('.skip-close')).toBeNull();
  });

  it('Escape and the backdrop close the drawer; focus moves in on open and back to the opener on close', async () => {
    narrow = true;
    const { f, q } = make();
    document.body.appendChild(f.nativeElement);
    try {
      const menu = q('#menu')!;
      menu.focus();
      menu.click();
      f.detectChanges();
      await f.whenStable();
      expect(f.componentInstance.open()).toBe(true);
      expect(document.activeElement).toBe(q('aside'));

      q('aside')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      f.detectChanges();
      await f.whenStable();
      expect(f.componentInstance.open()).toBe(false);
      expect(document.activeElement).toBe(menu);

      menu.click();
      f.detectChanges();
      await f.whenStable();
      q('.backdrop')!.click();
      f.detectChanges();
      await f.whenStable();
      expect(f.componentInstance.open()).toBe(false);
      expect(document.activeElement).toBe(menu);

      // The skip-style close button does the same for keyboard and screen-reader users.
      menu.click();
      f.detectChanges();
      await f.whenStable();
      q('.skip-close')!.click();
      f.detectChanges();
      expect(f.componentInstance.open()).toBe(false);
    } finally {
      f.nativeElement.remove();
    }
  });

  it('Escape does nothing on desktop (no drawer to close)', () => {
    const { f, q } = make();
    f.componentInstance.open.set(true); // ignored above the breakpoint
    f.detectChanges();
    const e = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
    let reachedOutside = false;
    f.nativeElement.addEventListener('keydown', () => (reachedOutside = true));
    q('aside')!.dispatchEvent(e);
    expect(reachedOutside).toBe(true);
  });

  it('fill: exactly the viewport, with the content and the sidebar scrolling inside and no content padding', () => {
    const { f, q } = make();
    const host = q('ui-sidebar-layout')!;
    expect(getComputedStyle(host).minHeight).toBe('100vh');
    expect(getComputedStyle(q('.content')!).overflowY).not.toBe('auto');
    f.componentInstance.fill.set(true);
    f.detectChanges();
    expect(host.classList.contains('ui-fill')).toBe(true);
    const hs = getComputedStyle(host);
    expect(hs.height).toMatch(/^100d?vh$/);
    expect(hs.overflow).toBe('hidden');
    const main = getComputedStyle(q('.main')!);
    expect([main.overflow, main.minHeight]).toEqual(['hidden', '0px']);
    const content = getComputedStyle(q('.content')!);
    expect([content.overflowY, content.minHeight, content.display, content.flexDirection]).toEqual(['auto', '0px', 'flex', 'column']);
    expect(content.paddingTop).toMatch(/^0(px)?$/);
    // The sidebar's body scrolls (0.41: inside the aside, between the fixed header and footer).
    expect(getComputedStyle(q('.sb-bd')!).overflowY).toBe('auto');
    expect(getComputedStyle(q('aside')!).overflowY).not.toBe('auto');
  });

  it('places the sidebar with logical properties and slides the drawer from the start edge, also in RTL', () => {
    narrow = true;
    const { f, q } = make();
    const aside = getComputedStyle(q('aside')!);
    expect(aside.borderInlineEndWidth || aside.getPropertyValue('border-inline-end')).toBeTruthy();
    expect(aside.position).toBe('fixed');
    expect(aside.transform).toBe('translateX(var(--ui-sb-from))');
    const host = q('ui-sidebar-layout')!;
    expect(getComputedStyle(host).getPropertyValue('--ui-sb-from').trim()).toBe('-100%');
    f.componentInstance.dir.set('rtl');
    f.detectChanges();
    expect(getComputedStyle(host).getPropertyValue('--ui-sb-from').trim()).toBe('100%');
  });
});

/** 0.41: a fixed [sidebar-header] and [sidebar-footer] around the scrolling [sidebar]. */
@Component({
  imports: [UiSidebarLayout],
  template: `
    <div [attr.dir]="dir()">
      <ui-sidebar-layout [bar]="false" [fill]="fill()" [(open)]="open">
        @if (parts()) { <button id="new" sidebar-header type="button">New chat</button> }
        <nav sidebar>@for (i of rows; track i) { <a class="row" href="#">Chat {{ i }}</a> }</nav>
        @if (parts()) { <div sidebar-footer><button id="visits" type="button">My nurse visits</button><button id="me" type="button">Profile</button></div> }
        <p>page</p>
      </ui-sidebar-layout>
    </div>
  `,
})
class Pinned {
  readonly fill = signal(true);
  readonly open = signal(false);
  readonly parts = signal(true);
  readonly dir = signal<'ltr' | 'rtl'>('ltr');
  readonly rows = Array.from({ length: 80 }, (_, i) => i + 1);
}

describe('UiSidebarLayout fixed sidebar header and footer', () => {
  const original = window.matchMedia;
  let narrow = false;
  beforeEach(() => {
    narrow = false;
    window.matchMedia = ((q: string) => ({ matches: narrow, media: q, addEventListener() {}, removeEventListener() {} })) as unknown as typeof window.matchMedia;
  });
  afterEach(() => { window.matchMedia = original; });

  const make = () => {
    const f = TestBed.createComponent(Pinned);
    f.detectChanges();
    const el = f.nativeElement as HTMLElement;
    return { f, el, q: (s: string) => el.querySelector(s) as HTMLElement };
  };
  const overflows = (e: Element) => {
    const st = getComputedStyle(e);
    return [st.overflow, st.overflowY].some((v) => v === 'auto' || v === 'scroll');
  };

  for (const mode of ['docked', 'drawer'] as const) {
    it(`${mode}: header, body, footer are the aside's column; only the body scrolls`, () => {
      narrow = mode === 'drawer';
      const { f, q } = make();
      if (mode === 'drawer') { f.componentInstance.open.set(true); f.detectChanges(); }
      const aside = q('aside');
      const parts = Array.from(aside.children).filter((c) => c.tagName === 'DIV').map((c) => c.className.split(' ')[0]);
      expect(parts).toEqual(['sb-hd', 'sb-bd', 'sb-ft']);
      expect(q('.sb-hd').contains(q('#new'))).toBe(true);
      expect(q('.sb-ft').contains(q('#visits'))).toBe(true);
      expect(q('.sb-bd').querySelectorAll('.row').length).toBe(80);
      const st = getComputedStyle(aside);
      expect([st.display, st.flexDirection]).toEqual(['flex', 'column']);
      expect(getComputedStyle(q('.sb-bd')).minHeight).toBe('0px');
      for (const s of ['.sb-hd', '.sb-ft']) expect(getComputedStyle(q(s)).flex.startsWith('0 0') || getComputedStyle(q(s)).flex === 'none', s).toBe(true);
      const scrollers = [aside, ...Array.from(aside.querySelectorAll('*'))].filter(overflows);
      expect(scrollers).toEqual([q('.sb-bd')]);
    });
  }

  it('hairlines show only while the list is scrolled out of sight on that side', () => {
    const { f, q } = make();
    const bd = q('.sb-bd');
    let top = 0;
    Object.defineProperty(bd, 'clientHeight', { get: () => 400 });
    Object.defineProperty(bd, 'scrollHeight', { get: () => 3200 });
    Object.defineProperty(bd, 'scrollTop', { get: () => top, set: (v: number) => { top = v; } });
    const scrollTo = (v: number) => { top = v; bd.dispatchEvent(new Event('scroll')); f.detectChanges(); };
    scrollTo(0);
    expect([q('.sb-hd').classList.contains('edge'), q('.sb-ft').classList.contains('edge')]).toEqual([false, true]);
    scrollTo(1000);
    expect([q('.sb-hd').classList.contains('edge'), q('.sb-ft').classList.contains('edge')]).toEqual([true, true]);
    scrollTo(2800);
    expect([q('.sb-hd').classList.contains('edge'), q('.sb-ft').classList.contains('edge')]).toEqual([true, false]);
  });

  it('the safe area goes on the first and last part: header top, footer bottom (fill and drawer)', () => {
    for (const n of [false, true]) {
      narrow = n;
      const { q } = make();
      expect(getComputedStyle(q('.sb-hd')).paddingBlockStart || getComputedStyle(q('.sb-hd')).getPropertyValue('padding-block-start')).toBe('var(--sb-pt)');
      expect(getComputedStyle(q('.sb-ft')).paddingBlockEnd || getComputedStyle(q('.sb-ft')).getPropertyValue('padding-block-end')).toBe('var(--sb-pb)');
      const aside = getComputedStyle(q('aside'));
      expect(aside.getPropertyValue('--sb-pt')).toContain('safe-area-inset-top');
      expect(aside.getPropertyValue('--sb-pb')).toContain('safe-area-inset-bottom');
    }
  });

  it('without header and footer the slots take no room and the list keeps its padding (backward compatible)', () => {
    const { f, q } = make();
    f.componentInstance.parts.set(false);
    f.detectChanges();
    expect(getComputedStyle(q('.sb-hd')).display).toBe('none');
    expect(getComputedStyle(q('.sb-ft')).display).toBe('none');
    const bd = getComputedStyle(q('.sb-bd'));
    expect(bd.paddingBlockStart || bd.getPropertyValue('padding-block-start')).toBe('var(--sb-pt)');
  });

  it('docked without fill, the header and footer stick to the screen while the page scrolls', () => {
    const { f, q } = make();
    f.componentInstance.fill.set(false);
    f.detectChanges();
    expect(getComputedStyle(q('.sb-hd')).position).toBe('sticky');
    expect(getComputedStyle(q('.sb-ft')).position).toBe('sticky');
    f.componentInstance.fill.set(true);
    f.detectChanges();
    expect(getComputedStyle(q('.sb-ft')).position).not.toBe('sticky');
  });

  it('focus order is header, list, footer, in LTR and RTL; the drawer stays labelled', () => {
    narrow = true;
    for (const dir of ['ltr', 'rtl'] as const) {
      const { f, q } = make();
      f.componentInstance.dir.set(dir);
      f.componentInstance.open.set(true);
      f.detectChanges();
      const order = Array.from(q('aside').querySelectorAll('a, button')).map((b) => b.id || b.className);
      expect(order[0]).toBe('skip-close');
      expect(order[1]).toBe('new');
      expect(order.slice(2, 82).every((c) => c === 'row')).toBe(true);
      expect(order.slice(82)).toEqual(['visits', 'me']);
      expect(q('aside').getAttribute('aria-label')).toBe('Navigation');
      // Logical padding, so the start inset follows the direction.
      const bd = getComputedStyle(q('.sb-bd'));
      expect(bd.paddingInlineStart || bd.getPropertyValue('padding-inline-start')).toBe('var(--sb-ps)');
    }
  });
});
