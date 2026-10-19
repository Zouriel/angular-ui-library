import {
  Component,
  DestroyRef,
  ElementRef,
  computed,
  effect,
  inject,
  input,
  model,
  signal,
  untracked,
} from '@angular/core';
import { HugeiconsIconComponent } from '@hugeicons/angular';
import { UiButton, UiSegmented } from '@zouriel/ui/button';
import { UiBottomSheet, UiModal, UiSnackbar } from '@zouriel/ui/dialog';
import { FbCanvas } from './builder-canvas';
import { FbDnd } from './builder-dnd';
import { FbInspector } from './builder-inspector';
import { FbLogicOverview } from './builder-logic';
import { FbPalette } from './builder-palette';
import { FbPreview } from './builder-preview';
import { FbBuilderStore } from './builder-store';
import { FB_SHARED_STYLES } from './builder-styles';
import { createDefinition, subtreeIds, type UiFbDiff, type UiFbDropTarget, type UiFbProblem, type UiFbReference } from './definition';
import type { UiFormDefinition } from './schema';
import { UI_FB_BUILTIN_VALIDATORS, UI_FB_VALIDATORS, type UiFbValidatorDef } from './validators';
import { UI_FB_OPTION_SOURCES, type UiFbOptionSourceDef } from './option-sources';
import { sourcesFromSettings, type UiFormGlobalSettings } from './global-settings';
import { UI_FB_HTTP_SOURCES } from './http-sources';
import { FB_ICONS } from './builder-icons';

type View = 'build' | 'logic' | 'preview';
type Layout = 'wide' | 'medium' | 'narrow';

interface PendingDelete {
  id: string;
  name: string;
  page: boolean;
  answers: boolean;
  refs: UiFbReference[];
  count: number;
}

/**
 * `ui-form-builder` — build forms by dragging fields onto a page, then add
 * rules: show or require a question only when other answers say so, group
 * questions into sections (that repeat, or depend on other sections), split
 * the form into steps, and add checks with your own messages.
 *
 * Bind `[(definition)]`; it's plain JSON, ready to store and to hand to
 * `ui-form-renderer`. Pass the `published` version and its `submissionCount`
 * so the builder protects answers that already exist (archiving instead of
 * deleting, locking saved values, remembering renamed keys).
 */
