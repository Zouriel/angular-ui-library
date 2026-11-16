/**
 * The bridge from a submitted form to a workflow. The form builder knows nothing about workflows:
 * a form only emits a `UiFormSubmission`. Everything that decides where the answers go (which
 * workflow, which branch, who approves, which queue gets the task) is written in the workflow
 * definition and runs from the submitted payload. This file is the thin, typed hand-over:
 *
 *  - `wfSubmissionPayload` turns a submission into the plain JSON a workflow start receives;
 *  - `wfPickWorkflow` chooses the workflow for it (`workflowId`, `serviceCode`, then form id);
 *  - `wfStartFromSubmission` starts it on an engine through `UiWorkflowApi.startManual`;
 *  - `wfRouteSubmission` walks the definition on the client, with the library's own condition
 *    evaluation, and returns the route the answers take (no engine needed);
 *  - `wfSubmissionRegistry` describes the answers as a record type, so conditions can be authored
 *    against them in the workflow builder (`entity.<answer path>`).
 *
 * Conditions in a workflow read the answers as `entity.<path>`, `input.<path>` or `trigger.data.<path>`
 * (the three are the same value), plus `trigger.formId`, `trigger.revision`, `trigger.locale`,
 * `trigger.serviceCode`, `trigger.workflowId`, and `steps.<id>.outcome` of a decided approval or task.
 */
import {
  evaluateCondition,
  isEmptyValue,
  type UiFbCondition,
  type UiFbConditionContext,
  type UiFbFieldType,
  type UiFbSubmissionField,
  type UiFormSubmission,
} from '@zouriel/ui/form-builder';
import type { UiWfInstance, UiWorkflowApi } from './api';
import type {
  UiWfAssignee,
  UiWfCondition,
  UiWfEntityDescriptor,
  UiWfFieldDescriptor,
  UiWfFieldType,
  UiWfStep,
  UiWfStepList,
  UiWorkflowDefinition,
  UiWorkflowRegistry,
  UiWorkflowSchema,
} from './schema';
import { stepName, type UiWfToken } from './definition';

// ── Payload ───────────────────────────────────────────────────────────────

/** What a workflow start receives from a submitted form: plain JSON, no `File` objects. */
export interface UiWfSubmissionPayload {
  formId: string;
  revision: number | null;
  locale: string;
  submittedAt: string;
  workflowId?: string;
  serviceCode?: string;
  values: Record<string, unknown>;
  fields: UiFbSubmissionField[];
}

/** The submission as a workflow payload. Files are dropped (they need an upload address first). */
export function wfSubmissionPayload(s: UiFormSubmission): UiWfSubmissionPayload {
  const p: UiWfSubmissionPayload = {
    formId: s.formId,
    revision: s.revision ?? null,
    locale: s.locale,
    submittedAt: s.submittedAt,
    values: JSON.parse(JSON.stringify(s.values ?? {})) as Record<string, unknown>,
    fields: (s.fields ?? []).map((f) => ({ ...f })),
  };
  if (s.workflowId) p.workflowId = s.workflowId;
  if (s.serviceCode) p.serviceCode = s.serviceCode;
  return p;
}

// ── Picking the workflow ──────────────────────────────────────────────────

/** A workflow and what it takes in: the service codes and form ids it is the process for. */
export interface UiWfSubmissionBinding {
  workflow: UiWorkflowDefinition;
  serviceCodes?: string[];
  formIds?: string[];
}

/**
 * The workflow for a submission, or null. The first match wins, in this order: the submission's
 * `workflowId` (a definition `id` or `key`), its `serviceCode` (a binding's `serviceCodes`), then its
 * `formId` (a binding's `formIds`). A `workflowId` that matches nothing is not guessed around.
 */
export function wfPickWorkflow(bindings: readonly (UiWfSubmissionBinding | UiWorkflowDefinition)[], s: Pick<UiFormSubmission, 'workflowId' | 'serviceCode' | 'formId'>): UiWorkflowDefinition | null {
  const list = bindings.map((b): UiWfSubmissionBinding => ('workflow' in b ? b : { workflow: b }));
  if (s.workflowId) return list.find((b) => b.workflow.id === s.workflowId || b.workflow.key === s.workflowId)?.workflow ?? null;
  if (s.serviceCode) {
    const hit = list.find((b) => b.serviceCodes?.includes(s.serviceCode!));
    if (hit) return hit.workflow;
  }
  return list.find((b) => b.formIds?.includes(s.formId))?.workflow ?? null;
}

