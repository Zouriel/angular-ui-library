import { Component, DestroyRef, ElementRef, computed, effect, inject, input, model, output, signal, untracked } from '@angular/core';
import { HugeiconsIconComponent } from '@hugeicons/angular';
import { UiButton, UiSegmented } from '@zouriel/ui/button';
import { UiBottomSheet, UiModal } from '@zouriel/ui/dialog';
import { UiWfApiError, injectWorkflowApi, type UiWfDefinitionSummary, type UiWfProblem, type UiWorkflowApi } from './api';
import { WfAutomationCanvas, WfBuilderUi, WfStepPicker, type WfLayout } from './canvas';
import { createWorkflow, indexSteps, stepName, stepReferences } from './definition';
import { WfDnd } from './dnd';
import { WF_ICONS } from './icons';
import { WfInspector } from './inspector';
import { WfLifecycleCanvas, WfLifecycleRuns } from './lifecycle';
import { WfTest, WfVersions } from './panels';
import type { UiWfStepType, UiWorkflowDefinition, UiWorkflowSchema, UiWorkflowSettings } from './schema';
import { WfBuilderStore } from './store';
import { WF_SHARED_STYLES } from './styles';

type View = 'build' | 'versions' | 'test';

interface PendingDelete {
  kind: 'step' | 'state' | 'transition';
  id: string;
  name: string;
  detail: string[];
}

/**
 * `ui-workflow-builder` — design workflows for non-technical admins. Automations are a trigger and
 * a list of steps (approvals, waits, branches, parallel paths, loops, messages, record updates,
 * app actions…) with branches drawn as columns; lifecycles are a diagram of states and the
 * transitions between them, each with who may apply it, checks, a form and the steps it runs.
 *
 * Bind `[(definition)]` (plain JSON, the Zouriel Workflows spec format). Give it the engine's API
 * with `provideUiWorkflow({ baseUrl })` (or the `api` input) and it loads the app's record types,
 * checks the workflow as you edit, saves, publishes and runs tests. Without an API, pass `schema`
 * yourself; it then works offline (no problems list, versions or tests).
 */
