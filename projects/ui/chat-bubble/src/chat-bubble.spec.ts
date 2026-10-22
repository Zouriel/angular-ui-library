import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { UiChatBubble } from './chat-bubble';

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
