/** Shared primitive types used across the library. */

/** The fixed size scale. Components never accept arbitrary sizes. */
export type UiSize = 'sm' | 'md' | 'lg';

/** Buttons (and avatars) also come extra large: `xl`, 56px, for the one big action on a phone screen. */
export type UiButtonSize = UiSize | 'xl';

/** Status/tone scale shared by badges, chips, progress, etc. */
export type UiStatus = 'neutral' | 'primary' | 'success' | 'warning' | 'danger';

/**
 * How see-through a glass bottom sheet or floating panel is (0.41.3). `'clear'`: for a map in the
 * theme's own brightness, which plainly shows through. `'frosted'`: near-opaque, AA over any backdrop
 * (photos, a map in the other brightness).
 */
export type UiGlassStrength = 'clear' | 'frosted';
