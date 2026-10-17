import { InjectionToken, inject, type Provider } from '@angular/core';
import type { UiFormDefinition } from '@zouriel/ui/form-builder';
import type { UiWorkflowDefinition, UiWorkflowSchema, UiWorkflowSettings } from './schema';

// Shapes returned by the workflow REST API (spec api/openapi.yaml). Engines in every language
// return these; the components below only talk to an engine through `UiWorkflowApi`.

export interface UiWfProblem {
  code: string;
  severity: 'error' | 'warning';
  /** The step, state or transition the problem is on. */
  node: string | null;
  message: string;
}

export interface UiWfDefinitionSummary {
  id: string;
  key: string;
  kind: 'automation' | 'lifecycle';
  title: string;
  entity: string | null;
  status: 'draft' | 'published' | 'archived';
  version: number;
  hasDraftChanges: boolean;
  updatedAt: string;
  updatedBy: string | null;
  runningInstances: number;
}

export interface UiWfVersionInfo {
  version: number;
  note: string | null;
  publishedAt: string;
  publishedBy: string | null;
  instances: number;
}

export interface UiWfDefinitionDetail {
  summary: UiWfDefinitionSummary;
  draft: UiWorkflowDefinition;
  published: UiWorkflowDefinition | null;
  versions: UiWfVersionInfo[];
  problems: UiWfProblem[];
}

export interface UiWfStepRun {
  id: string;
  nodeId: string;
  type: string;
  title: string | null;
  attempt: number;
  status: 'running' | 'waiting' | 'completed' | 'failed' | 'skipped' | 'cancelled';
  input: unknown;
  output: unknown;
  error: string | null;
  startedAt: string;
  endedAt: string | null;
}

export interface UiWfDecision {
  userId: string;
  name: string | null;
  outcome: string;
  comment: string | null;
  data: Record<string, unknown> | null;
  at: string;
}

export interface UiWfTask {
  id: string;
  instanceId: string;
  kind: 'approval' | 'task';
  title: string;
  instructions: string | null;
  definitionKey: string;
  entity: string | null;
  entityId: string | null;
  entityTitle: string | null;
  status: 'open' | 'completed' | 'cancelled' | 'timedOut';
  assignees: string[];
  assigneeNames: string[];
  rule: { type: string; value?: number | null } | null;
  outcomes: { key: string; label: string; tone?: string | null }[];
  decisions: UiWfDecision[];
  form: UiFormDefinition | null;
  requireComment: 'never' | 'reject' | 'always' | null;
  allowDelegation: boolean;
  outcome: string | null;
  dueAt: string;
  overdue: boolean;
  escalationLevel: number;
  createdAt: string;
  completedAt: string | null;
  canDecide: boolean;
}

export type UiWfInstanceStatus = 'queued' | 'running' | 'waiting' | 'incident' | 'completed' | 'failed' | 'cancelled' | 'active' | 'outOfSync';

export interface UiWfInstance {
  id: string;
  definitionId: string;
  definitionKey: string;
  title: string;
  version: number;
  kind: 'automation' | 'record' | 'run';
  parentId: string | null;
  reason: string | null;
  entity: string | null;
  entityId: string | null;
  entityTitle: string | null;
  status: UiWfInstanceStatus;
  state: string | null;
  stateLabel: string | null;
  error: string | null;
  errorStepId: string | null;
  initiatorId: string | null;
  initiatorName: string | null;
  startedAt: string;
  updatedAt: string;
  endedAt: string | null;
  trigger: Record<string, unknown> | null;
  steps: UiWfStepRun[] | null;
  tokens: { id: string; status: string; waiting: string | null; stepId: string | null }[] | null;
  outputs: Record<string, Record<string, unknown>> | null;
  variables: Record<string, unknown> | null;
  tasks: UiWfTask[] | null;
}

export interface UiWfTransitionOption {
  key: string;
  label: string;
  to: string;
  toLabel: string;
  tone: string | null;
  confirm: string | null;
  form: UiFormDefinition | null;
}

