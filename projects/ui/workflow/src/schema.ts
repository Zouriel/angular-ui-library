/**
 * The workflow definition format (Zouriel Workflows spec v1) shared by `ui-workflow-builder`
 * (which edits it) and the engines that run it (.NET, and later Laravel and Go). Everything is
 * plain JSON so the host app can store and send it as-is.
 *
 * Identity: states, transitions, steps, paths, cases and outcomes have an immutable `id`.
 * References inside a definition point at ids, except token paths (`entity.status`,
 * `steps.s3.outcome`), which point at registry keys and step ids.
 */
import type { UiFbConditionRule, UiFbOperator, UiFormDefinition } from '@zouriel/ui/form-builder';

export const UI_WF_SPEC_VERSION = 1;

export type UiWfKind = 'automation' | 'lifecycle';

// ── Values ────────────────────────────────────────────────────────────────

/** A value: a constant, a token path, today ± days, or a form-builder calculation over token paths. */
export type UiWfOperand =
  | { const: unknown }
  | { ref: string }
  | { today: number }
  | { calc: UiWfCalc };

export interface UiWfCalc {
  op: 'sum' | 'subtract' | 'multiply' | 'divide' | 'average' | 'min' | 'max' | 'count' | 'ageYears' | 'daysBetween' | 'concat';
  args: ({ ref: string } | { const: number | string } | { calc: UiWfCalc })[];
  decimals?: number;
}

/** Text with tokens: strings and `{ ref }` parts. */
export type UiWfTemplate = string | (string | { ref: string })[];

/** The form builder's condition JSON, with token paths as `ref`. */
export type UiWfCondition = UiWfConditionGroup | UiWfConditionRule;
export interface UiWfConditionGroup {
  match: 'all' | 'any' | 'none';
  conditions: UiWfCondition[];
}
export type UiWfConditionRule = Omit<UiFbConditionRule, 'op' | 'value' | 'value2'> & {
  op: UiFbOperator;
  value?: { const: unknown } | { ref: string } | { today: number };
  value2?: { const: unknown } | { ref: string } | { today: number };
};

/** One entry of a people list. Exactly one key is set. */
export type UiWfAssignee =
  | { role: string }
  | { group: string }
  | { user: string }
  | { field: string }
  | { managerOf: string }
  | { initiator: true };

export type UiWfRecipient = UiWfAssignee | { email: UiWfTemplate };

export type UiWfCalendar = 'calendar' | 'working';

// ── Triggers ──────────────────────────────────────────────────────────────

export type UiWfTriggerType =
  | 'created' | 'fieldChanged' | 'stateEntered' | 'transitionApplied' | 'deleted' | 'dateReached' | 'schedule' | 'manual' | 'signal';

export interface UiWfTrigger {
  type: UiWfTriggerType;
  when?: UiWfCondition;
  retrigger?: boolean;
  field?: string;
  from?: unknown[];
  to?: unknown[];
  lifecycle?: string;
  states?: string[];
  transitions?: string[];
  offset?: string;
  at?: string;
  cron?: string;
  forEach?: { when?: UiWfCondition; limit: number };
  label?: string;
  form?: UiFormDefinition;
  who?: UiWfAssignee[];
  signal?: string;
}

// ── Steps ─────────────────────────────────────────────────────────────────

export interface UiWfRetry {
  max: number;
  backoff?: 'fixed' | 'exponential';
  initial?: string;
  maxDelay?: string;
}

export type UiWfOnError = 'stop' | 'continue' | { steps: UiWfStep[] };

export interface UiWfStepBase {
  id: string;
  title?: string;
  note?: string;
  disabled?: boolean;
  retry?: UiWfRetry;
  timeout?: string;
  onError?: UiWfOnError;
}

export interface UiWfStepList {
  id: string;
  label?: string;
  steps: UiWfStep[];
}

export interface UiWfBranchStep extends UiWfStepBase {
  type: 'branch';
  paths: { id: string; label: string; when?: UiWfCondition; steps: UiWfStep[] }[];
  otherwise?: UiWfStepList;
}

export interface UiWfSwitchStep extends UiWfStepBase {
  type: 'switch';
  on: string;
  cases: { id: string; label: string; values: unknown[]; steps: UiWfStep[] }[];
  otherwise?: UiWfStepList;
}

export interface UiWfParallelStep extends UiWfStepBase {
  type: 'parallel';
  paths: UiWfStepList[];
  join: { type: 'all' | 'any' | 'count'; count?: number };
}

export interface UiWfForEachStep extends UiWfStepBase {
  type: 'forEach';
  collection: string;
  when?: UiWfCondition;
  mode?: 'sequential' | 'parallel';
  concurrency?: number;
  max: number;
  steps: UiWfStep[];
}