@Component({
  selector: 'ui-workflow-builder',
  providers: [WfBuilderStore, WfDnd, WfBuilderUi],
  imports: [HugeiconsIconComponent, UiButton, UiSegmented, UiModal, UiBottomSheet, WfAutomationCanvas, WfInspector, WfStepPicker, WfLifecycleCanvas, WfLifecycleRuns, WfVersions, WfTest],
  host: {
    class: 'ui-workflow-builder',
    '[attr.data-layout]': 'ui.layout()',
    '[attr.data-kind]': 'store.def().kind',
    '(keydown)': 'shortcuts($event)',
  },
  template: `
    <header class="top">
      <button type="button" class="title" (click)="store.selection.set({ kind: 'workflow' }); ui.inspectRequest.update(increment)" title="Workflow settings">
        <span class="kind">{{ store.def().kind === 'lifecycle' ? 'Lifecycle' : 'Automation' }}</span>
        <span class="name">{{ store.def().title || 'Untitled workflow' }}</span>
      </button>
      <ui-segmented class="views" size="sm" label="View" [options]="viewOptions()" [value]="view()" (valueChange)="view.set($any($event))" />
      <div class="tools">
        <button type="button" class="wf-icon-btn" [disabled]="!store.canUndo()" (click)="store.undo()" aria-label="Undo" title="Undo (Ctrl+Z)">
          <hugeicons-icon aria-hidden="true" [icon]="icons.Undo02Icon" [size]="16" [strokeWidth]="1.8" />
        </button>
        <button type="button" class="wf-icon-btn" [disabled]="!store.canRedo()" (click)="store.redo()" aria-label="Redo" title="Redo (Ctrl+Shift+Z)">
          <hugeicons-icon aria-hidden="true" [icon]="icons.Redo02Icon" [size]="16" [strokeWidth]="1.8" />
        </button>
        @if (store.errorCount()) {
          <button type="button" class="issues" (click)="showProblems.set(true)" [attr.aria-label]="store.errorCount() + ' problems to fix'">
            <hugeicons-icon aria-hidden="true" [icon]="icons.Alert02Icon" [size]="13" [strokeWidth]="1.9" />{{ store.errorCount() }}
          </button>
        } @else if (store.api() && !store.validating()) {
          <span class="ok" title="No problems found"><hugeicons-icon aria-hidden="true" [icon]="icons.Tick02Icon" [size]="13" [strokeWidth]="2" /><span class="ok-word">Ready</span></span>
        }
        @if (persist() && store.api()) {
          <span class="save-state" aria-live="polite">{{ saveState() }}</span>
          <ui-button size="sm" variant="outline" (click)="save()" [disabled]="saving() || !dirty()">Save</ui-button>
          <ui-button size="sm" (click)="view.set('versions')">Publish…</ui-button>
        }
        <ng-content select="[wfActions]" />
      </div>
    </header>

    @if (saveError()) { <div class="banner" role="alert">{{ saveError() }} <button type="button" class="wf-link" (click)="saveError.set('')">Dismiss</button></div> }

    <div class="main">
      @switch (view()) {
        @case ('build') {
          @if (ui.layout() === 'wide') {
            <aside class="pane left" aria-label="Steps to add">
              <h2 class="pane-title">Add a step</h2>
              <ui-wf-step-picker (chosen)="addFromPalette($event)" />
            </aside>
          }
          @if (store.def().kind === 'lifecycle') {
            <div class="center split">
              <ui-wf-lifecycle-canvas class="diagram" />
              <ui-wf-lifecycle-runs class="runs" />
            </div>
          } @else {
            <ui-wf-automation-canvas class="center" />
          }
          @if (ui.layout() !== 'narrow') {
            <aside class="pane right" aria-label="Settings">
              <ui-wf-inspector (deleteRequest)="requestDeleteSelected()" />
            </aside>
          }
        }
        @case ('versions') { <ui-wf-versions class="center" [saved]="savedOnce()" /> }
        @case ('test') { <ui-wf-test class="center" /> }
      }
    </div>

    @if (ui.layout() === 'narrow' && view() === 'build') {
      <ui-bottom-sheet [snaps]="[0, 0.62, 0.94]" [snap]="sheetSnap()" (snapChange)="sheetSnap.set($event)" [title]="sheetTitle()">
        <ui-wf-inspector class="sheet-inspector" [showHead]="false" (deleteRequest)="requestDeleteSelected()" />
      </ui-bottom-sheet>
    }

    @if (ui.layout() === 'narrow') {
      <ui-bottom-sheet [snaps]="[0, 0.78]" [snap]="ui.addTarget() ? 1 : 0" (snapChange)="!$event && ui.addTarget.set(null)" title="Add a step" [backdrop]="true">
        <ui-wf-step-picker [compact]="true" [draggable]="false" (chosen)="addAtTarget($event)" />
      </ui-bottom-sheet>
    } @else {
      <ui-modal [open]="!!ui.addTarget()" (openChange)="!$event && ui.addTarget.set(null)" title="Add a step" size="lg">
        <ui-wf-step-picker [compact]="true" [draggable]="false" (chosen)="addAtTarget($event)" />
      </ui-modal>
    }

    <ui-modal [open]="showProblems()" (openChange)="showProblems.set($event)" title="Problems to fix" size="md">
      <ul class="plist">
        @for (p of store.problems(); track $index) {
          <li [class.warn]="p.severity === 'warning'"><button type="button" (click)="goToProblem(p)">{{ p.message }}<span class="where">{{ whereOf(p) }}</span></button></li>
        }
      </ul>
    </ui-modal>

    <ui-modal [open]="!!pendingDelete()" (openChange)="!$event && pendingDelete.set(null)" [title]="'Delete “' + (pendingDelete()?.name ?? '') + '”?'" size="sm">
      @if (pendingDelete(); as p) {
        <div class="confirm">
          @for (d of p.detail; track $index) { <p>{{ d }}</p> }
          <p class="wf-hint">You can undo this.</p>
        </div>
      }
      @if (pendingDelete()) {
        <div modal-footer class="confirm-actions">
          <ui-button variant="ghost" (click)="pendingDelete.set(null)">Cancel</ui-button>
          <ui-button variant="destructive" (click)="confirmDelete()">Delete</ui-button>
        </div>
      }
    </ui-modal>

    @if (dnd.drag(); as d) {
      <div class="ghost" [style.transform]="'translate(' + (d.x + 12) + 'px,' + (d.y + 8) + 'px)'" aria-hidden="true">
        <hugeicons-icon aria-hidden="true" [icon]="d.payload.icon" [size]="14" [strokeWidth]="1.8" />{{ d.payload.label }}
      </div>
      @if (dnd.drop()?.line; as l) {
        <div class="drop-line" [class.invalid]="!dnd.drop()!.valid" aria-hidden="true" [style.left.px]="l.x" [style.top.px]="l.y" [style.width.px]="l.width"></div>
      }
    }
    <div class="wf-sr" role="status" aria-live="polite">{{ dnd.announcement() }}</div>
  `,
  styles: [WF_SHARED_STYLES, `
    :host { display: flex; flex-direction: column; height: 100%; min-height: 520px; position: relative; overflow: hidden;
      background: var(--ui-color-bg); color: var(--ui-color-text); font-family: var(--ui-font-default); font-size: var(--ui-font-size-sm);
      border: 1px solid var(--ui-color-border-subtle, var(--ui-color-border)); border-radius: var(--ui-radius); }
    .top { display: flex; align-items: center; gap: var(--ui-space-2) var(--ui-space-3); flex-wrap: wrap; padding: 6px var(--ui-space-3); flex: none;
      background: var(--ui-color-surface); border-bottom: 1px solid var(--ui-color-border-subtle, var(--ui-color-border)); }
    .title { display: flex; flex-direction: column; min-width: 0; max-width: 34ch; padding: 2px 6px; margin-left: -6px; border: 0; border-radius: var(--ui-radius-xs);
      background: transparent; color: var(--ui-color-text); font: inherit; text-align: left; cursor: pointer; }
    .title:hover { background: var(--ui-color-surface-hover); }
    .title:focus-visible { outline: none; box-shadow: var(--ui-focus-ring); }
    .kind { font-size: 11px; font-weight: 650; letter-spacing: 0.05em; text-transform: uppercase; color: var(--ui-color-text-muted); }
    .name { font-size: 14px; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .views { margin: 0 auto; }
    .tools { display: flex; align-items: center; justify-content: flex-end; flex-wrap: wrap; gap: 4px; margin-left: auto; min-width: 0; }
    .issues { display: inline-flex; align-items: center; gap: 4px; height: 24px; padding: 0 8px; margin: 0 2px; border: 0; border-radius: 12px; cursor: pointer;
      background: color-mix(in srgb, var(--ui-color-danger) 14%, transparent); color: var(--ui-color-danger); font: inherit; font-size: 12px; font-weight: 600; }
    .issues:focus-visible { outline: none; box-shadow: var(--ui-focus-ring); }
    .ok { display: inline-flex; align-items: center; gap: 3px; margin: 0 4px; font-size: 12px; color: var(--ui-color-success); }
    .save-state { font-size: 12px; color: var(--ui-color-text-muted); margin: 0 4px; white-space: nowrap; }
    .banner { flex: none; padding: 6px var(--ui-space-3); font-size: 13px; background: color-mix(in srgb, var(--ui-color-danger) 12%, var(--ui-color-surface)); border-bottom: 1px solid var(--ui-color-border); }
    .main { flex: 1; min-height: 0; display: flex; }
    .center { flex: 1; min-width: 0; min-height: 0; }
    .split { display: flex; flex-direction: column; }
    .split .diagram { flex: 1.25; min-height: 240px; }
    .split .runs { flex: 1; min-height: 180px; border-top: 1px solid var(--ui-color-border); }
    .split .runs.idle { flex: none; min-height: 0; }
    .pane { flex: none; min-height: 0; display: flex; flex-direction: column; background: var(--ui-color-surface); }
    .pane.left { width: 224px; padding: var(--ui-space-3) var(--ui-space-2) 0; border-right: 1px solid var(--ui-color-border-subtle, var(--ui-color-border)); }
    .pane.left ui-wf-step-picker { flex: 1; min-height: 0; }
    .pane-title { margin: 0 0 var(--ui-space-2); font-size: 12px; font-weight: 650; color: var(--ui-color-text-secondary); }
    .pane.right { width: 352px; border-left: 1px solid var(--ui-color-border-subtle, var(--ui-color-border)); }
    .pane.right ui-wf-inspector { flex: 1; }
    :host([data-layout="medium"]) .pane.right { width: 320px; }
    .sheet-inspector { height: 100%; }
    .plist { margin: 0; padding: 0; list-style: none; display: flex; flex-direction: column; gap: 4px; }
    .plist button { display: flex; flex-direction: column; gap: 2px; width: 100%; padding: 8px 10px; border: 0; border-left: 3px solid var(--ui-color-danger); border-radius: var(--ui-radius-xs);
      background: color-mix(in srgb, var(--ui-color-danger) 8%, transparent); color: var(--ui-color-text); font: inherit; font-size: 13px; text-align: left; cursor: pointer; }
    .plist li.warn button { border-left-color: var(--ui-color-warning); background: color-mix(in srgb, var(--ui-color-warning) 10%, transparent); }
    .plist button:hover { background: color-mix(in srgb, var(--ui-color-danger) 14%, transparent); }
    .plist li.warn button:hover { background: color-mix(in srgb, var(--ui-color-warning) 16%, transparent); }
    .where { font-size: 11.5px; color: var(--ui-color-text-muted); }
    .confirm { display: flex; flex-direction: column; gap: var(--ui-space-2); font-size: 14px; line-height: 1.5; }
    .confirm p { margin: 0; }
    .confirm-actions { display: flex; justify-content: space-between; width: 100%; }
    .ghost { position: fixed; left: 0; top: 0; z-index: var(--ui-z-toast, 1200); display: inline-flex; align-items: center; gap: 6px; height: 28px; padding: 0 var(--ui-space-3);
      border: 1px solid var(--ui-color-primary); border-radius: var(--ui-radius); background: var(--ui-color-surface-raised, var(--ui-color-surface));
      color: var(--ui-color-text); font-size: 13px; font-weight: 550; box-shadow: var(--ui-shadow-3); pointer-events: none; white-space: nowrap; }
    .drop-line { position: fixed; z-index: var(--ui-z-toast, 1200); height: 3px; border-radius: 2px; background: var(--ui-color-primary); pointer-events: none; transform: translateY(-1px);
      box-shadow: 0 0 0 3px color-mix(in srgb, var(--ui-color-primary) 22%, transparent); }
    .drop-line.invalid { background: var(--ui-color-danger); box-shadow: none; }
    :host([data-layout="narrow"]) { border-radius: 0; border-left: 0; border-right: 0; }
    :host([data-layout="narrow"]) .views { order: 3; margin: 0; width: 100%; }
    :host([data-layout="narrow"]) .ok-word, :host([data-layout="narrow"]) .save-state { display: none; }
    :host([data-layout="narrow"]) .split .diagram { flex: 1; min-height: 200px; }
  `],
})
export class UiWorkflowBuilder {
  protected readonly store = inject(WfBuilderStore);
  protected readonly dnd = inject(WfDnd);
  protected readonly ui = inject(WfBuilderUi);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly providedApi = injectWorkflowApi();

