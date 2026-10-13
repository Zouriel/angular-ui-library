import { httpOptionSource, type UiFbHttpSourceConfig, type UiFbHttpSourcesOptions } from './http-sources';
import type { UiFbOptionSourceDef } from './option-sources';
import type { UiFbSettings } from './schema';

/**
 * App-wide form settings, edited with `ui-form-global-settings` and stored by
 * the app as plain JSON: the lists every form can use, and what new forms start with.
 */
export interface UiFormGlobalSettings {
  version: 1;
  /** Lists set up by admins (address, paging, how to read the reply). */
  sources?: UiFbHttpSourceConfig[];
  /** What every new form starts with (`createDefinition(title, settings.defaults)`). Each form can change its own. */
  defaults?: UiFbSettings;
}

export function createGlobalSettings(): UiFormGlobalSettings {
  return { version: 1, sources: [], defaults: {} };
}

/** The lists in global settings as option sources (used by the builder and renderer's `globalSettings` input). */
export function sourcesFromSettings(settings: UiFormGlobalSettings | null | undefined, options: UiFbHttpSourcesOptions = {}): UiFbOptionSourceDef[] {
  return (settings?.sources ?? []).filter((c) => c.type && c.url).map((c) => httpOptionSource(c, options));
}
