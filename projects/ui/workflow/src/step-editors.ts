import { Component, computed, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HugeiconsIconComponent } from '@hugeicons/angular';
import { UiInput, UiNumberInput, UiSwitch, UiTextarea } from '@zouriel/ui/form';
import {
  collectionsOf,
  entityOf,
  fieldOf,
  goToTargets,
  stepName,
  wfId,
  wfKey,
  type UiWfToken,
} from './definition';
import { WfAssigneesEditor, WfConditionEditor, WfDurationInput, WfFormField, WfOperandEditor, WfTemplateEditor, WfTokenSelect, WfValueInput } from './editors';
import { WF_ICONS } from './icons';
import type {
  UiWfActionStep,
  UiWfApplyTransitionStep,
  UiWfApprovalStep,
  UiWfBranchStep,
  UiWfEndStep,
  UiWfForEachStep,
  UiWfGoToStep,
  UiWfNotifyStep,
  UiWfOnError,
  UiWfParallelStep,
  UiWfSetFieldsStep,
  UiWfSetVariablesStep,
  UiWfStep,
  UiWfSubWorkflowStep,
  UiWfSwitchStep,
  UiWfTaskStep,
  UiWfWaitStep,
  UiWfWaitUntil,
  UiWfWebhookStep,
} from './schema';
import { WfBuilderStore } from './store';
import { WF_SHARED_STYLES } from './styles';

const EDITOR_IMPORTS = [FormsModule, HugeiconsIconComponent, UiInput, UiNumberInput, UiSwitch, UiTextarea, WfAssigneesEditor, WfConditionEditor, WfDurationInput, WfFormField, WfOperandEditor, WfTemplateEditor, WfTokenSelect, WfValueInput];

/**
 * Settings for one step. Each step type gets its own section; common settings (name, note,
 * retries, what happens on failure) come after it.
 */