  /** The workflow being built. Two-way: every change is written back. */
  readonly definition = model<UiWorkflowDefinition>(createWorkflow('automation'));
  /** The published version, if any (locks the record type and key; drives "unpublished changes"). */
  readonly published = input<UiWorkflowDefinition | null>(null);
  /** The engine API. Defaults to the one from `provideUiWorkflow`. */
  readonly api = input<UiWorkflowApi | null>(null);
  /** The app's registry and step outputs, when there is no API (or to skip loading it). */
  readonly schema = input<UiWorkflowSchema | null>(null);
  /** Global settings (webhook connections…), when there is no API. */
  readonly settings = input<UiWorkflowSettings | null>(null);
  /** Save drafts and publish through the API from the builder's own header. */
  readonly persist = input(false);
  /** The engine's problems after each check (empty when none or offline). */
  readonly problemsChange = output<UiWfProblem[]>();
  /** Fired after a successful save through the API. */
  readonly saved = output<UiWorkflowDefinition>();

  protected readonly icons = WF_ICONS;
  protected readonly increment = (n: number) => n + 1;
  protected readonly view = signal<View>('build');
  protected readonly sheetSnap = signal(0);
  protected readonly showProblems = signal(false);
  protected readonly pendingDelete = signal<PendingDelete | null>(null);
  protected readonly saving = signal(false);
  protected readonly saveError = signal('');
  private readonly lastSaved = signal<string | null>(null);
  protected readonly savedOnce = signal(false);
  protected readonly dirty = computed(() => this.lastSaved() !== JSON.stringify(this.store.def()));
  protected readonly saveState = computed(() => (this.saving() ? 'Saving…' : this.dirty() ? 'Unsaved changes' : this.savedOnce() ? 'Saved' : ''));
  protected readonly viewOptions = computed(() => [
    { value: 'build', label: 'Build' },
    ...(this.store.api() ? [{ value: 'versions', label: 'Versions' }, { value: 'test', label: 'Test' }] : []),
  ]);
  protected readonly sheetTitle = computed(() => {
    const s = this.store.selection();
    if (!s || s.kind === 'workflow') return 'Settings';
    if (s.kind === 'trigger') return 'What starts it';
    if (s.kind === 'step') { const st = this.store.selectedStep(); return st ? stepName(st) : 'Step'; }
    if (s.kind === 'state') return this.store.selectedState()?.label ?? 'State';
    return this.store.selectedTransition()?.label ?? 'Transition';
  });

