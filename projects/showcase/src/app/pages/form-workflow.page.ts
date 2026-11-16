import { JsonPipe } from '@angular/common';
import { Component, computed, signal } from '@angular/core';
import { UiSegmented } from '@zouriel/ui/button';
import { UiBadge } from '@zouriel/ui/badge';
import { UiFormRenderer, fbSubmissionFields, type UiFormDefinition, type UiFormSubmission } from '@zouriel/ui/form-builder';
import {
  UiWorkflowBuilder,
  UiWorkflowStateBadge,
  createStep,
  createWorkflow,
  wfPickWorkflow,
  wfRouteSubmission,
  wfSubmissionPayload,
  wfSubmissionRegistry,
  type UiWfApprovalStep,
  type UiWfBranchStep,
  type UiWfTaskStep,
  type UiWorkflowDefinition,
} from '@zouriel/ui/workflow';
import { DocDemo, DocPage, DocSection, type ApiRow } from '../docs/docs-ui';

const LEAVE_FORM: UiFormDefinition = {
  schemaVersion: 2,
  id: 'leave-request',
  title: { en: 'Leave request', dv: 'ލީވް އެދުން' },
  revision: 1,
  defaultLocale: 'en',
  supportedLocales: [{ code: 'en' }, { code: 'dv' }],
  pages: [
    {
      id: 'p1',
      elements: [
        { kind: 'field', id: 'f_name', type: 'text', key: 'employee', label: { en: 'Your name', dv: 'ނަން' }, required: true },
        {
          kind: 'field', id: 'f_type', type: 'select', key: 'leave_type', label: { en: 'Kind of leave', dv: 'ލީވްގެ ބާވަތް' }, required: true,
          options: [
            { id: 'o1', value: 'annual', label: { en: 'Annual leave', dv: 'އަހަރީ ލީވް' } },
            { id: 'o2', value: 'sick', label: { en: 'Sick leave', dv: 'ބަލިމީހާގެ ލީވް' } },
          ],
        },
        { kind: 'field', id: 'f_days', type: 'number', key: 'days', label: { en: 'Days', dv: 'ދުވަސް' }, required: true, props: { min: 1, max: 60 } },
        { kind: 'field', id: 'f_why', type: 'textarea', key: 'reason', label: { en: 'Reason', dv: 'ސަބަބު' } },
      ],
    },
  ],
};

const WORKFLOW_ID = 'wf-leave';
const SERVICE_CODE = 'HR-LEAVE';

/** Longer than 3 days: the manager signs it off, then finance pays it out. Otherwise nobody needs to look. */
function leaveWorkflow(): UiWorkflowDefinition {
  const def = createWorkflow('automation', 'Leave approval', 'request');
  def.id = WORKFLOW_ID;
  def.key = 'leave';
  def.trigger = { type: 'created', label: 'A leave request is submitted' };
  const branch = createStep('branch') as UiWfBranchStep;
  branch.title = 'How long is the leave?';
  branch.paths[0].label = 'More than 3 days';
  branch.paths[0].when = { match: 'all', conditions: [{ ref: 'entity.days', op: 'gt', value: { const: 3 } }] };
  const approval = createStep('approval') as UiWfApprovalStep;
  approval.title = 'Manager approval';
  approval.assignees = [{ role: 'manager' }];
  const pay = createStep('task') as UiWfTaskStep;
  pay.title = 'Adjust the leave balance';
  pay.assignees = [{ group: 'finance' }];
  pay.outcomes[0].label = 'Done';
  approval.outcomes.approved = [pay];
  branch.paths[0].steps = [approval];
  branch.otherwise!.label = '3 days or fewer';
  branch.otherwise!.steps = [{ ...createStep('notify'), title: 'Tell the employee: approved' } as never];
  def.steps = [branch];
  return def;
}

