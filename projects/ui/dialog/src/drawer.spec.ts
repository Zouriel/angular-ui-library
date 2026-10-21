import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it } from 'vitest';
import { UiDrawer, UiDrawerSide } from './drawer';

/**
 * The drawer's fixed header and footer (0.41). jsdom has no layout, so the scroll sizes are set by
 * hand; the real geometry (footer pinned to the bottom of the panel while 60 rows scroll) is checked
 * in a browser for the showcase screenshots.
 */
@Component({
  imports: [UiDrawer],
  template: `
    <div [attr.dir]="dir()">
      <ui-drawer [(open)]="open" [side]="side()" title="Chats">
        @if (parts()) { <button id="new" drawer-header type="button">New chat</button> }
        @for (i of rows; track i) { <button class="row" type="button">Chat {{ i }}</button> }
        @if (parts()) { <div drawer-footer><button id="visits" type="button">My nurse visits</button></div> }
      </ui-drawer>
    </div>
  `,
})
class Host {
  readonly open = signal(true);
  readonly side = signal<UiDrawerSide>('left');
  readonly parts = signal(true);
  readonly dir = signal<'ltr' | 'rtl'>('ltr');
  readonly rows = Array.from({ length: 60 }, (_, i) => i + 1);
}

describe('UiDrawer header and footer', () => {
  afterEach(() => {
    document.body.querySelectorAll(':scope > .ui-layer').forEach((l) => l.remove());
    document.body.style.overflow = '';
  });

  async function make() {
    const f = TestBed.createComponent(Host);
    f.detectChanges();
    await f.whenStable();
    const panel = document.body.querySelector('.ui-layer .panel') as HTMLElement;
    const q = (s: string) => panel.querySelector(s) as HTMLElement;
    return { f, panel, q };
  }

  /** Gives the body a 300px viewport over `content` px and scrolls it to `top`. */
  function sizeBody(f: { detectChanges(): void }, bd: HTMLElement, content: number) {
    let top = 0;
    Object.defineProperty(bd, 'clientHeight', { configurable: true, get: () => 300 });
    Object.defineProperty(bd, 'scrollHeight', { configurable: true, get: () => content });
    Object.defineProperty(bd, 'scrollTop', { configurable: true, get: () => top, set: (v: number) => { top = v; } });
    const scrollTo = (v: number) => { top = v; bd.dispatchEvent(new Event('scroll')); f.detectChanges(); };
    scrollTo(0);
    return scrollTo;
  }

  it('puts the header and footer outside the body, which is the only part that scrolls', async () => {
    const { panel, q } = await make();
    const kids = Array.from(panel.children).map((c) => c.className.split(' ')[0]);
    expect(kids.slice(0, 4)).toEqual(['hd', 'dh', 'bd', 'df']);
    expect(q('.dh').contains(q('#new'))).toBe(true);
    expect(q('.df').contains(q('#visits'))).toBe(true);
    expect(q('.bd').querySelectorAll('.row').length).toBe(60);
    expect(q('.bd').contains(q('#new')) || q('.bd').contains(q('#visits'))).toBe(false);
    expect(getComputedStyle(panel).display).toBe('flex');
    expect(getComputedStyle(panel).flexDirection).toBe('column');
    const bd = getComputedStyle(q('.bd'));
    expect([bd.overflow, bd.minHeight]).toEqual(['auto', '0px']);
    for (const part of ['.hd', '.dh', '.df']) {
      const s = getComputedStyle(q(part));
      expect(s.flex.startsWith('0 0') || s.flex === 'none', part).toBe(true);
      expect(s.overflow === '' || s.overflow === 'visible', part).toBe(true);
    }
    // Nothing else in the panel scrolls.
    const scrollers = Array.from(panel.querySelectorAll('*')).filter((e) => {
      const st = getComputedStyle(e);
      return [st.overflow, st.overflowY].some((v) => v === 'auto' || v === 'scroll');
    });
    expect(scrollers).toEqual([q('.bd')]);
  });

  it('shows the footer hairline while rows are hidden below, the header hairline once scrolled', async () => {
    const { f, q } = await make();
    const scrollTo = sizeBody(f, q('.bd'), 2400);
    expect(q('.dh').classList.contains('edge')).toBe(false);
    expect(q('.df').classList.contains('edge')).toBe(true);
    scrollTo(900);
    expect(q('.dh').classList.contains('edge')).toBe(true);
    expect(q('.df').classList.contains('edge')).toBe(true);
    scrollTo(2100);
    expect(q('.dh').classList.contains('edge')).toBe(true);
    expect(q('.df').classList.contains('edge')).toBe(false);
    // The hairline is the border the part always has, just coloured: its height never changes.
    expect(getComputedStyle(q('.df')).borderTopWidth).toBe('1px');
    expect(getComputedStyle(q('.dh')).borderBottomWidth).toBe('1px');
  });

  it('no hairlines while everything fits', async () => {
    const { f, q } = await make();
    sizeBody(f, q('.bd'), 300);
    expect(q('.dh').classList.contains('edge')).toBe(false);
    expect(q('.df').classList.contains('edge')).toBe(false);
  });

  it('without header and footer content the slots take no room (backward compatible)', async () => {
    const { f, q } = await make();
    f.componentInstance.parts.set(false);
    f.detectChanges();
    expect(getComputedStyle(q('.dh')).display).toBe('none');
    expect(getComputedStyle(q('.df')).display).toBe('none');
    expect(q('.bd').querySelectorAll('.row').length).toBe(60);
  });

  it('keeps a full-height footer clear of the home indicator; a bottom drawer pads the whole panel', async () => {
    const { f, q, panel } = await make();
    expect(getComputedStyle(q('.df')).paddingBottom).toContain('safe-area-inset-bottom');
    f.componentInstance.side.set('right');
    f.detectChanges();
    expect(getComputedStyle(q('.df')).paddingBottom).toContain('safe-area-inset-bottom');
    f.componentInstance.side.set('bottom');
    f.detectChanges();
    // The bottom panel's own padding (env(safe-area-inset-bottom), which jsdom can't read back)
    // already lifts it; the footer doesn't add the inset a second time.
    expect(getComputedStyle(q('.df')).paddingBottom).not.toContain('safe-area');
    expect(panel.getAttribute('data-side')).toBe('bottom');
  });

  it('reads header, body, footer in that order for focus and screen readers, labelled by its title', async () => {
    const { panel } = await make();
    const order = Array.from(panel.querySelectorAll('button')).map((b) => b.id || b.className || b.textContent!.trim());
    // The title bar's close button, then the header, the 60 rows, then the footer.
    expect(order[0]).toBe('x');
    expect(order[1]).toBe('new');
    expect(order[2]).toBe('row');
    expect(order[61]).toBe('row');
    expect(order[62]).toBe('visits');
    expect(panel.getAttribute('role')).toBe('dialog');
    const label = document.getElementById(panel.getAttribute('aria-labelledby')!);
    expect(label?.textContent).toBe('Chats');
  });

  it('keeps the same structure in RTL (the parts are logical, not physical)', async () => {
    const { f, panel } = await make();
    f.componentInstance.dir.set('rtl');
    f.detectChanges();
    const kids = Array.from(panel.children).map((c) => c.className.split(' ')[0]);
    expect(kids.slice(0, 4)).toEqual(['hd', 'dh', 'bd', 'df']);
    const dh = getComputedStyle(panel.querySelector('.dh')!);
    expect(dh.paddingLeft).toBe(dh.paddingRight);
  });
});
