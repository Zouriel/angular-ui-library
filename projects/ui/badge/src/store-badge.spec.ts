import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it, vi } from 'vitest';
import { UiStoreBadge } from './store-badge';
import { APP_STORE_BADGE_BLACK, APP_STORE_BADGE_WHITE } from './store-badge-art';

@Component({
  imports: [UiStoreBadge],
  template: `<ui-store-badge [href]="url" [scheme]="scheme()" [height]="h" />`,
})
class Host {
  url = 'https://apps.apple.com/us/app/invites-blog/id6829749209';
  scheme = signal<'auto' | 'light' | 'dark'>('light');
  h = 44;
}

function mount() {
  const f = TestBed.createComponent(Host);
  f.detectChanges();
  const el = f.nativeElement as HTMLElement;
  return { f, a: el.querySelector('a')!, img: el.querySelector('img')! };
}

describe('UiStoreBadge', () => {
  it('links to the listing with the official alt text and height', () => {
    const { a, img } = mount();
    expect(a.getAttribute('href')).toBe('https://apps.apple.com/us/app/invites-blog/id6829749209');
    expect(img.alt).toBe('Download on the App Store');
    expect(img.style.height).toBe('44px');
  });

  it('uses the black badge on light and the white one on dark', () => {
    const { f, img } = mount();
    expect(img.getAttribute('src')).toBe(APP_STORE_BADGE_BLACK);
    f.componentInstance.scheme.set('dark');
    f.detectChanges();
    expect(f.nativeElement.querySelector('img').getAttribute('src')).toBe(APP_STORE_BADGE_WHITE);
  });

  it('auto follows the surrounding color-scheme', async () => {
    // jsdom doesn't compute color-scheme, so answer for it
    const spy = vi.spyOn(window, 'getComputedStyle').mockReturnValue({ colorScheme: 'dark' } as CSSStyleDeclaration);
    const f = TestBed.createComponent(Host);
    f.componentInstance.scheme.set('auto');
    f.detectChanges();
    await f.whenStable();
    f.detectChanges();
    expect(f.nativeElement.querySelector('img').getAttribute('src')).toBe(APP_STORE_BADGE_WHITE);
    spy.mockRestore();
  });
});
