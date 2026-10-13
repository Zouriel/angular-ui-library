import type { UiFbFieldProps, UiFbFieldType, UiFbOperator, UiFbStaticType } from './schema';

/** The shape of a field's answer — drives which operators and validators make sense. */
export type UiFbValueKind = 'text' | 'number' | 'date' | 'time' | 'choice' | 'multi' | 'boolean' | 'file';

export type UiFbPaletteCategory = 'Text' | 'Choice' | 'Number & date' | 'Other' | 'Layout';

export interface UiFbFieldTypeInfo {
  type: UiFbFieldType;
  label: string;
  description: string;
  category: UiFbPaletteCategory;
  valueKind: UiFbValueKind;
  /** Has a list of options to choose from. */
  hasOptions?: boolean;
  /** Shows a placeholder when empty. */
  placeholder?: boolean;
  /** A single text box, so the label and error can sit inside it. */
  textLike?: boolean;
  /** Has no input for people to fill in. */
  noInput?: boolean;
  defaultLabel: string;
  defaultProps?: UiFbFieldProps;
}

export const UI_FB_FIELD_TYPES: readonly UiFbFieldTypeInfo[] = [
  { type: 'text', label: 'Short text', description: 'One line of text, like a name', category: 'Text', valueKind: 'text', placeholder: true, textLike: true, defaultLabel: 'Short answer' },
  { type: 'textarea', label: 'Long text', description: 'Several lines, like a comment', category: 'Text', valueKind: 'text', placeholder: true, textLike: true, defaultLabel: 'Long answer', defaultProps: { rows: 3, maxRows: 8 } },
  { type: 'email', label: 'Email', description: 'An email address, checked automatically', category: 'Text', valueKind: 'text', placeholder: true, textLike: true, defaultLabel: 'Email address', defaultProps: { autocomplete: 'email' } },
  { type: 'phone', label: 'Phone', description: 'A phone number', category: 'Text', valueKind: 'text', placeholder: true, textLike: true, defaultLabel: 'Phone number', defaultProps: { autocomplete: 'tel' } },
  { type: 'url', label: 'Website', description: 'A web address', category: 'Text', valueKind: 'text', placeholder: true, textLike: true, defaultLabel: 'Website' },
  { type: 'select', label: 'Dropdown', description: 'Pick one option from a list', category: 'Choice', valueKind: 'choice', hasOptions: true, placeholder: true, defaultLabel: 'Choose one' },
  { type: 'radio', label: 'Single choice', description: 'Pick one, all options visible', category: 'Choice', valueKind: 'choice', hasOptions: true, defaultLabel: 'Pick one', defaultProps: { orientation: 'vertical' } },
  { type: 'checkboxes', label: 'Multiple choice', description: 'Tick any number of options', category: 'Choice', valueKind: 'multi', hasOptions: true, defaultLabel: 'Pick all that apply', defaultProps: { orientation: 'vertical' } },
  { type: 'multiselect', label: 'Multi-select', description: 'Pick several from a long list', category: 'Choice', valueKind: 'multi', hasOptions: true, placeholder: true, defaultLabel: 'Choose several' },
  { type: 'checkbox', label: 'Checkbox', description: 'A single tick, like agreeing to terms', category: 'Choice', valueKind: 'boolean', defaultLabel: 'Agreement', defaultProps: { caption: 'I agree' } },
  { type: 'toggle', label: 'Yes / no', description: 'An on/off switch', category: 'Choice', valueKind: 'boolean', defaultLabel: 'Yes or no', defaultProps: { caption: 'Yes' } },
  { type: 'number', label: 'Number', description: 'A whole or decimal number', category: 'Number & date', valueKind: 'number', placeholder: true, textLike: true, defaultLabel: 'Number' },
  { type: 'currency', label: 'Amount', description: 'A money amount', category: 'Number & date', valueKind: 'number', placeholder: true, textLike: true, defaultLabel: 'Amount', defaultProps: { decimals: 2, currency: 'USD', min: 0 } },
  { type: 'date', label: 'Date', description: 'A day from a calendar', category: 'Number & date', valueKind: 'date', placeholder: true, defaultLabel: 'Date' },
  { type: 'time', label: 'Time', description: 'A time of day', category: 'Number & date', valueKind: 'time', defaultLabel: 'Time' },
  { type: 'rating', label: 'Rating', description: 'Stars from 1 to 5', category: 'Number & date', valueKind: 'number', defaultLabel: 'Rating', defaultProps: { maxRating: 5 } },
  { type: 'slider', label: 'Slider', description: 'A number picked on a scale', category: 'Number & date', valueKind: 'number', defaultLabel: 'Scale', defaultProps: { min: 0, max: 10, step: 1 } },
  { type: 'file', label: 'File upload', description: 'Attach one or more files', category: 'Other', valueKind: 'file', defaultLabel: 'Attachment' },
  { type: 'calculated', label: 'Calculated', description: 'Worked out from other answers', category: 'Other', valueKind: 'number', noInput: true, defaultLabel: 'Total', defaultProps: { format: 'number' } },
  { type: 'hidden', label: 'Hidden value', description: 'Stored with the answers, never shown', category: 'Other', valueKind: 'text', noInput: true, defaultLabel: 'Hidden value' },
];