@Component({
  selector: 'ui-form-builder',
  providers: [FbBuilderStore, FbDnd],
  imports: [HugeiconsIconComponent, UiButton, UiSegmented, UiModal, UiBottomSheet, UiSnackbar, FbCanvas, FbInspector, FbPalette, FbLogicOverview, FbPreview],
  host: {
    class: 'ui-form-builder',
    '[attr.data-layout]': 'layout()',
    '(keydown)': 'shortcuts($event)',
  },
  template: `
    <header class="top">
      @if (showTitle()) {
        <button type="button" class="title" (click)="openForm()" title="Form settings">
          <span>{{ store.def().title || 'Untitled form' }}</span>
        </button>
      }
      <ui-segmented class="views" size="sm" label="View" [options]="views" [value]="view()" (valueChange)="setView($any($event))" />
      <div class="top-tools">
        <button type="button" class="fb-icon-btn" [disabled]="!store.canUndo()" (click)="store.undo()" aria-label="Undo" title="Undo (Ctrl+Z)">
          <hugeicons-icon aria-hidden="true" [icon]="undoIcon" [size]="16" [strokeWidth]="1.8" />
        </button>
        <button type="button" class="fb-icon-btn" [disabled]="!store.canRedo()" (click)="store.redo()" aria-label="Redo" title="Redo (Ctrl+Shift+Z)">
          <hugeicons-icon aria-hidden="true" [icon]="redoIcon" [size]="16" [strokeWidth]="1.8" />
        </button>
        @if (errorCount()) {
          <button type="button" class="issues" (click)="setView('logic')" [attr.aria-label]="errorCount() + ' problems to fix'">
            <hugeicons-icon aria-hidden="true" [icon]="alertIcon" [size]="14" [strokeWidth]="1.8" />{{ errorCount() }}
          </button>
        }
        @if (store.diff(); as d) {
          @if (d.summary.length) {
            <details class="changes">
              <summary [attr.aria-label]="d.summary.length + ' unpublished change' + (d.summary.length > 1 ? 's' : '')">
                {{ d.summary.length }}<span class="changes-word"> unpublished</span> change{{ d.summary.length > 1 ? 's' : '' }}
              </summary>
              <ul>@for (line of d.summary; track $index) { <li>{{ line }}</li> }</ul>
            </details>
          }
        }
        @if (layout() === 'medium' && view() === 'build') {
          <ui-button class="add" size="sm" variant="outline" (click)="openAdd(null)"><hugeicons-icon aria-hidden="true" [icon]="addIcon" [size]="14" [strokeWidth]="1.8" />Add</ui-button>
        }
        <ng-content select="[fbActions]" />
      </div>
    </header>

    <div class="main" [attr.data-view]="view()">
      @switch (view()) {
        @case ('build') {
          @if (layout() === 'wide') {
            <aside class="pane left" aria-label="Fields to add">
              <ui-fb-palette />
            </aside>
          }
          <ui-fb-canvas class="center" (addAt)="openAdd($event)" (deleteRequest)="requestDelete($event.id)" (open)="openSettings($event)" />
          @if (layout() !== 'narrow') {
            <aside class="pane right" aria-label="Settings">
              <ui-fb-inspector (deleteRequest)="requestDelete($event)" />
            </aside>
          }
        }
        @case ('logic') { <ui-fb-logic class="center" (open)="openFromLogic($event)" /> }
        @case ('preview') { <ui-fb-preview class="center" /> }
      }
    </div>

    @if (layout() === 'narrow' && view() === 'build') {
      <ui-bottom-sheet [snaps]="[0, 0.6, 0.94]" [snap]="sheetSnap()" (snapChange)="sheetSnap.set($event)" [title]="sheetTitle()">
        <ui-fb-inspector class="sheet-inspector" [showHead]="false" (deleteRequest)="requestDelete($event)" />
      </ui-bottom-sheet>
      @if (sheetSnap() === 0 && !addOpen()) {
        <button type="button" class="fab" (click)="openAdd(null)"><hugeicons-icon aria-hidden="true" [icon]="addIcon" [size]="18" [strokeWidth]="2" />Add field</button>
      }
    }

    @if (layout() === 'narrow') {
      <ui-bottom-sheet [snaps]="[0, 0.75]" [snap]="addOpen() ? 1 : 0" (snapChange)="!$event && addOpen.set(false)" title="Add a field" [backdrop]="true">
        <ui-fb-palette [compact]="true" [target]="addTarget()" (added)="addOpen.set(false)" />
      </ui-bottom-sheet>
    } @else {
      <ui-modal [open]="addOpen()" (openChange)="addOpen.set($event)" title="Add a field" size="lg">
        <ui-fb-palette [compact]="true" [target]="addTarget()" (added)="addOpen.set(false)" />
      </ui-modal>
    }

    <ui-modal [open]="!!pendingDelete()" (openChange)="!$event && pendingDelete.set(null)" [title]="deleteTitle()" size="sm">
      @if (pendingDelete(); as p) {
        <div class="confirm">
          @if (p.answers) {
            <p>People have already answered {{ p.page ? 'questions on this page' : 'this' }}. <strong>Archiving</strong> hides it from new answers and keeps the saved ones readable. Deleting leaves old answers without a question to show them under.</p>
          } @else if (p.page && p.count) {
            <p>This page has {{ p.count }} question{{ p.count > 1 ? 's' : '' }} on it. They’ll be deleted too.</p>
          }
          @if (p.refs.length) {
            <p>These rules use it and will be removed:</p>
            <ul>@for (r of p.refs; track r.ownerId + r.kind) { <li>“{{ store.name(r.ownerId) }}” {{ refWords[r.kind] }}</li> }</ul>
          }
          <p class="fb-hint">You can undo this.</p>
        </div>
      }
      <!-- A separate @if with one root, so the buttons land in the modal's footer slot. -->
      @if (pendingDelete(); as p) {
        <div modal-footer class="confirm-actions">
          <ui-button variant="ghost" (click)="pendingDelete.set(null)">Cancel</ui-button>
          <div class="fb-row">
            @if (p.answers && !p.page) {
              <ui-button variant="outline" (click)="confirmDelete()">Delete anyway</ui-button>
              <ui-button (click)="archivePending()">Archive</ui-button>
            } @else {
              <ui-button variant="destructive" (click)="confirmDelete()">Delete</ui-button>
            }
          </div>
        </div>
      }
    </ui-modal>

    @if (dnd.drag(); as d) {
      <div class="ghost" [style.transform]="'translate(' + (d.x + 12) + 'px,' + (d.y + 8) + 'px)'" aria-hidden="true">
        <hugeicons-icon aria-hidden="true" [icon]="d.payload.icon" [size]="14" [strokeWidth]="1.8" />{{ d.payload.label }}
      </div>
      @if (dnd.drop()?.line; as l) {
        <div class="drop-line" [class.vertical]="l.vertical" [class.invalid]="!dnd.drop()!.valid" aria-hidden="true"
          [style.left.px]="l.x" [style.top.px]="l.y" [style.width.px]="l.vertical ? 3 : l.length" [style.height.px]="l.vertical ? l.length : 3"></div>
      }
    }

    @if (toast(); as t) {
      <ui-snackbar class="toast" [message]="t" actionLabel="Undo" (action)="undoToast()"
        (mouseenter)="holdToast()" (mouseleave)="releaseToast()" (focusin)="holdToast()" (focusout)="releaseToast()" />
    }
    <!-- Always present, so screen readers hear each change as its text is swapped. -->
    <div class="fb-sr" role="status" aria-live="polite">{{ toast() ? toast() + '. Press Ctrl+Z to undo.' : dnd.announcement() }}</div>
  `,
  styles: [FB_SHARED_STYLES, `
    :host { display: flex; flex-direction: column; height: 100%; min-height: 480px; position: relative; overflow: hidden;
      background: var(--ui-color-bg); color: var(--ui-color-text); font-family: var(--ui-font-default); font-size: var(--ui-font-size-sm);
      border: 1px solid var(--ui-color-border-subtle, var(--ui-color-border)); border-radius: var(--ui-radius); }
    .top { display: flex; align-items: center; gap: var(--ui-space-2) var(--ui-space-3); flex-wrap: wrap; padding: 6px var(--ui-space-3); flex: none;
      background: var(--ui-color-surface); border-bottom: 1px solid var(--ui-color-border-subtle, var(--ui-color-border)); }
    .title { min-width: 0; max-width: 32ch; padding: 4px 6px; margin-left: -6px; border: 0; border-radius: var(--ui-radius-xs); background: transparent;
      color: var(--ui-color-text); font: inherit; font-size: 14px; font-weight: 600; cursor: pointer; text-align: left; }
    .title span { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .title:hover { background: var(--ui-color-surface-hover); }
    .title:focus-visible { outline: none; box-shadow: var(--ui-focus-ring); }
    .views { margin: 0 auto; }
    /* Wraps instead of overflowing, so the host's own buttons (Publish…) never leave the screen. */
    .top-tools { display: flex; align-items: center; justify-content: flex-end; flex-wrap: wrap; gap: 2px; min-width: 0; max-width: 100%; margin-left: auto; }
    .top-tools .add { margin-left: var(--ui-space-2); }
    .issues { display: inline-flex; align-items: center; gap: 4px; height: 24px; padding: 0 8px; margin: 0 4px; border: 0; border-radius: 12px; cursor: pointer;
      background: color-mix(in srgb, var(--ui-color-danger) 14%, transparent); color: var(--ui-color-danger); font: inherit; font-size: 12px; font-weight: 600; }
    .issues:focus-visible { outline: none; box-shadow: var(--ui-focus-ring); }
    .changes { position: relative; margin: 0 4px; font-size: 12px; }
    .changes summary { cursor: pointer; list-style: none; padding: 3px 8px; border-radius: 12px; color: var(--ui-color-text-secondary); background: var(--ui-color-surface-hover); white-space: nowrap; }
    .changes summary::-webkit-details-marker { display: none; }
    .changes ul { position: absolute; right: 0; top: calc(100% + 6px); z-index: 5; width: min(340px, 86vw); max-height: 300px; overflow: auto; margin: 0; padding: var(--ui-space-2) var(--ui-space-2) var(--ui-space-2) var(--ui-space-6);
      background: var(--ui-color-surface-raised, var(--ui-color-surface)); border: 1px solid var(--ui-color-border); border-radius: var(--ui-radius); box-shadow: var(--ui-shadow-2);
      display: flex; flex-direction: column; gap: 4px; line-height: 1.4; }
    .main { flex: 1; min-height: 0; display: flex; }
    .center { flex: 1; min-width: 0; }
    .pane { flex: none; min-height: 0; display: flex; flex-direction: column; background: var(--ui-color-surface); }
    .pane.left { width: 232px; padding: var(--ui-space-3) var(--ui-space-2); border-right: 1px solid var(--ui-color-border-subtle, var(--ui-color-border)); }
    .pane.left ui-fb-palette { flex: 1; }
    .pane.right { width: 340px; border-left: 1px solid var(--ui-color-border-subtle, var(--ui-color-border)); }
    .pane.right ui-fb-inspector { flex: 1; }
    :host([data-layout="medium"]) .pane.right { width: 316px; }
    /* The sheet pads its body already: the inspector's content lines up with that edge, and keeps
       4px of its own (taken back by the margin) so focus rings aren't clipped by its scroller. */
    .sheet-inspector { height: 100%; --fb-inspector-pad: var(--ui-space-1); margin-inline: calc(var(--ui-space-1) * -1); }
    .fab { position: absolute; right: var(--ui-space-4); bottom: var(--ui-space-4); z-index: 3; display: inline-flex; align-items: center; gap: 6px; height: 44px; padding: 0 var(--ui-space-4);
      border: 0; border-radius: 22px; background: var(--ui-color-primary); color: var(--ui-color-primary-contrast); font: inherit; font-size: 14px; font-weight: 600;
      box-shadow: var(--ui-shadow-2); cursor: pointer; }
    .fab:focus-visible { outline: none; box-shadow: var(--ui-focus-ring); }
    .fab:active { transform: scale(0.97); }
    .fab { transition: transform var(--ui-motion-fast) var(--ui-ease-standard); }
    .confirm { display: flex; flex-direction: column; gap: var(--ui-space-2); font-size: 14px; line-height: 1.5; }
    .confirm p { margin: 0; }
    .confirm ul { margin: 0; padding-left: var(--ui-space-4); }
    .confirm-actions { display: flex; justify-content: space-between; align-items: center; width: 100%; gap: var(--ui-space-2); }
    .ghost { position: fixed; left: 0; top: 0; z-index: var(--ui-z-toast, 1200); display: inline-flex; align-items: center; gap: 6px; height: 28px; padding: 0 var(--ui-space-3);
      border: 1px solid var(--ui-color-primary); border-radius: var(--ui-radius); background: var(--ui-color-surface-raised, var(--ui-color-surface));
      color: var(--ui-color-text); font-size: 13px; font-weight: 550; box-shadow: var(--ui-shadow-3); pointer-events: none; white-space: nowrap; will-change: transform; }
    .drop-line { position: fixed; z-index: var(--ui-z-toast, 1200); border-radius: 2px; background: var(--ui-color-primary); pointer-events: none;
      box-shadow: 0 0 0 3px color-mix(in srgb, var(--ui-color-primary) 22%, transparent); }
    .drop-line.vertical { transform: translateX(-1px); }
    .drop-line:not(.vertical) { transform: translateY(-1px); }
    .drop-line.invalid { background: var(--ui-color-danger); box-shadow: none; }
    .toast { position: absolute; left: 50%; bottom: var(--ui-space-4); transform: translateX(-50%); z-index: 4; width: max-content;
      animation: fb-toast-in var(--ui-motion-base) var(--ui-ease-decelerate, ease-out); }
    @keyframes fb-toast-in { from { opacity: 0; transform: translate(-50%, 6px); } }
    :host([data-layout="narrow"]) { border-radius: 0; border-left: 0; border-right: 0; }
    :host([data-layout="narrow"]) .title { max-width: 18ch; }
    :host([data-layout="narrow"]) .changes-word { display: none; }
    :host([data-layout="narrow"]) .views { order: 3; margin: 0; width: 100%; }
    :host([data-layout="narrow"]) .toast { bottom: 76px; }
    @media (prefers-reduced-motion: reduce) { .toast { animation: none; } }
  `],
})
export class UiFormBuilder {
  protected readonly store = inject(FbBuilderStore);
  protected readonly dnd = inject(FbDnd);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly registered = (inject(UI_FB_VALIDATORS, { optional: true }) ?? []).flat();
  private readonly registeredSources = (inject(UI_FB_OPTION_SOURCES, { optional: true }) ?? []).flat();
  private readonly http = inject(UI_FB_HTTP_SOURCES, { optional: true }) ?? {};

