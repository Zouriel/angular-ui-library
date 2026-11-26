import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { describe, expect, it } from 'vitest';
import { UI_LINK_NAVIGATOR } from '@zouriel/ui';
import { provideUiRouterLinks, uiRouterUrl, type UiRouterLinksOptions } from './router-links';
import { vi } from 'vitest';

@Component({ template: '' })
class Blank {}

describe('uiRouterUrl', () => {
  it('maps hrefs relative to or including the base href to router URLs; app paths stay', () => {
    const base = 'https://addu.example/admin/';
    expect(uiRouterUrl('media/12', base)).toBe('/media/12');
    expect(uiRouterUrl('/admin/media/12?tab=2#x', base)).toBe('/media/12?tab=2#x');
    expect(uiRouterUrl('/media/12', base)).toBe('/media/12');
    expect(uiRouterUrl('media', 'https://addu.example/')).toBe('/media');
  });
});

describe('provideUiRouterLinks', () => {
  function setup(options?: UiRouterLinksOptions) {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          { path: 'media', component: Blank },
          { path: 'media/:id', component: Blank },
          { path: 'hr', component: Blank },
        ]),
        provideUiRouterLinks(options),
      ],
    });
    return { router: TestBed.inject(Router), nav: TestBed.inject(UI_LINK_NAVIGATOR) };
  }

  it('navigates through the router and knows the open page by its path', async () => {
    const { router, nav } = setup();
    nav.navigate('/media/12');
    await new Promise((r) => setTimeout(r));
    expect(router.url).toBe('/media/12');
    expect(nav.isCurrent?.('/media/12')).toBe(true);
    expect(nav.isCurrent?.('/media/12?tab=2')).toBe(true);
    expect(nav.isCurrent?.('/media')).toBe(false);
    expect(nav.isCurrent?.('/hr')).toBe(false);
  });

  it('exact: false also counts the pages under a section link', async () => {
    const { nav } = setup({ exact: false });
    nav.navigate('/media/12');
    await new Promise((r) => setTimeout(r));
    expect(nav.isCurrent?.('/media')).toBe(true);
    expect(nav.isCurrent?.('/med')).toBe(false);
    expect(nav.isCurrent?.('/')).toBe(false);
  });

  it('outside: loads paths another app serves instead of routing them; its own paths still route', async () => {
    const assign = vi.fn<(href: string) => void>();
    const { router, nav } = setup({
      outside: (path) => path.startsWith('/connect/'),
      load: assign,
    });
    nav.navigate('/connect/jobs');
    await new Promise((r) => setTimeout(r));
    expect(assign).toHaveBeenCalledWith('/connect/jobs');
    expect(router.url).toBe('/');
    nav.navigate('/media/12');
    await new Promise((r) => setTimeout(r));
    expect(router.url).toBe('/media/12');
    expect(assign).toHaveBeenCalledTimes(1);
  });
});
