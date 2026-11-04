/** One choice in a filter section: a person, "Videos", a month. */
export interface UiFilterOption {
  /** What the value holds. */
  id: string;
  label: string;
  /** How many items it matches, shown at the end of its row; null or absent for none. */
  count?: number | null;
}

/**
 * One section of a filter panel ("Uploaded by", "Type"). Nothing chosen in a section means everything
 * passes it; its "all" row (allLabel, or the strings' filterAll) is checked then, and choosing it
 * clears the section.
 */
export interface UiFilterSection {
  id: string;
  title: string;
  options: readonly UiFilterOption[];
  /** Several options at once (checkboxes, any of them passes) or one (radios). Default false. */
  multiple?: boolean;
  /** The "everything" row's words ("Everyone"); default the strings' filterAll ("All"). */
  allLabel?: string;
  /** The "everything" row's count. */
  allCount?: number | null;
  /** From this many options the section gets a search field. Default 8. */
  searchAt?: number;
}

/** What is chosen, by section id. A section that's missing or empty lets everything through. */
export type UiFilterValue = Readonly<Record<string, readonly string[]>>;

/** One filter that's on, for a chip: which section and option, and the option's label. */
export interface UiActiveFilter {
  section: string;
  option: string;
  label: string;
}

/** How many options are chosen across every section: the filter button's badge. */
export function uiFilterCount(value: UiFilterValue | null | undefined): number {
  let n = 0;
  for (const ids of Object.values(value ?? {})) n += ids.length;
  return n;
}

/** The chosen options that exist in `sections`, in the panel's order. */
export function uiActiveFilters(sections: readonly UiFilterSection[], value: UiFilterValue | null | undefined): UiActiveFilter[] {
  const out: UiActiveFilter[] = [];
  for (const s of sections) {
    const chosen = value?.[s.id];
    if (!chosen?.length) continue;
    for (const o of s.options) if (chosen.includes(o.id)) out.push({ section: s.id, option: o.id, label: o.label });
  }
  return out;
}

/** `value` without choices that `sections` no longer offer (someone's photos all removed), and
 *  without empty sections. An app filters with this so a stale choice never empties the screen. */
export function uiFilterPrune(sections: readonly UiFilterSection[], value: UiFilterValue | null | undefined): UiFilterValue {
  const out: Record<string, string[]> = {};
  for (const s of sections) {
    const chosen = value?.[s.id];
    if (!chosen?.length) continue;
    const kept = s.options.filter((o) => chosen.includes(o.id)).map((o) => o.id);
    if (kept.length) out[s.id] = s.multiple ? kept : kept.slice(0, 1);
  }
  return out;
}

/** `value` with `section` set to `ids` (removed when empty). */
export function uiFilterSet(value: UiFilterValue | null | undefined, section: string, ids: readonly string[]): UiFilterValue {
  const out: Record<string, readonly string[]> = { ...(value ?? {}) };
  if (ids.length) out[section] = [...ids];
  else delete out[section];
  return out;
}

/** `value` after tapping `option` in `section`: a checkbox flips; a radio is chosen, or cleared when
 *  it already was. */
export function uiFilterToggle(section: UiFilterSection, value: UiFilterValue | null | undefined, option: string): UiFilterValue {
  const chosen = value?.[section.id] ?? [];
  const on = chosen.includes(option);
  if (section.multiple) return uiFilterSet(value, section.id, on ? chosen.filter((id) => id !== option) : [...chosen, option]);
  return uiFilterSet(value, section.id, on ? [] : [option]);
}

/** `value` with one option turned off (a chip's ×). */
export function uiFilterRemove(value: UiFilterValue | null | undefined, section: string, option: string): UiFilterValue {
  return uiFilterSet(value, section, (value?.[section] ?? []).filter((id) => id !== option));
}
