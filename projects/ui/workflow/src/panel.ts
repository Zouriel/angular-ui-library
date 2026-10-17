import { Component, DestroyRef, computed, effect, inject, input, model, output, signal, untracked } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { HugeiconsIconComponent } from '@hugeicons/angular';
import { UiDrawer } from '@zouriel/ui/dialog';
import { UiStepBody, UiStepper, type UiStep } from '@zouriel/ui/navigation';
import type { UiWfAuditEntry, UiWfRecord, UiWorkflowApi } from './api';
import { WF_ICONS } from './icons';
import { WfRecordActions, WfRunView, UiWorkflowStateBadge } from './runtime';
import { WfWithApi, wfActorLabel, wfAuditJson, wfDescribeHistory, wfErrorText, wfReadableError, wfRunStatusLabel, wfRunStatusTone, wfStatePassed } from './runtime-shared';
import { WF_SHARED_STYLES } from './styles';

/**
 * How `ui-workflow-panel` sits on the page:
 * - `vertical`: a panel in the page, the states top to bottom with history and actions under each;
 * - `horizontal`: the states left to right, the current state's actions and the history below;
 * - `side-drawer`: a column of dots on the screen's edge that opens the vertical panel in a drawer;
 * - `bottom-drawer`: a row of dots along the bottom that opens the horizontal panel in a drawer.
 */
export type UiWorkflowPanelLayout = 'vertical' | 'horizontal' | 'compact' | 'side-drawer' | 'bottom-drawer';

/** One state on the record's path, with what happened while it was there. */
export interface UiWfPanelStep {
  key: string;
  label: string;
  /** History entries that happened in this state, oldest first. */
  entries: UiWfAuditEntry[];
}

/**
 * The states a record shows, in order: the states it has been through (first visit first), then,
 * unless it has finished, the states it hasn't reached yet in the lifecycle's order. The active one
 * is the current state; a state it went back from (sent back for changes) counts as not reached.
 */
export function wfPanelPath(r: UiWfRecord, history: readonly UiWfAuditEntry[]): { steps: UiWfPanelStep[]; active: number } {
  const label = (k: string) => r.states.find((s) => s.key === k)?.label ?? k;
  const steps: UiWfPanelStep[] = [];
  const byKey = new Map<string, UiWfPanelStep>();
  const visit = (k: string) => {
    let st = byKey.get(k);
    if (!st) { st = { key: k, label: label(k), entries: [] }; byKey.set(k, st); steps.push(st); }
    return st;
  };
  let here: UiWfPanelStep | null = null;
  for (const h of [...history].sort((a, b) => a.seq - b.seq)) {
    const entered = h.category === 'lifecycle' ? wfAuditJson(h.after)['state'] : undefined;
    if (typeof entered === 'string' && entered) here = visit(entered);
    // An entry belongs to the state the record was in when it happened (a move, to the state it entered).
    here?.entries.push(h);
  }
  if (r.state) visit(r.state);
  const active = r.state ? steps.findIndex((s) => s.key === r.state) : -1;
  const finished = r.states.find((s) => s.key === r.state)?.category === 'terminal';
  if (!finished) for (const s of r.states) if (!byKey.has(s.key)) visit(s.key);
  return { steps, active: Math.max(0, active) };
}

/**
 * `ui-workflow-panel` — the workflow of one record, to attach to the record's page: its states as a
 * stepper (green for states it has been through, dark for those not reached), what happened in each,
 * and in the current state the moves this person may make, open tasks and manual workflows.
 *
 * Choose where it sits with `layout`: `vertical` (a stepper with what happened in each state),
 * `horizontal` (states left to right, details below), `compact` (a badge, a strip of states, the
 * actions and a flat history, for a narrow column), or a drawer. The drawer layouts collapse to a rail
 * of dots on the screen's edge: hovering it opens the drawer on a desktop (moving away closes it),
 * tapping it does on touch. A record type with no lifecycle still shows its manual workflows, open
 * tasks and history.
 *
 * ```html
 * <ui-workflow-panel entity="application" [entityId]="app.id" layout="side-drawer" (changed)="reload()" />
 * ```
 */