@Component({
  selector: 'page-form-workflow',
  imports: [JsonPipe, UiSegmented, UiBadge, UiFormRenderer, UiWorkflowBuilder, UiWorkflowStateBadge, DocDemo, DocPage, DocSection],
  template: `
    <doc-page eyebrow="Integration" title="Form → workflow"
      lead="A form only collects answers. What happens next (who approves, which queue gets the work) is written in a workflow, and it reads the submitted answers. The form builder holds no routing, and the workflow builder holds no questions. A small bridge in @zouriel/ui/workflow hands one to the other.">

      <doc-section name="Live example" selector="ui-form-renderer → wfRouteSubmission → ui-workflow-builder"
        summary="Submit the leave request below, in English or Dhivehi. The workflow on the right decides the route from the answers: more than 3 days goes to the manager, then the finance queue; otherwise it is approved on its own. Then change the condition in the builder (select the branch, edit its condition): the route under it changes at once for the same answers. Everything here runs in your browser.">
        <div class="grid">
          <div class="col">
            <h3>1. The form (knows nothing about the workflow)</h3>
            <ui-segmented label="Form language" size="sm" [options]="localeOptions" [value]="locale()" (valueChange)="locale.set($any($event))" />
            <ui-form-renderer [definition]="form" [locale]="locale()" [link]="link" (submitted)="submitted($event)" />
          </div>
          <div class="col">
            <h3>2. The workflow (owns the routing)</h3>
            <div class="builder"><ui-workflow-builder [(definition)]="workflow" [schema]="schema()" /></div>
          </div>
        </div>

        <h3>3. What the bridge did</h3>
        @if (last(); as s) {
          <div class="result">
            <div class="row">
              <span class="lbl">Picked workflow</span>
              @if (picked(); as w) { <ui-badge tone="primary">{{ w.title }}</ui-badge> <code>{{ w.id }}</code> } @else { <ui-badge tone="danger">none matched</ui-badge> }
            </div>
            <div class="row">
              <span class="lbl">Manager decides</span>
              <ui-segmented label="Manager decision" size="sm" [options]="decisionOptions" [value]="decision()" (valueChange)="decision.set($any($event))" />
            </div>
            @if (route(); as r) {
              <ol class="route">
                @for (st of r.steps; track st.stepId) {
                  <li [style.margin-left.px]="st.path.length * 18">
                    <strong>{{ st.title }}</strong>
                    @if (st.taken) { <span class="muted"> took “{{ st.taken }}”</span> }
                    @if (st.type === 'approval') { <ui-workflow-state-badge [label]="'Approval · ' + st.outcome" [tone]="st.outcome === 'approved' ? 'success' : 'danger'" /> }
                    @if (st.queue) { <ui-workflow-state-badge [label]="'Queue · ' + st.queue" tone="info" /> }
                    @if (st.assignees.length) { <span class="muted"> for {{ assigneeText(st) }}</span> }
                  </li>
                }
              </ol>
              <div class="row">
                <ui-workflow-state-badge [label]="r.approvals.length ? r.approvals.length + ' approval(s)' : 'No approval needed'" [tone]="r.approvals.length ? 'warning' : 'success'" />
                <ui-workflow-state-badge [label]="r.queues.length ? 'Queue: ' + r.queues.join(', ') : 'No queue'" [tone]="r.queues.length ? 'info' : 'neutral'" />
              </div>
            } @else {
              <p class="muted">No workflow is bound to this submission, so nothing was started.</p>
            }
            <details open>
              <summary>The payload the workflow receives</summary>
              <pre>{{ payload() | json }}</pre>
            </details>
          </div>
        } @else {
          <p class="muted">Submit the form to see the payload, the picked workflow and the route.</p>
        }
      </doc-section>

      <doc-section name="Integrating it" selector="@zouriel/ui/workflow"
        summary="Five calls. The bridge is pure and needs no engine to preview; with an engine, wfStartFromSubmission starts the real run through the API client's startManual and the engine routes it from the same definition.">
        <doc-demo lang="ts" [code]="integration"></doc-demo>
      </doc-section>

      <doc-section name="Bridge API" selector="functions" [api]="bridgeApi" apiTitle="Functions"
        summary="The form builder's own condition language is reused: a workflow condition is its JSON with token paths as ref. In a workflow, an answer is entity.days (the form's answers shown as a record type), input.days or trigger.data.days. Link and form details are trigger.formId, trigger.locale, trigger.serviceCode and trigger.workflowId.">
        <doc-demo lang="ts" [code]="routeShape"></doc-demo>
      </doc-section>
    </doc-page>
  `,
  styles: `
    h3 { margin: 0 0 var(--ui-space-2); font-size: 14px; }
    .grid { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1.4fr); gap: var(--ui-space-4); margin-bottom: var(--ui-space-4); }
    @media (max-width: 1100px) { .grid { grid-template-columns: minmax(0, 1fr); } }
    .col { min-width: 0; }
    .builder { height: 560px; border: 1px solid var(--ui-color-border); border-radius: var(--ui-radius); overflow: hidden; }
    .builder ui-workflow-builder { height: 100%; }
    .result { display: flex; flex-direction: column; gap: var(--ui-space-3); }
    .row { display: flex; align-items: center; flex-wrap: wrap; gap: var(--ui-space-2); }
    .lbl { min-width: 130px; font-size: 13px; color: var(--ui-color-text-muted); }
    .route { margin: 0; padding: 0; list-style: none; display: flex; flex-direction: column; gap: var(--ui-space-2); font-size: 13.5px; }
    .muted { color: var(--ui-color-text-muted); font-size: 13px; }
    pre { margin: var(--ui-space-2) 0 0; padding: var(--ui-space-3); background: var(--ui-color-surface-2, var(--ui-color-surface)); border: 1px solid var(--ui-color-border); border-radius: var(--ui-radius); font-size: 12px; overflow: auto; max-height: 320px; }
    summary { cursor: pointer; font-size: 13px; }
  `,
})
export class FormWorkflowPage {
  protected readonly form = LEAVE_FORM;
  /** Set by the host, never stored in the form: which process these answers belong to. */
  protected readonly link = { workflowId: WORKFLOW_ID, serviceCode: SERVICE_CODE };
  protected readonly workflow = signal<UiWorkflowDefinition>(leaveWorkflow());
  /** The form's questions as a record type, so the builder's condition editor can pick them. */
  protected readonly schema = signal(wfSubmissionRegistry(fbSubmissionFields(LEAVE_FORM), {
    entity: 'request', entityLabel: 'Leave request',
    roles: [{ key: 'manager', label: 'Line manager' }],
    groups: [{ key: 'finance', label: 'Finance queue' }],
  }));
  protected readonly last = signal<UiFormSubmission | null>(null);
  protected readonly locale = signal('en');
  protected readonly localeOptions = [{ label: 'English', value: 'en' }, { label: 'ދިވެހި', value: 'dv' }];
  protected readonly decision = signal<'approved' | 'rejected'>('approved');
  protected readonly decisionOptions = [{ label: 'Approves', value: 'approved' }, { label: 'Rejects', value: 'rejected' }];

