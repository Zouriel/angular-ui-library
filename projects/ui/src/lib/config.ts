import {
  DOCUMENT,
  EnvironmentProviders,
  InjectionToken,
  inject,
  makeEnvironmentProviders,
  provideEnvironmentInitializer,
} from '@angular/core';

/**
 * Global library configuration. Consumers set defaults once via
 * `provideUiConfig({ ... })` in `app.config.ts`; every component reads these
 * defaults from {@link UI_CONFIG} and lets its own inputs override per-instance.
 */
export interface UiConfig {
  /** Default glass treatment on surface components (card, window, modal, …). */
  glass: boolean;
  /** Rounded corners on/off. */
  radius: boolean;
  /**
   * The library's body font. When set to anything other than the default,
   * `provideUiConfig` writes it to the `--ui-font-default` token on `<html>`, so every
   * component (and any theme that sets its own font) uses it.
   */
  defaultFont: string;
  /**
   * Master animation switch. When false, `provideUiConfig` adds the `ui-no-anim`
   * class to `<html>`, which turns off every library animation and transition
   * (see `styles/animations.css`).
   */
  animations: boolean;
  /**
   * How big things are drawn (0.45.0). `'comfortable'` (the default) is the library as it always was.
   * `'compact'` makes things smaller, not tighter: type one step down (14px body), controls 4px lower,
   * icons and control marks 10% smaller; spacing, radii and touch targets stay. `'auto'` is compact
   * below 600px wide and comfortable above, following resizes. `provideUiConfig` writes it to
   * `data-density` on `<html>` (see {@link applyUiDensity}).
   */
  density: UiDensity;
  /**
   * Where `ui-chat-bubble` puts your own (`mine`) messages when it has no `mineSide` of its own
   * (0.46.3). `'end'` (the default) is the inline end, so they move to the left in RTL; `'right'`
   * keeps them on the right and the other side's on the left in both directions (the chat-app habit).
   */
  chatMineSide: UiChatBubbleSide;
}

/** Where `ui-chat-bubble` puts your own messages: see {@link UiConfig.chatMineSide}. */
export type UiChatBubbleSide = 'end' | 'right';

/** The library's density: see {@link UiConfig.density}. */
export type UiDensity = 'comfortable' | 'compact' | 'auto';

/** Below this viewport width (px) `density: 'auto'` is compact (the media query in tokens.css). */
export const UI_COMPACT_BELOW = 600;

/**
 * Sets the density on an element (default `<html>`), for the whole app or one subtree: writes
 * `data-density="compact"` or `"auto"`, and removes the attribute for `'comfortable'`. The tokens in
 * tokens.css do the rest, so it can change at any time (a settings switch).
 */
export function applyUiDensity(density: UiDensity, el?: HTMLElement | null): void {
  const target = el ?? globalThis.document?.documentElement;
  if (!target) return;
  if (density === 'comfortable') target.removeAttribute('data-density');
  else target.setAttribute('data-density', density);
}

export const UI_CONFIG = new InjectionToken<UiConfig>('UI_CONFIG', {
  providedIn: 'root',
  factory: () => defaultUiConfig,
});

export const defaultUiConfig: UiConfig = {
  glass: false,
  radius: true,
  defaultFont: 'var(--ui-font-default)',
  animations: true,
  density: 'comfortable',
  chatMineSide: 'end',
};

/**
 * Sets library-wide defaults. Call it once in the application's providers
 * (`app.config.ts`); unset keys keep {@link defaultUiConfig}.
 */
export function provideUiConfig(config: Partial<UiConfig> = {}): EnvironmentProviders {
  const resolved: UiConfig = { ...defaultUiConfig, ...config };
  return makeEnvironmentProviders([
    { provide: UI_CONFIG, useValue: resolved },
    provideEnvironmentInitializer(() => {
      const root = inject(DOCUMENT).documentElement;
      root.classList.toggle('ui-no-anim', !resolved.animations);
      // Writing the default back would make the token refer to itself, so only an explicit font is set.
      if (resolved.defaultFont !== defaultUiConfig.defaultFont) root.style.setProperty('--ui-font-default', resolved.defaultFont);
      // Comfortable leaves <html> alone, so an app that sets data-density itself keeps it.
      if (resolved.density !== 'comfortable') applyUiDensity(resolved.density, root);
    }),
  ]);
}

/**
 * Convenience accessor for components. Always returns a fully-resolved config
 * (falls back to {@link defaultUiConfig} when no provider is present).
 */
export function injectUiConfig(): UiConfig {
  return inject(UI_CONFIG, { optional: true }) ?? defaultUiConfig;
}