@Component({
  selector: 'ui-wf-step-editor',
  imports: EDITOR_IMPORTS,
  template: `
    <div class="wf-stack">
      <label class="lw"><span class="wf-label">Name</span>
        <ui-input size="sm" [ngModel]="step().title ?? ''" (ngModelChange)="patch({ title: $event || undefined }, 'title')" [placeholder]="defaultName()" /></label>

      @switch (step().type) {
        @case ('approval') {
          <div class="wf-stack">
            <div><span class="wf-label">Who approves</span>
              <ui-wf-assignees [value]="human().assignees" [registry]="store.registry()" [tokens]="tokens()" [api]="store.api()" label="approvers"
                emptyText="Add the people who decide." (valueChange)="patch({ assignees: $any($event) })" /></div>
            <div class="wf-grid2">
              <label class="lw"><span class="wf-label">Decided when</span>
                <select class="wf-select" (change)="setRule($any($event.target).value)">
                  <option value="any" [selected]="approval().rule.type === 'any'">Anyone approves</option>
                  <option value="all" [selected]="approval().rule.type === 'all'">Everyone approves</option>
                  <option value="count" [selected]="approval().rule.type === 'count'">A number approve</option>
                  <option value="percent" [selected]="approval().rule.type === 'percent'">A share approve</option>
                </select></label>
              @if (approval().rule.type === 'count' || approval().rule.type === 'percent') {
                <label class="lw"><span class="wf-label">{{ approval().rule.type === 'count' ? 'How many' : 'Percent' }}</span>
                  <ui-number-input size="sm" [ngModel]="approval().rule.value ?? 1" (ngModelChange)="patch({ rule: { type: approval().rule.type, value: $event ?? 1 } })" [min]="1" [max]="approval().rule.type === 'percent' ? 100 : undefined" /></label>
              }
            </div>
            <p class="wf-hint">Anyone: the first approval wins. Everyone: one rejection rejects it.</p>
            <label class="lw"><span class="wf-label">Comment required</span>
              <select class="wf-select" (change)="patch({ requireComment: $any($event.target).value })">
                <option value="never" [selected]="!approval().requireComment || approval().requireComment === 'never'">Never</option>
                <option value="reject" [selected]="approval().requireComment === 'reject'">When rejecting</option>
                <option value="always" [selected]="approval().requireComment === 'always'">Always</option>
              </select></label>
          </div>
        }
        @case ('task') {
          <div class="wf-stack">
            <div><span class="wf-label">Who does it</span>
              <ui-wf-assignees [value]="human().assignees" [registry]="store.registry()" [tokens]="tokens()" [api]="store.api()" label="people"
                emptyText="Add the person or people who decide." (valueChange)="patch({ assignees: $any($event) })" /></div>
            <div><span class="wf-label">Buttons (what they can choose)</span>
              @for (o of task().outcomes; track o.id; let i = $index) {
                <div class="outcome">
                  <ui-input size="sm" [ngModel]="o.label" (ngModelChange)="setOutcome(i, $event)" [ariaLabel]="'Button ' + (i + 1)" />
                  <select class="wf-select tone" (change)="setOutcomeTone(i, $any($event.target).value)" aria-label="Colour">
                    @for (t of tones; track t) { <option [value]="t" [selected]="(o.tone ?? 'neutral') === t">{{ t }}</option> }
                  </select>
                  <button type="button" class="wf-icon-btn danger" [disabled]="task().outcomes.length < 2" (click)="removeOutcome(i)" aria-label="Remove button">
                    <hugeicons-icon aria-hidden="true" [icon]="icons.Delete02Icon" [size]="14" [strokeWidth]="1.8" />
                  </button>
                </div>
              }
              @if (task().outcomes.length < 8) { <button type="button" class="wf-link" (click)="addOutcome()">Add a button</button> }
            </div>
          </div>
        }
        @case ('branch') {
          <div class="wf-stack">
            @for (p of branch().paths; track p.id; let i = $index) {
              <div class="path">
                <div class="wf-row">
                  <ui-input class="grow" size="sm" [ngModel]="p.label" (ngModelChange)="setPathLabel(i, $event)" [ariaLabel]="'Path ' + (i + 1) + ' name'" />
                  <button type="button" class="wf-icon-btn danger" [disabled]="branch().paths.length < 2" (click)="removePath(i)" aria-label="Remove path">
                    <hugeicons-icon aria-hidden="true" [icon]="icons.Delete02Icon" [size]="14" [strokeWidth]="1.8" />
                  </button>
                </div>
                <ui-wf-condition [value]="p.when" [tokens]="tokens()" emptyText="Add a condition for this path." (valueChange)="setPathWhen(i, $event)" />
              </div>
            }
            <div class="wf-row">
              <button type="button" class="wf-link" (click)="addPath()">Add a path</button>
              <label class="wf-row small"><ui-switch [ngModel]="!!branch().otherwise" (ngModelChange)="toggleOtherwise($event)" /> Otherwise path</label>
            </div>
            <p class="wf-hint">The first path whose conditions hold runs; if none do, “Otherwise”.</p>
          </div>
        }
        @case ('switch') {
          <div class="wf-stack">
            <label class="lw"><span class="wf-label">Switch on</span>
              <ui-wf-token-select [tokens]="tokens()" [value]="switchStep().on" (valueChange)="patch({ on: $event })" /></label>
            @for (c of switchStep().cases; track c.id; let i = $index) {
              <div class="path">
                <div class="wf-row">
                  <ui-input class="grow" size="sm" [ngModel]="c.label" (ngModelChange)="setCase(i, { label: $event })" [ariaLabel]="'Case ' + (i + 1) + ' name'" />
                  <button type="button" class="wf-icon-btn danger" [disabled]="switchStep().cases.length < 2" (click)="removeCase(i)" aria-label="Remove case">
                    <hugeicons-icon aria-hidden="true" [icon]="icons.Delete02Icon" [size]="14" [strokeWidth]="1.8" />
                  </button>
                </div>
                @if (switchToken()?.options?.length) {
                  <div class="multi">
                    @for (o of switchToken()!.options!; track o.value) {
                      <label class="opt"><input type="checkbox" [checked]="c.values.map(str).includes('' + o.value)" (change)="toggleCaseValue(i, o.value, $any($event.target).checked)" />{{ o.label }}</label>
                    }
                  </div>
                } @else {
                  <ui-input size="sm" [ngModel]="c.values.join(', ')" (ngModelChange)="setCase(i, { values: splitList($event) })" placeholder="Values, separated by commas" aria-label="Values" />
                }
              </div>
            }
            <div class="wf-row">
              <button type="button" class="wf-link" (click)="addCase()">Add a case</button>
              <label class="wf-row small"><ui-switch [ngModel]="!!switchStep().otherwise" (ngModelChange)="toggleOtherwise($event)" /> Otherwise path</label>
            </div>
          </div>
        }
        @case ('parallel') {
          <div class="wf-stack">
            @for (p of parallel().paths; track p.id; let i = $index) {
              <div class="wf-row">
                <ui-input class="grow" size="sm" [ngModel]="p.label" (ngModelChange)="setParallelLabel(i, $event)" [ariaLabel]="'Path ' + (i + 1) + ' name'" />
                <button type="button" class="wf-icon-btn danger" [disabled]="parallel().paths.length < 3" (click)="removeParallel(i)" aria-label="Remove path">
                  <hugeicons-icon aria-hidden="true" [icon]="icons.Delete02Icon" [size]="14" [strokeWidth]="1.8" />
                </button>
              </div>
            }
            @if (parallel().paths.length < 10) { <button type="button" class="wf-link" (click)="addParallel()">Add a path</button> }
            <div class="wf-grid2">
              <label class="lw"><span class="wf-label">Continue when</span>
                <select class="wf-select" (change)="patch({ join: { type: $any($event.target).value, count: parallel().join.count } })">
                  <option value="all" [selected]="parallel().join.type === 'all'">All paths finish</option>
                  <option value="any" [selected]="parallel().join.type === 'any'">The first path finishes</option>
                  <option value="count" [selected]="parallel().join.type === 'count'">A number of paths finish</option>
                </select></label>
              @if (parallel().join.type === 'count') {
                <label class="lw"><span class="wf-label">How many</span>
                  <ui-number-input size="sm" [ngModel]="parallel().join.count ?? 1" (ngModelChange)="patch({ join: { type: 'count', count: $event ?? 1 } })" [min]="1" [max]="parallel().paths.length" /></label>
              }
            </div>
            @if (parallel().join.type !== 'all') { <p class="wf-hint">Paths still running are stopped (their tasks are cancelled).</p> }
          </div>
        }
        @case ('forEach') {
          <div class="wf-stack">
            <label class="lw"><span class="wf-label">For each of</span>
              <select class="wf-select" (change)="patch({ collection: $any($event.target).value })">
                <option value="" [selected]="!forEach().collection" disabled>Choose a list…</option>
                @for (c of collections(); track c.path) { <option [value]="c.path" [selected]="c.path === forEach().collection">{{ c.label }}</option> }
              </select></label>
            <div><span class="wf-label">Only items where</span>
              <ui-wf-condition [value]="forEach().when" [tokens]="tokens()" emptyText="Every item." (valueChange)="patch({ when: $event.conditions.length ? $event : undefined })" /></div>
            <div class="wf-grid2">
              <label class="lw"><span class="wf-label">One at a time?</span>
                <select class="wf-select" (change)="patch({ mode: $any($event.target).value })">
                  <option value="sequential" [selected]="forEach().mode !== 'parallel'">One after another</option>
                  <option value="parallel" [selected]="forEach().mode === 'parallel'">At the same time</option>
                </select></label>
              <label class="lw"><span class="wf-label">At most</span>
                <ui-number-input size="sm" [ngModel]="forEach().max" (ngModelChange)="patch({ max: $event ?? 100 })" [min]="1" [max]="500" suffix="items" /></label>
            </div>
          </div>
        }
        @case ('wait') {
          <div class="wf-stack">
            <label class="lw"><span class="wf-label">Wait</span>
              <select class="wf-select" (change)="setWaitType($any($event.target).value)">
                <option value="duration" [selected]="wait().until.type === 'duration'">For a length of time</option>
                <option value="date" [selected]="wait().until.type === 'date'">Until a date</option>
                <option value="condition" [selected]="wait().until.type === 'condition'">Until something is true</option>
                <option value="signal" [selected]="wait().until.type === 'signal'">Until the app reports an event</option>
              </select></label>
            @switch (wait().until.type) {
              @case ('duration') {
                <ui-wf-duration [value]="$any(wait().until).duration" label="How long" (valueChange)="setUntil({ duration: $event })" />
                <label class="wf-row small"><ui-switch [ngModel]="$any(wait().until).calendar === 'working'" (ngModelChange)="setUntil({ calendar: $event ? 'working' : undefined })" /> Count working time only</label>
              }
              @case ('date') {
                <label class="lw"><span class="wf-label">The date</span>
                  <ui-wf-token-select [tokens]="tokens()" [types]="['date', 'dateTime']" [value]="dateRef()" (valueChange)="setUntil({ date: { ref: $event } })" /></label>
                <div><span class="wf-label">Shift it</span>
                  <ui-wf-duration [value]="$any(wait().until).offset ?? 'P0D'" [signed]="true" label="Offset" (valueChange)="setUntil({ offset: $event === 'P0D' ? undefined : $event })" /></div>
              }
              @case ('condition') {
                <ui-wf-condition [value]="$any(wait().until).when" [tokens]="tokens()" emptyText="Add the condition to wait for." (valueChange)="setUntil({ when: $event })" />
                <div><span class="wf-label">Give up after</span>
                  <ui-wf-duration [value]="$any(wait().until).timeout" label="Time limit" (valueChange)="setUntil({ timeout: $event })" /></div>
                <p class="wf-hint">Checked again whenever the record changes.</p>
              }
              @case ('signal') {
                <label class="lw"><span class="wf-label">Event</span>
                  <select class="wf-select" (change)="setUntil({ signal: $any($event.target).value })">
                    <option value="" disabled [selected]="!$any(wait().until).signal">Choose…</option>
                    @for (s of store.registry()?.signals ?? []; track s.key) { <option [value]="s.key" [selected]="s.key === $any(wait().until).signal">{{ s.label }}</option> }
                  </select></label>
                <label class="wf-row small"><ui-switch [ngModel]="!!$any(wait().until).timeout" (ngModelChange)="setUntil($event ? { timeout: 'P7D', onTimeout: { id: newId('l'), steps: [] } } : { timeout: undefined, onTimeout: undefined })" /> Give up after a while</label>
                @if ($any(wait().until).timeout) { <ui-wf-duration [value]="$any(wait().until).timeout" label="Time limit" (valueChange)="setUntil({ timeout: $event })" /> }
              }
            }
          </div>
        }
        @case ('setFields') {
          <div class="wf-stack">
            <label class="lw"><span class="wf-label">Record</span>
              <select class="wf-select" (change)="patch({ target: $any($event.target).value === 'self' ? undefined : $any($event.target).value, values: [] })">
                <option value="self" [selected]="!setFields().target || setFields().target === 'self'">This {{ entityLabel() }}</option>
                @for (r of relations(); track r.key) { <option [value]="'entity.' + r.key" [selected]="setFields().target === 'entity.' + r.key">{{ r.label }}</option> }
              </select></label>
            @for (v of setFields().values; track $index; let i = $index) {
              <div class="assign">
                <select class="wf-select" (change)="setFieldAt(i, $any($event.target).value)" [attr.aria-label]="'Field ' + (i + 1)">
                  <option value="" disabled [selected]="!v.field">Field…</option>
                  @for (f of settable(); track f.key) { <option [value]="f.key" [selected]="f.key === v.field">{{ f.label }}</option> }
                </select>
                <ui-wf-operand [value]="v.value" [field]="targetField(v.field)" [tokens]="tokens()" [label]="targetField(v.field)?.label ?? 'Value'" (valueChange)="setValueAt(i, $event)" />
                <button type="button" class="wf-icon-btn danger" (click)="removeValueAt(i)" aria-label="Remove">
                  <hugeicons-icon aria-hidden="true" [icon]="icons.Delete02Icon" [size]="14" [strokeWidth]="1.8" />
                </button>
              </div>
            }
            @if (settable().length) { <button type="button" class="wf-link" (click)="addValue()">Change another field</button> }
            @else { <p class="wf-hint">The app hasn’t allowed workflows to change any field of this record.</p> }
          </div>
        }
        @case ('setVariables') {
          <div class="wf-stack">
            @for (v of setVariables().values; track $index; let i = $index) {
              <div class="assign">
                <select class="wf-select" (change)="setVariableAt(i, $any($event.target).value)" [attr.aria-label]="'Variable ' + (i + 1)">
                  <option value="" disabled [selected]="!v.variable">Variable…</option>
                  @for (x of store.def().variables ?? []; track x.id) { <option [value]="x.id" [selected]="x.id === v.variable">{{ x.label }}</option> }
                </select>
                <ui-wf-operand [value]="v.value" [type]="variableType(v.variable)" [tokens]="tokens()" (valueChange)="setVariableValueAt(i, $event)" />
                <button type="button" class="wf-icon-btn danger" (click)="removeVariableAt(i)" aria-label="Remove">
                  <hugeicons-icon aria-hidden="true" [icon]="icons.Delete02Icon" [size]="14" [strokeWidth]="1.8" />
                </button>
              </div>
            }
            @if ((store.def().variables ?? []).length) { <button type="button" class="wf-link" (click)="addVariableValue()">Set another variable</button> }
            @else { <p class="wf-hint">Add variables in the workflow’s settings first.</p> }
          </div>
        }
        @case ('applyTransition') {
          <div class="wf-stack">
            <label class="lw"><span class="wf-label">Lifecycle</span>
              <select class="wf-select" (change)="patch({ lifecycle: $any($event.target).value, transition: '' })">
                <option value="" disabled [selected]="!applyTransition().lifecycle">Choose…</option>
                @for (l of lifecycles(); track l.key) { <option [value]="l.key" [selected]="l.key === applyTransition().lifecycle">{{ l.title }}</option> }
              </select></label>
            <label class="lw"><span class="wf-label">Transition (key)</span>
              <ui-input size="sm" [ngModel]="applyTransition().transition" (ngModelChange)="patch({ transition: $event }, 'transition')" placeholder="e.g. approve" /></label>
            <label class="lw"><span class="wf-label">If it isn’t possible</span>
              <select class="wf-select" (change)="patch({ ifNotAllowed: $any($event.target).value })">
                <option value="fail" [selected]="applyTransition().ifNotAllowed !== 'skip'">Stop with an error</option>
                <option value="skip" [selected]="applyTransition().ifNotAllowed === 'skip'">Skip it and carry on</option>
              </select></label>
          </div>
        }
        @case ('notify') {
          <div class="wf-stack">
            <label class="lw"><span class="wf-label">Send by</span>
              <select class="wf-select" (change)="patch({ channel: $any($event.target).value })">
                @for (c of store.registry()?.channels ?? []; track c.key) { <option [value]="c.key" [selected]="c.key === notify().channel">{{ c.label }}</option> }
              </select></label>
            <div><span class="wf-label">To</span>
              <ui-wf-assignees [value]="notify().to" [registry]="store.registry()" [tokens]="tokens()" [api]="store.api()" [allowEmail]="true" label="recipients"
                emptyText="Add who gets it." (valueChange)="patch({ to: $event })" /></div>
            <div><span class="wf-label">Subject</span>
              <ui-wf-template [value]="notify().subject" [tokens]="tokens()" [multiline]="false" label="Subject" (valueChange)="patch({ subject: $event }, 'subject')" /></div>
            <div><span class="wf-label">Message</span>
              <ui-wf-template [value]="notify().body" [tokens]="tokens()" label="Message" placeholder="Write the message. Insert values from the record or earlier steps." (valueChange)="patch({ body: $event }, 'body')" /></div>
            <label class="wf-row small"><ui-switch [ngModel]="notify().link === 'record'" (ngModelChange)="patch({ link: $event ? 'record' : undefined })" /> Include a link to the record</label>
          </div>
        }
        @case ('webhook') {
          <div class="wf-stack">
            @if (connections().length) {
              <label class="lw"><span class="wf-label">Connection</span>
                <select class="wf-select" (change)="setConnection($any($event.target).value)">
                  <option value="" [selected]="!webhook().connection">A web address</option>
                  @for (c of connections(); track c.key) { <option [value]="c.key" [selected]="c.key === webhook().connection">{{ c.label }}</option> }
                </select></label>
            }
            <div class="wf-grid2 method">
              <label class="lw"><span class="wf-label">Method</span>
                <select class="wf-select" (change)="patch({ method: $any($event.target).value })">
                  @for (m of methods; track m) { <option [value]="m" [selected]="m === webhook().method">{{ m }}</option> }
                </select></label>
              @if (!webhook().connection) {
                <label class="lw"><span class="wf-label">Address</span>
                  <ui-input size="sm" type="url" [ngModel]="webhook().url ?? ''" (ngModelChange)="patch({ url: $event }, 'url')" placeholder="https://…" /></label>
              }
            </div>
            <div><span class="wf-label">Path</span>
              <ui-wf-template [value]="webhook().path" [tokens]="tokens()" [multiline]="false" label="Path" placeholder="/orders/" (valueChange)="patch({ path: $event || undefined }, 'path')" /></div>
            <label class="lw"><span class="wf-label">Body (JSON; use {{ '{' }}"ref": "entity.title"{{ '}' }} for values)</span>
              <ui-textarea [ngModel]="bodyText()" (ngModelChange)="setBody($event)" [rows]="5" [invalid]="bodyInvalid()" /></label>
            @if (bodyInvalid()) { <p class="wf-error">That isn’t valid JSON yet.</p> }
            <p class="wf-hint">Only addresses allowed in the workflow settings can be called.</p>
          </div>
        }
        @case ('action') {
          <div class="wf-stack">
            <label class="lw"><span class="wf-label">Action</span>
              <select class="wf-select" (change)="patch({ action: $any($event.target).value, input: {} })">
                <option value="" disabled [selected]="!action().action">Choose…</option>
                @for (a of store.registry()?.actions ?? []; track a.key) { <option [value]="a.key" [selected]="a.key === action().action">{{ a.category ? a.category + ' › ' : '' }}{{ a.label }}</option> }
              </select></label>
            @if (actionDef(); as ad) {
              @if (ad.description) { <p class="wf-hint">{{ ad.description }}</p> }
              @for (p of ad.inputs; track p.key) {
                <div><span class="wf-label">{{ p.label }}{{ p.required ? ' *' : '' }}</span>
                  <ui-wf-operand [value]="action().input?.[p.key]" [type]="p.type" [field]="p.options ? { key: p.key, label: p.label, type: 'enum', options: p.options } : undefined"
                    [tokens]="tokens()" [label]="p.label" (valueChange)="setActionInput(p.key, $event)" /></div>
              }
              @if (ad.outputs.length) { <p class="wf-hint">Gives: {{ outputsText(ad.outputs) }}</p> }
            }
          </div>
        }
        @case ('subWorkflow') {
          <div class="wf-stack">
            <label class="lw"><span class="wf-label">Workflow</span>
              <select class="wf-select" (change)="patch({ workflow: $any($event.target).value })">
                <option value="" disabled [selected]="!subWorkflow().workflow">Choose…</option>
                @for (w of automations(); track w.key) { <option [value]="w.key" [selected]="w.key === subWorkflow().workflow">{{ w.title }}</option> }
              </select></label>
            <label class="wf-row small"><ui-switch [ngModel]="subWorkflow().wait" (ngModelChange)="patch({ wait: $event })" /> Wait for it to finish (and use its results)</label>
          </div>
        }
        @case ('goTo') {
          <div class="wf-stack">
            <label class="lw"><span class="wf-label">Go back to</span>
              <select class="wf-select" (change)="patch({ target: $any($event.target).value })">
                <option value="" disabled [selected]="!goTo().target">Choose a step…</option>
                @for (s of earlierSteps(); track s.id) { <option [value]="s.id" [selected]="s.id === goTo().target">{{ s.name }}</option> }
              </select></label>
            <label class="lw"><span class="wf-label">At most</span>
              <ui-number-input size="sm" [ngModel]="goTo().maxTimes" (ngModelChange)="patch({ maxTimes: $event ?? 1 })" [min]="1" [max]="50" suffix="times" /></label>
            <p class="wf-hint">After that it carries on to the next step.</p>
          </div>
        }
        @case ('end') {
          <div class="wf-stack">
            <label class="lw"><span class="wf-label">End as</span>
              <select class="wf-select" (change)="patch({ result: $any($event.target).value })">
                <option value="completed" [selected]="end().result === 'completed'">Finished</option>
                <option value="failed" [selected]="end().result === 'failed'">Failed</option>
              </select></label>
            <div><span class="wf-label">Reason</span>
              <ui-wf-template [value]="end().reason" [tokens]="tokens()" [multiline]="false" label="Reason" (valueChange)="patch({ reason: $event || undefined }, 'reason')" /></div>
          </div>
        }
      }

      @if (step().type === 'approval' || step().type === 'task') {
        <section class="wf-section wf-stack">
          <h4 class="wf-section-title">Deadline and reminders</h4>
          <div><span class="wf-label">Due within</span><ui-wf-duration [value]="human().due" label="Due" (valueChange)="patch({ due: $event })" /></div>
          <label class="wf-row small"><ui-switch [ngModel]="human().calendar === 'working'" (ngModelChange)="patch({ calendar: $event ? 'working' : undefined })" /> Count working time only</label>
          <div><span class="wf-label">Reminders</span>
            @for (r of human().reminders ?? []; track $index; let i = $index) {
              <div class="wf-row"><ui-wf-duration class="grow" [value]="r" label="Reminder" (valueChange)="setReminder(i, $event)" />
                <button type="button" class="wf-icon-btn danger" (click)="removeReminder(i)" aria-label="Remove reminder"><hugeicons-icon aria-hidden="true" [icon]="icons.Delete02Icon" [size]="14" [strokeWidth]="1.8" /></button></div>
            }
            <button type="button" class="wf-link" (click)="addReminder()">Add a reminder</button>
          </div>
          <label class="wf-row small"><ui-switch [ngModel]="!!human().escalation" (ngModelChange)="toggleEscalation($event)" /> Escalate if nobody decides</label>
          @if (human().escalation; as esc) {
            <div><span class="wf-label">After</span><ui-wf-duration [value]="esc.after" label="Escalate after" (valueChange)="patch({ escalation: { ...esc, after: $event } })" /></div>
            <div><span class="wf-label">Also give it to</span>
              <ui-wf-assignees [value]="esc.assignees" [registry]="store.registry()" [tokens]="tokens()" [api]="store.api()" [allowManagerOfAssignees]="true" label="escalation"
                (valueChange)="patch({ escalation: { ...esc, assignees: $any($event) } })" /></div>
          }
          <label class="wf-row small"><ui-switch [ngModel]="!!human().allowDelegation" (ngModelChange)="patch({ allowDelegation: $event || undefined })" /> Allow handing it to someone else</label>
        </section>
        <section class="wf-section wf-stack">
          <h4 class="wf-section-title">What they see</h4>
          <div><span class="wf-label">Instructions</span>
            <ui-wf-template [value]="human().instructions" [tokens]="tokens()" label="Instructions" (valueChange)="patch({ instructions: $event || undefined }, 'instructions')" /></div>
          <div><span class="wf-label">Questions to answer</span>
            <ui-wf-form-field [value]="human().form" [title]="(step().title || defaultName()) + ' form'" addLabel="Add questions (a form)" (valueChange)="patch({ form: $event })" /></div>
        </section>
      }

      @if (callsOut()) {
        <section class="wf-section wf-stack">
          <h4 class="wf-section-title">If it fails</h4>
          <div class="wf-grid2">
            <label class="lw"><span class="wf-label">Try again</span>
              <ui-number-input size="sm" [ngModel]="step().retry?.max ?? 0" (ngModelChange)="setRetries($event ?? 0)" [min]="0" [max]="10" suffix="times" /></label>
            @if ((step().retry?.max ?? 0) > 0) {
              <div><span class="wf-label">First wait</span><ui-wf-duration [value]="step().retry?.initial ?? 'PT1M'" label="Retry delay" (valueChange)="patch({ retry: { ...step().retry!, initial: $event, backoff: 'exponential' } })" /></div>
            }
          </div>
          <label class="lw"><span class="wf-label">Then</span>
            <select class="wf-select" (change)="setOnError($any($event.target).value)">
              <option value="stop" [selected]="onErrorMode() === 'stop'">Stop and tell an admin</option>
              <option value="continue" [selected]="onErrorMode() === 'continue'">Carry on with the next step</option>
              <option value="steps" [selected]="onErrorMode() === 'steps'">Run other steps</option>
            </select></label>
        </section>
      }

      <section class="wf-section">
        <label class="lw"><span class="wf-label">Note (only builders see it)</span>
          <ui-textarea [ngModel]="step().note ?? ''" (ngModelChange)="patch({ note: $event || undefined }, 'note')" [rows]="2" [autosize]="true" /></label>
      </section>
    </div>
  `,
  styles: [WF_SHARED_STYLES, `
    :host { display: block; }
    .lw { display: block; min-width: 0; }
    .grow { flex: 1; min-width: 0; }
    .small { font-size: 13px; color: var(--ui-color-text-secondary); gap: 8px; cursor: pointer; }
    .path { display: flex; flex-direction: column; gap: 6px; padding: 8px; border: 1px solid var(--ui-color-border-subtle, var(--ui-color-border)); border-radius: var(--ui-radius); }
    .outcome { display: grid; grid-template-columns: minmax(0, 1fr) 96px auto; gap: 6px; margin-bottom: 4px; align-items: center; }
    .tone { height: var(--ui-size-sm); font-size: 12px; }
    .assign { display: grid; grid-template-columns: minmax(0, 0.8fr) minmax(0, 1.4fr) auto; gap: 6px; align-items: center; }
    .multi { display: flex; flex-wrap: wrap; gap: 4px 10px; }
    .opt { display: inline-flex; align-items: center; gap: 5px; font-size: 13px; cursor: pointer; }
    .opt input { accent-color: var(--ui-color-primary); margin: 0; }
    .method { grid-template-columns: 96px minmax(0, 1fr); }
    @container (max-width: 300px) { .assign { grid-template-columns: 1fr auto; } .assign ui-wf-operand { grid-column: 1 / -1; } }
  `],
})
export class WfStepEditor {
  protected readonly store = inject(WfBuilderStore);
  readonly step = input.required<UiWfStep>();
  protected readonly icons = WF_ICONS;
  protected readonly tones = ['neutral', 'primary', 'success', 'warning', 'danger'];
  protected readonly methods = ['POST', 'PUT', 'PATCH', 'GET', 'DELETE'];
  protected readonly str = String;
  protected readonly newId = wfId;

