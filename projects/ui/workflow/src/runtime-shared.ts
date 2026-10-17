import { Directive, computed, input } from '@angular/core';
import { UiWfApiError, injectWorkflowApi, injectWorkflowClock, type UiWfAuditEntry, type UiWfRecord, type UiWfTask, type UiWorkflowApi } from './api';

/**
 * Helpers shared by the runtime views (workflow panel, tasks, runs, audit). Internal:
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

/** "someKey" → "Some key": the last resort for a key nobody gave a label. */
export function wfHumanize(key: string): string {
  const words = key.replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/[_.-]+/g, ' ').trim().toLowerCase();
  return words ? words[0].toUpperCase() + words.slice(1) : key;
}

/** A decision's outcome as people read it: the task's own label when known, else a sensible default. */
export function wfOutcomeLabel(key: unknown, outcomes?: readonly { key: string; label: string }[] | null): string {
  const k = key === null || key === undefined ? '' : String(key);
  const own = outcomes?.find((o) => o.key === k)?.label;
  if (own) return own;
  return ({ approved: 'Approved', rejected: 'Rejected', timedOut: 'Out of time', cancelled: 'Cancelled', completed: 'Done' } as Record<string, string>)[k] ?? (k ? wfHumanize(k) : 'Done');
}

/** How a finished task ended ("Approved", "Out of time", "Cancelled"). */
export function wfTaskResult(t: Pick<UiWfTask, 'status' | 'outcome' | 'outcomes'>): string {
  if (t.status === 'timedOut') return 'Out of time';
  if (t.status === 'cancelled') return 'Cancelled';
  return wfOutcomeLabel(t.outcome, t.outcomes);
}

/** A run's status as people read it; the run view, the runs list and the workflow panel all use it. */
export function wfRunStatusLabel(s: string | null | undefined): string {
  if (!s) return '';
  return ({ queued: 'Queued', running: 'Running', waiting: 'Waiting', incident: 'Stopped', completed: 'Finished', failed: 'Failed', cancelled: 'Cancelled', active: 'Active', outOfSync: 'Out of sync' } as Record<string, string>)[s] ?? wfHumanize(s);
}

/** The tone a run status is shown in. */
export function wfRunStatusTone(s: string | null | undefined): string {
  return s === 'completed' ? 'success' : s === 'incident' || s === 'failed' ? 'danger' : s === 'cancelled' || s === 'outOfSync' ? 'warning' : 'info';
}

/** The audit log's categories, in the order filters list them. */
export const WF_AUDIT_CATEGORIES: readonly { value: string; label: string }[] = [
  { value: 'lifecycle', label: 'Record moves' }, { value: 'task', label: 'Tasks and decisions' }, { value: 'instance', label: 'Runs' },
  { value: 'step', label: 'Steps' }, { value: 'trigger', label: 'Triggers' }, { value: 'definition', label: 'Workflow changes' },
  { value: 'settings', label: 'Settings' }, { value: 'audit', label: 'The audit log itself' },
];

/** An audit category's label ("lifecycle" → "Record moves"). */
export function wfAuditCategoryLabel(category: string): string {
  return WF_AUDIT_CATEGORIES.find((c) => c.value === category)?.label ?? wfHumanize(category);
}

const AUDIT_ACTIONS: Record<string, string> = {
  'definition.created': 'Workflow created', 'definition.draftSaved': 'Draft saved', 'definition.published': 'Published',
  'definition.archived': 'Archived', 'definition.restored': 'Restored', 'definition.rolledBack': 'Rolled back to an earlier version',
  'definition.deleted': 'Workflow deleted',
  'instance.started': 'Run started', 'instance.queued': 'Run queued', 'instance.completed': 'Run finished', 'instance.failed': 'Run failed',
  'instance.cancelled': 'Run cancelled', 'instance.migrated': 'Run moved to another version', 'instance.retried': 'Stopped step tried again',
  'instance.skipped': 'Stopped step skipped', 'instance.incident': 'Run stopped on an error', 'instance.timerFailed': 'A timer could not run',
  'step.started': 'Step started', 'step.completed': 'Step done', 'step.failed': 'Step failed', 'step.retryScheduled': 'Retry scheduled',
  'step.skipped': 'Step skipped', 'step.branchTaken': 'Path chosen', 'step.waiting': 'Step waiting',
  'lifecycle.created': 'Lifecycle started', 'lifecycle.transitioned': 'Record moved', 'lifecycle.autoTransitioned': 'Moved automatically',
  'lifecycle.autoSkipped': 'Automatic move skipped', 'lifecycle.slaBreached': 'Stayed too long in a state', 'lifecycle.forced': 'Moved by an admin', 'lifecycle.reset': 'Workflow started over',
  'lifecycle.writeRefused': 'Direct state change refused', 'lifecycle.writeObserved': 'Direct state change seen', 'lifecycle.outOfSync': 'State out of sync',
  'task.created': 'Task created', 'task.assigned': 'Task assigned', 'task.reminded': 'Reminder sent', 'task.escalated': 'Task escalated',
  'task.delegated': 'Task handed to someone else', 'task.reassigned': 'Task reassigned', 'task.decided': 'Decided', 'task.cancelled': 'Task cancelled',
  'task.timedOut': 'Task ran out of time',
  'trigger.suppressed': 'Start held back', 'trigger.skipped': 'Start skipped', 'trigger.paused': 'Starts paused', 'trigger.resumed': 'Starts resumed',
  'trigger.failed': 'A workflow could not start',
  'settings.updated': 'Settings changed',
  'audit.exported': 'Audit log exported', 'audit.purged': 'Old entries removed',
};