export interface UiWfRecord {
  entity: string;
  id: string;
  title: string | null;
  lifecycle: string | null;
  lifecycleTitle: string | null;
  state: string | null;
  stateLabel: string | null;
  stateTone: string | null;
  status: UiWfInstanceStatus | null;
  stateEnteredAt: string | null;
  transitions: UiWfTransitionOption[];
  tasks: UiWfTask[];
  instances: UiWfInstance[];
  manual: { key: string; label: string; form: UiFormDefinition | null }[];
  states: { key: string; label: string; category: string; tone: string | null }[];
  /** Starting the workflow over, when this person may and it would change something (else null). */
  reset?: { label: string; to: string; toLabel: string; confirm: string | null; form: UiFormDefinition | null } | null;
}

export interface UiWfAuditEntry {
  seq: number;
  id: string;
  at: string;
  tenant: string | null;
  actorType: 'user' | 'system' | 'workflow' | string;
  actorId: string | null;
  actorName: string | null;
  category: string;
  action: string;
  subjectType: string;
  subjectId: string;
  entity: string | null;
  entityId: string | null;
  instanceId: string | null;
  definitionId: string | null;
  /** JSON text. */
  before: string | null;
  after: string | null;
  data: string | null;
  correlationId: string;
  causationId: string | null;
  prevHash: string;
  hash: string;
}

export interface UiWfAuditVerification {
  valid: boolean;
  checked: number;
  brokenAtSeq: number | null;
  problem: string | null;
  purgedGaps: { from: number; to: number }[];
}

export interface UiWfPage<T> {
  items: T[];
  total: number;
}

export interface UiWfUser {
  id: string;
  name: string;
  email?: string | null;
  roles?: string[] | null;
  groups?: string[] | null;
}

/** The signed-in person, as the engine sees them, and what they may do (`GET /me`). */
export interface UiWfMe {
  type: string;
  id: string | null;
  name: string | null;
  roles: string[];
  can: { edit: boolean; publish: boolean; settings: boolean; intervene: boolean; audit: boolean };
}

export interface UiWfTriggerOverview {
  definitionId: string;
  definitionKey: string;
  title: string;
  kind: 'automation' | 'lifecycle';
  type: string;
  entity: string | null;
  field: string | null;
  summary: string;
  version: number;
}

export interface UiWfSimulationEvent {
  type: 'decide' | 'advance' | 'signal' | 'set';
  step?: string;
  outcome?: string;
  comment?: string;
  data?: Record<string, unknown>;
  user?: string;
  duration?: string;
  signal?: string;
  values?: Record<string, unknown>;
}

export interface UiWfSimulationRequest {
  entityId?: string;
  values?: Record<string, unknown>;
  trigger?: Record<string, unknown>;
  fromState?: string;
  transition?: string;
  input?: Record<string, unknown>;
  events?: UiWfSimulationEvent[];
}

export interface UiWfSimulationResult {
  problems: UiWfProblem[];
  log: { kind: string; action: string; subject: string | null; text: string | null; data: unknown; at: string }[];
  instances: UiWfInstance[];
  openTasks: UiWfTask[];
  record: Record<string, unknown> | null;
  error: string | null;
}

export interface UiWfInstanceQuery {
  definitionId?: string;
  definitionKey?: string;
  entity?: string;
  entityId?: string;
  status?: string[];
  kind?: string[];
  parentId?: string;
  skip?: number;
  take?: number;
}

export interface UiWfAuditQuery {
  category?: string;
  action?: string;
  entity?: string;
  entityId?: string;
  instanceId?: string;
  definitionId?: string;
  actorId?: string;
  from?: string;
  to?: string;
  before?: number;
  take?: number;
}

/** A refusal from the engine, e.g. `{ code: 'notAllowed', message: 'You are not allowed to “Approve”.' }`. */
export class UiWfApiError extends Error {
  constructor(readonly status: number, readonly code: string, message: string, readonly details?: unknown) {
    super(message);
  }
}

