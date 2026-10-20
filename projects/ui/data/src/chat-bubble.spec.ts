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
});
