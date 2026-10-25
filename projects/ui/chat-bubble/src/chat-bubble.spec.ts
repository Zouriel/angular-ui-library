import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { UiChatBubble } from './chat-bubble';
import { defaultUiConfig, provideUiConfig } from '@zouriel/ui';

@Component({
  imports: [UiChatBubble],
  template: `
    <ui-chat-bubble id="m" [mine]="true" meta="09:41 · Read" ariaLabel="You, 09:41">On my way</ui-chat-bubble>
    <ui-chat-bubble id="o">See you soon</ui-chat-bubble>
  `,
})
class Host {}

describe('ui-chat-bubble', () => {
  it('marks your own, shows the meta line, and names the message when asked', () => {
    const f = TestBed.createComponent(Host);
    f.detectChanges();
    const el = f.nativeElement as HTMLElement;
    const m = el.querySelector('#m')!, o = el.querySelector('#o')!;
    expect(m.classList.contains('mine')).toBe(true);
    expect(o.classList.contains('mine')).toBe(false);
    expect(m.querySelector('.meta')!.textContent).toBe('09:41 · Read');
    expect(o.querySelector('.meta')).toBeNull();
    expect(m.getAttribute('aria-label')).toBe('You, 09:41');
    expect(m.querySelector('.text')!.textContent!.trim()).toBe('On my way');
    // Inline end / start, so RTL mirrors it.
    expect(getComputedStyle(m).justifyContent).toBe('flex-end');
    expect(getComputedStyle(o).justifyContent).toBe('flex-start');
  });

  // 0.42.2: in a column with align-items: flex-start/flex-end the host shrank to its text, the 80%
  // resolved against that and overflow-wrap: anywhere broke "okay" as "ok/ay". The layout itself is
  // checked in Chromium by `npm run audit:chat-wrap`; this guards the rules it depends on.
  it('takes the whole row whatever the parent aligns, and breaks words only when they overflow', () => {
    const f = TestBed.createComponent(Host);
    f.detectChanges();
    const el = f.nativeElement as HTMLElement;
    for (const b of [el.querySelector('#m')!, el.querySelector('#o')!]) {
      const s = getComputedStyle(b);
      expect(s.alignSelf).toBe('stretch');
      expect(s.justifySelf).toBe('stretch');
      expect(s.width).toBe('100%');
      expect(s.minWidth).toBe('0px');
      expect(s.boxSizing).toBe('border-box');
      const bubble = getComputedStyle(b.querySelector('.bubble')!);
      expect(bubble.overflowWrap).toBe('break-word');
      expect(bubble.maxWidth).toBe('80%');
    }
  });
});

// 0.46.3: mineSide="right" keeps yours on the physical right in LTR and RTL (the chat-app habit), with the
// tucked corner and the meta line following, and lets the text take its own direction. Positions in a real
// browser are measured by `npm run audit:rtl`; this guards the rules and the config fallback.
@Component({
  imports: [UiChatBubble],
  template: `
    <div [attr.dir]="dir">
      <ui-chat-bubble id="m" [mine]="true" [mineSide]="side()" meta="09:41">ޝުކުރިއްޔާ</ui-chat-bubble>
      <ui-chat-bubble id="o" [mineSide]="side()" meta="09:40">On my way</ui-chat-bubble>
    </div>
  `,
})
class SideHost {
  dir: 'ltr' | 'rtl' = 'rtl';
  readonly side = signal<'end' | 'right' | undefined>(undefined);
}

describe('ui-chat-bubble mineSide', () => {
  const make = (dir: 'ltr' | 'rtl', side: 'end' | 'right' | undefined) => {
    const f = TestBed.createComponent(SideHost);
    f.componentInstance.dir = dir;
    f.componentInstance.side.set(side);
    f.detectChanges();
    const el = f.nativeElement as HTMLElement;
    return { m: el.querySelector('#m') as HTMLElement, o: el.querySelector('#o') as HTMLElement };
  };
  const bubble = (h: HTMLElement) => getComputedStyle(h.querySelector('.bubble')!);

  for (const dir of ['rtl', 'ltr'] as const) {
    it(`${dir} + right: yours pushed to the right edge, theirs to the left, corners and meta physical`, () => {
      const { m, o } = make(dir, 'right');
      expect(m.classList.contains('side-right')).toBe(true);
      expect(o.classList.contains('side-right')).toBe(true);
      expect(bubble(m).marginLeft).toBe('auto');
      expect(bubble(m).marginRight).toBe('0px');
      expect(bubble(o).marginRight).toBe('auto');
      expect(bubble(o).marginLeft).toBe('0px');
      // The tucked corner is the bottom right for yours and the bottom left for theirs, in both directions.
      expect(bubble(m).borderBottomRightRadius).toContain('--ui-radius-xs');
      expect(bubble(m).borderBottomLeftRadius).toContain('--ui-radius-lg');
      expect(bubble(o).borderBottomLeftRadius).toContain('--ui-radius-xs');
      expect(bubble(o).borderBottomRightRadius).toContain('--ui-radius-lg');
      for (const h of [m, o]) {
        expect(getComputedStyle(h.querySelector('.meta')!).textAlign).toBe('right');
        // The text keeps its own direction (Thaana right to left, Latin left to right).
        expect(h.querySelector('.text')!.getAttribute('dir')).toBe('auto');
      }
    });
  }

  it('rtl + default: unchanged, yours at the inline end (the left in RTL) with logical corners', () => {
    const { m, o } = make('rtl', undefined);
    for (const h of [m, o]) {
      expect(h.classList.contains('side-right')).toBe(false);
      expect(bubble(h).marginLeft).not.toBe('auto');
      expect(bubble(h).marginRight).not.toBe('auto');
      expect(h.querySelector('.text')!.hasAttribute('dir')).toBe(false);
      expect(getComputedStyle(h.querySelector('.meta')!).textAlign).toBe('end');
    }
    expect(getComputedStyle(m).justifyContent).toBe('flex-end');
    expect(getComputedStyle(o).justifyContent).toBe('flex-start');
  });

  it("'end' given explicitly is the default", () => {
    const { m } = make('ltr', 'end');
    expect(m.classList.contains('side-right')).toBe(false);
    expect(bubble(m).marginLeft).not.toBe('auto');
  });

  it('follows provideUiConfig({ chatMineSide }) when unset, and its own mineSide wins', () => {
    TestBed.configureTestingModule({ providers: [provideUiConfig({ chatMineSide: 'right' })] });
    const f = TestBed.createComponent(SideHost);
    f.detectChanges();
    const el = f.nativeElement as HTMLElement;
    expect(el.querySelector('#m')!.classList.contains('side-right')).toBe(true);
    f.componentInstance.side.set('end');
    f.detectChanges();
    expect(el.querySelector('#m')!.classList.contains('side-right')).toBe(false);
    expect(defaultUiConfig.chatMineSide).toBe('end');
  });
});