@Component({
  selector: 'ui-workflow-panel',
  imports: [HugeiconsIconComponent, NgTemplateOutlet, UiDrawer, UiStepper, UiStepBody, UiWorkflowStateBadge, WfRecordActions, WfRunView],
  host: { '[attr.data-layout]': 'layout()' },
  template: `
    <!-- The record's workflows still running or stopped, each opening its steps (and, for people who may, try again, skip or cancel). -->
    <ng-template #runsTpl>
      @if (activeRuns().length) {
        <section class="runs" aria-label="Workflows running">
          <h3>Running</h3>
          @for (run of activeRuns(); track run.id) {
            <div class="run" [attr.data-status]="run.status">
              <button type="button" class="run-row" (click)="toggleRun(run.id)" [attr.aria-expanded]="openRuns().has(run.id)">
                <span class="wf-chip" [attr.data-tone]="runTone(run.status)">{{ runLabel(run.status) }}</span>
                <span class="rt">{{ run.title }}</span>
                <span class="rs">{{ run.status === 'incident' ? (readable(run.error) || 'Stopped') : 'since ' + ago(run.startedAt) }}</span>
                <hugeicons-icon class="chev" aria-hidden="true" [icon]="icons.ArrowDown01Icon" [size]="14" [strokeWidth]="1.8" />
              </button>
              @if (openRuns().has(run.id)) {
                <ui-wf-run-view class="run-view" [instanceId]="run.id" [api]="client()" [showHead]="false" (changed)="reload()" />
              }
            </div>
          }
        </section>
      }
    </ng-template>

    <ng-template #body let-mode>
      @if (record(); as r) {
        @if (!r.state || mode === 'compact') {
          <!-- Compact, or no lifecycle: the state as a badge and a strip, the actions, and one flat history. -->
          <div class="state">
            @if (r.state) {
              <ui-workflow-state-badge [label]="r.stateLabel ?? r.state" [tone]="r.stateTone" />
              <span class="since">since {{ ago(r.stateEnteredAt) }}</span>
              @if (r.status === 'outOfSync') { <span class="wf-chip" data-tone="warning">Out of sync</span> }
            } @else {
              <span class="wf-hint">No lifecycle for this record type.</span>
            }
          </div>
          @if (r.states.length > 1) {
            <ol class="track" aria-label="Lifecycle">
              @for (s of r.states; track s.key) {
                <li [class.here]="s.key === r.state" [class.done]="passed(r, s.key)" [attr.data-tone]="s.tone ?? 'neutral'"><span>{{ s.label }}</span></li>
              }
            </ol>
          }
          <ui-wf-record-actions class="now" [record]="r" [entity]="entity()" [entityId]="entityId()" [api]="client()" (changed)="moved($event)" (reload)="reload()" [emptyText]="r.state ? emptyText() : ''" />
          <ng-container *ngTemplateOutlet="runsTpl" />
          @if (showHistory()) {
            <section>
              <h3>History</h3>
              <ol class="log">
                @for (h of newestFirst(); track h.seq) {
                  <li><span class="hw">{{ describe(h) }}</span><span class="hm">{{ actor(h) }} · {{ ago(h.at) }}</span></li>
                } @empty { <li class="wf-hint">Nothing yet.</li> }
              </ol>
            </section>
          }
        } @else {
          <div class="state">
            <ui-workflow-state-badge [label]="r.stateLabel ?? r.state" [tone]="r.stateTone" />
            <span class="since">since {{ ago(r.stateEnteredAt) }}</span>
            @if (r.status === 'outOfSync') { <span class="wf-chip" data-tone="warning">Out of sync</span> }
          </div>
          @if (mode === 'vertical') {
            <ui-stepper class="steps" orientation="vertical" tone="success" [label]="title()" [steps]="stepLabels()" [active]="path().active">
              <ng-template uiStepBody let-i="index" let-state="state">
                @let st = path().steps[i];
                @if (showHistory() && st.entries.length) {
                  <ol class="log">
                    @for (h of st.entries; track h.seq) {
                      <li><span class="hw">{{ describe(h) }}</span><span class="hm">{{ actor(h) }} · {{ ago(h.at) }}</span></li>
                    }
                  </ol>
                }
                @if (state === 'active') {
                  <ui-wf-record-actions class="now" [record]="r" [entity]="entity()" [entityId]="entityId()" [api]="client()" (changed)="moved($event)" (reload)="reload()" [emptyText]="emptyText()" />
                  <ng-container *ngTemplateOutlet="runsTpl" />
                } @else if (state === 'todo' && !st.entries.length) {
                  <span class="wf-hint">Not reached yet</span>
                }
              </ng-template>
            </ui-stepper>
          } @else {
            <ui-stepper class="steps" tone="success" [label]="title()" [steps]="stepLabels()" [active]="path().active" />
            <ui-wf-record-actions class="now" [record]="r" [entity]="entity()" [entityId]="entityId()" [api]="client()" (changed)="moved($event)" (reload)="reload()" [emptyText]="emptyText()" />
            <ng-container *ngTemplateOutlet="runsTpl" />
            @if (showHistory() && history().length) {
              <section>
                <h3>History</h3>
                <ol class="log">
                  @for (h of recent(); track h.seq) {
                    <li><span class="hw">{{ describe(h) }}</span><span class="hm">{{ actor(h) }} · {{ ago(h.at) }}</span></li>
                  }
                </ol>
              </section>
            }
          }
        }
      } @else if (error()) {
        <p class="wf-error" role="alert">{{ error() }}</p>
      } @else {
        <p class="wf-hint">Loading…</p>
      }
    </ng-template>

    @switch (layout()) {
      @case ('vertical') {
        <h2 class="title">{{ title() }}</h2>
        <ng-container *ngTemplateOutlet="body; context: { $implicit: 'vertical' }" />
      }
      @case ('horizontal') {
        <h2 class="title">{{ title() }}</h2>
        <ng-container *ngTemplateOutlet="body; context: { $implicit: 'horizontal' }" />
      }
      @case ('compact') {
        @if (title()) { <h2 class="title">{{ title() }}</h2> }
        <ng-container *ngTemplateOutlet="body; context: { $implicit: 'compact' }" />
      }
      @default {
        <button type="button" class="rail" [attr.data-edge]="edge()" [attr.aria-expanded]="open()" [attr.aria-label]="railLabel()"
          (pointerenter)="hoverIn($event)" (pointerleave)="hoverOut($event)" (click)="toggle()">
          <ui-stepper variant="dots" tone="success" [orientation]="edge() === 'bottom' ? 'horizontal' : 'vertical'"
            [steps]="stepLabels()" [active]="path().active" aria-hidden="true" />
        </button>
        <ui-drawer [open]="open()" (openChange)="open.set($event)" [side]="edge()" [title]="title()" [modal]="!hoverOpened()"
          (panelEnter)="hoverIn()" (panelLeave)="hoverOut()">
          <div class="in-drawer">
            <ng-container *ngTemplateOutlet="body; context: { $implicit: edge() === 'bottom' ? 'horizontal' : 'vertical' }" />
          </div>
        </ui-drawer>
      }
    }
  `,
  styles: [WF_SHARED_STYLES, `
    :host { display: block; font-size: 13.5px; color: var(--ui-color-text); }
    :host([data-layout="vertical"]), :host([data-layout="horizontal"]), :host([data-layout="compact"]) { display: flex; flex-direction: column; gap: var(--ui-space-3); }
    .track { display: flex; flex-wrap: wrap; gap: 4px; margin: 0 0 var(--ui-space-2); padding: 0; list-style: none; }
    .track li { display: flex; align-items: center; height: 22px; padding: 0 8px; border-radius: 11px; font-size: 11.5px; color: var(--ui-color-text-muted); background: var(--ui-color-surface-hover); }
    .track li.done { color: var(--ui-color-text-secondary); }
    .track li.here { color: var(--ui-color-primary-contrast); background: var(--ui-color-primary); font-weight: 600; }
    /* Compact: the panel's own gap spaces the blocks, without the stepper layouts' margins on top. */
    :host([data-layout="compact"]) { gap: var(--ui-space-2); }
    :host([data-layout="compact"]) .state, :host([data-layout="compact"]) .track, :host([data-layout="compact"]) .now { margin: 0; }
    :host([data-layout="compact"]) h3 { margin-top: var(--ui-space-2); }
    .title { margin: 0; font-size: var(--ui-font-size-md); font-weight: 600; }
    .state { display: flex; align-items: center; gap: var(--ui-space-2); flex-wrap: wrap; margin-bottom: var(--ui-space-3); }
    .since { font-size: 12px; color: var(--ui-color-text-muted); }
    .steps { margin-bottom: var(--ui-space-3); }
    .now { margin-top: var(--ui-space-2); }
    h3 { margin: var(--ui-space-3) 0 6px; font-size: 11px; font-weight: 650; letter-spacing: 0.04em; text-transform: uppercase; color: var(--ui-color-text-muted); }
    .log { margin: 0; padding: 0; list-style: none; display: flex; flex-direction: column; gap: 4px; }
    .log li { display: flex; flex-direction: column; padding: 4px 0 4px 10px; border-left: 2px solid var(--ui-color-border); }
    .hw { font-size: 13px; }
    .hm { font-size: 11.5px; color: var(--ui-color-text-muted); }
    .in-drawer { display: flex; flex-direction: column; }
    .runs { display: flex; flex-direction: column; gap: var(--ui-space-2); margin-top: var(--ui-space-2); }
    .runs h3 { margin: 0; }
    .run { border: 1px solid var(--ui-color-border); border-radius: var(--ui-radius); background: var(--ui-color-surface); overflow: hidden; }
    .run[data-status="incident"] { border-color: color-mix(in srgb, var(--ui-color-danger) 45%, var(--ui-color-border)); }
    .run-row { display: grid; grid-template-columns: auto minmax(0, 1fr) auto; grid-template-rows: auto auto; align-items: center; gap: 2px var(--ui-space-2); width: 100%;
      padding: var(--ui-space-2) var(--ui-space-3); border: 0; background: transparent; color: var(--ui-color-text); font: inherit; text-align: left; cursor: pointer; }
    .run-row:hover { background: var(--ui-color-surface-hover); }
    .run-row:focus-visible { outline: none; box-shadow: inset var(--ui-focus-ring); }
    .rt { font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .rs { grid-column: 1 / 3; font-size: 12px; color: var(--ui-color-text-muted); overflow-wrap: anywhere; }
    .run[data-status="incident"] .rs { color: var(--ui-color-danger); }
    .chev { grid-row: 1 / 3; grid-column: 3; transition: transform var(--ui-motion-fast) var(--ui-ease-standard); }
    .run-row[aria-expanded="true"] .chev { transform: rotate(180deg); }
    .run-view { display: flex; padding: var(--ui-space-2) var(--ui-space-3) var(--ui-space-3); border-top: 1px solid var(--ui-color-border); }

    /* The rail: the record's states as dots on the screen's edge. Hover (desktop) or tap opens the drawer. */
    .rail { position: fixed; z-index: var(--ui-z-docked); display: flex; align-items: center; justify-content: center; margin: 0; cursor: pointer;
      padding: var(--ui-space-3) var(--ui-space-2); border: 1px solid var(--ui-color-border); background: var(--ui-color-surface-raised, var(--ui-color-surface));
      box-shadow: var(--ui-shadow-2); color: var(--ui-color-text); font: inherit; touch-action: manipulation; }
    .rail:focus-visible { outline: none; box-shadow: var(--ui-focus-ring); }
    .rail[data-edge="right"] { right: 0; top: 50%; transform: translateY(-50%); border-right: 0; border-radius: var(--ui-radius-lg) 0 0 var(--ui-radius-lg); }
    .rail[data-edge="left"] { left: 0; top: 50%; transform: translateY(-50%); border-left: 0; border-radius: 0 var(--ui-radius-lg) var(--ui-radius-lg) 0; }
    .rail[data-edge="bottom"] { bottom: 0; left: 50%; transform: translateX(-50%); padding: var(--ui-space-2) var(--ui-space-3); border-bottom: 0;
      border-radius: var(--ui-radius-lg) var(--ui-radius-lg) 0 0; padding-bottom: calc(var(--ui-space-2) + env(safe-area-inset-bottom)); }
    /* Fingers need a bigger target than the dots. */
    @media (pointer: coarse) { .rail { min-width: var(--ui-size-touch); min-height: var(--ui-size-touch); } }
  `],
})
export class UiWorkflowPanel extends WfWithApi {
  readonly entity = input.required<string>();
  readonly entityId = input.required<string>();
  readonly layout = input<UiWorkflowPanelLayout>('vertical');
  /** Which edge the side drawer opens from. */
  readonly side = input<'right' | 'left'>('right');
  /** The panel's heading (and the drawer's title). */
  readonly title = input('Workflow');
  readonly showHistory = input(true);
  /** Said in the current state when this person has nothing to do there; empty hides it. */
  readonly emptyText = input('Nothing for you to do here right now.');
  /** Whether the drawer is open (drawer layouts). Two-way. */
  readonly open = model(false);
  /** Fired after the record moved through the panel, so the page can reload its own data. */
  readonly changed = output<UiWfRecord>();