interface UiWfHumanBase extends UiWfStepBase {
  assignees: UiWfAssignee[];
  due: string;
  calendar?: UiWfCalendar;
  reminders?: string[];
  escalation?: { after: string; assignees: UiWfAssignee[]; notify?: boolean };
  form?: UiFormDefinition;
  instructions?: UiWfTemplate;
  allowDelegation?: boolean;
}

export interface UiWfApprovalStep extends UiWfHumanBase {
  type: 'approval';
  rule: { type: 'any' | 'all' | 'count' | 'percent'; value?: number };
  requireComment?: 'never' | 'reject' | 'always';
  outcomes: { approved: UiWfStep[]; rejected: UiWfStep[]; timedOut: UiWfStep[] };
}

export interface UiWfTaskOutcome {
  id: string;
  key: string;
  label: string;
  tone?: UiWfTone;
  steps: UiWfStep[];
}

export interface UiWfTaskStep extends UiWfHumanBase {
  type: 'task';
  requireComment?: 'never' | 'always';
  outcomes: UiWfTaskOutcome[];
  onTimeout: UiWfStepList;
}

export type UiWfWaitUntil =
  | { type: 'duration'; duration: string; calendar?: UiWfCalendar }
  | { type: 'date'; date: UiWfOperand; offset?: string; at?: string }
  | { type: 'condition'; when: UiWfCondition; timeout: string; onTimeout: UiWfStepList }
  | { type: 'signal'; signal: string; timeout?: string; onTimeout?: UiWfStepList };

export interface UiWfWaitStep extends UiWfStepBase {
  type: 'wait';
  until: UiWfWaitUntil;
}

export interface UiWfSetFieldsStep extends UiWfStepBase {
  type: 'setFields';
  target?: string;
  values: { field: string; value: UiWfOperand }[];
}

export interface UiWfSetVariablesStep extends UiWfStepBase {
  type: 'setVariables';
  values: { variable: string; value: UiWfOperand }[];
}

export interface UiWfApplyTransitionStep extends UiWfStepBase {
  type: 'applyTransition';
  target?: string;
  lifecycle: string;
  transition: string;
  input?: Record<string, UiWfOperand>;
  ifNotAllowed?: 'fail' | 'skip';
}

export interface UiWfNotifyStep extends UiWfStepBase {
  type: 'notify';
  channel: string;
  to: UiWfRecipient[];
  subject?: UiWfTemplate;
  body: UiWfTemplate;
  link?: UiWfTemplate;
}

export interface UiWfWebhookStep extends UiWfStepBase {
  type: 'webhook';
  connection?: string;
  url?: string;
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  path?: UiWfTemplate;
  headers?: Record<string, UiWfTemplate>;
  body?: unknown;
  expect?: number[];
}

export interface UiWfActionStep extends UiWfStepBase {
  type: 'action';
  action: string;
  input?: Record<string, UiWfOperand>;
}

export interface UiWfSubWorkflowStep extends UiWfStepBase {
  type: 'subWorkflow';
  workflow: string;
  target?: string;
  wait: boolean;
  input?: Record<string, UiWfOperand>;
}

export interface UiWfGoToStep extends UiWfStepBase {
  type: 'goTo';
  target: string;
  maxTimes: number;
}

export interface UiWfEndStep extends UiWfStepBase {
  type: 'end';
  result: 'completed' | 'failed';
  reason?: UiWfTemplate;
}

export type UiWfStep =
  | UiWfBranchStep | UiWfSwitchStep | UiWfParallelStep | UiWfForEachStep | UiWfApprovalStep | UiWfTaskStep | UiWfWaitStep
  | UiWfSetFieldsStep | UiWfSetVariablesStep | UiWfApplyTransitionStep | UiWfNotifyStep | UiWfWebhookStep | UiWfActionStep
  | UiWfSubWorkflowStep | UiWfGoToStep | UiWfEndStep;

export type UiWfStepType = UiWfStep['type'];

export type UiWfTone = 'neutral' | 'primary' | 'info' | 'success' | 'warning' | 'danger';

// ── Lifecycles ────────────────────────────────────────────────────────────

export interface UiWfState {
  id: string;
  /** The value stored in the record's field for this state. */
  key: string;
  label: string;
  category: 'initial' | 'active' | 'terminal';
  tone?: Exclude<UiWfTone, 'primary'>;
  description?: string;
  onEnter?: UiWfStep[];
  onExit?: UiWfStep[];
  keepRunsOnExit?: boolean;
  sla?: { within: string; calendar?: UiWfCalendar; steps: UiWfStep[] };
}

