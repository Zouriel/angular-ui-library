import { DOCUMENT } from '@angular/common';
import { inject, type Provider, signal } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { UI_LINK_NAVIGATOR, type UiLinkNavigator } from '@zouriel/ui';

export interface UiRouterLinksOptions {
  /**
   * When a link counts as the open page: `true` (default) only on its own path; `false` also on the pages
   * under it (`/media` for `/media/12`), for section links in a navbar.
   */
  exact?: boolean;
  /**
   * Same-origin paths this app does not serve, such as a sibling app on the same domain (a hub at `/`
   * with portal apps at `/connect/`, `/visit/`...). A link whose path it returns `true` for loads that
   * page instead of going to this app's router, which would only find its own "not found" page.
   * Receives the link's path, e.g. `/connect/jobs`.
   */
  outside?: (path: string) => boolean;
  /** How a link `outside` names is loaded; defaults to `location.assign(href)`. */
  load?: (href: string) => void;
}

/** The path of a URL or href, without query or fragment, and without a trailing slash. */
function pathOf(url: string): string {
  const path = url.split(/[?#]/)[0] || '/';
  return path.length > 1 ? path.replace(/\/+$/, '') : path;
}

/**
 * An href as the router's URL: an href relative to the page's `<base href>` (`media/12`) or one that
 * includes it (`/admin/media/12`) both become `/media/12`; an app path (`/media/12`) stays as it is.
 */
export function uiRouterUrl(href: string, baseUri: string): string {
  const base = new URL(baseUri);
  const url = new URL(href, base);
  const root = base.pathname.replace(/\/[^/]*$/, '/');
  const rest = url.pathname.startsWith(root) ? '/' + url.pathname.slice(root.length) : url.pathname;
  return rest + url.search + url.hash;
}

/**
 * The library's links through the Angular Router (0.87.0): a plain click on an app-internal `ui-link`,
 * `ui-button href`, breadcrumb or feature card goes to `router.navigateByUrl` instead of loading the page,
 * and those links mark the open page (`aria-current="page"`). Add it to the app's providers next to
 * `provideRouter`. Under a `<base href>` (an app served at `/admin/`), write hrefs relative to it
 * (`media/12`) or with it (`/admin/media/12`), so open-in-new-tab gets the right address too; both reach
 * the router as `/media/12`. Paths served by another app on the same origin are named with `outside`.
 */
export function provideUiRouterLinks(options: UiRouterLinksOptions = {}): Provider {
  return {
    provide: UI_LINK_NAVIGATOR,
    useFactory: (): UiLinkNavigator => {
      const router = inject(Router);
      const doc = inject(DOCUMENT);
      const toUrl = (href: string) => uiRouterUrl(href, doc.baseURI);
      const url = signal(router.url);
      router.events.subscribe((e) => {
        if (e instanceof NavigationEnd) url.set(e.urlAfterRedirects);
      });
      const exact = options.exact ?? true;
      return {
        navigate: (href) => {
          if (options.outside?.(new URL(href, doc.baseURI).pathname))
            (options.load ?? ((h) => doc.location.assign(h)))(href);
          else void router.navigateByUrl(toUrl(href));
        },
        isCurrent: (href) => {
          const here = pathOf(url());
          const there = pathOf(toUrl(href));
          return here === there || (!exact && there !== '/' && here.startsWith(there + '/'));
        },
      };
    },
  };
}