/**
 * Everything the workflow components ask of an engine. The default implementation calls the
 * REST API (`provideUiWorkflow({ baseUrl })`); tests and demos can supply their own.
 */
export interface UiWorkflowApi {
  schema(): Promise<UiWorkflowSchema>;
  /** The signed-in person and what they may do. */
  me(): Promise<UiWfMe>;
  settings(): Promise<{ settings: UiWorkflowSettings; revision: number }>;
  saveSettings(settings: UiWorkflowSettings, revision: number): Promise<{ revision: number }>;
  triggers(): Promise<UiWfTriggerOverview[]>;
  searchUsers(query: string, take?: number): Promise<UiWfUser[]>;
  user(id: string): Promise<UiWfUser | null>;

  definitions(): Promise<UiWfDefinitionSummary[]>;
  definition(id: string): Promise<UiWfDefinitionDetail>;
  createDefinition(def: UiWorkflowDefinition): Promise<UiWfDefinitionSummary>;
  saveDraft(def: UiWorkflowDefinition): Promise<UiWfDefinitionSummary>;
  deleteDefinition(id: string): Promise<void>;
  publish(id: string, note?: string): Promise<UiWfDefinitionSummary>;
  archive(id: string): Promise<UiWfDefinitionSummary>;
  restore(id: string): Promise<UiWfDefinitionSummary>;
  rollback(id: string, version: number): Promise<UiWfDefinitionSummary>;
  version(id: string, version: number): Promise<UiWorkflowDefinition>;
  diff(id: string): Promise<string[]>;
  validate(def: UiWorkflowDefinition): Promise<UiWfProblem[]>;
  simulate(def: UiWorkflowDefinition, request: UiWfSimulationRequest): Promise<UiWfSimulationResult>;

  instances(q: UiWfInstanceQuery): Promise<UiWfPage<UiWfInstance>>;
  instance(id: string): Promise<UiWfInstance>;
  instanceDefinition(id: string): Promise<UiWorkflowDefinition>;
  cancel(id: string, reason?: string): Promise<UiWfInstance>;
  /** Retries a stopped step. `target` picks the incident (a token id or failed step id) when several paths stopped. */
  retry(id: string, target?: string): Promise<UiWfInstance>;
  /** Skips a stopped step, optionally giving its outputs. `target` as for `retry`. */
  skip(id: string, outputs?: Record<string, unknown>, target?: string): Promise<UiWfInstance>;
  migrate(id: string, version: number, stateMap?: Record<string, string>): Promise<UiWfInstance>;

  tasks(q: { scope?: 'mine' | 'all'; status?: string[]; entity?: string; entityId?: string; skip?: number; take?: number }): Promise<UiWfPage<UiWfTask>>;
  task(id: string): Promise<UiWfTask>;
  decide(id: string, outcome: string, comment?: string, data?: Record<string, unknown>): Promise<UiWfTask>;
  delegate(id: string, to: string, note?: string): Promise<UiWfTask>;
  reassign(id: string, assignees: string[], reason?: string): Promise<UiWfTask>;

  record(entity: string, id: string): Promise<UiWfRecord>;
  recordHistory(entity: string, id: string, take?: number): Promise<UiWfAuditEntry[]>;
  applyTransition(entity: string, id: string, key: string, input?: Record<string, unknown>): Promise<UiWfRecord>;
  forceState(entity: string, id: string, state: string, reason: string, skipSteps?: boolean): Promise<UiWfRecord>;
  /** Starts the record's workflow over (the lifecycle's reset), with the reset form's answers. */
  resetRecord(entity: string, id: string, input?: Record<string, unknown>): Promise<UiWfRecord>;
  startManual(workflow: string, entity: string | null, id: string | null, input?: Record<string, unknown>): Promise<UiWfInstance>;