export interface UiFbStaticTypeInfo {
  type: UiFbStaticType;
  label: string;
  description: string;
}

export const UI_FB_STATIC_TYPES: readonly UiFbStaticTypeInfo[] = [
  { type: 'heading', label: 'Heading', description: 'A title between questions' },
  { type: 'paragraph', label: 'Text block', description: 'Instructions or an explanation' },
  { type: 'divider', label: 'Divider', description: 'A line between sections' },
];

const BY_TYPE = new Map(UI_FB_FIELD_TYPES.map((t) => [t.type, t]));

export function fieldTypeInfo(type: UiFbFieldType): UiFbFieldTypeInfo {
  return BY_TYPE.get(type) ?? UI_FB_FIELD_TYPES[0];
}

/**
 * The value kind a field's answer has. A calculated field that joins text is
 * text; every other calculation is a number.
 */
export function valueKindOf(type: UiFbFieldType, format?: UiFbFieldProps['format']): UiFbValueKind {
  if (type === 'calculated') return format === 'text' ? 'text' : 'number';
  return fieldTypeInfo(type).valueKind;
}

export interface UiFbOperatorInfo {
  op: UiFbOperator;
  /** Reads after the field name: "Age *is more than* 18". */
  label: string;
  /** How many values it compares against. */
  arity: 0 | 1 | 2;
  /** The operand is a list of options rather than one. */
  multiValue?: boolean;
  /** The operand is a count rather than the field's own kind of value. */
  countValue?: boolean;
}

