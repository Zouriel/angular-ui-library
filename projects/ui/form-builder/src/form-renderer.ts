import { NgTemplateOutlet } from '@angular/common';
import {
  Component,
  ElementRef,
  Injector,
  ViewEncapsulation,
  afterNextRender,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
  viewChild,
  viewChildren,
} from '@angular/core';
import { HugeiconsIconComponent } from '@hugeicons/angular';
import { UiButton } from '@zouriel/ui/button';
import { UiFormEngine, type UiFbRemovedRow, type UiFormMode } from './engine';
import { formatValue } from './format';
import { UiFbFieldView, type UiFbUploader } from './renderer-field';
import type { UiFbChange, UiFbElement, UiFbField, UiFbGroup, UiFormDefinition, UiFormSubmission } from './schema';
import { UI_FB_VALIDATORS, type UiFbValidatorDef } from './validators';
import { FB_ICONS } from './builder-icons';

let rendererSeq = 0;

const SPAN: Record<string, number> = { full: 12, 'two-thirds': 8, half: 6, third: 4 };

/**
 * `ui-form-renderer` — fills in a form built with `ui-form-builder`.
 *
 * Give it a definition, and (to edit or view saved answers) the saved `data`.
 * It emits `submitted` with JSON ready to store: `{ formId, revision, data, … }`.
 */