  /** The form being built. Two-way: every change is written back. */
  readonly definition = model<UiFormDefinition>(createDefinition());
  /** The version people are answering now (for warnings and the change list). */
  readonly published = input<UiFormDefinition | null>(null);
  /** How many answers the published version has. Above zero, saved data is protected. */
  readonly submissionCount = input(0);
  /** App checks for the "Add a check" list, on top of `provideUiFormValidators`. */
  readonly validators = input<readonly UiFbValidatorDef[]>([]);
  /** Extra option sources (searchable lists) for dropdowns and multi-selects, on top of `provideUiFormOptionSources`. */
  readonly optionSources = input<readonly UiFbOptionSourceDef[]>([]);
  /** App-wide settings from `ui-form-global-settings`: their lists become data sources here. */
  readonly globalSettings = input<UiFormGlobalSettings | null>(null);
  /** Show the form's title in the top bar. Turn off when the host's own header already names the form. */
  readonly showTitle = input(true);

  protected readonly addIcon = FB_ICONS.Add01Icon;
  protected readonly undoIcon = FB_ICONS.Undo02Icon;
  protected readonly redoIcon = FB_ICONS.Redo02Icon;
  protected readonly alertIcon = FB_ICONS.Alert02Icon;
  protected readonly views = [{ value: 'build', label: 'Build' }, { value: 'logic', label: 'Logic' }, { value: 'preview', label: 'Preview' }];
  protected readonly refWords: Record<string, string> = {
    visibility: 'decides when it shows', required: 'decides when it’s required', disabled: 'decides when it’s read-only',
    setValue: 'fills itself in from it', validator: 'checks against it', calc: 'calculates from it', jump: 'jumps based on it', source: 'narrows its list by it',
  };

