/**
 * A CSS font stack that previews `family` with a sensible fallback, for showing a font in its own
 * typeface (font pickers). A value that is already a stack (has a comma or quotes) is used as is;
 * a bare family name is quoted, so names with spaces ("Open Sans") work.
 */
export function uiFontStack(family: string | null | undefined): string | null {
  const f = (family ?? '').trim();
  if (!f) return null;
  if (/[,"']/.test(f)) return f;
  if (/^(serif|sans-serif|monospace|cursive|fantasy|system-ui|ui-[a-z-]+)$/.test(f)) return f;
  return `"${f}", system-ui, sans-serif`;
}