@Component({
  selector: 'ui-form-renderer',
  encapsulation: ViewEncapsulation.None,
  imports: [NgTemplateOutlet, HugeiconsIconComponent, UiButton, UiFbFieldView],
  host: { class: 'ui-fr-host' },
  template: `
    @if (engine(); as e) {
      @let def = e.definition;
      @let page = e.page();
      <form class="ui-fr" novalidate (submit)="$event.preventDefault(); primary()" [attr.aria-labelledby]="showTitle() ? uid + '-title' : null">
        @if (showTitle() && (def.title || def.description)) {
          <header class="ui-fr-header">
            @if (def.title) { <h2 class="ui-fr-title" [id]="uid + '-title'">{{ def.title }}</h2> }
            @if (def.description) { <p class="ui-fr-desc">{{ def.description }}</p> }
          </header>
        }

        @if (e.mode === 'view') {
          <!-- Reading saved answers: every page on the route, one after another, no steps. -->
          @for (i of e.path(); track i) {
            @let p = def.pages[i];
            <section class="ui-fr-view-page" [attr.aria-label]="p.title || null">
              @if (multiPage() && (p.title || p.description)) {
                <div class="ui-fr-page-head">
                  @if (p.title) { <h3 class="ui-fr-page-title">{{ p.title }}</h3> }
                  @if (p.description) { <p class="ui-fr-desc">{{ p.description }}</p> }
                </div>
              }
              <div class="ui-fr-grid">
                <ng-container [ngTemplateOutlet]="elements" [ngTemplateOutletContext]="{ $implicit: p.elements, row: null, cols: 1 }" />
              </div>
            </section>
          }
        } @else {
        @if (multiPage() && def.settings?.showProgress !== false) {
          <div class="ui-fr-progress">
            <div class="ui-fr-steps" aria-hidden="true">
              @for (i of e.path(); track i; let n = $index) {
                <span class="seg" [class.done]="n < e.step()" [class.on]="n === e.step()"></span>
              }
            </div>
            <p class="ui-fr-step">Step {{ e.step() + 1 }} of {{ e.path().length }}@if (page.title) {<span class="sep">:</span> {{ page.title }}}</p>
          </div>
        }

        @if (summary().length) {
          <div class="ui-fr-summary" role="alert" tabindex="-1" #summaryBox [attr.aria-labelledby]="uid + '-sum'">
            <h3 class="ui-fr-summary-title" [id]="uid + '-sum'">There {{ summary().length === 1 ? 'is a problem' : 'are ' + summary().length + ' problems' }}</h3>
            <ul>
              @for (item of summary(); track item.addr) {
                <li><a [href]="'#' + uid + '-' + item.addr" (click)="$event.preventDefault(); focusField(item.addr)">{{ item.message }}</a></li>
              }
            </ul>
          </div>
        }

        @if (multiPage() && (page.title || page.description)) {
          <div class="ui-fr-page-head">
            @if (page.title && def.settings?.showProgress === false) { <h3 class="ui-fr-page-title">{{ page.title }}</h3> }
            @if (page.description) { <p class="ui-fr-desc">{{ page.description }}</p> }
          </div>
        }

        <div class="ui-fr-grid">
          <ng-container [ngTemplateOutlet]="elements" [ngTemplateOutletContext]="{ $implicit: page.elements, row: null, cols: 1 }" />
        </div>
        }

        @if (showActions() && e.mode !== 'view') {
          <footer class="ui-fr-footer">
            <div class="ui-fr-footer-start">
              @if (multiPage() && e.step() > 0) {
                <ui-button variant="outline" type="button" (click)="back()">{{ def.settings?.backLabel || 'Back' }}</ui-button>
              }
              @if (cancelLabel()) {
                <ui-button variant="ghost" type="button" (click)="cancelled.emit()">{{ cancelLabel() }}</ui-button>
              }
            </div>
            <div class="ui-fr-footer-end">
              @if (e.mode === 'edit') {
                @if (e.dirty()) {
                  <details class="ui-fr-changes">
                    <summary>{{ e.changes().length === 1 ? '1 change' : e.changes().length + ' changes' }}</summary>
                    <ul>
                      @for (c of e.changes(); track c.path) {
                        <li><span class="what">{{ c.label }}</span><span class="from">{{ show(c, c.from) }}</span><span class="to">{{ show(c, c.to) }}</span></li>
                      }
                    </ul>
                  </details>
                } @else {
                  <span class="ui-fr-saved">No changes</span>
                }
              }
              <ui-button type="submit" [loading]="busy()">{{ primaryLabel() }}</ui-button>
            </div>
          </footer>
        }
      </form>

      <ng-template #elements let-els let-row="row" let-cols="cols">
        @for (el of els; track el.id) {
          @if (!el.archived && e.instanceState(el.id, row).visible && !(el.kind === 'field' && el.type === 'hidden')) {
            <div class="ui-fr-cell" [style.grid-column]="'span ' + span(el, cols)" [attr.data-kind]="el.kind" animate.enter="ui-fr-enter">
              @switch (el.kind) {
                @case ('field') {
                  <ui-fb-field [engine]="e" [field]="asField(el)" [row]="row" [idPrefix]="uid" [uploader]="uploader()" />
                }
                @case ('static') {
                  @switch (el.type) {
                    @case ('heading') { <h3 class="ui-fr-heading">{{ el.text }}</h3> }
                    @case ('paragraph') { <p class="ui-fr-para">{{ el.text }}</p> }
                    @default { <hr class="ui-fr-hr" /> }
                  }
                }
                @case ('group') {
                  @let g = asGroup(el);
                  <fieldset class="ui-fr-group" [class.is-repeat]="!!g.repeat" [disabled]="e.instanceState(g.id, row).disabled && e.mode !== 'view'">
                    @if (g.title) { <legend class="ui-fr-legend">{{ g.title }}</legend> }
                    @if (g.description) { <p class="ui-fr-desc">{{ g.description }}</p> }
                    @if (g.repeat) {
                      @let rows = e.rows(g.id);
                      @for (r of rows; track r; let n = $index) {
                        <section class="ui-fr-entry" [attr.aria-label]="entryLabel(g, n)" animate.enter="ui-fr-enter">
                          <header class="ui-fr-entry-head">
                            <h4>{{ entryLabel(g, n) }}</h4>
                            @if (e.mode !== 'view') {
                              <div class="ui-fr-entry-tools">
                                @if (rows.length > 1) {
                                  <button type="button" class="ui-fr-icon" [disabled]="n === 0" (click)="e.moveRow(g.id, r, -1)" [attr.aria-label]="'Move ' + entryLabel(g, n) + ' up'">
                                    <hugeicons-icon aria-hidden="true" [icon]="upIcon" [size]="15" [strokeWidth]="1.8" />
                                  </button>
                                  <button type="button" class="ui-fr-icon" [disabled]="n === rows.length - 1" (click)="e.moveRow(g.id, r, 1)" [attr.aria-label]="'Move ' + entryLabel(g, n) + ' down'">
                                    <hugeicons-icon aria-hidden="true" [icon]="downIcon" [size]="15" [strokeWidth]="1.8" />
                                  </button>
                                }
                                @if (e.canRemoveRow(g.id)) {
                                  <button type="button" class="ui-fr-icon danger" (click)="removeRow(g, r, n)" [attr.aria-label]="'Remove ' + entryLabel(g, n)">
                                    <hugeicons-icon aria-hidden="true" [icon]="deleteIcon" [size]="15" [strokeWidth]="1.8" />
                                  </button>
                                }
                              </div>
                            }
                          </header>
                          <div class="ui-fr-grid">
                            <ng-container [ngTemplateOutlet]="elements" [ngTemplateOutletContext]="{ $implicit: g.elements, row: r, cols: g.columns ?? 1 }" />
                          </div>
                        </section>
                      } @empty {
                        <p class="ui-fr-empty">{{ e.mode === 'view' ? 'None added.' : 'Nothing added yet.' }}</p>
                      }
                      @if (e.mode !== 'view') {
                        @if (removed()?.groupId === g.id) {
                          <p class="ui-fr-undo">{{ removed()!.label }} removed.
                            <button type="button" class="ui-fr-link" (click)="undoRemove()">Undo</button></p>
                        }
                        <div class="ui-fr-add" [attr.data-fr-add]="g.id">
                          <ui-button variant="outline" size="sm" type="button" [disabled]="!e.canAddRow(g.id) || e.instanceState(g.id, row).disabled" (click)="addRow(g)">
                            <hugeicons-icon aria-hidden="true" [icon]="addIcon" [size]="15" [strokeWidth]="1.8" />{{ g.repeat.addLabel || 'Add another' }}
                          </ui-button>
                          @if (g.repeat.max) { <span class="ui-fr-count">{{ rows.length }} of {{ g.repeat.max }}</span> }
                        </div>
                      }
                    } @else {
                      <div class="ui-fr-grid">
                        <ng-container [ngTemplateOutlet]="elements" [ngTemplateOutletContext]="{ $implicit: g.elements, row: row, cols: g.columns ?? 1 }" />
                      </div>
                    }
                  </fieldset>
                }
              }
            </div>
          }
        }
      </ng-template>
      <div class="ui-fr-live" aria-live="polite">{{ announce() }}</div>
    }
  `,
  styles: `
    .ui-fr-host { display: block; container: ui-fr / inline-size; color: var(--ui-color-text); font-family: var(--ui-font-default); }
    .ui-fr { display: flex; flex-direction: column; gap: var(--ui-space-4); }
    .ui-fr-header { display: flex; flex-direction: column; gap: var(--ui-space-1); }
    .ui-fr-title, .ui-fr-heading, .ui-fr-legend, .ui-fr-desc, .ui-fr-para, .ui-fr-page-title, .ui-fr-entry-head h4 { overflow-wrap: anywhere; }
    .ui-fr-title { margin: 0; font-family: var(--ui-font-display); font-size: 20px; font-weight: 600; letter-spacing: var(--ui-tracking-tight, -0.01em); }
    .ui-fr-desc { margin: 0; color: var(--ui-color-text-secondary); font-size: var(--ui-font-size-sm); line-height: 1.45; white-space: pre-wrap; }
    .ui-fr-progress { display: flex; flex-direction: column; gap: var(--ui-space-2); }
    .ui-fr-steps { display: flex; gap: 4px; }
    .ui-fr-steps .seg { flex: 1; height: 4px; border-radius: 2px; background: var(--ui-color-track, var(--ui-color-border)); transition: background var(--ui-motion-base) var(--ui-ease-standard); }
    .ui-fr-steps .seg.done { background: color-mix(in srgb, var(--ui-color-primary) 55%, var(--ui-color-track, var(--ui-color-border))); }
    .ui-fr-steps .seg.on { background: var(--ui-color-primary); }
    .ui-fr-step { margin: 0; font-size: var(--ui-font-size-sm); color: var(--ui-color-text-secondary); font-weight: 500; }
    .ui-fr-step .sep { margin-right: 2px; }
    .ui-fr-view-page > .ui-fr-page-head { margin-bottom: var(--ui-space-3); }
    .ui-fr-view-page + .ui-fr-view-page { margin-top: var(--ui-space-6); padding-top: var(--ui-space-6); border-top: 1px solid var(--ui-color-border); }
    .ui-fr-page-title { margin: 0 0 2px; font-size: var(--ui-font-size-lg); font-weight: 600; }
    .ui-fr-grid { display: grid; grid-template-columns: repeat(12, minmax(0, 1fr)); gap: var(--ui-space-4) var(--ui-space-3); }
    .ui-fr-cell { min-width: 0; }
    @container ui-fr (max-width: 560px) { .ui-fr-cell { grid-column: span 12 !important; } }
    .ui-fr-heading { margin: var(--ui-space-2) 0 0; font-family: var(--ui-font-display); font-size: var(--ui-font-size-lg); font-weight: 600; }
    .ui-fr-para { margin: 0; color: var(--ui-color-text-secondary); font-size: var(--ui-font-size-sm); line-height: 1.5; white-space: pre-wrap; }
    .ui-fr-hr { border: 0; border-top: 1px solid var(--ui-color-border-subtle, var(--ui-color-border)); margin: var(--ui-space-1) 0; }
    .ui-fr-group { margin: 0; padding: var(--ui-space-3); border: 1px solid var(--ui-color-border-subtle, var(--ui-color-border)); border-radius: var(--ui-radius);
      display: flex; flex-direction: column; gap: var(--ui-space-3); min-width: 0; }
    .ui-fr-group:disabled { opacity: 0.6; }
    .ui-fr-legend { padding: 0 var(--ui-space-1); margin-left: calc(-1 * var(--ui-space-1)); font-weight: 600; font-size: var(--ui-font-size-md); }
    .ui-fr-entry { display: flex; flex-direction: column; gap: var(--ui-space-3); padding: var(--ui-space-3); border-radius: var(--ui-radius); background: var(--ui-color-surface-subtle, var(--ui-color-surface)); }
    .ui-fr-entry-head { display: flex; align-items: center; justify-content: space-between; gap: var(--ui-space-2); min-height: 24px; }
    .ui-fr-entry-head h4 { margin: 0; font-size: var(--ui-font-size-sm); font-weight: 600; color: var(--ui-color-text-secondary); }
    .ui-fr-entry-tools { display: flex; gap: 2px; }
    .ui-fr-icon { display: inline-grid; place-items: center; width: 28px; height: 28px; border: 0; border-radius: var(--ui-radius-xs); background: transparent; color: var(--ui-color-text-muted); cursor: pointer; }
    .ui-fr-icon:hover:not(:disabled) { background: var(--ui-color-surface-hover); color: var(--ui-color-text); }
    .ui-fr-icon.danger:hover:not(:disabled) { color: var(--ui-color-danger); }
    .ui-fr-icon:disabled { opacity: 0.35; cursor: default; }
    .ui-fr-icon:focus-visible { outline: none; box-shadow: var(--ui-focus-ring); }
    @media (pointer: coarse) { .ui-fr-icon { width: 40px; height: 40px; } }
    .ui-fr-add { display: flex; align-items: center; gap: var(--ui-space-3); }
    .ui-fr-add ui-button hugeicons-icon { margin-right: 4px; }
    .ui-fr-undo { margin: 0; font-size: var(--ui-font-size-sm); color: var(--ui-color-text-secondary); }
    .ui-fr-link { border: 0; background: none; padding: 0 2px; color: var(--ui-color-primary); font: inherit; font-weight: 600; cursor: pointer; text-decoration: underline; text-underline-offset: 2px; }
    .ui-fr-link:focus-visible { outline: none; box-shadow: var(--ui-focus-ring); border-radius: 2px; }
    .ui-fr-count, .ui-fr-empty { font-size: var(--ui-font-size-sm); color: var(--ui-color-text-muted); margin: 0; }
    .ui-fr-summary { padding: var(--ui-space-3); border: 1px solid color-mix(in srgb, var(--ui-color-danger) 55%, transparent); border-left-width: 4px;
      border-radius: var(--ui-radius); background: color-mix(in srgb, var(--ui-color-danger) 8%, var(--ui-color-surface)); }
    .ui-fr-summary:focus { outline: none; box-shadow: var(--ui-focus-ring); }
    .ui-fr-summary-title { margin: 0 0 var(--ui-space-1); font-size: var(--ui-font-size-md); font-weight: 600; }
    .ui-fr-summary ul { margin: 0; padding-left: var(--ui-space-4); display: flex; flex-direction: column; gap: 2px; }
    .ui-fr-summary a { color: var(--ui-color-danger); font-size: var(--ui-font-size-sm); text-underline-offset: 2px; }
    .ui-fr-footer { display: flex; align-items: center; justify-content: space-between; gap: var(--ui-space-3); flex-wrap: wrap;
      padding-top: var(--ui-space-3); border-top: 1px solid var(--ui-color-border-subtle, var(--ui-color-border)); }
    .ui-fr-footer-start, .ui-fr-footer-end { display: flex; align-items: center; gap: var(--ui-space-2); }
    .ui-fr-footer-end { margin-left: auto; }
    .ui-fr-saved { font-size: var(--ui-font-size-sm); color: var(--ui-color-text-muted); }
    .ui-fr-changes { position: relative; font-size: var(--ui-font-size-sm); }
    .ui-fr-changes summary { cursor: pointer; color: var(--ui-color-text-secondary); list-style: none; padding: 4px var(--ui-space-2); border-radius: var(--ui-radius-xs); }
    .ui-fr-changes summary::-webkit-details-marker { display: none; }
    .ui-fr-changes summary:hover { background: var(--ui-color-surface-hover); }
    .ui-fr-changes ul { position: absolute; right: 0; bottom: calc(100% + 6px); z-index: 2; width: min(360px, 80vw); max-height: 260px; overflow: auto; margin: 0; padding: var(--ui-space-2);
      list-style: none; display: flex; flex-direction: column; gap: 6px; background: var(--ui-color-surface-raised, var(--ui-color-surface)); border: 1px solid var(--ui-color-border); border-radius: var(--ui-radius); box-shadow: var(--ui-shadow-2); }
    .ui-fr-changes li { display: grid; grid-template-columns: minmax(0, 1fr); gap: 1px; overflow-wrap: anywhere; }
    .ui-fr-changes .what { font-weight: 550; }
    .ui-fr-changes .from { color: var(--ui-color-text-muted); text-decoration: line-through; }
    .ui-fr-changes .to { color: var(--ui-color-text); }
    .ui-fr-live { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); }
    .ui-fr-enter { animation: ui-fr-in var(--ui-motion-base) var(--ui-ease-decelerate, ease-out); }
    @keyframes ui-fr-in { from { opacity: 0; transform: translateY(-4px); } }
    @media (prefers-reduced-motion: reduce) { .ui-fr-enter { animation: none; } .ui-fr-steps .seg { transition: none; } }
  `,
})
export class UiFormRenderer {
  private readonly injector = inject(Injector);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly registered = (inject(UI_FB_VALIDATORS, { optional: true }) ?? []).flat();