  audit(q: UiWfAuditQuery): Promise<UiWfAuditEntry[]>;
  auditExportUrl(q: UiWfAuditQuery & { format: 'csv' | 'json' }): string;
  exportAudit(q: UiWfAuditQuery & { format: 'csv' | 'json' }): Promise<Blob>;
  verifyAudit(fromSeq?: number): Promise<UiWfAuditVerification>;
}

export interface UiWorkflowHttpOptions {
  /** Where the API is mounted, e.g. `/api/workflows`. */
  baseUrl: string;
  /** Replace to add sign-in (an Authorization header) or route through your HTTP layer. Defaults to `fetch`. */
  fetch?: (input: string, init: RequestInit) => Promise<Response>;
  /** Extra headers on every request. A function is called per request. */
  headers?: Record<string, string> | (() => Record<string, string>);
}

export const UI_WORKFLOW_API = new InjectionToken<UiWorkflowApi>('UI_WORKFLOW_API');

/**
 * The time the workflow views count from ("2 hours ago", "due in 3 days", "overdue"), as epoch
 * milliseconds. Defaults to the browser's clock; provide the engine's clock when they differ (a
 * sandbox whose clock was moved forward, or a server whose time is the one that counts).
 */
export const UI_WORKFLOW_CLOCK = new InjectionToken<() => number>('UI_WORKFLOW_CLOCK', { providedIn: 'root', factory: () => () => Date.now() });

/** Provides the clock the workflow views count from (see `UI_WORKFLOW_CLOCK`). */
export function provideUiWorkflowClock(now: () => number): Provider {
  return { provide: UI_WORKFLOW_CLOCK, useValue: now };
}

/** The clock the workflow views count from: the provided one, else the browser's. */
export function injectWorkflowClock(): () => number {
  return inject(UI_WORKFLOW_CLOCK, { optional: true }) ?? (() => Date.now());
}

/**
 * Connects the workflow components to an engine's REST API.
 *
 * ```ts
 * providers: [provideUiWorkflow({ baseUrl: '/api/workflows' })]
 * ```
 */
export function provideUiWorkflow(options: (UiWorkflowHttpOptions | { api: UiWorkflowApi }) & { now?: () => number }): Provider[] {
  const api: Provider = { provide: UI_WORKFLOW_API, useFactory: () => ('api' in options ? options.api : new UiWorkflowHttpApi(options)) };
  return options.now ? [api, provideUiWorkflowClock(options.now)] : [api];
}

/** The API the components use: the one passed as an input, else the provided one. */
export function injectWorkflowApi(): UiWorkflowApi | null {
  return inject(UI_WORKFLOW_API, { optional: true });
}

function qs(params: Record<string, unknown>): string {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === '') continue;
    p.set(k, Array.isArray(v) ? v.join(',') : String(v));
  }
  const s = p.toString();
  return s ? `?${s}` : '';
}

/** The REST implementation of `UiWorkflowApi`. */
export class UiWorkflowHttpApi implements UiWorkflowApi {
  private readonly base: string;

  constructor(private readonly options: UiWorkflowHttpOptions) {
    this.base = options.baseUrl.replace(/\/+$/, '');
  }

  private headers(): Record<string, string> {
    const h = this.options.headers;
    return typeof h === 'function' ? h() : (h ?? {});
  }

  private async call<T>(method: string, path: string, body?: unknown): Promise<T> {
    const f = this.options.fetch ?? ((i: string, init: RequestInit) => fetch(i, init));
    const res = await f(this.base + path, {
      method,
      headers: { ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}), Accept: 'application/json', ...this.headers() },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (res.status === 204) return undefined as T;
    const text = await res.text();
    let json: unknown = null;
    try { json = text ? JSON.parse(text) : null; } catch { json = null; }
    if (!res.ok) {
      const e = (json ?? {}) as { code?: string; message?: string; details?: unknown };
      const fallback = res.status === 403 ? 'You are not allowed to do that.' : res.status === 401 ? 'Please sign in.' : `The server answered ${res.status}.`;
      throw new UiWfApiError(res.status, e.code ?? `http${res.status}`, e.message ?? fallback, e.details);
    }
    return json as T;
  }