  protected readonly tokens = computed<UiWfToken[]>(() => this.store.tokens({ stepId: this.step().id }));
  protected readonly defaultName = computed(() => stepName({ ...this.step(), title: undefined } as UiWfStep));
  protected readonly entityLabel = computed(() => this.store.entity()?.label.toLowerCase() ?? 'record');

  // Typed views of the step, for the template.
  protected readonly approval = computed(() => this.step() as UiWfApprovalStep);
  protected readonly task = computed(() => this.step() as UiWfTaskStep);
  protected readonly human = computed(() => this.step() as UiWfApprovalStep | UiWfTaskStep);
  protected readonly branch = computed(() => this.step() as UiWfBranchStep);
  protected readonly switchStep = computed(() => this.step() as UiWfSwitchStep);
  protected readonly parallel = computed(() => this.step() as UiWfParallelStep);
  protected readonly forEach = computed(() => this.step() as UiWfForEachStep);
  protected readonly wait = computed(() => this.step() as UiWfWaitStep);
  protected readonly setFields = computed(() => this.step() as UiWfSetFieldsStep);
  protected readonly setVariables = computed(() => this.step() as UiWfSetVariablesStep);
  protected readonly applyTransition = computed(() => this.step() as UiWfApplyTransitionStep);
  protected readonly notify = computed(() => this.step() as UiWfNotifyStep);
  protected readonly webhook = computed(() => this.step() as UiWfWebhookStep);
  protected readonly action = computed(() => this.step() as UiWfActionStep);
  protected readonly subWorkflow = computed(() => this.step() as UiWfSubWorkflowStep);
  protected readonly goTo = computed(() => this.step() as UiWfGoToStep);
  protected readonly end = computed(() => this.step() as UiWfEndStep);

