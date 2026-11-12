import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { UiTourService } from '@zouriel/ui/guidance';
import { UiTab, UiTabs } from './tabs';

// 0.75.1: `ui-tab [anchor]` lets a tour point at one tab, whose button `ui-tabs` builds itself.

@Component({
  imports: [UiTabs, UiTab],
  template: `
    <ui-tabs>
      <ui-tab label="Received">received panel</ui-tab>
      <ui-tab label="Hosting" [anchor]="anchor()">hosting panel</ui-tab>
      <ui-tab label="Drafts">drafts panel</ui-tab>
    </ui-tabs>
  `,
})
class Host {
  anchor = signal<string | undefined>('tabs.hosting');
}

const realRect = HTMLElement.prototype.getBoundingClientRect;

describe('UiTab anchor', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'requestAnimationFrame', 'cancelAnimationFrame', 'Date'] });
    // Each tab is a 100 x 36 button in a strip 16px from the top-left.
    HTMLElement.prototype.getBoundingClientRect = function (this: HTMLElement) {
      if (this.getAttribute('role') === 'tab') {
        const i = [...this.parentElement!.querySelectorAll('[role="tab"]')].indexOf(this);
        return new DOMRect(16 + i * 104, 16, 100, 36);
      }
      return realRect.call(this);
    };
    HTMLElement.prototype.scrollIntoView = vi.fn();
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1024 });
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 768 });
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
    const tabs = [...(f.nativeElement as HTMLElement).querySelectorAll<HTMLButtonElement>('[role="tab"]')];
    return { f, tabs, tours: TestBed.inject(UiTourService) };
  }

  it('a tour step on the tab anchor spotlights that tab\'s button', () => {
    const { f, tabs, tours } = setup();
    expect(tours.findAnchor('tabs.hosting')).toBe(tabs[1]);
    tours.start({ id: 't', steps: [{ anchor: 'tabs.hosting', text: 'Events you host.' }] });
    for (let i = 0; i < 6; i++) {
      vi.advanceTimersByTime(60);
      f.detectChanges();
    }
    expect(tours.active()).toBe('t');
    const hole = (document.querySelector('.hole') as HTMLElement).style;
    expect([hole.left, hole.top, hole.width, hole.height]).toEqual(['114px', '10px', '112px', '48px']);
  });

  it('a tab without an anchor registers nothing, and removing the anchor unregisters it', async () => {
    const { f, tours } = setup();
    f.componentInstance.anchor.set(undefined);
    f.detectChanges();
    expect(tours.findAnchor('tabs.hosting')).toBeNull();
    expect(tours.findAnchor('undefined')).toBeNull();
    expect(await tours.start({ id: 't', steps: [{ anchor: 'tabs.hosting', text: 'x' }] })).toBe('closed');
  });
});
