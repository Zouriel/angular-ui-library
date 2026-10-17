import { Component, DestroyRef, computed, effect, inject, input, model, output, signal, untracked } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { HugeiconsIconComponent } from '@hugeicons/angular';
import { UiDrawer } from '@zouriel/ui/dialog';
import { UiStepBody, UiStepper, type UiStep } from '@zouriel/ui/navigation';
import type { UiWfAuditEntry, UiWfRecord, UiWorkflowApi } from './api';
import { WF_ICONS } from './icons';
import { WfRecordActions, WfRunView, UiWorkflowStateBadge } from './runtime';
import { WfWithApi, wfActorLabel, wfAuditJson, wfDescribeHistory, wfErrorText, wfReadableError, wfRunLabel, wfRunNeedsAttention, wfRunTone, wfStatePassed } from './runtime-shared';
import { WF_SHARED_STYLES } from './styles';

/**
 * How `ui-workflow-panel` sits on the page:
 * - `vertical`: a panel in the page, the states top to bottom with history and actions under each;
 * - `horizontal`: the states left to right, the current state's actions and the history below;
 * - `compact`: a state badge, a strip of the states, the actions and one flat history, for a narrow column;
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
 *
 * After a reset the path starts again: what happened before the latest reset is returned apart, in
 * `earlier` (oldest first), so states visited only before starting over show as not reached. When the
 * history is cut short (only the newest entries), entries before its first move belong to the state
 * that move left.
 */
export function wfPanelPath(r: UiWfRecord, history: readonly UiWfAuditEntry[]): { steps: UiWfPanelStep[]; active: number; earlier: UiWfAuditEntry[] } {
  const label = (k: string) => r.states.find((s) => s.key === k)?.label ?? k;
  const steps: UiWfPanelStep[] = [];
  const byKey = new Map<string, UiWfPanelStep>();
  const visit = (k: string) => {
    let st = byKey.get(k);
    if (!st) { st = { key: k, label: label(k), entries: [] }; byKey.set(k, st); steps.push(st); }
    return st;
  };
  const sorted = [...history].sort((a, b) => a.seq - b.seq);
  const lastReset = sorted.reduce((at, h, i) => (h.category === 'lifecycle' && h.action === 'reset' ? i : at), -1);
  const earlier = lastReset > 0 ? sorted.slice(0, lastReset) : [];
  const current = lastReset > 0 ? sorted.slice(lastReset) : sorted;
  const entered = (h: UiWfAuditEntry) => {
    const s = h.category === 'lifecycle' ? wfAuditJson(h.after)['state'] : undefined;
    return typeof s === 'string' && s ? s : null;
  };
  // A cut-short history may begin mid-state: the first move says which state it left.
  const firstMove = current.find((h) => entered(h));
  const left = firstMove ? wfAuditJson(firstMove.before)['state'] : undefined;
  let here: UiWfPanelStep | null = firstMove && firstMove !== current[0] && typeof left === 'string' && left ? visit(left) : null;
  for (const h of current) {
    const k = entered(h);
    if (k) here = visit(k);
    // An entry belongs to the state the record was in when it happened (a move, to the state it entered).
    here?.entries.push(h);
  }
  if (r.state) visit(r.state);
  const active = r.state ? steps.findIndex((s) => s.key === r.state) : -1;
  const finished = r.states.find((s) => s.key === r.state)?.category === 'terminal';
  if (!finished) for (const s of r.states) if (!byKey.has(s.key)) visit(s.key);
  return { steps, active: Math.max(0, active), earlier };
}

/** What `changed` compares between two reads: the state, its status, and each run's status. */
function wfRecordSignature(r: UiWfRecord): string {
  return JSON.stringify([r.state, r.status, r.instances.map((i) => `${i.id}:${i.status}`).sort()]);
}