  private validateTimer: ReturnType<typeof setTimeout> | null = null;
  private validateSeq = 0;

  constructor() {
    // Definition in, definition out.
    effect(() => {
      const d = this.definition();
      untracked(() => {
        if (d !== this.store.def()) this.store.load(d);
      });
    });
    effect(() => {
      const d = this.store.def();
      untracked(() => {
        if (d !== this.definition()) this.definition.set(d);
      });
    });
    effect(() => this.store.published.set(this.published()));
    effect(() => {
      const api = this.api() ?? this.providedApi;
      untracked(() => {
        this.store.api.set(api);
        void this.loadContext(api);
      });
    });
    effect(() => { const s = this.schema(); if (s) this.store.schema.set(s); });
    effect(() => { const s = this.settings(); if (s) this.store.settings.set(s); });
    // Ask the engine for problems shortly after each change.
    effect(() => {
      const def = this.store.def();
      const api = this.store.api();
      untracked(() => this.scheduleValidation(def, api));
    });
    effect(() => {
      this.ui.inspectRequest();
      untracked(() => { if (this.ui.layout() === 'narrow' && this.store.selection()) this.sheetSnap.set(1); });
    });

    const destroy = inject(DestroyRef);
    const ro = new ResizeObserver(([e]) => {
      const w = e.contentRect.width;
      const next: WfLayout = w >= 1100 ? 'wide' : w >= 720 ? 'medium' : 'narrow';
      if (next !== this.ui.layout()) this.ui.layout.set(next);
    });
    queueMicrotask(() => {
      this.dnd.attach(this.host.nativeElement);
      ro.observe(this.host.nativeElement);
    });
    destroy.onDestroy(() => {
      ro.disconnect();
      if (this.validateTimer) clearTimeout(this.validateTimer);
    });
  }

