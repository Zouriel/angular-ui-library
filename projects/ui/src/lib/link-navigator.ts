import { InjectionToken, inject, type Provider } from '@angular/core';

/**
 * How the library's own links (`ui-link`, `ui-button` / `ui-icon-button` with `href`, `ui-breadcrumbs`,
 * `ui-feature-card` with `href`, `ui-side-nav` items) move around an app (0.87.0). Without one they are
 * plain `<a href>` and the browser loads the page; with one, a plain click on an app-internal link is
 * handed to `navigate` (a router), and `isCurrent` lets links mark the page that is open
 * (`aria-current="page"`). `@zouriel/ui/router` has one for the Angular Router: `provideUiRouterLinks()`.
 */
export interface UiLinkNavigator {
  /** Goes to an app-internal href (the click's default is already prevented). */
  navigate(href: string, event?: Event): void;
  /** Whether `href` is the page that is open. Read inside a computed, so back it with a signal to stay live. */
  isCurrent?(href: string): boolean;
}

export const UI_LINK_NAVIGATOR = new InjectionToken<UiLinkNavigator>('UI_LINK_NAVIGATOR');

/** Provides the app's link navigator: `provideUiLinkNavigator(() => ({ navigate: (h) => router.navigateByUrl(h) }))`. */
export function provideUiLinkNavigator(factory: () => UiLinkNavigator): Provider {
  return { provide: UI_LINK_NAVIGATOR, useFactory: factory };
}

/** The navigator in effect (inside an injection context), or null. */
export function injectUiLinkNavigator(): UiLinkNavigator | null {
  return inject(UI_LINK_NAVIGATOR, { optional: true });
}

/**
 * Whether a link's href stays in this app: relative (`/media/12`, `media`, `?tab=2`), or absolute with the
 * page's own origin. `#fragment`-only links, other schemes (`mailto:`, `tel:`) and other origins don't.
 */
export function uiIsInternalHref(href: string | null | undefined, origin = globalThis.location?.origin): boolean {
  if (!href || href.startsWith('#')) return false;
  if (/^[a-z][a-z0-9+.-]*:/i.test(href) || href.startsWith('//')) {
    try {
      return !!origin && new URL(href).origin === origin;
    } catch {
      return false;
    }
  }
  return true;
}

/**
 * Hands a click on a library link to the navigator when it should be: a plain primary click (no
 * Ctrl/Cmd/Shift/Alt, not already handled), on an app-internal href, with no `target`. Prevents the
 * browser's own navigation then and returns true; otherwise leaves the click alone and returns false.
 */
export function uiFollowLink(navigator: UiLinkNavigator | null, href: string | null | undefined, event: MouseEvent, target?: string | null): boolean {
  if (!navigator || !href || event.defaultPrevented) return false;
  if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return false;
  if (target && target !== '_self') return false;
  if (!uiIsInternalHref(href)) return false;
  event.preventDefault();
  navigator.navigate(href, event);
  return true;
}