  readonly definition = input.required<UiFormDefinition>();
  /** Saved answers to edit or view. */
  readonly data = input<Record<string, unknown> | null>(null);
  /** Defaults to `edit` when `data` is given, otherwise `create`. */
  readonly mode = input<UiFormMode | null>(null);
  /** Extra app checks, on top of the ones from `provideUiFormValidators`. */
  readonly validators = input<readonly UiFbValidatorDef[]>([]);
  /** Uploads files as they're picked; without it, files ride along in the submission. */
  readonly uploader = input<UiFbUploader | null>(null);
  readonly showTitle = input(true);
  readonly showActions = input(true);
  readonly submitLabel = input<string | null>(null);
  readonly cancelLabel = input<string | null>(null);
  /** Shows the primary button as busy (e.g. while the host saves). */
  readonly busy = input(false);
  /** Fixes "today" (previews and tests). */
  readonly today = input<(() => string) | null>(null);

  readonly submitted = output<UiFormSubmission>();
  readonly cancelled = output<void>();
  /** The answers as they'd be saved, after every change. */
  readonly valueChange = output<Record<string, unknown>>();
  readonly dirtyChange = output<boolean>();

  protected readonly uid = `fr${++rendererSeq}`;
  protected readonly addIcon = FB_ICONS.Add01Icon;
  protected readonly deleteIcon = FB_ICONS.Delete02Icon;
  protected readonly upIcon = FB_ICONS.ArrowUp01Icon;
  protected readonly downIcon = FB_ICONS.ArrowDown01Icon;