  private async loadContext(api: UiWorkflowApi | null): Promise<void> {
    if (!api) return;
    try {
      const [schema, others] = await Promise.all([this.schema() ? Promise.resolve(this.schema()!) : api.schema(), api.definitions().catch(() => [] as UiWfDefinitionSummary[])]);
      this.store.schema.set(schema);
      this.store.others.set(others);
      const mine = others.find((o) => o.id === this.store.def().id);
      if (mine) {
        this.savedOnce.set(true);
        this.lastSaved.set(JSON.stringify(this.store.def()));
      }
    } catch (e) {
      this.saveError.set(e instanceof UiWfApiError ? e.message : 'Could not load the app’s record types.');
    }
    // Settings are optional for builders (only admins can read them).
    api.settings().then((s) => this.store.settings.set(s.settings)).catch(() => undefined);
  }

  private scheduleValidation(def: UiWorkflowDefinition, api: UiWorkflowApi | null): void {
    if (this.validateTimer) clearTimeout(this.validateTimer);
    if (!api) return;
    this.store.validating.set(true);
    const seq = ++this.validateSeq;
    this.validateTimer = setTimeout(async () => {
      try {
        const problems = await api.validate(def);
        if (seq !== this.validateSeq) return;
        this.store.serverProblems.set(problems);
        this.problemsChange.emit(problems);
      } catch {
        // A failed check leaves the previous problems in place.
      } finally {
        if (seq === this.validateSeq) this.store.validating.set(false);
      }
    }, 450);
  }