  protected readonly record = signal<UiWfRecord | null>(null);
  protected readonly history = signal<UiWfAuditEntry[]>([]);
  protected readonly error = signal('');
  /** The drawer was opened by hovering the rail: it stays non-modal and closes when the pointer leaves. */
  protected readonly hoverOpened = signal(false);
  private seq = 0;
  private closeTimer: ReturnType<typeof setTimeout> | undefined;

  protected readonly edge = computed(() => (this.layout() === 'bottom-drawer' ? 'bottom' : this.side()));
  protected readonly path = computed(() => {
    const r = this.record();
    return r ? wfPanelPath(r, this.history()) : { steps: [], active: 0 };
  });
  /** The states as steps; a record type with no lifecycle still gets one dot, so a drawer's rail can open. */
  protected readonly stepLabels = computed<UiStep[]>(() => {
    const steps = this.path().steps.map((s) => ({ label: s.label }));
    return steps.length || !this.record() ? steps : [{ label: this.title() || 'Workflow' }];
  });
  protected readonly newestFirst = computed(() => [...this.history()].sort((a, b) => b.seq - a.seq));
  protected readonly recent = computed(() => this.newestFirst().slice(0, 8));
  protected readonly passed = wfStatePassed;
  protected readonly icons = WF_ICONS;
  protected readonly runLabel = wfRunStatusLabel;
  protected readonly runTone = wfRunStatusTone;
  protected readonly readable = wfReadableError;
  /** The record's workflows still running or stopped, stopped ones first. */
  protected readonly activeRuns = computed(() =>
    (this.record()?.instances ?? []).filter((i) => ['queued', 'running', 'waiting', 'incident'].includes(i.status))
      .sort((a, b) => Number(b.status === 'incident') - Number(a.status === 'incident')));
  /** Runs shown open: a stopped run opens by itself the first time it is seen, so what to do is in view. */
  protected readonly openRuns = signal<ReadonlySet<string>>(new Set());
  private readonly seenStopped = new Set<string>();