  schema() { return this.call<UiWorkflowSchema>('GET', '/schema'); }
  me() { return this.call<UiWfMe>('GET', '/me'); }
  settings() { return this.call<{ settings: UiWorkflowSettings; revision: number }>('GET', '/settings'); }
  saveSettings(settings: UiWorkflowSettings, revision: number) { return this.call<{ revision: number }>('PUT', '/settings', { settings, revision }); }
  triggers() { return this.call<UiWfTriggerOverview[]>('GET', '/triggers'); }
  searchUsers(query: string, take = 20) { return this.call<UiWfUser[]>('GET', `/directory/users${qs({ q: query, take })}`); }
  async user(id: string) {
    try { return await this.call<UiWfUser>('GET', `/directory/users/${encodeURIComponent(id)}`); }
    catch (e) { if (e instanceof UiWfApiError && e.status === 404) return null; throw e; }
  }

  definitions() { return this.call<UiWfDefinitionSummary[]>('GET', '/definitions'); }
  definition(id: string) { return this.call<UiWfDefinitionDetail>('GET', `/definitions/${encodeURIComponent(id)}`); }
  createDefinition(def: UiWorkflowDefinition) { return this.call<UiWfDefinitionSummary>('POST', '/definitions', def); }
  saveDraft(def: UiWorkflowDefinition) { return this.call<UiWfDefinitionSummary>('PUT', `/definitions/${encodeURIComponent(def.id)}`, def); }
  deleteDefinition(id: string) { return this.call<void>('DELETE', `/definitions/${encodeURIComponent(id)}`); }
  publish(id: string, note?: string) { return this.call<UiWfDefinitionSummary>('POST', `/definitions/${encodeURIComponent(id)}/publish`, { note: note ?? null }); }
  archive(id: string) { return this.call<UiWfDefinitionSummary>('POST', `/definitions/${encodeURIComponent(id)}/archive`); }
  restore(id: string) { return this.call<UiWfDefinitionSummary>('POST', `/definitions/${encodeURIComponent(id)}/restore`); }
  rollback(id: string, version: number) { return this.call<UiWfDefinitionSummary>('POST', `/definitions/${encodeURIComponent(id)}/rollback`, { version }); }
  version(id: string, version: number) { return this.call<UiWorkflowDefinition>('GET', `/definitions/${encodeURIComponent(id)}/versions/${version}`); }
  diff(id: string) { return this.call<string[]>('GET', `/definitions/${encodeURIComponent(id)}/diff`); }
  validate(def: UiWorkflowDefinition) { return this.call<UiWfProblem[]>('POST', '/validate', def); }
  simulate(def: UiWorkflowDefinition, request: UiWfSimulationRequest) { return this.call<UiWfSimulationResult>('POST', '/simulate', { definition: def, request }); }

  instances(q: UiWfInstanceQuery) { return this.call<UiWfPage<UiWfInstance>>('GET', `/instances${qs({ ...q })}`); }
  instance(id: string) { return this.call<UiWfInstance>('GET', `/instances/${encodeURIComponent(id)}`); }
  instanceDefinition(id: string) { return this.call<UiWorkflowDefinition>('GET', `/instances/${encodeURIComponent(id)}/definition`); }
  cancel(id: string, reason?: string) { return this.call<UiWfInstance>('POST', `/instances/${encodeURIComponent(id)}/cancel`, { reason: reason ?? null }); }
  retry(id: string, target?: string) { return this.call<UiWfInstance>('POST', `/instances/${encodeURIComponent(id)}/retry`, { target: target ?? null }); }
  skip(id: string, outputs?: Record<string, unknown>, target?: string) { return this.call<UiWfInstance>('POST', `/instances/${encodeURIComponent(id)}/skip`, { outputs: outputs ?? null, target: target ?? null }); }
  migrate(id: string, version: number, stateMap?: Record<string, string>) { return this.call<UiWfInstance>('POST', `/instances/${encodeURIComponent(id)}/migrate`, { version, stateMap: stateMap ?? null }); }