  /** Saves the draft through the API (creates it the first time). */
  async save(): Promise<void> {
    const api = this.store.api();
    if (!api) return;
    this.saving.set(true);
    this.saveError.set('');
    const def = this.store.def();
    try {
      if (this.savedOnce()) await api.saveDraft(def);
      else await api.createDefinition(def);
      this.savedOnce.set(true);
      this.lastSaved.set(JSON.stringify(def));
      this.saved.emit(def);
      this.store.others.set(await api.definitions().catch(() => this.store.others()));
    } catch (e) {
      this.saveError.set(e instanceof UiWfApiError ? e.message : 'Saving failed.');
    } finally {
      this.saving.set(false);
    }
  }

  protected addFromPalette(type: UiWfStepType): void {
    // Clicking a step in the side palette adds it after the selection (or at the end).
    const sel = this.store.selection();
    const loc = sel?.kind === 'step' ? this.store.steps().get(sel.id) : null;
    if (loc) { this.store.addStep(type, loc.listId, loc.index + 1); return; }
    const listId = this.defaultList();
    if (!listId) return;
    const steps = listId === 'root' ? this.store.def().steps ?? [] : [];
    this.store.addStep(type, listId, steps.length);
  }

  /** The list new steps go to when nothing says otherwise. */
  private defaultList(): string | null {
    const def = this.store.def();
    if (def.kind === 'automation') return 'root';
    const s = this.store.selection();
    if (s?.kind === 'transition') return `transition:${s.id}`;
    if (s?.kind === 'state') return `onEnter:${s.id}`;
    return null;
  }

  protected addAtTarget(type: UiWfStepType): void {
    const t = this.ui.addTarget();
    if (!t) return;
    this.ui.addTarget.set(null);
    this.store.addStep(type, t.listId, t.index);
    this.ui.inspectRequest.update(this.increment);
  }

  protected requestDeleteSelected(): void {
    const s = this.store.selection();
    if (s?.kind === 'step') this.ui.deleteRequest.set(s.id);
    else if (s?.kind === 'state' || s?.kind === 'transition') this.askDelete(s.kind, s.id);
  }

  private readonly deleteWatcher = effect(() => {
    const id = this.ui.deleteRequest();
    if (!id) return;
    untracked(() => {
      this.ui.deleteRequest.set(null);
      this.askDelete('step', id);
    });
  });