/** An audit action's label ("lifecycle", "slaBreached" → "Stayed too long in a state"). */
export function wfAuditActionLabel(category: string, action: string): string {
  return AUDIT_ACTIONS[`${category}.${action}`] ?? wfHumanize(action);
}

/** How a record history entry reads ("Submit: Draft → Submitted"). `stateLabel` turns state keys into labels. */
export function wfDescribeHistory(h: UiWfAuditEntry, stateLabel: (key: unknown) => string): string {
  const data = wfAuditJson(h.data);
  const before = wfAuditJson(h.before);
  const after = wfAuditJson(h.after);
  const text = (v: unknown) => (v === null || v === undefined ? '' : String(v));
  switch (`${h.category}.${h.action}`) {
    case 'lifecycle.created': return `Started in ${stateLabel(after['state'])}`;
    case 'lifecycle.transitioned': {
      const remark = text(data['comment']);
      return `${text(data['label'] ?? data['transition']) || 'Moved'}: ${stateLabel(before['state'])} → ${stateLabel(after['state'])}${remark ? ` (“${remark}”)` : ''}`;
    }
    case 'lifecycle.autoTransitioned': return `Moved automatically: ${stateLabel(before['state'])} → ${stateLabel(after['state'])}`;
    case 'lifecycle.autoSkipped': return 'An automatic move was skipped';
    case 'lifecycle.reset': {
      const input = data['input'] && typeof data['input'] === 'object' ? (data['input'] as Record<string, unknown>) : {};
      // The person's remarks, else the reset form's reason.
      const why = text(data['comment']) || text(input['reason'] ?? Object.values(input).find((v) => typeof v === 'string'));
      const undone = Array.isArray(data['undone']) ? data['undone'].length : 0;
      const took = undone ? `, took back ${undone} thing${undone === 1 ? '' : 's'} the workflow did` : '';
      return `${text(data['label']) || 'Reset'}: ${stateLabel(before['state'])} → ${stateLabel(after['state'])}${why ? ` (“${why}”)` : ''}${took}`;
    }
    case 'lifecycle.forced': return `Moved by an admin to ${stateLabel(after['state'])}${data['reason'] ? `: ${text(data['reason'])}` : ''}`;
    case 'lifecycle.writeRefused': return 'A direct change to the state was refused';
    case 'lifecycle.slaBreached': return `Stayed too long in ${stateLabel(data['state'] ?? before['state'] ?? after['state'])}`;
    case 'lifecycle.outOfSync': return 'The state was changed outside the workflow';
    case 'task.created': return `Waiting for: ${text(data['title'])}`;
    case 'task.decided': return `Decided: ${text(data['outcomeLabel']) || wfOutcomeLabel(data['outcome'])}${data['comment'] ? ` (“${text(data['comment'])}”)` : ''}`;
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
    case 'trigger.failed': return `A workflow could not start${data['error'] ? `: ${text(data['error'])}` : ''}`;
    default: return wfAuditActionLabel(h.category, h.action);
  }
}

/**
 * Who did something, as people read it: a person's name; for a workflow, "Workflow: <title>" (the
 * actor id is the workflow's key, looked up with `workflowTitle`); "System" for the engine itself.
 */
export function wfActorLabel(e: Pick<UiWfAuditEntry, 'actorType' | 'actorId' | 'actorName'>, workflowTitle?: (key: string) => string | undefined): string {
  if (e.actorType === 'workflow') {
    const key = e.actorId ?? '';
    // The title when it is known: the engine may store the key as the actor's name.
    return `Workflow: ${workflowTitle?.(key) || e.actorName || (key ? wfHumanize(key) : 'unknown')}`;
  }
  if (e.actorName) return e.actorName;
  if (e.actorType === 'system') return 'System';
  return e.actorId ?? wfHumanize(e.actorType);
}

/**
 * Whether deciding [outcome] needs remarks (spec §7): always, or for a negative outcome when the step
 * asks for them on rejecting (an approval's "rejected", a task's red outcomes).
 */
export function wfCommentRequired(t: Pick<UiWfTask, 'requireComment' | 'kind' | 'outcomes'>, outcome: string): boolean {
  if (t.requireComment === 'always') return true;
  if (t.requireComment !== 'reject') return false;
  return outcome === 'rejected' || t.outcomes.some((o) => o.key === outcome && o.tone === 'danger');
}

/** How the remarks box is labelled: what it is required for, else optional. */
export function wfRemarksLabel(t: Pick<UiWfTask, 'requireComment' | 'kind' | 'outcomes'>): string {
  if (t.requireComment === 'always') return 'Remarks (required)';
  if (t.requireComment === 'reject') {
    const negative = t.outcomes.filter((o) => wfCommentRequired(t, o.key)).map((o) => o.label);
    if (negative.length) return `Remarks (required to ${negative.length === 1 && negative[0] ? negative[0].toLowerCase() : 'choose ' + negative.join(' or ')})`;
  }
  return 'Remarks (optional)';
}

/**
 * A run's error as people read it: without the engine's exception-type prefix ("InvalidOperationException:
 * Bank API: 503" reads "Bank API: 503"). The step's own detail keeps the full text for whoever debugs it.
 */
export function wfReadableError(error: string | null | undefined): string {
  return (error ?? '').replace(/^[A-Z]\w*Exception:\s*/, '');
}

/** Whether a finished step ended by running out of time (an approval or task, or a wait, that timed out). */
export function wfStepTimedOut(output: unknown): boolean {
  if (!output || typeof output !== 'object') return false;
  const o = output as Record<string, unknown>;
  return o['outcome'] === 'timedOut' || o['timedOut'] === true;
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
