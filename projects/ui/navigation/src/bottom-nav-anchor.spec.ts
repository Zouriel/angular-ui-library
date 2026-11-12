import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { UiTourService } from '@zouriel/ui/guidance';
import { UiBottomNav, type UiBottomNavItem } from './bottom-nav';

// 0.75.1: `UiBottomNavItem.anchor` lets a tour point at one destination, which an app can't mark
// itself because the bar builds its own buttons.

@Component({
  imports: [UiBottomNav],
  template: `<ui-bottom-nav [items]="items()" active="feed" />`,
})
class Host {
  items = signal<UiBottomNavItem[]>([
    { label: 'Feed', value: 'feed' },
    { label: 'Inbox', value: 'inbox', anchor: 'nav.inbox' },
    { label: 'Account', value: 'account' },
  ]);
}

const realRect = HTMLElement.prototype.getBoundingClientRect;

describe('UiBottomNav item anchor', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'requestAnimationFrame', 'cancelAnimationFrame', 'Date'] });
    // Each item is a 130 x 56 tile along the bottom of a 390 x 844 screen.
    HTMLElement.prototype.getBoundingClientRect = function (this: HTMLElement) {
      if (this.classList.contains('item')) {
        const i = [...this.parentElement!.querySelectorAll('.item')].indexOf(this);
        return new DOMRect(i * 130, 788, 130, 56);
      }
      return realRect.call(this);
    };
    HTMLElement.prototype.scrollIntoView = vi.fn();
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 390 });
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 844 });
  });
  afterEach(() => {
    TestBed.inject(UiTourService).stop();
    vi.useRealTimers();
    HTMLElement.prototype.getBoundingClientRect = realRect;
    document.querySelectorAll('.cdk-overlay-container').forEach((c) => (c.innerHTML = ''));
  });

  function setup() {
    const f = TestBed.createComponent(Host);
    document.body.appendChild(f.nativeElement);
    f.detectChanges();
    const buttons = [...(f.nativeElement as HTMLElement).querySelectorAll<HTMLButtonElement>('button.item')];
    return { f, buttons, tours: TestBed.inject(UiTourService) };
  }

  it('a tour step on the item anchor spotlights that item\'s button', () => {
    const { f, buttons, tours } = setup();
    expect(tours.findAnchor('nav.inbox')).toBe(buttons[1]);
    let outcome: string | undefined;
    tours.start({ id: 't', steps: [{ anchor: 'nav.inbox', text: 'Invitations land here.' }] }).then((o) => (outcome = o));
    for (let i = 0; i < 6; i++) {
      vi.advanceTimersByTime(60);
      f.detectChanges();
    }
    expect(tours.active()).toBe('t');
    const hole = (document.querySelector('.hole') as HTMLElement).style;
    // The button's box, 6px of room round it.
    expect([hole.left, hole.top, hole.width, hole.height]).toEqual(['124px', '782px', '142px', '68px']);
    expect(outcome).toBeUndefined();
  });

  it('items without an anchor register nothing', async () => {
    const { f, tours } = setup();
    f.componentInstance.items.set([
      { label: 'Feed', value: 'feed' },
      { label: 'Inbox', value: 'inbox' },
    ]);
    f.detectChanges();
    expect(tours.findAnchor('nav.inbox')).toBeNull();
    expect(tours.findAnchor('')).toBeNull();
    expect(tours.findAnchor('undefined')).toBeNull();
    expect(await tours.start({ id: 't', steps: [{ anchor: 'nav.inbox', text: 'x' }] })).toBe('closed');
  });
});