  protected readonly callsOut = computed(() => ['action', 'webhook', 'subWorkflow'].includes(this.step().type));
  protected readonly onErrorMode = computed(() => { const e = this.step().onError; return !e ? 'stop' : typeof e === 'string' ? e : 'steps'; });
  protected readonly switchToken = computed(() => this.tokens().find((t) => t.path === this.switchStep().on));
  protected readonly collections = computed(() => collectionsOf(this.store.registry(), this.store.def().entity));
  protected readonly relations = computed(() => (this.store.entity()?.fields ?? []).filter((f) => f.type === 'relation' && f.entity));
  protected readonly targetEntity = computed(() => {
    const t = this.setFields().target;
    if (!t || t === 'self') return this.store.def().entity;
    return fieldOf(this.store.registry(), this.store.def().entity, t.split('.')[1])?.entity;
  });
  protected readonly settable = computed(() => (entityOf(this.store.registry(), this.targetEntity())?.fields ?? []).filter((f) => f.settable));
  protected readonly dateRef = computed(() => { const u = this.wait().until; return u.type === 'date' && 'ref' in u.date ? u.date.ref : null; });
  protected readonly connections = computed(() => this.store.settingsConnections());
  protected readonly actionDef = computed(() => this.store.registry()?.actions?.find((a) => a.key === this.action().action));
  protected readonly lifecycles = computed(() => [
    ...(this.store.def().kind === 'lifecycle' ? [{ key: this.store.def().key, title: `${this.store.def().title} (this one)` }] : []),
    ...this.store.others().filter((o) => o.kind === 'lifecycle' && o.key !== this.store.def().key && o.version > 0),
  ]);
  protected readonly automations = computed(() => this.store.others().filter((o) => o.kind === 'automation' && o.key !== this.store.def().key && o.version > 0));
  protected readonly earlierSteps = computed(() => goToTargets(this.store.def(), this.step().id).map((x) => ({ id: x.id, name: stepName(x) })));
  protected readonly bodyText = computed(() => (this.webhook().body === undefined ? '' : JSON.stringify(this.webhook().body, null, 2)));
  protected readonly bodyInvalid = signal(false);

