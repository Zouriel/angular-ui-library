import { Component, computed, effect, output, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { UiButton } from '@zouriel/ui/button';
import { UiInput } from '@zouriel/ui/form';
import type { UiWfDefinitionSummary, UiWfPermissionChange, UiWorkflowApi } from './api';
import { describeAssignees, indexSteps, stepInfo, stepName, tokensAt, type UiWfToken } from './definition';
import { WfAssigneesEditor } from './editors';
import { WfWithApi, wfErrorText } from './runtime-shared';
import type { UiWfAssignee, UiWorkflowDefinition, UiWorkflowRegistry } from './schema';
import { WF_SHARED_STYLES } from './styles';

/** One "who" in a published workflow: a transition, the reset, the start button or a person's step. */
export interface UiWfPermissionRow {
  /** What `updatePermissions` changes: a transition or step id, `'reset'` or `'trigger'`. */
  node: string;
  kind: 'transition' | 'reset' | 'trigger' | 'step';
  label: string;
  /** Where it is: "Submitted → Under review", "Approval in Finance sign-off"… */
  detail: string;
  who: UiWfAssignee[];
}

/** Every "who" a published workflow has, in reading order (moves, reset, start button, then steps). */
export function permissionRows(def: UiWorkflowDefinition): UiWfPermissionRow[] {
  const rows: UiWfPermissionRow[] = [];
  const lc = def.lifecycle;
  if (lc) {
    const state = (id: string) => lc.states.find((s) => s.id === id)?.label ?? id;
    for (const t of lc.transitions) {
      // Automatic moves happen on their own: nobody is asked.
      if (t.auto) continue;
      const from = t.from === '*' ? 'Any state' : t.from.map(state).join(', ');
      rows.push({ node: t.id, kind: 'transition', label: t.label, detail: `${from} → ${state(t.to)}`, who: t.who ?? [] });
    }
    if (lc.reset) {
      const to = lc.reset.to ? state(lc.reset.to) : lc.states.find((s) => s.category === 'initial')?.label ?? 'the start';
      rows.push({ node: 'reset', kind: 'reset', label: lc.reset.label || 'Start over', detail: `Back to ${to}`, who: lc.reset.who ?? [] });
    }
  }
  if (def.trigger?.type === 'manual') {
    rows.push({ node: 'trigger', kind: 'trigger', label: `“${def.trigger.label || 'Start'}” button`, detail: 'Starts this workflow', who: def.trigger.who ?? [] });
  }
  for (const loc of indexSteps(def).values()) {
    const s = loc.step;
    if (s.type !== 'approval' && s.type !== 'task') continue;
    rows.push({ node: s.id, kind: 'step', label: stepName(s), detail: stepInfo(s.type).label, who: s.assignees ?? [] });
  }
  return rows;
}

interface WorkflowPermissions {
  summary: UiWfDefinitionSummary;
  def: UiWorkflowDefinition;
  rows: UiWfPermissionRow[];
  tokens: UiWfToken[];
}

/**
 * `ui-workflow-permissions` — who may do what in every published workflow, on one settings page:
 * who may make each lifecycle move, start a record over, press a start button, and decide each
 * approval or task. Saving publishes a new version straight away (only these changes), so admins can
 * change people without opening the builder.
 *
 * ```html
 * <ui-workflow-permissions (saved)="reload()" />
 * ```
 */
@Component({
  selector: 'ui-workflow-permissions',
  imports: [FormsModule, UiButton, UiInput, WfAssigneesEditor],
  template: `
    <div class="head">
      <ui-input class="search" size="sm" type="search" placeholder="Find a workflow or step" [ngModel]="query()" (ngModelChange)="query.set($event)" ariaLabel="Find a workflow or step" />
      @if (!canEdit()) { <span class="wf-hint">You can see who may do what; changing it needs the right to publish workflows.</span> }
    </div>
    @if (loading()) {
      <p class="wf-hint">Loading…</p>
    } @else if (loadError()) {
      <p class="wf-error" role="alert">{{ loadError() }}</p>
    } @else {
      @for (w of shown(); track w.summary.id) {
        <section class="wf" [attr.aria-labelledby]="'perm-' + w.summary.id">
          <header class="wf-head">
            <h3 [id]="'perm-' + w.summary.id">{{ w.summary.title }}</h3>
            <span class="wf-chip">{{ w.summary.kind === 'lifecycle' ? 'Lifecycle' : 'Automation' }} · v{{ w.summary.version }}</span>
          </header>
          <ul class="rows" role="list">
            @for (r of w.rows; track r.node) {
              <li class="row" [class.changed]="isChanged(w, r)">
                <div class="what">
                  <span class="label">{{ r.label }}</span>
                  <span class="detail">{{ r.detail }}</span>
                </div>
                <div class="who">
                  @if (canEdit()) {
                    <ui-wf-assignees [value]="whoOf(w, r)" [registry]="registry()" [tokens]="w.tokens" [api]="client()"
                      [label]="r.label" emptyText="Nobody yet." (valueChange)="edit(w, r, $any($event))" />
                  } @else {
                    <span class="read">{{ describe(w, r) }}</span>
                  }
                </div>
              </li>
            }
          </ul>
          @if (canEdit()) {
            <footer class="wf-foot">
              @if (changeCount(w); as n) {
                <ui-input class="note" size="sm" placeholder="Why (kept with the version)" [ngModel]="notes()[w.summary.id] ?? ''"
                  (ngModelChange)="setNote(w, $event)" ariaLabel="Why these changes" />
                <ui-button size="sm" variant="ghost" (click)="discard(w)" [disabled]="busy() === w.summary.id">Undo</ui-button>
                <ui-button size="sm" (click)="save(w)" [disabled]="!!busy()">Save {{ n }} change{{ n === 1 ? '' : 's' }}</ui-button>
              } @else if (savedText()[w.summary.id]; as t) {
                <span class="wf-hint" role="status">{{ t }}</span>
              }
              @if (errors()[w.summary.id]; as e) { <p class="wf-error" role="alert">{{ e }}</p> }
            </footer>
          }
        </section>
      } @empty {
        <p class="wf-hint">{{ query() ? 'Nothing matches.' : 'No published workflow asks anyone for anything yet.' }}</p>
      }
    }
  `,
  styles: [WF_SHARED_STYLES, `
    :host { display: flex; flex-direction: column; gap: var(--ui-space-4); min-width: 0; container-type: inline-size; }
    .head { display: flex; align-items: center; gap: var(--ui-space-3); flex-wrap: wrap; }
    .search { width: min(320px, 100%); }
    .wf { border: 1px solid var(--ui-color-border); border-radius: var(--ui-radius); background: var(--ui-color-surface); }
    .wf-head { display: flex; align-items: center; gap: var(--ui-space-2); padding: var(--ui-space-3) var(--ui-space-4);
      border-bottom: 1px solid var(--ui-color-border-subtle, var(--ui-color-border)); }
    h3 { flex: 1; min-width: 0; margin: 0; font-size: 14px; font-weight: 650; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .rows { margin: 0; padding: 0; list-style: none; }
    .row { display: grid; grid-template-columns: minmax(160px, 1fr) minmax(0, 1.4fr); gap: var(--ui-space-4); align-items: start;
      padding: var(--ui-space-3) var(--ui-space-4); border-top: 1px solid var(--ui-color-border-subtle, var(--ui-color-border)); }
    .row:first-child { border-top: 0; }
    .row.changed { box-shadow: inset 3px 0 0 var(--ui-color-primary); }
    .what { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
    .label { font-size: 13.5px; font-weight: 600; }
    .detail { font-size: 12px; color: var(--ui-color-text-muted); }
    .read { font-size: 13px; color: var(--ui-color-text-secondary); }
    .wf-foot { display: flex; align-items: center; gap: var(--ui-space-2); flex-wrap: wrap; padding: var(--ui-space-3) var(--ui-space-4);
      border-top: 1px solid var(--ui-color-border-subtle, var(--ui-color-border)); }
    .wf-foot:empty { display: none; }
    .note { flex: 1; min-width: 180px; }
    .wf-foot .wf-error { flex-basis: 100%; }
    @container (max-width: 560px) { .row { grid-template-columns: minmax(0, 1fr); gap: var(--ui-space-2); } }
  `],
})
export class UiWorkflowPermissions extends WfWithApi {
  /** After a workflow's permissions were saved (the new version's summary). */
  readonly saved = output<UiWfDefinitionSummary>();

  protected readonly workflows = signal<WorkflowPermissions[]>([]);
  protected readonly registry = signal<UiWorkflowRegistry | null>(null);
  protected readonly loading = signal(true);
  protected readonly loadError = signal('');
  protected readonly canEdit = signal(false);
  protected readonly query = signal('');
  /** Unsaved "who" per workflow id and node. */
  protected readonly edits = signal<Record<string, Record<string, UiWfAssignee[]>>>({});
  protected readonly notes = signal<Record<string, string>>({});
  protected readonly errors = signal<Record<string, string>>({});
  protected readonly savedText = signal<Record<string, string>>({});
  /** The workflow being saved (one at a time). */
  protected readonly busy = signal<string | null>(null);

  protected readonly shown = computed(() => {
    const q = this.query().trim().toLowerCase();
    const all = this.workflows().filter((w) => w.rows.length);
    if (!q) return all;
    return all
      .map((w) => (w.summary.title.toLowerCase().includes(q) ? w : { ...w, rows: w.rows.filter((r) => `${r.label} ${r.detail}`.toLowerCase().includes(q)) }))
      .filter((w) => w.rows.length);
  });

  constructor() {
    super();
    effect(() => {
      const api = this.client();
      untracked(() => void this.load(api));
    });
  }

  /** Loads every published workflow (again). */
  async load(api: UiWorkflowApi | null = this.client()): Promise<void> {
    if (!api) { this.loading.set(false); return; }
    this.loading.set(true);
    this.loadError.set('');
    try {
      const [summaries, schema, me] = await Promise.all([
        api.definitions(),
        api.schema().catch(() => null),
        api.me ? api.me().catch(() => null) : Promise.resolve(null),
      ]);
      this.registry.set(schema?.registry ?? null);
      // Without /me the server still decides; offer editing and show its answer if it refuses.
      this.canEdit.set(me ? me.can.publish : true);
      const published = summaries.filter((s) => s.version > 0 && s.status !== 'archived');
      const details = await Promise.all(published.map((s) => api.definition(s.id).catch(() => null)));
      const list: WorkflowPermissions[] = [];
      details.forEach((d, i) => {
        if (!d?.published) return;
        list.push({ summary: published[i], def: d.published, rows: permissionRows(d.published), tokens: tokensAt({ def: d.published, registry: this.registry() }) });
      });
      this.workflows.set(list.sort((a, b) => a.summary.title.localeCompare(b.summary.title)));
    } catch (e) {
      this.loadError.set(wfErrorText(e, 'Could not load the workflows.'));
    } finally {
      this.loading.set(false);
    }
  }

  protected whoOf(w: WorkflowPermissions, r: UiWfPermissionRow): UiWfAssignee[] {
    return this.edits()[w.summary.id]?.[r.node] ?? r.who;
  }

  protected isChanged(w: WorkflowPermissions, r: UiWfPermissionRow): boolean {
    return r.node in (this.edits()[w.summary.id] ?? {});
  }

  protected changeCount(w: WorkflowPermissions): number {
    return Object.keys(this.edits()[w.summary.id] ?? {}).length;
  }

  protected describe(w: WorkflowPermissions, r: UiWfPermissionRow): string {
    const text = describeAssignees(r.who, { registry: this.registry(), def: w.def, tokens: w.tokens });
    return text.charAt(0).toUpperCase() + text.slice(1);
  }

  protected edit(w: WorkflowPermissions, r: UiWfPermissionRow, who: UiWfAssignee[]): void {
    const id = w.summary.id;
    this.edits.update((all) => {
      const mine = { ...(all[id] ?? {}) };
      // Back to what is published: not a change any more.
      if (JSON.stringify(who) === JSON.stringify(r.who)) delete mine[r.node];
      else mine[r.node] = who;
      return { ...all, [id]: mine };
    });
    this.savedText.update((t) => ({ ...t, [id]: '' }));
    this.errors.update((e) => ({ ...e, [id]: '' }));
  }

  protected setNote(w: WorkflowPermissions, note: string): void {
    this.notes.update((n) => ({ ...n, [w.summary.id]: note }));
  }

  protected discard(w: WorkflowPermissions): void {
    const id = w.summary.id;
    this.edits.update((all) => ({ ...all, [id]: {} }));
    this.errors.update((e) => ({ ...e, [id]: '' }));
  }

  /** Publishes one workflow's changes as a new version. */
  protected async save(w: WorkflowPermissions): Promise<void> {
    const api = this.client();
    const id = w.summary.id;
    const pending = this.edits()[id] ?? {};
    if (!api || this.busy() || !Object.keys(pending).length) return;
    const changes: UiWfPermissionChange[] = Object.entries(pending).map(([node, who]) => ({ node, who }));
    this.busy.set(id);
    this.errors.update((e) => ({ ...e, [id]: '' }));
    try {
      const summary = await api.updatePermissions(id, changes, this.notes()[id]?.trim() || undefined);
      const d = await api.definition(id);
      const def = d.published ?? w.def;
      this.workflows.update((list) => list.map((x) => (x.summary.id === id ? { summary, def, rows: permissionRows(def), tokens: tokensAt({ def, registry: this.registry() }) } : x)));
      this.edits.update((all) => ({ ...all, [id]: {} }));
      this.notes.update((n) => ({ ...n, [id]: '' }));
      this.savedText.update((t) => ({ ...t, [id]: `Saved: version ${summary.version} is now in use.` }));
      this.saved.emit(summary);
    } catch (e) {
      this.errors.update((x) => ({ ...x, [id]: wfErrorText(e, 'Saving failed.') }));
    } finally {
      this.busy.set(null);
    }
  }
}
