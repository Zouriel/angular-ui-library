/**
 * The form definition format shared by `ui-form-builder` (which edits it) and
 * `ui-form-renderer` (which fills it in). Everything here is plain JSON so a host
 * app can store it as-is.
 *
 * Identity: every element has an immutable `id` (generated, never shown). Fields
 * also have an editable `key` — the property name their answer is stored under
 * in the submitted data. Rules, calculations and jumps always point at ids, so
 * renaming a key never breaks logic; a renamed key is remembered in `keyHistory`
 * so answers saved under the old name still load.
 */

export const UI_FB_SCHEMA_VERSION = 1;

export type UiFbFieldType =
  | 'text'
  | 'textarea'
  | 'email'
  | 'phone'
  | 'url'
  | 'number'
  | 'currency'
  | 'date'
  | 'time'
  | 'select'
  | 'radio'
  | 'checkboxes'
  | 'multiselect'
  | 'checkbox'
  | 'toggle'
  | 'rating'
  | 'slider'
  | 'file'
  | 'hidden'
  | 'calculated';

export type UiFbStaticType = 'heading' | 'paragraph' | 'divider';

/** Where a field's label sits. `inside` floats it inside text-like inputs. */
export type UiFbLabelPlacement = 'top' | 'inside' | 'left' | 'hidden';
/** Where a field's error message sits. `inside` puts it within the input box. */
export type UiFbErrorPlacement = 'below' | 'inside';
export type UiFbWidth = 'full' | 'two-thirds' | 'half' | 'third';

// ── Conditions ────────────────────────────────────────────────────────────

export type UiFbOperator =
  // any field
  | 'empty'
  | 'notEmpty'
  // text and numbers
  | 'eq'
  | 'neq'
  | 'contains'
  | 'notContains'
  | 'startsWith'
  | 'endsWith'
  | 'gt'
  | 'gte'
  | 'lt'
  | 'lte'
  | 'between'
  // dates and times
  | 'before'
  | 'after'
  | 'onOrBefore'
  | 'onOrAfter'
  // single choice
  | 'anyOf'
  | 'noneOf'
  // multiple choice
  | 'includes'
  | 'excludes'
  | 'includesAny'
  | 'includesAll'
  | 'countGte'
  | 'countLte'
  // yes/no
  | 'isTrue'
  | 'isFalse'
  // groups and pages
  | 'visible'
  | 'hidden'
  | 'complete'
  | 'incomplete'
  // repeatable groups
  | 'rowsGte'
  | 'rowsLte';

/** The right-hand side of a comparison. */
export type UiFbOperand =
  | { const: unknown }
  /** Another field's current value. */
  | { ref: string }
  /** Today's date shifted by `today` days (dates only). */
  | { today: number };

/** One comparison: "<ref> <op> <value>". `ref` is an element id. */
export interface UiFbConditionRule {
  ref: string;
  op: UiFbOperator;
  value?: UiFbOperand;
  /** Second bound for `between`. */
  value2?: UiFbOperand;
}

/** A set of conditions combined with all (AND), any (OR) or none (NOR). */
export interface UiFbConditionGroup {
  match: 'all' | 'any' | 'none';
  conditions: UiFbCondition[];
}

export type UiFbCondition = UiFbConditionGroup | UiFbConditionRule;

/** `true`/`false`, or "only when this condition holds". */
export type UiFbToggle = boolean | { when: UiFbCondition };

export interface UiFbVisibility {
  action: 'show' | 'hide';
  when: UiFbCondition;
}

export interface UiFbSetValue {
  id: string;
  when: UiFbCondition;
  value: UiFbOperand;
}

// ── Validation ────────────────────────────────────────────────────────────

export interface UiFbValidatorRule {
  id: string;
  /** A built-in validator type (`minLength`, `email`, …) or an app-registered one. */
  type: string;
  params?: Record<string, unknown>;
  /** Overrides the validator's default message. Supports `{label}` and `{param}` placeholders. */
  message?: string;
  /** Only check this rule when the condition holds. */
  when?: UiFbCondition;
  /** Warnings are shown but do not block submitting. */
  severity?: 'error' | 'warning';
}

// ── Calculations ──────────────────────────────────────────────────────────

export type UiFbCalcOp =
  | 'sum'
  | 'subtract'
  | 'multiply'
  | 'divide'
  | 'average'
  | 'min'
  | 'max'
  | 'count'
  | 'ageYears'
  | 'daysBetween'
  | 'concat';

export type UiFbCalcArg = { ref: string } | { const: number | string } | { calc: UiFbCalc };

export interface UiFbCalc {
  op: UiFbCalcOp;
  args: UiFbCalcArg[];
  /** Round the result to this many decimal places. */
  decimals?: number;
}

// ── Elements ──────────────────────────────────────────────────────────────

export interface UiFbOption {
  id: string;
  /** Stored in the submitted data. Locked once a form has answers. */
  value: string;
  label: string;
  /** Hidden from new answers but still understood in old ones. */
  archived?: boolean;
}

export interface UiFbLayout {
  width?: UiFbWidth;
  labelPlacement?: UiFbLabelPlacement;
  errorPlacement?: UiFbErrorPlacement;
}