  protected readonly view = signal<View>('build');
  private readonly width = signal(1200);
  protected readonly layout = computed<Layout>(() => (this.width() >= 1100 ? 'wide' : this.width() >= 720 ? 'medium' : 'narrow'));
  protected readonly addOpen = signal(false);
  protected readonly addTarget = signal<UiFbDropTarget | null>(null);
  protected readonly sheetSnap = signal(0);
  protected readonly pendingDelete = signal<PendingDelete | null>(null);
  protected readonly toast = signal<string | null>(null);
  private toastTimer: ReturnType<typeof setTimeout> | null = null;

  protected readonly errorCount = computed(() => this.store.problems().filter((p) => p.severity === 'error').length);
  protected readonly deleteTitle = computed(() => {
    const p = this.pendingDelete();
    if (!p) return '';
    return p.answers && !p.page ? `“${p.name}” has answers` : `Delete “${p.name}”?`;
  });
  protected readonly sheetTitle = computed(() => (this.store.selected() ? this.store.name(this.store.selectedId()!) : 'Form settings'));

  /** Problems that would stop the form working well, for hosts to show before publishing. */
  readonly problems = computed<UiFbProblem[]>(() => this.store.problems());
  /** What changed since `published`, worded for a confirmation screen. */
  readonly changes = computed<UiFbDiff | null>(() => this.store.diff());