  /** The running form. Hosts can read `data()`, `dirty()`, `changes()` from it. */
  readonly engine = signal<UiFormEngine | null>(null);
  protected readonly announce = signal('');
  /** The repeat entry removed last, for its Undo. */
  protected readonly removed = signal<(UiFbRemovedRow & { label: string }) | null>(null);
  private removedTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly resetTick = signal(0);
  private readonly summaryBox = viewChild<ElementRef<HTMLElement>>('summaryBox');
  private readonly fields = viewChildren(UiFbFieldView);

  protected readonly multiPage = computed(() => (this.engine()?.path().length ?? 0) > 1);
  protected readonly summary = computed(() => {
    const e = this.engine();
    if (!e || !e.settings.errorSummary) return [];
    const page = e.page();
    return e.attempted().has(page.id) ? e.pageErrors(e.pageIndex()) : [];
  });
  protected readonly primaryLabel = computed(() => {
    const e = this.engine();
    if (!e) return '';
    if (!e.isLastPage()) return e.definition.settings?.nextLabel || 'Continue';
    return this.submitLabel() || e.definition.settings?.submitLabel || (e.mode === 'edit' ? 'Save changes' : 'Submit');
  });

  constructor() {
    effect((onCleanup) => {
      this.resetTick();
      const definition = this.definition();
      const data = this.data();
      const mode = this.mode();
      const validators = [...this.registered, ...this.validators()];
      const today = this.today();
      const e = untracked(() => new UiFormEngine({
        definition, data, mode: mode ?? undefined, validators, injector: this.injector, today: today ?? undefined,
      }));
      this.engine.set(e);
      onCleanup(() => e.destroy());
    });
    let first = true;
    effect(() => {
      const e = this.engine();
      if (!e) return;
      const data = e.data();
      const dirty = e.dirty();
      if (first) { first = false; return; }
      untracked(() => { this.valueChange.emit(data); this.dirtyChange.emit(dirty); });
    });
  }

