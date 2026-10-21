import type { DestroyRef } from '@angular/core';

/**
 * Calls `check` now, and again whenever anything that can change the theme tokens in effect at `el`
 * may have changed, until `destroy` (or the returned stop function). Browser only; call it once the
 * element is in the page (after render), so its ancestors are known.
 *
 * A component that reads tokens with `getComputedStyle` (custom feature-card colours, the Google
 * button's auto theme, the map's dark tiles) needs more than a `data-theme` watcher: an app built with
 * critical-CSS inlining (Angular's default production build) starts on the inlined `:root` tokens
 * (Winter Dark) and loads the stylesheet with its `[data-theme="..."]` rules a moment later, without
 * any attribute changing, so a component created in between read the wrong theme and kept it.
 *
 * It re-checks on:
 * - `data-theme` changes anywhere in the page (UiThemeService, ui-theme-provider, a scoped theme);
 * - `class` / `style` changes on `el` and each of its ancestors (themes switched by a class, tokens set inline);
 * - stylesheets arriving: `<style>` / `<link>` added, removed or edited in `<head>`, and a `<link>` finishing loading;
 * - the device's light/dark preference changing (`prefers-color-scheme`, for app stylesheets that follow it).
 *
 * Checks are coalesced to one per microtask, so a burst of changes reads the tokens once.
 */
export function uiWatchTheme(el: Element, destroy: DestroyRef, check: () => void): () => void {
  const doc = el.ownerDocument;
  const win = doc.defaultView;
  let stopped = false;
  let queued = false;
  const schedule = () => {
    if (stopped || queued) return;
    queued = true;
    queueMicrotask(() => {
      queued = false;
      if (!stopped) check();
    });
  };

  const themes = new MutationObserver(schedule);
  themes.observe(doc.documentElement, { attributes: true, subtree: true, attributeFilter: ['data-theme'] });

  const chain = new MutationObserver(schedule);
  for (let n: Element | null = el; n; n = n.parentElement) chain.observe(n, { attributes: true, attributeFilter: ['class', 'style'] });

  const sheets = new MutationObserver(schedule);
  if (doc.head) {
    sheets.observe(doc.head, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['media', 'disabled', 'href', 'rel'] });
  }

  // `load` doesn't bubble: listen in the capture phase to hear every <link rel="stylesheet"> finish.
  const onLoad = (e: Event) => {
    if ((e.target as Element | null)?.localName === 'link') schedule();
  };
  doc.addEventListener('load', onLoad, true);

  const scheme = typeof win?.matchMedia === 'function' ? win.matchMedia('(prefers-color-scheme: dark)') : null;
  scheme?.addEventListener?.('change', schedule);

  const stop = () => {
    if (stopped) return;
    stopped = true;
    themes.disconnect();
    chain.disconnect();
    sheets.disconnect();
    doc.removeEventListener('load', onLoad, true);
    scheme?.removeEventListener?.('change', schedule);
  };
  destroy.onDestroy(stop);
  check();
  return stop;
}