/** Type-specific settings. Only the ones relevant to a field's type are used. */
export interface UiFbFieldProps {
  min?: number;
  max?: number;
  step?: number;
  decimals?: number;
  currency?: string;
  prefix?: string;
  suffix?: string;
  rows?: number;
  maxRows?: number;
  maxRating?: number;
  orientation?: 'vertical' | 'horizontal';
  selectAll?: boolean;
  multiple?: boolean;
  accept?: string;
  autocomplete?: string;
  /** Text shown next to a single checkbox or toggle. */
  caption?: string;
  /** For calculated fields: how the result is shown. */
  format?: 'number' | 'currency' | 'text';
  /** For calculated fields: leave the result out of the submitted data. */
  excludeFromData?: boolean;
}

/** A param's value: fixed, or another question's answer (for lists that depend on each other). */
export type UiFbSourceParamValue = { const: unknown } | { ref: string };

export interface UiFbOptionSourceRef {
  /** The registered source's `type`. */
  type: string;
  params?: Record<string, UiFbSourceParamValue>;
}

export interface UiFbField {
  kind: 'field';
  id: string;
  type: UiFbFieldType;
  key: string;
  keyHistory?: string[];
  label: string;
  help?: string;
  placeholder?: string;
  defaultValue?: unknown;
  readOnly?: boolean;
  required?: UiFbToggle;
  requiredMessage?: string;
  disabled?: UiFbToggle;
  visibility?: UiFbVisibility;
  options?: UiFbOption[];
  /**
   * Dropdowns and multi-selects only: take the options from a list the app
   * registered (`provideUiFormOptionSources`) instead of `options`. Answers are
   * then saved as `{ value, label }` (a list of them for multi-selects).
   */
  source?: UiFbOptionSourceRef;
  props?: UiFbFieldProps;
  validators?: UiFbValidatorRule[];
  calc?: UiFbCalc;
  setValue?: UiFbSetValue[];
  layout?: UiFbLayout;
  archived?: boolean;
}

export interface UiFbRepeat {
  min?: number;
  max?: number;
  /** Label of the "add another" button. */
  addLabel?: string;
  /** Title of each entry; `{n}` is replaced by its number. */
  itemLabel?: string;
}

export interface UiFbGroup {
  kind: 'group';
  id: string;
  title?: string;
  description?: string;
  /** When set, the group's answers are nested under this key. Required for repeatable groups. */
  key?: string;
  keyHistory?: string[];
  columns?: 1 | 2 | 3;
  repeat?: UiFbRepeat;
  visibility?: UiFbVisibility;
  disabled?: UiFbToggle;
  layout?: Pick<UiFbLayout, 'width'>;
  elements: UiFbElement[];
  archived?: boolean;
}

export interface UiFbStatic {
  kind: 'static';
  id: string;
  type: UiFbStaticType;
  text?: string;
  visibility?: UiFbVisibility;
  layout?: Pick<UiFbLayout, 'width'>;
  archived?: boolean;
}

export type UiFbElement = UiFbField | UiFbGroup | UiFbStatic;

export interface UiFbJump {
  id: string;
  when: UiFbCondition;
  /** A later page's id, or `end` to go straight to submitting. */
  to: string;
}

export interface UiFbPage {
  id: string;
  title?: string;
  description?: string;
  visibility?: UiFbVisibility;
  /** Checked in order after this page; the first that holds decides where to go next. */
  jumps?: UiFbJump[];
  elements: UiFbElement[];
}

export interface UiFbSettings {
  labelPlacement?: UiFbLabelPlacement;
  errorPlacement?: UiFbErrorPlacement;
  /** `blur`: check a field when it is left, then live once it shows an error. `submit`: only on next/submit. */
  validateOn?: 'blur' | 'submit';
  /** What happens to the answer of a field that rules hide. */
  clearHidden?: 'onSubmit' | 'never';
  errorSummary?: boolean;
  requiredMarker?: 'asterisk' | 'optional' | 'none';
  submitLabel?: string;
  nextLabel?: string;
  backLabel?: string;
  showProgress?: boolean;
}

export interface UiFormDefinition {
  schemaVersion: number;
  id: string;
  title: string;
  description?: string;
  /** Bumped by the host each time it publishes; recorded on every submission. */
  revision?: number;
  settings?: UiFbSettings;
  pages: UiFbPage[];
}

// ── Answers ───────────────────────────────────────────────────────────────

/** What a file field stores. `url`/`id` come from the host's uploader. */
export interface UiFbFileValue {
  name: string;
  size: number;
  type: string;
  url?: string;
  id?: string;
}

/** Emitted when a form is submitted. `data` is the JSON to store. */
export interface UiFormSubmission {
  formId: string;
  revision: number | null;
  data: Record<string, unknown>;
  submittedAt: string;
  /** Files picked in this session that have no uploader URL yet, keyed by data path. */
  files: Record<string, File[]>;
}

/** One difference between the data a form was opened with and its current data. */
export interface UiFbChange {
  path: string;
  label: string;
  from: unknown;
  to: unknown;
}