  /** Starts over from the data the form was given (or blank), back on the first page. */
  reset(): void {
    this.resetTick.update((n) => n + 1);
  }

  /** Continue on inner pages, submit on the last. */
  protected primary(): void {
    const e = this.engine();
    if (!e) return;
    if (!e.isLastPage()) {
      if (e.next()) this.pageChanged();
      else this.showSummary();
      return;
    }
    this.submit();
  }

  /** Validates everything and emits `submitted` when it's all fine. Returns the submission. */
  submit(): UiFormSubmission | null {
    const e = this.engine();
    if (!e) return null;
    const before = e.pageIndex();
    const s = e.submit();
    if (!s) {
      if (e.pageIndex() !== before) this.pageChanged();
      this.showSummary();
      return null;
    }
    this.submitted.emit(s);
    return s;
  }

  protected back(): void {
    if (this.engine()?.back()) this.pageChanged();
  }

  protected addRow(g: UiFbGroup): void {
    const e = this.engine();
    if (!e?.addRow(g.id)) return;
    this.announce.set(`${this.entryLabel(g, e.rows(g.id).length - 1)} added`);
  }

  protected removeRow(g: UiFbGroup, row: string, n: number): void {
    const snapshot = this.engine()?.removeRow(g.id, row);
    if (!snapshot) return;
    const label = this.entryLabel(g, n);
    this.removed.set({ ...snapshot, label });
    this.announce.set(`${label} removed. Undo is next to the add button.`);
    if (this.removedTimer) clearTimeout(this.removedTimer);
    this.removedTimer = setTimeout(() => this.removed.set(null), 12000);
    // The button that was pressed is gone; keep focus in the same place in the form.
    afterNextRender(() => this.host.nativeElement.querySelector<HTMLElement>(`[data-fr-add="${g.id}"] button`)?.focus(), { injector: this.injector });
  }

