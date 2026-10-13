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