  protected readonly payload = computed(() => (this.last() ? wfSubmissionPayload(this.last()!) : null));
  protected readonly picked = computed(() => {
    const s = this.last();
    return s ? wfPickWorkflow([{ workflow: this.workflow(), serviceCodes: [SERVICE_CODE], formIds: [LEAVE_FORM.id] }], s) : null;
  });
  /** Recomputed whenever the workflow is edited, so a changed condition changes the route for the same answers. */
  protected readonly route = computed(() => {
    const s = this.last();
    const w = this.picked();
    if (!s || !w) return null;
    const approvals: Record<string, string> = {};
    const walk = (steps: readonly { id: string; type: string }[]) => steps.forEach((st) => { if (st.type === 'approval') approvals[st.id] = this.decision(); });
    const flat = (list: readonly any[]): void => { walk(list); list.forEach((st) => { for (const p of st.paths ?? []) flat(p.steps); if (st.otherwise) flat(st.otherwise.steps); }); };
    flat(w.steps ?? []);
    return wfRouteSubmission(w, s, { decisions: approvals, registry: this.schema().registry });
  });

  protected submitted(s: UiFormSubmission): void {
    this.last.set(s);
  }

  protected assigneeText(st: { assignees: { label: string }[] }): string {
    return st.assignees.map((a) => a.label).join(', ');
  }