// ── Starting it on an engine ──────────────────────────────────────────────

/**
 * Starts the workflow on an engine with the submission's answers (`input.*` in the workflow).
 * Throws when the submission has files picked and no upload address (the engine takes JSON only).
 */
export function wfStartFromSubmission(api: Pick<UiWorkflowApi, 'startManual'>, workflow: UiWorkflowDefinition, s: UiFormSubmission): Promise<UiWfInstance> {
  if (Object.values(s.files ?? {}).some((f) => f.length)) {
    throw new Error('The files picked in this form can’t be sent: the form needs an upload address for them.');
  }
  return api.startManual(workflow.key, null, null, wfSubmissionPayload(s).values);
}

// ── Reading answers in conditions ─────────────────────────────────────────

/** The value at a path of the answers: `address.city`, `children[].age` (one value per row). */
export function wfAnswerAt(data: unknown, path: string): unknown {
  const parts = path.split('.').filter(Boolean);
  const read = (v: unknown, i: number): unknown => {
    if (i >= parts.length) return v;
    const p = parts[i];
    const rows = p.endsWith('[]');
    const key = rows ? p.slice(0, -2) : p;
    const next = v != null && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>)[key] : undefined;
    if (!rows) return read(next, i + 1);
    return Array.isArray(next) ? next.map((r) => read(r, i + 1)) : [];
  };
  return read(data, 0);
}

function conditionContext(payload: UiWfSubmissionPayload, outcomes: Record<string, string>, today: string): UiFbConditionContext {
  const value = (ref: string): unknown => {
    for (const prefix of ['entity.', 'input.', 'trigger.data.']) if (ref.startsWith(prefix)) return wfAnswerAt(payload.values, ref.slice(prefix.length));
    const meta: Record<string, unknown> = {
      'trigger.formId': payload.formId, 'trigger.revision': payload.revision, 'trigger.locale': payload.locale,
      'trigger.serviceCode': payload.serviceCode, 'trigger.workflowId': payload.workflowId, 'trigger.at': payload.submittedAt,
    };
    if (ref in meta) return meta[ref];
    const m = /^steps\.([^.]+)\.outcome$/.exec(ref);
    if (m) return outcomes[m[1]];
    return undefined;
  };
  return {
    value,
    visible: (ref) => !isEmptyValue(value(ref)),
    complete: (ref) => !isEmptyValue(value(ref)),
    rows: (ref) => { const v = value(ref); return Array.isArray(v) ? v.length : 0; },
    today: () => today,
  };
}

/**
 * Whether a workflow condition holds for a submission. This is the form builder's own condition
 * evaluation (a workflow condition is its JSON with token paths as `ref`), not a second language.
 */
export function wfConditionHolds(when: UiWfCondition | undefined, s: UiFormSubmission | UiWfSubmissionPayload, today = new Date().toISOString().slice(0, 10)): boolean {
  const payload = 'fields' in s && !('files' in s) ? (s as UiWfSubmissionPayload) : wfSubmissionPayload(s as UiFormSubmission);
  return evaluateCondition(when as UiFbCondition | undefined, conditionContext(payload, {}, today));
}

// ── The route ─────────────────────────────────────────────────────────────

/** A person or group a step hands work to, with a readable label. */
export interface UiWfRouteAssignee {
  assignee: UiWfAssignee;
  label: string;
}

/** One step the answers pass through, in the order they reach it. */
export interface UiWfRouteStep {
  stepId: string;
  type: UiWfStep['type'];
  title: string;
  /** Where it sits: the branch paths, outcomes and lists it is inside ("Over the limit" › "Approved"). */
  path: string[];
  assignees: UiWfRouteAssignee[];
  /** For a task: the group (queue) it lands in, when it is assigned to one. */
  queue: string | null;
  /** For a branch, switch, approval or task: what was taken or assumed. */
  taken?: string;
  /** For an approval or task: the outcome the walk followed (the `decisions` given, else approved / the first outcome). */
  outcome?: string;
}

export interface UiWfRoute {
  workflowId: string;
  workflowKey: string;
  title: string;
  steps: UiWfRouteStep[];
  approvals: UiWfRouteStep[];
  /** The groups tasks were queued to, in order, without repeats. */
  queues: string[];
  /** Every branch/switch decision: which path it took (null: nothing matched and there was no "otherwise"). */
  decisions: { stepId: string; title: string; taken: string | null }[];
  /** How the walk ended: an End step, or the end of the steps (`completed`). */
  result: 'completed' | 'failed';
  /** The reason of an End step that failed or completed with one. */
  reason?: string;
}