export interface UiWfTransition {
  id: string;
  key: string;
  label: string;
  /** State ids, or `'*'` for every non-final state. */
  from: string[] | '*';
  to: string;
  who?: UiWfAssignee[];
  when?: UiWfCondition;
  input?: { form: UiFormDefinition };
  steps?: UiWfStep[];
  auto?: { after: string; calendar?: UiWfCalendar } | { when: UiWfCondition };
  confirm?: string;
  tone?: Exclude<UiWfTone, 'info'>;
  hidden?: boolean;
}

export interface UiWfLifecycle {
  field: string;
  mode?: 'enforce' | 'observe';
  states: UiWfState[];
  transitions: UiWfTransition[];
  /** Positions on the diagram, by state id. States without one are placed automatically. */
  layout?: Record<string, [number, number]>;
}

// ── Definition ────────────────────────────────────────────────────────────

export interface UiWfVariable {
  id: string;
  key: string;
  label: string;
  type: 'text' | 'number' | 'boolean' | 'date' | 'dateTime' | 'user' | 'json';
  default?: unknown;
}

export interface UiWorkflowDefinition {
  specVersion: 1;
  id: string;
  key: string;
  kind: UiWfKind;
  title: string;
  description?: string;
  revision?: number;
  entity?: string;
  trigger?: UiWfTrigger;
  steps?: UiWfStep[];
  lifecycle?: UiWfLifecycle;
  variables?: UiWfVariable[];
  settings?: {
    concurrency?: 'perRecordSerial' | 'parallel' | 'skipIfRunning';
    owners?: UiWfAssignee[];
    notifyOwnersOnIncident?: boolean;
    calendar?: UiWfCalendar;
  };
}

// ── Registry (what the app allows workflows to use) ───────────────────────

export type UiWfFieldType =
  | 'text' | 'longText' | 'email' | 'phone' | 'url' | 'number' | 'currency' | 'boolean' | 'date' | 'dateTime' | 'enum' | 'user' | 'relation' | 'collection' | 'json';

export interface UiWfFieldOption {
  value: string | number;
  label: string;
}

export interface UiWfFieldDescriptor {
  key: string;
  label: string;
  type: UiWfFieldType;
  options?: UiWfFieldOption[];
  entity?: string;
  readable?: boolean;
  watchable?: boolean;
  settable?: boolean;
  lifecycle?: boolean;
  sensitive?: boolean;
  required?: boolean;
}

export interface UiWfEntityDescriptor {
  key: string;
  label: string;
  pluralLabel?: string;
  titleField?: string;
  fields: UiWfFieldDescriptor[];
}

export interface UiWfParamDescriptor {
  key: string;
  label: string;
  type: UiWfFieldType;
  required?: boolean;
  options?: UiWfFieldOption[];
  entity?: string;
  description?: string;
}

export interface UiWfActionDescriptor {
  key: string;
  label: string;
  description?: string;
  category?: string;
  entity?: string;
  inputs: UiWfParamDescriptor[];
  outputs: UiWfParamDescriptor[];
}

export interface UiWfSignalDescriptor {
  key: string;
  label: string;
  entity?: string;
  fields: UiWfParamDescriptor[];
}

export interface UiWfLabelled {
  key: string;
  label: string;
  description?: string;
}

export interface UiWorkflowRegistry {
  specVersion: 1;
  entities: UiWfEntityDescriptor[];
  actions?: UiWfActionDescriptor[];
  signals?: UiWfSignalDescriptor[];
  channels?: UiWfLabelled[];
  roles?: UiWfLabelled[];
  groups?: UiWfLabelled[];
}

/** `GET /schema`: the registry plus what each step type outputs. */
export interface UiWorkflowSchema {
  specVersion: number;
  registry: UiWorkflowRegistry;
  steps: { type: UiWfStepType; label: string; outputs: string[] }[];
}

// ── Global settings ───────────────────────────────────────────────────────

export interface UiWorkflowSettings {
  version: 1;
  timeZone?: string;
  calendar?: { days?: ('mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun')[]; hours?: [string, string]; holidays?: string[] };
  defaults?: {
    retry?: UiWfRetry;
    taskDue?: string;
    reminders?: string[];
    concurrency?: 'perRecordSerial' | 'parallel' | 'skipIfRunning';
    maxChainDepth?: number;
    forEachMax?: number;
  };
  people?: { delegation?: boolean; escalationDefault?: UiWfAssignee[] };
  channels?: Record<string, { enabled?: boolean; sender?: string; footer?: string }>;
  webhooks?: {
    allowedOrigins?: string[];
    connections?: { key: string; label: string; baseUrl: string; auth?: 'none' | 'secret'; secretName?: string; header?: string }[];
  };
  audit?: { retentionDays?: Record<string, number>; maskedFields?: string[] };
  paused?: { entity: string }[];
}