const OP: Record<UiFbOperator, UiFbOperatorInfo> = {
  empty: { op: 'empty', label: 'is empty', arity: 0 },
  notEmpty: { op: 'notEmpty', label: 'is filled in', arity: 0 },
  eq: { op: 'eq', label: 'is', arity: 1 },
  neq: { op: 'neq', label: 'is not', arity: 1 },
  contains: { op: 'contains', label: 'contains', arity: 1 },
  notContains: { op: 'notContains', label: 'does not contain', arity: 1 },
  startsWith: { op: 'startsWith', label: 'starts with', arity: 1 },
  endsWith: { op: 'endsWith', label: 'ends with', arity: 1 },
  gt: { op: 'gt', label: 'is more than', arity: 1 },
  gte: { op: 'gte', label: 'is at least', arity: 1 },
  lt: { op: 'lt', label: 'is less than', arity: 1 },
  lte: { op: 'lte', label: 'is at most', arity: 1 },
  between: { op: 'between', label: 'is between', arity: 2 },
  before: { op: 'before', label: 'is before', arity: 1 },
  after: { op: 'after', label: 'is after', arity: 1 },
  onOrBefore: { op: 'onOrBefore', label: 'is on or before', arity: 1 },
  onOrAfter: { op: 'onOrAfter', label: 'is on or after', arity: 1 },
  anyOf: { op: 'anyOf', label: 'is any of', arity: 1, multiValue: true },
  noneOf: { op: 'noneOf', label: 'is none of', arity: 1, multiValue: true },
  includes: { op: 'includes', label: 'includes', arity: 1 },
  excludes: { op: 'excludes', label: 'does not include', arity: 1 },
  includesAny: { op: 'includesAny', label: 'includes any of', arity: 1, multiValue: true },
  includesAll: { op: 'includesAll', label: 'includes all of', arity: 1, multiValue: true },
  countGte: { op: 'countGte', label: 'has at least … ticked', arity: 1, countValue: true },
  countLte: { op: 'countLte', label: 'has at most … ticked', arity: 1, countValue: true },
  isTrue: { op: 'isTrue', label: 'is ticked', arity: 0 },
  isFalse: { op: 'isFalse', label: 'is not ticked', arity: 0 },
  visible: { op: 'visible', label: 'is shown', arity: 0 },
  hidden: { op: 'hidden', label: 'is hidden', arity: 0 },
  complete: { op: 'complete', label: 'is complete', arity: 0 },
  incomplete: { op: 'incomplete', label: 'is not complete', arity: 0 },
  rowsGte: { op: 'rowsGte', label: 'has at least … entries', arity: 1, countValue: true },
  rowsLte: { op: 'rowsLte', label: 'has at most … entries', arity: 1, countValue: true },
};

export function operatorInfo(op: UiFbOperator): UiFbOperatorInfo {
  return OP[op];
}

const OPS_BY_KIND: Record<UiFbValueKind | 'group' | 'repeat' | 'page', UiFbOperator[]> = {
  text: ['eq', 'neq', 'contains', 'notContains', 'startsWith', 'endsWith', 'notEmpty', 'empty'],
  number: ['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'between', 'notEmpty', 'empty'],
  date: ['eq', 'before', 'after', 'onOrBefore', 'onOrAfter', 'between', 'notEmpty', 'empty'],
  time: ['eq', 'before', 'after', 'between', 'notEmpty', 'empty'],
  choice: ['eq', 'neq', 'anyOf', 'noneOf', 'notEmpty', 'empty'],
  multi: ['includes', 'excludes', 'includesAny', 'includesAll', 'countGte', 'countLte', 'notEmpty', 'empty'],
  boolean: ['isTrue', 'isFalse'],
  file: ['notEmpty', 'empty', 'countGte', 'countLte'],
  group: ['complete', 'incomplete', 'visible', 'hidden'],
  repeat: ['rowsGte', 'rowsLte', 'complete', 'incomplete', 'visible', 'hidden'],
  page: ['complete', 'incomplete', 'visible', 'hidden'],
};

/** Operators offered for a value kind (or for a group / repeatable group / page). */
export function operatorsFor(kind: UiFbValueKind | 'group' | 'repeat' | 'page'): UiFbOperatorInfo[] {
  return OPS_BY_KIND[kind].map((op) => OP[op]);
}

/** Field types whose answers can safely change into each other's without losing meaning. */
const COMPATIBLE: UiFbFieldType[][] = [
  ['text', 'textarea', 'email', 'phone', 'url', 'hidden'],
  ['select', 'radio'],
  ['checkboxes', 'multiselect'],
  ['checkbox', 'toggle'],
  ['number', 'currency', 'slider', 'rating'],
];

export function typesCompatible(a: UiFbFieldType, b: UiFbFieldType): boolean {
  return a === b || COMPATIBLE.some((set) => set.includes(a) && set.includes(b));
}