export interface UiWfRouteOptions {
  /** The outcome to follow at an approval or task, by step id. Default: `approved` / the first outcome. */
  decisions?: Record<string, string>;
  /** Labels for roles and groups (`registry.roles` / `registry.groups`), so routes read "Finance team" not `finance`. */
  registry?: Pick<UiWorkflowRegistry, 'roles' | 'groups'> | null;
  /** Today as `YYYY-MM-DD`, for conditions on dates. */
  today?: string;
}

function assigneeLabel(a: UiWfAssignee, reg: UiWfRouteOptions['registry']): string {
  if ('role' in a) return reg?.roles?.find((r) => r.key === a.role)?.label ?? a.role;
  if ('group' in a) return reg?.groups?.find((g) => g.key === a.group)?.label ?? a.group;
  if ('user' in a) return a.user;
  if ('field' in a) return `the person in ${a.field}`;
  if ('managerOf' in a) return `the manager of ${a.managerOf}`;
  return 'the person who submitted';
}

const TEXT_OF = (t: unknown): string => (typeof t === 'string' ? t : Array.isArray(t) ? t.map((p) => (typeof p === 'string' ? p : `{${p.ref}}`)).join('') : '');

/**
 * Walks the workflow's steps with the submission's answers, entirely on the client, and returns the
 * route: the branch paths taken, the steps passed, the approvals and the queues. Only the steps
 * reachable from the trigger are walked. A branch takes its first path whose condition holds, else
 * "otherwise". A switch compares its `on` value (with the answers' normal matching) to each case. Parallel
 * paths are all walked. Approvals follow `approved` and tasks their first outcome unless `decisions`
 * says otherwise; waits, loops and go-tos are listed but not entered. Conditions are the library's own.
 */
export function wfRouteSubmission(def: UiWorkflowDefinition, s: UiFormSubmission | UiWfSubmissionPayload, options: UiWfRouteOptions = {}): UiWfRoute {
  const payload = 'files' in s ? wfSubmissionPayload(s) : s;
  const outcomes: Record<string, string> = {};
  const ctx = conditionContext(payload, outcomes, options.today ?? new Date().toISOString().slice(0, 10));
  const steps: UiWfRouteStep[] = [];
  const decisions: UiWfRoute['decisions'] = [];
  let result: UiWfRoute['result'] = 'completed';
  let reason: string | undefined;
  let ended = false;

  const people = (list: UiWfAssignee[] | undefined): UiWfRouteAssignee[] => (list ?? []).map((a) => ({ assignee: a, label: assigneeLabel(a, options.registry) }));

  const walk = (list: readonly UiWfStep[] | undefined, path: string[]): void => {
    for (const step of list ?? []) {
      if (ended) return;
      if (step.disabled) continue;
      const row: UiWfRouteStep = { stepId: step.id, type: step.type, title: stepName(step), path, assignees: [], queue: null };
      switch (step.type) {
        case 'branch': {
          const hit = step.paths.find((p) => evaluateCondition(p.when as UiFbCondition | undefined, ctx));
          const taken = hit ? hit.label || 'If' : step.otherwise ? step.otherwise.label || 'Otherwise' : null;
          row.taken = taken ?? undefined;
          steps.push(row);
          decisions.push({ stepId: step.id, title: row.title, taken });
          if (hit) walk(hit.steps, [...path, taken!]);
          else if (step.otherwise) walk(step.otherwise.steps, [...path, taken!]);
          break;
        }
        case 'switch': {
          const on = ctx.value(step.on);
          const hit = step.cases.find((c) => c.values.some((v) => String(v).trim().toLowerCase() === String((on as { value?: unknown })?.value ?? on ?? '').trim().toLowerCase()));
          const taken = hit ? hit.label : step.otherwise ? step.otherwise.label || 'Otherwise' : null;
          row.taken = taken ?? undefined;
          steps.push(row);
          decisions.push({ stepId: step.id, title: row.title, taken });
          if (hit) walk(hit.steps, [...path, taken!]);
          else if (step.otherwise) walk(step.otherwise.steps, [...path, taken!]);
          break;
        }
        case 'parallel': {
          steps.push(row);
          for (const p of step.paths as UiWfStepList[]) walk(p.steps, [...path, p.label || 'Path']);
          break;
        }
        case 'approval': {
          row.assignees = people(step.assignees);
          const outcome = options.decisions?.[step.id] ?? 'approved';
          row.outcome = outcome;
          outcomes[step.id] = outcome;
          steps.push(row);
          const next = step.outcomes[outcome as keyof typeof step.outcomes];
          walk(next, [...path, outcome === 'approved' ? 'Approved' : outcome === 'rejected' ? 'Rejected' : 'Timed out']);
          break;
        }
        case 'task': {
          row.assignees = people(step.assignees);
          const group = step.assignees.find((a): a is { group: string } => 'group' in a);
          row.queue = group ? assigneeLabel(group, options.registry) : null;
          const chosen = step.outcomes.find((o) => o.key === options.decisions?.[step.id]) ?? step.outcomes[0];
          row.outcome = chosen?.key;
          if (chosen) outcomes[step.id] = chosen.key;
          steps.push(row);
          if (chosen) walk(chosen.steps, [...path, chosen.label]);
          break;
        }
        case 'end': {
          steps.push(row);
          result = step.result;
          reason = TEXT_OF(step.reason) || undefined;
          ended = true;
          break;
        }
        case 'notify': {
          row.assignees = people(step.to.filter((r): r is UiWfAssignee => !('email' in r)));
          steps.push(row);
          break;
        }
        default:
          steps.push(row);
      }
    }
  };
  walk(def.steps, []);

  const approvals = steps.filter((x) => x.type === 'approval');
  const queues = [...new Set(steps.map((x) => x.queue).filter((q): q is string => !!q))];
  const route: UiWfRoute = { workflowId: def.id, workflowKey: def.key, title: def.title, steps, approvals, queues, decisions, result };
  if (reason) route.reason = reason;
  return route;
}

