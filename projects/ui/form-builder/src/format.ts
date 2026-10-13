import { isEmptyValue } from './conditions';
import type { UiFbField, UiFbFileValue } from './schema';

/** An option's label for a stored value, or the value itself (marked) when the option is gone. */
export function optionLabel(field: UiFbField, value: unknown): string {
  const opt = field.options?.find((o) => o.value === String(value));
  return opt ? opt.label : `${String(value)} (no longer an option)`;
}

function formatNumber(n: number, field: UiFbField): string {
  const p = field.props ?? {};
  const money = field.type === 'currency' || p.format === 'currency';
  if (money) {
    try {
      return new Intl.NumberFormat(undefined, { style: 'currency', currency: p.currency || 'USD', minimumFractionDigits: p.decimals ?? 2, maximumFractionDigits: p.decimals ?? 2 }).format(n);
    } catch {
      return n.toFixed(p.decimals ?? 2);
    }
  }
  const text = new Intl.NumberFormat(undefined, { maximumFractionDigits: p.decimals ?? 10 }).format(n);
  return `${p.prefix ?? ''}${text}${p.suffix ? ` ${p.suffix}` : ''}`;
}

export function formatDate(iso: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso;
  const [y, m, d] = iso.split('-').map(Number);
  return new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(y, m - 1, d));
}

/** An answer as people read it: option labels, dates, money, Yes/No, file names. */
export function formatValue(field: UiFbField, value: unknown): string {
  if (isEmptyValue(value)) return '';
  switch (field.type) {
    case 'select':
    case 'radio':
      return optionLabel(field, value);
    case 'checkboxes':
    case 'multiselect':
      return (Array.isArray(value) ? value : [value]).map((v) => optionLabel(field, v)).join(', ');
    case 'checkbox':
    case 'toggle':
      return value === true ? 'Yes' : 'No';
    case 'date':
      return formatDate(String(value));
    case 'file':
      return (value as UiFbFileValue[]).map((f) => f.name).join(', ');
    case 'rating':
      return `${value} / ${field.props?.maxRating ?? 5}`;
  }
  if (typeof value === 'number') return formatNumber(value, field);
  if (Array.isArray(value)) return value.join(', ');
  return String(value);
}