  protected undoRemove(): void {
    const r = this.removed();
    if (!r) return;
    this.engine()?.restoreRow(r);
    this.removed.set(null);
    this.announce.set(`${r.label} restored`);
  }

  protected focusField(addr: string): void {
    this.fields().find((f) => f.addr() === addr)?.focus();
  }

  protected entryLabel(g: UiFbGroup, n: number): string {
    return (g.repeat?.itemLabel || 'Entry {n}').replace('{n}', String(n + 1));
  }

  protected span(el: UiFbElement, cols: number): number {
    const w = el.kind === 'static' && el.type !== 'paragraph' ? undefined : el.layout?.width;
    if (w) return SPAN[w] ?? 12;
    if (el.kind === 'static' && el.type !== 'paragraph') return 12;
    return cols > 1 ? Math.round(12 / cols) : 12;
  }

  protected show(c: UiFbChange, v: unknown): string {
    if (v === null || v === undefined || v === '') return 'Empty';
    const id = [...(this.engine()?.index.values() ?? [])].find((x) => x.kind === 'field' && this.engine()?.dataPath(x.id, null) === c.path.replace(/\[\d+\]/g, ''))?.id;
    const field = id ? this.engine()?.field(id) : undefined;
    return field ? formatValue(field, v) || 'Empty' : typeof v === 'object' ? JSON.stringify(v) : String(v);
  }

  protected asField(el: UiFbElement): UiFbField {
    return el as UiFbField;
  }

  protected asGroup(el: UiFbElement): UiFbGroup {
    return el as UiFbGroup;
  }

  private showSummary(): void {
    if (!this.engine()?.settings.errorSummary) {
      afterNextRender(() => this.fields().find((f) => this.summaryFirst() === f.addr())?.focus(), { injector: this.injector });
      return;
    }
    afterNextRender(() => this.summaryBox()?.nativeElement.focus(), { injector: this.injector });
  }

  private summaryFirst(): string | undefined {
    const e = this.engine();
    return e?.pageErrors(e.pageIndex())[0]?.addr;
  }

  private pageChanged(): void {
    const e = this.engine();
    if (!e) return;
    const page = e.page();
    this.announce.set(`Step ${e.step() + 1} of ${e.path().length}${page.title ? `: ${page.title}` : ''}`);
    afterNextRender(() => {
      const el = this.host.nativeElement;
      if (el.getBoundingClientRect().top < 0) el.scrollIntoView({ block: 'start' });
      el.querySelector<HTMLElement>('input, textarea, select, [tabindex="0"]')?.focus({ preventScroll: true });
    }, { injector: this.injector });
  }
}
