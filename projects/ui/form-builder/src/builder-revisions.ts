import { ChangeDetectionStrategy, Component, effect, input, output, signal } from '@angular/core';
import { UiButton } from '@zouriel/ui/button';
import { UiConfirmDialog } from '@zouriel/ui/dialog';
import { diffDefinitions } from './definition';
import type { UiFbRevision, UiFbRevisionStore } from './revisions';
import type { UiFormDefinition } from './schema';

const when = (iso: string): string => {
  const d = new Date(iso);
  return isNaN(d.getTime()) ? iso : new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(d);
};

/**
 * `ui-fb-revisions` — the published versions of a form, newest first. Each can be opened to see what
 * changed, compared with the draft, or restored: restoring replaces the draft with that version's
 * content (nothing goes live until the form is published again). The `restore` output carries the new draft.
 */
@Component({
  selector: 'ui-fb-revisions',
  imports: [UiButton, UiConfirmDialog],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="rev" aria-label="Version history">
      @if (loading()) {
        <p class="note" role="status">Loading versions…</p>
      } @else if (error(); as e) {
        <p class="note bad" role="alert">{{ e }}</p>
      } @else if (!items().length) {
        <p class="note">Nothing has been published yet. Each time you publish, the version is saved here so you can look back or restore it.</p>
      } @else {
        <ul class="list">
          @for (r of items(); track r.revision; let i = $index) {
            <li class="item">
              <div class="head">
                <strong>Version {{ r.revision }}</strong>
                @if (i === 0) { <span class="tag">Latest</span> }
                <span class="when">{{ when(r.publishedAt) }}@if (r.publishedBy) { · {{ r.publishedBy }} }</span>
              </div>
              @if (r.summary) { <p class="sum">{{ r.summary }}</p> }
              <div class="actions">
                <ui-button size="sm" variant="ghost" [attr.aria-expanded]="open() === r.revision" (click)="toggle('open', r.revision)">{{ open() === r.revision ? 'Hide what changed' : 'What changed' }}</ui-button>
                <ui-button size="sm" variant="ghost" [attr.aria-expanded]="compare() === r.revision" (click)="toggle('compare', r.revision)">{{ compare() === r.revision ? 'Hide comparison' : 'Compare with draft' }}</ui-button>
                <ui-button size="sm" variant="outline" [disabled]="busy()" (click)="ask(r)">Restore</ui-button>
              </div>
              @if (open() === r.revision) {
                <div class="detail">
                  <p class="lbl">Changed in version {{ r.revision }}</p>
                  @if (changes(r, i); as lines) {
                    @if (lines.length) { <ul>@for (l of lines; track $index) { <li>{{ l }}</li> }</ul> } @else { <p class="muted">No changes to the questions.</p> }
                  } @else { <p class="muted">This was the first version.</p> }
                </div>
              }
              @if (compare() === r.revision) {
                <div class="detail">
                  <p class="lbl">What the draft has changed since version {{ r.revision }}</p>
                  @if (vsDraft(r); as lines) {
                    @if (lines.length) { <ul>@for (l of lines; track $index) { <li>{{ l }}</li> }</ul> } @else { <p class="muted">The draft is the same as this version.</p> }
                  }
                </div>
              }
            </li>
          }
        </ul>
      }
      @if (restoreError()) { <p class="note bad" role="alert">{{ restoreError() }}</p> }
    </section>

    <ui-confirm-dialog [open]="!!target()" (openChange)="!$event && target.set(null)"
      [title]="'Restore version ' + (target()?.revision ?? '') + '?'"
      [message]="'The draft is replaced by version ' + (target()?.revision ?? '') + '. Questions you added since then are archived, not deleted, so answers already saved are kept. Nothing goes live until you publish.'"
      confirmLabel="Restore this version" (confirm)="restoreNow()" />
  `,
  styles: `
    :host { display: block; }
    .rev { display: flex; flex-direction: column; gap: var(--ui-space-3); }
    .list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: var(--ui-space-3); }
    .item { padding: var(--ui-space-3); border: 1px solid var(--ui-color-border); border-radius: var(--ui-radius); background: var(--ui-color-surface); display: flex; flex-direction: column; gap: var(--ui-space-2); }
    .head { display: flex; flex-wrap: wrap; align-items: baseline; gap: var(--ui-space-2); }
    .tag { font-size: 11px; font-weight: 550; padding: 0 6px; border-radius: var(--ui-radius-xs); color: var(--ui-color-success); background: color-mix(in srgb, var(--ui-color-success) 13%, transparent); }
    .when, .muted, .lbl { color: var(--ui-color-text-muted); font-size: 12px; }
    .sum { margin: 0; font-size: var(--ui-font-size-sm); color: var(--ui-color-text-secondary); }
    .actions { display: flex; flex-wrap: wrap; gap: var(--ui-space-1); margin-left: calc(var(--ui-space-3) * -1); }
    .actions > :last-child { margin-left: auto; margin-right: calc(var(--ui-space-3) * -1); }
    .detail { padding: var(--ui-space-2) var(--ui-space-3); border-radius: var(--ui-radius-sm); background: var(--ui-color-surface-subtle); }
    .detail p { margin: 0; }
    .detail ul { margin: var(--ui-space-1) 0 0; padding-inline-start: var(--ui-space-4); font-size: var(--ui-font-size-sm); display: flex; flex-direction: column; gap: var(--ui-space-1); }
    .note { margin: 0; padding: var(--ui-space-3); border-radius: var(--ui-radius-sm); font-size: var(--ui-font-size-sm); color: var(--ui-color-text-secondary); background: var(--ui-color-surface-subtle); }
    .note.bad { color: var(--ui-color-text); background: color-mix(in srgb, var(--ui-color-danger) 12%, var(--ui-color-surface)); }
  `,
})
export class UiFbRevisionPanel {
  store = input.required<UiFbRevisionStore>();
  formId = input.required<string>();
  /** The draft being edited, for "Compare with draft" and to carry over saved answers on restore. */
  current = input.required<UiFormDefinition>();
  /** The new draft after a restore. */
  restore = output<UiFormDefinition>();

  protected readonly items = signal<UiFbRevision[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal('');
  protected readonly restoreError = signal('');
  protected readonly busy = signal(false);
  protected readonly open = signal<number | null>(null);
  protected readonly compare = signal<number | null>(null);
  protected readonly target = signal<UiFbRevision | null>(null);
  protected readonly when = when;
  private seq = 0;

  constructor() {
    effect(() => {
      const store = this.store();
      const id = this.formId();
      const run = ++this.seq;
      this.open.set(null);
      this.compare.set(null);
      this.restoreError.set('');
      let result;
      try { result = store.listRevisions(id); } catch (e) { this.fail(e); return; }
      if (result instanceof Promise) {
        this.loading.set(true);
        this.error.set('');
        result.then((r) => run === this.seq && this.set(r), (e) => run === this.seq && this.fail(e));
      } else this.set(result);
    });
  }

  private set(list: UiFbRevision[]): void {
    this.items.set([...list].sort((a, b) => b.revision - a.revision));
    this.loading.set(false);
    this.error.set('');
  }
  private fail(e: unknown): void {
    this.loading.set(false);
    this.error.set(`The versions couldn’t be loaded${e instanceof Error && e.message ? ': ' + e.message : '.'}`);
  }

  protected toggle(which: 'open' | 'compare', revision: number): void {
    const s = which === 'open' ? this.open : this.compare;
    s.set(s() === revision ? null : revision);
  }

  /** What version [r] changed: the stored diff, else computed against the version before it. `null` for the first version. */
  protected changes(r: UiFbRevision, index: number): string[] | null {
    if (r.diff) return r.diff.summary;
    const before = this.items()[index + 1];
    return before ? this.lines(before.definition, r.definition) : null;
  }
  protected vsDraft(r: UiFbRevision): string[] {
    return this.lines(r.definition, this.current());
  }
  private lines(a: UiFormDefinition, b: UiFormDefinition): string[] {
    return diffDefinitions(a, b).summary;
  }

  protected ask(r: UiFbRevision): void {
    this.restoreError.set('');
    this.target.set(r);
  }
  protected async restoreNow(): Promise<void> {
    const r = this.target();
    if (!r) return;
    this.busy.set(true);
    try {
      const draft = await this.store().rollback(this.formId(), r.revision, this.current());
      this.restore.emit(draft);
    } catch (e) {
      this.restoreError.set(`Version ${r.revision} couldn’t be restored${e instanceof Error && e.message ? ': ' + e.message : '.'}`);
    } finally {
      this.busy.set(false);
      this.target.set(null);
    }
  }

}