// ── Authoring conditions against a form's answers ─────────────────────────

const TYPE_OF: Record<UiFbFieldType, UiWfFieldType> = {
  text: 'text', textarea: 'longText', email: 'email', phone: 'phone', url: 'url', number: 'number', currency: 'currency',
  date: 'date', time: 'text', select: 'text', radio: 'text', checkboxes: 'json', multiselect: 'json', checkbox: 'boolean',
  toggle: 'boolean', rating: 'number', slider: 'number', file: 'json', hidden: 'text', calculated: 'number',
};

/** The workflow field type of a form answer's type. */
export function wfFieldTypeOf(t: UiFbFieldType): UiWfFieldType {
  return TYPE_OF[t] ?? 'text';
}

/** The submission's fields as record fields, keyed by answer path (`address.city`). Files are left out. */
export function wfSubmissionFieldDescriptors(fields: readonly UiFbSubmissionField[]): UiWfFieldDescriptor[] {
  const seen = new Set<string>();
  const out: UiWfFieldDescriptor[] = [];
  for (const f of fields) {
    if (f.type === 'file' || seen.has(f.path)) continue;
    seen.add(f.path);
    out.push({ key: f.path, label: f.label || f.key, type: wfFieldTypeOf(f.type), readable: true });
  }
  return out;
}

/** The answers as a record type (`request` by default) for a workflow registry. */
export function wfSubmissionEntity(fields: readonly UiFbSubmissionField[], key = 'request', label = 'Request'): UiWfEntityDescriptor {
  return { key, label, pluralLabel: `${label}s`, fields: wfSubmissionFieldDescriptors(fields) };
}

/**
 * A schema for `ui-workflow-builder [schema]` that makes the form's answers pickable in conditions
 * (as `entity.<path>`), with the roles and groups the app has. Needs no engine.
 */
export function wfSubmissionRegistry(fields: readonly UiFbSubmissionField[], extra: Partial<Pick<UiWorkflowRegistry, 'roles' | 'groups' | 'channels'>> & { entity?: string; entityLabel?: string } = {}): UiWorkflowSchema {
  const { entity, entityLabel, ...lists } = extra;
  return {
    specVersion: 1,
    registry: { specVersion: 1, entities: [wfSubmissionEntity(fields, entity, entityLabel)], ...lists },
    steps: [],
  };
}

/** The same answers as condition tokens (`input.<path>` under "Form answers"), for pickers you build yourself. */
export function wfSubmissionTokens(fields: readonly UiFbSubmissionField[]): UiWfToken[] {
  return wfSubmissionFieldDescriptors(fields).map((f) => ({ path: `input.${f.key}`, label: f.label, group: 'Form answers', type: f.type }));
}