  protected readonly integration = `import { UiFormRenderer } from '@zouriel/ui/form-builder';
import { wfPickWorkflow, wfRouteSubmission, wfStartFromSubmission, wfSubmissionRegistry } from '@zouriel/ui/workflow';

// 1. The host links the form to a process. The form definition never holds this.
//    <ui-form-renderer [definition]="form" [link]="{ workflowId: 'wf-leave', serviceCode: 'HR-LEAVE' }"
//                      (submitted)="onSubmit($event)" />

async onSubmit(s: UiFormSubmission) {
  // 2. Which workflow? workflowId, then serviceCode, then form id. null: nothing is bound.
  const wf = wfPickWorkflow(bindings, s);
  if (!wf) return;

  // 3a. Preview on the client: the route the answers take (branches, approvals, queues).
  const route = wfRouteSubmission(wf, s, { registry });

  // 3b. Or start it on the engine: the answers arrive as input.* and the engine routes them.
  const run = await wfStartFromSubmission(api, wf, s);
}

// 4. Author conditions against the form's answers in the workflow builder (no engine needed):
//    <ui-workflow-builder [(definition)]="wf" [schema]="wfSubmissionRegistry(fbSubmissionFields(form))" />`;

  protected readonly routeShape = `interface UiWfRoute {
  workflowId: string; workflowKey: string; title: string;
  steps: UiWfRouteStep[];          // in order; { stepId, type, title, path, assignees, queue, taken?, outcome? }
  approvals: UiWfRouteStep[];      // the approval steps reached
  queues: string[];                // groups tasks were queued to
  decisions: { stepId; title; taken: string | null }[];   // each branch / switch
  result: 'completed' | 'failed'; reason?: string;
}`;

  protected readonly bridgeApi: ApiRow[] = [
    { name: 'wfSubmissionPayload(s)', type: '(UiFormSubmission) => UiWfSubmissionPayload', desc: 'The plain JSON a workflow start receives: formId, revision, locale, submittedAt, workflowId, serviceCode, data, fields. No File objects.' },
    { name: 'wfPickWorkflow(list, s)', type: '(UiWfSubmissionBinding[] | UiWorkflowDefinition[], s) => UiWorkflowDefinition | null', desc: 'By s.workflowId (a definition id or key), else s.serviceCode (binding.serviceCodes), else s.formId (binding.formIds). A workflowId that matches nothing returns null.' },
    { name: 'wfStartFromSubmission(api, wf, s)', type: '(Pick<UiWorkflowApi, "startManual">, wf, s) => Promise<UiWfInstance>', desc: 'Starts the workflow on an engine with the answers as input. Throws when files were picked and have no upload address.' },
    { name: 'wfRouteSubmission(wf, s, options?)', type: '(wf, s | payload, { decisions?, registry?, today? }) => UiWfRoute', desc: 'Client-side route. A branch takes its first path whose condition holds, else otherwise; a switch compares its value to each case; parallel paths are all walked; approvals follow approved (or decisions[stepId]); tasks follow their first outcome.' },
    { name: 'wfConditionHolds(when, s)', type: '(UiWfCondition | undefined, s) => boolean', desc: 'One workflow condition against a submission, with the form builder’s own evaluation.' },
    { name: 'wfSubmissionRegistry(fields, extra?)', type: '(UiFbSubmissionField[], { entity?, entityLabel?, roles?, groups? }) => UiWorkflowSchema', desc: 'The answers as a record type for ui-workflow-builder [schema], so conditions can be picked as entity.<answer path>.' },
    { name: 'wfSubmissionEntity / wfSubmissionTokens', type: '(fields) => UiWfEntityDescriptor / UiWfToken[]', desc: 'The same hints as a record type for your own registry, or as input.<path> tokens under “Form answers”.' },
    { name: 'wfAnswerAt(data, path)', type: '(unknown, string) => unknown', desc: 'Reads address.city or children[].age (one value per row) from the answers.' },
  ];
}