  protected toggleRun(id: string): void {
    const next = new Set(this.openRuns());
    if (next.has(id)) next.delete(id); else next.add(id);
    this.openRuns.set(next);
  }
  protected readonly railLabel = computed(() => {
    const { steps, active } = this.path();
    const now = steps[active]?.label;
    return `${this.title()}${now ? `: ${now}, step ${active + 1} of ${steps.length}` : ''}. ${this.open() ? 'Close' : 'Open'}`;
  });

  constructor() {
    super();
    effect(() => {
      const api = this.client();
      const e = this.entity(), id = this.entityId();
      if (api) untracked(() => void this.load(api, e, id));
    });
    // Closing by any route (Escape, the close button, a tap outside) ends a hover-opened peek.
    effect(() => { if (!this.open()) untracked(() => this.hoverOpened.set(false)); });
    inject(DestroyRef).onDestroy(() => clearTimeout(this.closeTimer));
  }

  /** Reloads the record and its history (e.g. after the page changed the record itself). */
  async reload(): Promise<void> {
    const api = this.client();
    if (api) await this.load(api, this.entity(), this.entityId());
  }

  private async load(api: UiWorkflowApi, entity: string, id: string): Promise<void> {
    const n = ++this.seq;
    try {
      const [record, history] = await Promise.all([api.record(entity, id), this.showHistory() ? api.recordHistory(entity, id, 100).catch(() => []) : Promise.resolve([])]);
      if (n !== this.seq) return;
      this.record.set(record);
      this.history.set(history);
      this.error.set('');
      const stopped = record.instances.filter((i) => i.status === 'incident' && !this.seenStopped.has(i.id)).map((i) => i.id);
      if (stopped.length) {
        stopped.forEach((id) => this.seenStopped.add(id));
        this.openRuns.set(new Set([...this.openRuns(), ...stopped]));
      }
    } catch (e) {
      if (n === this.seq) this.error.set(wfErrorText(e, 'Could not load the record’s workflow.'));
    }
  }