  protected patch(patch: Partial<UiWfStep> | Record<string, unknown>, mergeKey?: string): void {
    this.store.updateStep(this.step().id, patch as Record<string, unknown>, mergeKey ? `${this.step().id}:${mergeKey}` : undefined);
  }

  protected targetField(key: string) {
    return fieldOf(this.store.registry(), this.targetEntity(), key);
  }

  protected variableType(id: string) {
    return this.store.def().variables?.find((v) => v.id === id)?.type;
  }

  protected outputsText(outs: { label: string }[]): string {
    return outs.map((o) => o.label).join(', ');
  }

  protected splitList(text: string): string[] {
    return text.split(',').map((s) => s.trim()).filter(Boolean);
  }

  // Approval and task
  protected setRule(type: UiWfApprovalStep['rule']['type']): void {
    this.patch({ rule: type === 'count' || type === 'percent' ? { type, value: type === 'percent' ? 50 : 2 } : { type } });
  }
  protected setOutcome(i: number, label: string): void {
    const outs = this.task().outcomes.map((o, j) => (j === i ? { ...o, label } : o));
    this.patch({ outcomes: outs }, `outcome${i}`);
  }
  protected setOutcomeTone(i: number, tone: string): void {
    this.patch({ outcomes: this.task().outcomes.map((o, j) => (j === i ? { ...o, tone: tone as UiWfTaskStep['outcomes'][number]['tone'] } : o)) });
  }
  protected addOutcome(): void {
    const keys = this.task().outcomes.map((o) => o.key);
    const label = `Option ${this.task().outcomes.length + 1}`;
    this.patch({ outcomes: [...this.task().outcomes, { id: wfId('o'), key: wfKey(label, keys), label, steps: [] }] });
  }
  protected removeOutcome(i: number): void {
    this.patch({ outcomes: this.task().outcomes.filter((_, j) => j !== i) });
  }
  protected setReminder(i: number, v: string): void {
    this.patch({ reminders: (this.human().reminders ?? []).map((r, j) => (j === i ? v : r)) });
  }
  protected removeReminder(i: number): void {
    const r = (this.human().reminders ?? []).filter((_, j) => j !== i);
    this.patch({ reminders: r.length ? r : undefined });
  }
  protected addReminder(): void {
    this.patch({ reminders: [...(this.human().reminders ?? []), 'P1D'] });
  }
  protected toggleEscalation(on: boolean): void {
    this.patch({ escalation: on ? { after: this.human().due || 'P2D', assignees: [{ managerOf: 'assignees' }] } : undefined });
  }