  constructor() {
    this.dnd.attach(this.host.nativeElement);
    // Outside → in: a definition the host sets replaces the builder's. A different form clears history;
    // the same form handed back with a new revision (a published copy) keeps it. See FbBuilderStore.load.
    effect(() => {
      const d = this.definition();
      if (d !== untracked(() => this.store.def())) untracked(() => this.store.load(d));
    });
    // In → outside: every change goes back through the model.
    effect(() => {
      this.store.version();
      const d = this.store.def();
      if (d !== untracked(() => this.definition())) untracked(() => this.definition.set(d));
    });
    effect(() => this.store.published.set(this.published()));
    effect(() => this.store.submissionCount.set(this.submissionCount()));
    effect(() => this.store.validatorDefs.set([...UI_FB_BUILTIN_VALIDATORS, ...this.registered, ...this.validators()]));
    effect(() => this.store.optionSourceDefs.set([...this.registeredSources, ...sourcesFromSettings(this.globalSettings(), this.http), ...this.optionSources()]));

    // Lays out by the builder's own width, not the window's (it may sit in a panel). No observer on the server.
    const ro = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(([e]) => this.width.set(e.contentRect.width));
    ro?.observe(this.host.nativeElement);
    inject(DestroyRef).onDestroy(() => {
      ro?.disconnect();
      if (this.toastTimer) clearTimeout(this.toastTimer);
    });
  }