  protected async moved(r: UiWfRecord): Promise<void> {
    this.record.set(r);
    this.changed.emit(r);
    await this.reload();
  }

  protected actor(h: UiWfAuditEntry): string {
    return wfActorLabel(h, (k) => this.record()?.instances.find((i) => i.definitionKey === k)?.title);
  }

  protected describe(h: UiWfAuditEntry): string {
    return wfDescribeHistory(h, (k) => this.record()?.states.find((s) => s.key === k)?.label ?? String(k ?? ''));
  }

  /** Hover opens the drawer only with a real hovering pointer (a mouse or trackpad), never a finger. */
  protected hoverIn(e?: PointerEvent): void {
    clearTimeout(this.closeTimer);
    if (!e || e.pointerType !== 'mouse' || this.open()) return;
    this.hoverOpened.set(true);
    this.open.set(true);
  }

  /** Leaving the rail and the drawer closes a hover-opened drawer, after a moment to cross the gap. */
  protected hoverOut(e?: PointerEvent): void {
    if (e && e.pointerType !== 'mouse') return;
    if (!this.hoverOpened()) return;
    clearTimeout(this.closeTimer);
    this.closeTimer = setTimeout(() => this.open.set(false), 300);
  }

  /** A tap, a click or Enter on the rail: open as a regular drawer, or close. */
  protected toggle(): void {
    clearTimeout(this.closeTimer);
    if (this.open() && !this.hoverOpened()) { this.open.set(false); return; }
    // A click on the rail of a hover-opened drawer pins it open as a regular one.
    this.hoverOpened.set(false);
    this.open.set(true);
  }
}