  // Branch and switch
  protected setPathLabel(i: number, label: string): void {
    this.patch({ paths: this.branch().paths.map((p, j) => (j === i ? { ...p, label } : p)) }, `path${i}`);
  }
  protected setPathWhen(i: number, when: UiWfBranchStep['paths'][number]['when']): void {
    this.patch({ paths: this.branch().paths.map((p, j) => (j === i ? { ...p, when } : p)) });
  }
  protected addPath(): void {
    this.patch({ paths: [...this.branch().paths, { id: wfId('p'), label: `Path ${this.branch().paths.length + 1}`, when: { match: 'all', conditions: [] }, steps: [] }] });
  }
  protected removePath(i: number): void {
    this.patch({ paths: this.branch().paths.filter((_, j) => j !== i) });
  }
  protected toggleOtherwise(on: boolean): void {
    this.patch({ otherwise: on ? { id: wfId('l'), label: 'Otherwise', steps: [] } : undefined });
  }
  protected setCase(i: number, p: Partial<UiWfSwitchStep['cases'][number]>): void {
    this.patch({ cases: this.switchStep().cases.map((c, j) => (j === i ? { ...c, ...p } : c)) }, `case${i}`);
  }
  protected toggleCaseValue(i: number, v: string | number, on: boolean): void {
    const c = this.switchStep().cases[i];
    const values = on ? [...c.values.filter((x) => String(x) !== String(v)), v] : c.values.filter((x) => String(x) !== String(v));
    this.setCase(i, { values });
  }
  protected addCase(): void {
    this.patch({ cases: [...this.switchStep().cases, { id: wfId('c'), label: `Case ${this.switchStep().cases.length + 1}`, values: [], steps: [] }] });
  }
  protected removeCase(i: number): void {
    this.patch({ cases: this.switchStep().cases.filter((_, j) => j !== i) });
  }

