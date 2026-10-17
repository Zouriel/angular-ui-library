import { Directive, computed, input } from '@angular/core';
import { UiWfApiError, injectWorkflowApi, injectWorkflowClock, type UiWfAuditEntry, type UiWfRecord, type UiWorkflowApi } from './api';

/**
 * Helpers shared by the runtime views (record panel, workflow panel, tasks, runs, audit). Internal:
 * not exported from the entry point.
 */

/** "3 hours ago" / "in 2 days" / "just now", counted from `now` (epoch ms). */
export function wfAgo(iso: string | null | undefined, now: number): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(+d)) return iso;
  const s = Math.round((now - d.getTime()) / 1000);
  const abs = Math.abs(s);
  const fmt = (n: number, u: string) => `${n} ${u}${n === 1 ? '' : 's'}`;
  if (abs < 60) return 'just now';
  const t = abs < 3600 ? fmt(Math.round(abs / 60), 'minute') : abs < 86400 ? fmt(Math.round(abs / 3600), 'hour') : fmt(Math.round(abs / 86400), 'day');
  return s >= 0 ? `${t} ago` : `in ${t}`;
}

/** A date and time in the viewer's locale ("17 Oct 2026, 13:05"). */
export function wfDateTime(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  return isNaN(+d) ? iso : d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

/** The message to show for a failed call: the engine's message and its details, else `fallback`. */
export function wfErrorText(e: unknown, fallback: string): string {
  if (e instanceof UiWfApiError) {
    const details = Array.isArray(e.details) ? (e.details as { message?: string }[]).map((d) => d.message).filter(Boolean) : [];
    return details.length ? `${e.message} ${details.join(' ')}` : e.message;
  }
  return fallback;
}

/** Parses an audit entry's JSON field; a broken one reads as empty rather than throwing. */
export function wfAuditJson(text: string | null): Record<string, unknown> {
  if (!text) return {};
  try {
    const v = JSON.parse(text) as unknown;
    return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

/** How a record history entry reads ("Submit: Draft → Submitted"). `stateLabel` turns state keys into labels. */
export function wfDescribeHistory(h: UiWfAuditEntry, stateLabel: (key: unknown) => string): string {
  const data = wfAuditJson(h.data);
  const before = wfAuditJson(h.before);
  const after = wfAuditJson(h.after);
  const text = (v: unknown) => (v === null || v === undefined ? '' : String(v));
  switch (`${h.category}.${h.action}`) {
    case 'lifecycle.created': return `Started in ${stateLabel(after['state'])}`;
    case 'lifecycle.transitioned': return `${text(data['label'] ?? data['transition']) || 'Moved'}: ${stateLabel(before['state'])} → ${stateLabel(after['state'])}`;
    case 'lifecycle.autoTransitioned': return `Moved automatically: ${stateLabel(before['state'])} → ${stateLabel(after['state'])}`;
    case 'lifecycle.autoSkipped': return 'An automatic move was skipped';
    case 'lifecycle.forced': return `Moved by an admin to ${stateLabel(after['state'])}${data['reason'] ? `: ${text(data['reason'])}` : ''}`;
    case 'lifecycle.writeRefused': return 'A direct change to the state was refused';
    case 'lifecycle.slaBreached': return `Stayed too long in ${stateLabel(data['state'] ?? before['state'] ?? after['state'])}`;
    case 'lifecycle.outOfSync': return 'The state was changed outside the workflow';
    case 'task.created': return `Waiting for: ${text(data['title'])}`;
    case 'task.decided': return `${text(data['outcomeLabel'] ?? data['outcome']) || 'Decided'}${data['comment'] ? ` (“${text(data['comment'])}”)` : ''}`;
    case 'task.timedOut': return `Ran out of time: ${text(data['title'])}`;
    case 'task.delegated': return 'A task was handed to someone else';
    case 'task.reassigned': return 'A task was reassigned';
    case 'task.escalated': return 'A task was escalated';
    case 'instance.started': return `Started: ${text(data['title'] ?? data['definitionKey']) || 'a workflow'}`;
    case 'instance.completed': return 'A workflow finished';
    case 'instance.failed': return 'A workflow failed';
    case 'instance.cancelled': return 'A workflow was cancelled';
    case 'instance.incident': return 'A workflow stopped on an error';
    case 'instance.timerFailed': return 'A timer could not run';
    case 'trigger.failed': return 'A workflow could not start';
    default: return `${h.category} ${h.action}`.replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase();
  }
}

/** Whether state `key` comes before the record's current state in the lifecycle's order. */
export function wfStatePassed(r: UiWfRecord, key: string): boolean {
  const i = r.states.findIndex((s) => s.key === key);
  const here = r.states.findIndex((s) => s.key === r.state);
  return i >= 0 && here >= 0 && i < here;
}

/** Common base: the API from the input or `provideUiWorkflow`, and the clock times count from. */
@Directive()
export abstract class WfWithApi {
  readonly api = input<UiWorkflowApi | null>(null);
  private readonly provided = injectWorkflowApi();
  protected readonly client = computed(() => this.api() ?? this.provided);
  protected readonly clock = injectWorkflowClock();
  protected readonly ago = (iso: string | null | undefined) => wfAgo(iso, this.clock());
  protected readonly when = (iso: string | null | undefined) => (iso ? `${wfDateTime(iso)} (${wfAgo(iso, this.clock())})` : '');
}