/** How many history entries the panel reads; the engine returns the newest ones. */
export const WF_PANEL_HISTORY_TAKE = 500;
/** How often the panel looks again while one of the record's runs is still going (ms). */
const RUNS_POLL_MS = 15_000;

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
        <section class="runs" [attr.aria-label]="runsHeading()">
          <h3>{{ runsHeading() }}</h3>
          @for (run of activeRuns(); track run.id) {
            <div class="run" [attr.data-status]="run.status" [attr.data-attention]="attention(run) ? '' : null">
              <button type="button" class="run-row" (click)="toggleRun(run.id)" [attr.aria-expanded]="openRuns().has(run.id)">
                <span class="wf-chip" [attr.data-tone]="runTone(run)">{{ runLabel(run) }}</span>
                <span class="rt">{{ run.title }}</span>
                <span class="rs">{{ attention(run) ? (readable(run.error) || 'Stopped') : 'since ' + ago(run.startedAt) }}</span>
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
      @if (record() && error()) {
        <!-- A reload failed: what is shown may be out of date. -->
        <p class="wf-error stale" role="alert">{{ error() }} What is shown may be out of date. <button type="button" class="wf-link" (click)="reload()">Try again</button></p>
      }
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
                } @empty { <li class="wf-hint">{{ historyError() ? 'The history could not be loaded.' : 'Nothing yet.' }}</li> }
              </ol>
              @if (historyNote(); as note) { <p class="wf-hint">{{ note }}</p> }
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
            @if (showHistory() && path().earlier.length) {
              <details class="earlier">
                <summary>Earlier, before starting over ({{ path().earlier.length }})</summary>
                <ol class="log">
                  @for (h of path().earlier; track h.seq) {
                    <li><span class="hw">{{ describe(h) }}</span><span class="hm">{{ actor(h) }} · {{ ago(h.at) }}</span></li>
                  }
                </ol>
              </details>
            }
            @if (showHistory() && (historyError() || historyNote())) { <p class="wf-hint">{{ historyError() ? 'The history could not be loaded.' : historyNote() }}</p> }
          } @else {
            <ui-stepper class="steps" tone="success" [label]="title()" [steps]="stepLabels()" [active]="path().active" />
            <ui-wf-record-actions class="now" [record]="r" [entity]="entity()" [entityId]="entityId()" [api]="client()" (changed)="moved($event)" (reload)="reload()" [emptyText]="emptyText()" />
            <ng-container *ngTemplateOutlet="runsTpl" />
            @if (showHistory() && historyError()) { <p class="wf-hint">The history could not be loaded.</p> }
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
    /* Passed states read as done (a tint of success, like the stepper's), not as not reached. */
    .track li.done { color: var(--ui-color-success); background: color-mix(in srgb, var(--ui-color-success) 12%, transparent); }
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
    .stale { margin: 0 0 var(--ui-space-2); }
    .earlier { margin-bottom: var(--ui-space-3); }
    .earlier summary { cursor: pointer; font-size: 12.5px; color: var(--ui-color-text-secondary); margin-bottom: var(--ui-space-2); }
    .runs { display: flex; flex-direction: column; gap: var(--ui-space-2); margin-top: var(--ui-space-2); }
    .runs h3 { margin: 0; }
    .run { border: 1px solid var(--ui-color-border); border-radius: var(--ui-radius); background: var(--ui-color-surface); overflow: hidden; }
    .run[data-attention] { border-color: color-mix(in srgb, var(--ui-color-danger) 45%, var(--ui-color-border)); }
    .run-row { display: grid; grid-template-columns: auto minmax(0, 1fr) auto; grid-template-rows: auto auto; align-items: center; gap: 2px var(--ui-space-2); width: 100%;
      padding: var(--ui-space-2) var(--ui-space-3); border: 0; background: transparent; color: var(--ui-color-text); font: inherit; text-align: left; cursor: pointer; }
    .run-row:hover { background: var(--ui-color-surface-hover); }
    .run-row:focus-visible { outline: none; box-shadow: inset var(--ui-focus-ring); }
    .rt { font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .rs { grid-column: 1 / 3; font-size: 12px; color: var(--ui-color-text-muted); overflow-wrap: anywhere; }
    .run[data-attention] .rs { color: var(--ui-color-danger); }
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
  /**
   * Fired whenever the record's workflow changed as the panel saw it: a move made in the panel, and
   * any reload that finds a new state or status or runs that started, finished or stopped (after a
   * decision, a manual start, a retry, skip or cancel, or the panel looking again while runs go on).
   */
  readonly changed = output<UiWfRecord>();

  protected readonly record = signal<UiWfRecord | null>(null);
  protected readonly history = signal<UiWfAuditEntry[]>([]);
  /** The history could not be read (the record could). */
  protected readonly historyError = signal(false);
  protected readonly error = signal('');
  /** Said under the history when only the newest entries were read. */
  protected readonly historyNote = computed(() =>
    this.history().length >= WF_PANEL_HISTORY_TAKE ? `Showing the latest ${WF_PANEL_HISTORY_TAKE} entries.` : '');
  /** The drawer was opened by hovering the rail: it stays non-modal and closes when the pointer leaves. */
  protected readonly hoverOpened = signal(false);
  private seq = 0;
  private closeTimer: ReturnType<typeof setTimeout> | undefined;

  protected readonly edge = computed(() => (this.layout() === 'bottom-drawer' ? 'bottom' : this.side()));
  protected readonly path = computed(() => {
    const r = this.record();
    return r ? wfPanelPath(r, this.history()) : { steps: [], active: 0, earlier: [] as UiWfAuditEntry[] };
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
  protected readonly runLabel = wfRunLabel;
  protected readonly runTone = wfRunTone;
  /** Stopped on an error, or parked with one while still waiting (a timer failed ten times): someone should look. */
  protected readonly attention = wfRunNeedsAttention;
  protected readonly readable = wfReadableError;
  /** The record's workflows still running or stopped, the ones needing attention (stopped or parked) first. */
  protected readonly activeRuns = computed(() =>
    (this.record()?.instances ?? []).filter((i) => ['queued', 'running', 'waiting', 'incident'].includes(i.status))
      .sort((a, b) => Number(wfRunNeedsAttention(b)) - Number(wfRunNeedsAttention(a))));
  /** "Stopped" when every listed run stopped on an error, "Needs attention" when each stopped or is parked, else "Running". */
  protected readonly runsHeading = computed(() => {
    const runs = this.activeRuns();
    return runs.every((r) => r.status === 'incident') ? 'Stopped' : runs.every(wfRunNeedsAttention) ? 'Needs attention' : 'Running';
  });
  /** Runs shown open: a stopped (or parked) run opens by itself the first time it is seen, so what to do is in view. */
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

  /** The record the shown data belongs to (`entity/id`), so a switch can tell itself apart from a reload. */
  private shownKey = '';
  /** Whether the page is visible: looking again for running runs pauses while it is hidden. */
  private readonly visible = signal(typeof document === 'undefined' || document.visibilityState !== 'hidden');
  /** Some run of the record is still going (queued, running or waiting): worth looking again. */
  private readonly runsGoing = computed(() => this.activeRuns().some((r) => r.status !== 'incident'));

  constructor() {
    super();
    effect(() => {
      const api = this.client();
      const e = this.entity(), id = this.entityId();
      untracked(() => {
        // Another record: drop the old one at once, so its buttons and history never show for the new one.
        if (`${e}/${id}` !== this.shownKey) {
          this.shownKey = `${e}/${id}`;
          this.seq++;
          this.record.set(null);
          this.history.set([]);
          this.historyError.set(false);
          this.error.set('');
          this.openRuns.set(new Set());
          this.seenStopped.clear();
        }
        if (api) void this.load(api, e, id);
      });
    });
    // Closing by any route (Escape, the close button, a tap outside) ends a hover-opened peek.
    effect(() => { if (!this.open()) untracked(() => this.hoverOpened.set(false)); });
    // While a run is still going, look again now and then (not while the page is hidden).
    const destroy = inject(DestroyRef);
    let poll: ReturnType<typeof setInterval> | null = null;
    const stopPoll = () => { if (poll) clearInterval(poll); poll = null; };
    effect(() => {
      const go = this.runsGoing() && this.visible();
      untracked(() => { stopPoll(); if (go) poll = setInterval(() => void this.reload(), RUNS_POLL_MS); });
    });
    if (typeof document !== 'undefined') {
      const onVisibility = () => this.visible.set(document.visibilityState !== 'hidden');
      document.addEventListener('visibilitychange', onVisibility);
      destroy.onDestroy(() => document.removeEventListener('visibilitychange', onVisibility));
    }
    destroy.onDestroy(() => { clearTimeout(this.closeTimer); stopPoll(); });
  }

  /** Reloads the record and its history (e.g. after the page changed the record itself). */
  async reload(): Promise<void> {
    const api = this.client();
    if (api) await this.load(api, this.entity(), this.entityId());
  }

  private async load(api: UiWorkflowApi, entity: string, id: string): Promise<void> {
    const n = ++this.seq;
    try {
      let historyFailed = false;
      const [record, history] = await Promise.all([
        api.record(entity, id),
        this.showHistory() ? api.recordHistory(entity, id, WF_PANEL_HISTORY_TAKE).catch(() => { historyFailed = true; return [] as UiWfAuditEntry[]; }) : Promise.resolve([]),
      ]);
      if (n !== this.seq) return;
      const before = this.record();
      this.record.set(record);
      // A failed history read keeps what was shown rather than emptying it.
      if (!historyFailed) this.history.set(history);
      this.historyError.set(historyFailed);
      this.error.set('');
      if (before && wfRecordSignature(before) !== wfRecordSignature(record)) this.changed.emit(record);
      const stopped = record.instances.filter((i) => wfRunNeedsAttention(i) && !this.seenStopped.has(i.id)).map((i) => i.id);
      if (stopped.length) {
        stopped.forEach((id) => this.seenStopped.add(id));
        this.openRuns.set(new Set([...this.openRuns(), ...stopped]));
      }
    } catch (e) {
      if (n === this.seq) this.error.set(wfErrorText(e, 'Could not load the record’s workflow.'));
    }
  }

  /** A move made here: the record the engine answered with, then a fresh read for its history. */
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