  // Parallel
  protected setParallelLabel(i: number, label: string): void {
    this.patch({ paths: this.parallel().paths.map((p, j) => (j === i ? { ...p, label } : p)) }, `ppath${i}`);
  }
  protected addParallel(): void {
    this.patch({ paths: [...this.parallel().paths, { id: wfId('p'), label: `Path ${this.parallel().paths.length + 1}`, steps: [] }] });
  }
  protected removeParallel(i: number): void {
    this.patch({ paths: this.parallel().paths.filter((_, j) => j !== i) });
  }

  // Wait
  protected setWaitType(type: UiWfWaitUntil['type']): void {
    const until: UiWfWaitUntil =
      type === 'duration' ? { type, duration: 'P1D' }
        : type === 'date' ? { type, date: { ref: '' } }
          : type === 'condition' ? { type, when: { match: 'all', conditions: [] }, timeout: 'P7D', onTimeout: { id: wfId('l'), steps: [] } }
            : { type, signal: this.store.registry()?.signals?.[0]?.key ?? '' };
    this.patch({ until });
  }
  protected setUntil(p: Record<string, unknown>): void {
    const next = { ...this.wait().until, ...p } as Record<string, unknown>;
    for (const k of Object.keys(next)) if (next[k] === undefined) delete next[k];
    this.patch({ until: next as unknown as UiWfWaitUntil });
  }