  private askDelete(kind: PendingDelete['kind'], id: string): void {
    const def = this.store.def();
    if (kind === 'step') {
      const loc = indexSteps(def).get(id);
      if (!loc) return;
      const inner = [...indexSteps(def).values()].filter((l) => l.path.some((p) => p.startsWith(`${id}/`))).length;
      const refs = stepReferences(def, id);
      const detail: string[] = [];
      if (inner) detail.push(`The ${inner} step${inner === 1 ? '' : 's'} inside it will be deleted too.`);
      if (refs.length) detail.push(`${refs.map((r) => `“${stepName(r)}”`).join(', ')} use${refs.length === 1 ? 's' : ''} its results and will show a problem.`);
      // Nothing inside and nothing depends on it: delete straight away (it can be undone).
      if (!detail.length) { this.store.removeStep(id); return; }
      this.pendingDelete.set({ kind, id, name: stepName(loc.step), detail });
      return;
    }
    const lc = def.lifecycle;
    if (kind === 'state') {
      const st = lc?.states.find((s) => s.id === id);
      if (!st) return;
      const n = lc!.transitions.filter((t) => t.to === id || (t.from !== '*' && t.from.includes(id))).length;
      this.pendingDelete.set({ kind, id, name: st.label, detail: n ? [`The ${n} transition${n === 1 ? '' : 's'} into or out of it will be deleted too.`] : ['Records in this state will be shown as out of sync.'] });
      return;
    }
    const t = lc?.transitions.find((x) => x.id === id);
    if (t) this.pendingDelete.set({ kind, id, name: t.label, detail: t.steps?.length ? [`Its ${t.steps.length} step${t.steps.length === 1 ? '' : 's'} will be deleted too.`] : [] });
  }

  protected confirmDelete(): void {
    const p = this.pendingDelete();
    if (!p) return;
    this.pendingDelete.set(null);
    if (p.kind === 'step') this.store.removeStep(p.id);
    else if (p.kind === 'state') this.store.removeState(p.id);
    else this.store.removeTransition(p.id);
    this.store.selection.set(null);
  }

  protected whereOf(p: UiWfProblem): string {
    if (!p.node) return 'Workflow';
    const step = this.store.steps().get(p.node)?.step;
    if (step) return stepName(step);
    const lc = this.store.def().lifecycle;
    return lc?.states.find((s) => s.id === p.node)?.label ?? lc?.transitions.find((t) => t.id === p.node)?.label ?? '';
  }

  protected goToProblem(p: UiWfProblem): void {
    this.showProblems.set(false);
    this.view.set('build');
    const lc = this.store.def().lifecycle;
    if (!p.node) this.store.selection.set(this.store.def().kind === 'automation' && /trigger|field|watch|value|signal|cron|lifecycle/i.test(p.code) ? { kind: 'trigger' } : { kind: 'workflow' });
    else if (this.store.steps().has(p.node)) this.store.selection.set({ kind: 'step', id: p.node });
    else if (lc?.states.some((s) => s.id === p.node)) this.store.selection.set({ kind: 'state', id: p.node });
    else if (lc?.transitions.some((t) => t.id === p.node)) this.store.selection.set({ kind: 'transition', id: p.node });
    this.ui.inspectRequest.update(this.increment);
  }

  protected shortcuts(e: KeyboardEvent): void {
    const target = e.target as HTMLElement;
    const typing = target.closest('input, textarea, select, [contenteditable="true"]');
    const mod = e.ctrlKey || e.metaKey;
    if (mod && e.key.toLowerCase() === 's') { e.preventDefault(); void this.save(); return; }
    if (typing) return;
    if (mod && e.key.toLowerCase() === 'z') { e.preventDefault(); if (e.shiftKey) this.store.redo(); else this.store.undo(); return; }
    if (mod && e.key.toLowerCase() === 'y') { e.preventDefault(); this.store.redo(); return; }
    if ((e.key === 'Delete' || e.key === 'Backspace') && this.store.selection()) { e.preventDefault(); this.requestDeleteSelected(); return; }
    if (e.key === 'Escape') this.store.selection.set(null);
  }
}