  /** Selects an element or page (null for the form) and shows its settings. */
  select(id: string | null): void {
    this.view.set('build');
    this.store.select(id);
  }

  undo(): void { this.store.undo(); }
  redo(): void { this.store.redo(); }
  /** Forgets undo/redo history, e.g. after the host saves and wants a fresh start. */
  clearHistory(): void { this.store.clearHistory(); }

  protected setView(v: View): void {
    // The undo toast belongs to the view it was raised in; elsewhere it would cover that view's own buttons.
    if (v !== this.view()) this.dismissToast();
    this.view.set(v);
    this.sheetSnap.set(0);
  }

  protected openForm(): void {
    this.select(null);
    if (this.layout() === 'narrow') this.sheetSnap.set(1);
  }

  /** Settings were asked for (toolbar button, long press, double-click, Enter). Wider layouts
   *  already show them beside the canvas; on a phone they open in the sheet. */
  protected openSettings(id: string): void {
    this.select(id);
    if (this.layout() === 'narrow') this.sheetSnap.set(1);
  }

  protected openFromLogic(id: string): void {
    this.select(id);
    if (this.layout() === 'narrow') this.sheetSnap.set(1);
  }

  protected openAdd(target: UiFbDropTarget | null): void {
    this.addTarget.set(target);
    this.sheetSnap.set(0);
    this.addOpen.set(true);
  }

  // ── Deleting ────────────────────────────────────────────────────────────

  protected requestDelete(id: string): void {
    const entry = this.store.index().get(id);
    if (!entry) return;
    const ids = subtreeIds(this.store.def(), id);
    const answers = ids.some((x) => this.store.hasAnswers(x) && this.store.index().get(x)?.kind === 'field');
    const refs = this.store.externalRefs(id);
    const page = entry.kind === 'page';
    const count = page ? ids.filter((x) => this.store.index().get(x)?.kind === 'field').length : 0;
    const p: PendingDelete = { id, name: this.store.name(id), page, answers, refs, count };
    if (!answers && !refs.length && !(page && count)) this.doDelete(p);
    else this.pendingDelete.set(p);
  }

  protected confirmDelete(): void {
    const p = this.pendingDelete();
    this.pendingDelete.set(null);
    if (p) this.doDelete(p);
  }

  protected archivePending(): void {
    const p = this.pendingDelete();
    this.pendingDelete.set(null);
    if (!p) return;
    this.store.setArchived(p.id, true);
    this.showToast(`Archived “${p.name}”`);
  }

  private doDelete(p: PendingDelete): void {
    if (p.page) this.store.removePage(p.id);
    else this.store.remove(p.id);
    this.sheetSnap.set(0);
    this.showToast(`Deleted “${p.name}”`);
    this.host.nativeElement.querySelector<HTMLElement>('[data-fb-scroll]')?.focus?.();
  }

  private showToast(message: string): void {
    this.toast.set(message);
    this.releaseToast(10000);
  }

  /** Keeps the toast (and its Undo) up while someone is pointing at or tabbing to it. */
  protected holdToast(): void {
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.toastTimer = null;
  }

  protected releaseToast(ms = 4000): void {
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => this.toast.set(null), ms);
  }

  protected undoToast(): void {
    this.store.undo();
    this.dismissToast();
  }

  private dismissToast(): void {
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.toastTimer = null;
    this.toast.set(null);
  }

  // ── Keyboard ────────────────────────────────────────────────────────────

  protected shortcuts(e: KeyboardEvent): void {
    const t = e.target as HTMLElement;
    const typing = t.closest('input, textarea, select, [contenteditable="true"]');
    const mod = e.ctrlKey || e.metaKey;
    if (mod && !typing && e.key.toLowerCase() === 'z') {
      e.preventDefault();
      if (e.shiftKey) this.store.redo();
      else this.store.undo();
    } else if (mod && !typing && e.key.toLowerCase() === 'y') {
      e.preventDefault();
      this.store.redo();
    } else if (e.key === 'Escape' && !typing && this.store.selectedId() && !this.dnd.drag() && this.view() === 'build') {
      this.store.select(null);
    }
  }
}