  // Set fields / variables
  protected addValue(): void {
    this.patch({ values: [...this.setFields().values, { field: '', value: { const: null } }] });
  }
  protected setFieldAt(i: number, field: string): void {
    this.patch({ values: this.setFields().values.map((v, j) => (j === i ? { field, value: { const: null } } : v)) });
  }
  protected setValueAt(i: number, value: UiWfSetFieldsStep['values'][number]['value']): void {
    this.patch({ values: this.setFields().values.map((v, j) => (j === i ? { ...v, value } : v)) }, `value${i}`);
  }
  protected removeValueAt(i: number): void {
    this.patch({ values: this.setFields().values.filter((_, j) => j !== i) });
  }
  protected addVariableValue(): void {
    this.patch({ values: [...this.setVariables().values, { variable: '', value: { const: null } }] });
  }
  protected setVariableAt(i: number, variable: string): void {
    this.patch({ values: this.setVariables().values.map((v, j) => (j === i ? { ...v, variable } : v)) });
  }
  protected setVariableValueAt(i: number, value: UiWfSetVariablesStep['values'][number]['value']): void {
    this.patch({ values: this.setVariables().values.map((v, j) => (j === i ? { ...v, value } : v)) }, `var${i}`);
  }
  protected removeVariableAt(i: number): void {
    this.patch({ values: this.setVariables().values.filter((_, j) => j !== i) });
  }

  // Webhook and action
  protected setConnection(key: string): void {
    this.patch(key ? { connection: key, url: undefined } : { connection: undefined, url: '' });
  }
  protected setBody(text: string): void {
    if (!text.trim()) {
      this.bodyInvalid.set(false);
      this.patch({ body: undefined }, 'body');
      return;
    }
    try {
      const body = JSON.parse(text);
      this.bodyInvalid.set(false);
      this.patch({ body }, 'body');
    } catch {
      this.bodyInvalid.set(true);
    }
  }
  protected setActionInput(key: string, value: NonNullable<UiWfActionStep['input']>[string]): void {
    this.patch({ input: { ...(this.action().input ?? {}), [key]: value } }, `input:${key}`);
  }

  // Failure handling
  protected setRetries(max: number): void {
    this.patch({ retry: max > 0 ? { ...(this.step().retry ?? { initial: 'PT1M', backoff: 'exponential' }), max } : undefined });
  }
  protected setOnError(mode: string): void {
    const onError: UiWfOnError | undefined = mode === 'continue' ? 'continue' : mode === 'steps' ? { steps: typeof this.step().onError === 'object' ? (this.step().onError as { steps: UiWfStep[] }).steps : [] } : undefined;
    this.patch({ onError });
  }
}