  tasks(q: { scope?: 'mine' | 'all'; status?: string[]; entity?: string; entityId?: string; skip?: number; take?: number }) {
    return this.call<UiWfPage<UiWfTask>>('GET', `/tasks${qs({ ...q })}`);
  }
  task(id: string) { return this.call<UiWfTask>('GET', `/tasks/${encodeURIComponent(id)}`); }
  decide(id: string, outcome: string, comment?: string, data?: Record<string, unknown>) {
    return this.call<UiWfTask>('POST', `/tasks/${encodeURIComponent(id)}/decide`, { outcome, comment: comment ?? null, data: data ?? null });
  }
  delegate(id: string, to: string, note?: string) { return this.call<UiWfTask>('POST', `/tasks/${encodeURIComponent(id)}/delegate`, { to, note: note ?? null }); }
  reassign(id: string, assignees: string[], reason?: string) { return this.call<UiWfTask>('POST', `/tasks/${encodeURIComponent(id)}/reassign`, { assignees, reason: reason ?? null }); }

  record(entity: string, id: string) { return this.call<UiWfRecord>('GET', `/records/${encodeURIComponent(entity)}/${encodeURIComponent(id)}`); }
  recordHistory(entity: string, id: string, take = 200) { return this.call<UiWfAuditEntry[]>('GET', `/records/${encodeURIComponent(entity)}/${encodeURIComponent(id)}/history${qs({ take })}`); }
  applyTransition(entity: string, id: string, key: string, input?: Record<string, unknown>) {
    return this.call<UiWfRecord>('POST', `/records/${encodeURIComponent(entity)}/${encodeURIComponent(id)}/transitions/${encodeURIComponent(key)}`, { input: input ?? null });
  }
  forceState(entity: string, id: string, state: string, reason: string, skipSteps = false) {
    return this.call<UiWfRecord>('POST', `/records/${encodeURIComponent(entity)}/${encodeURIComponent(id)}/force-state`, { state, reason, skipSteps });
  }
  resetRecord(entity: string, id: string, input?: Record<string, unknown>) {
    return this.call<UiWfRecord>('POST', `/records/${encodeURIComponent(entity)}/${encodeURIComponent(id)}/reset`, { input: input ?? {} });
  }
  startManual(workflow: string, entity: string | null, id: string | null, input?: Record<string, unknown>) {
    const path = entity && id ? `/records/${encodeURIComponent(entity)}/${encodeURIComponent(id)}/manual/${encodeURIComponent(workflow)}` : `/manual/${encodeURIComponent(workflow)}`;
    return this.call<UiWfInstance>('POST', path, { input: input ?? null });
  }

  audit(q: UiWfAuditQuery) { return this.call<UiWfAuditEntry[]>('GET', `/audit${qs({ ...q })}`); }
  auditExportUrl(q: UiWfAuditQuery & { format: 'csv' | 'json' }) { return `${this.base}/audit/export${qs({ ...q })}`; }
  async exportAudit(q: UiWfAuditQuery & { format: 'csv' | 'json' }) {
    const f = this.options.fetch ?? ((i: string, init: RequestInit) => fetch(i, init));
    const res = await f(this.auditExportUrl(q), { method: 'GET', headers: { ...this.headers() } });
    if (!res.ok) throw new UiWfApiError(res.status, `http${res.status}`, res.status === 403 ? 'You are not allowed to export the audit log.' : `The server answered ${res.status}.`);
    return res.blob();
  }
  verifyAudit(fromSeq?: number) { return this.call<UiWfAuditVerification>('POST', `/audit/verify${qs({ fromSeq })}`); }
}
