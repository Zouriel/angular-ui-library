import { DOCUMENT } from '@angular/common';
import { Component, ElementRef, afterRenderEffect, computed, inject, input, model, output, viewChild } from '@angular/core';
import { injectUiStrings, uiFormatString } from '@zouriel/ui';
import { UiButton } from '@zouriel/ui/button';
import { UiProgressBar } from '@zouriel/ui/progress';
import { UiModal } from './modal';

let taskSeq = 0;

/**
 * `ui-task-progress`: progress for a job over many files, with Cancel. Shows the title, "12 of 40"
 * (the built-in `taskCount`), a detail line (the file in hand) and a bar that fills as files finish (it
 * sweeps while `total` is 0). Cancel sets `stopping` (two-way) and emits `cancel`; the button then reads
 * Stopping, busy and disabled, until the job closes it or sets `stopping` back. Open it modally with
 * ui-task-progress-dialog, or place it anywhere.
 */
@Component({
  selector: 'ui-task-progress',
  imports: [UiButton, UiProgressBar],
  template: `
    <p class="title" [id]="titleId">{{ title() }}</p>
    @if (known()) { <p class="count">{{ countText() }}</p> }
    @if (detail()) { <p class="detail">{{ detail() }}</p> }
    <ui-progress-bar class="bar" [value]="pct()" [label]="title()" />
    <div class="actions">
      <ui-button variant="outline" size="sm" [loading]="stopping()" [disabled]="stopping()" (click)="onCancel()">
        {{ stopping() ? strings.taskStopping : (cancelLabel() ?? strings.cancel) }}
      </ui-button>
    </div>
  `,
  styles: `
    :host { display: flex; flex-direction: column; min-width: 0; font-family: var(--ui-font-default); color: var(--ui-color-text); line-height: 1.35; }
    p { margin: 0; }
    .title { font-weight: 600; font-size: var(--ui-font-size-md); margin-bottom: var(--ui-space-1); }
    .count { font-size: var(--ui-font-size-sm); font-weight: 500; font-variant-numeric: tabular-nums; }
    .detail { font-size: var(--ui-font-size-sm); color: var(--ui-color-text-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .bar { margin-top: var(--ui-space-3); }
    .actions { display: flex; justify-content: flex-end; margin-top: var(--ui-space-3); }
  `,
})
export class UiTaskProgress {
  protected readonly strings = injectUiStrings();
  readonly title = input.required<string>();
  /** How many are finished. */
  readonly done = input(0);
  /** How many there are; 0 while unknown (the bar sweeps). */
  readonly total = input(0);
  /** A line under the count, e.g. the file being worked on. */
  readonly detail = input<string | null>(null);
  /** Default: the built-in `cancel`. */
  readonly cancelLabel = input<string | undefined>(undefined);
  /** Two-way: true once Cancel is pressed (shows Stopping) until the job is closed or sets it back. */
  readonly stopping = model(false);
  readonly cancel = output<void>();
  /** The id of the title, for a dialog's aria-labelledby. */
  readonly titleId = `ui-task-progress-${taskSeq++}`;

  protected readonly known = computed(() => this.total() > 0);
  protected readonly clampedDone = computed(() => Math.max(0, Math.min(this.done(), this.total())));
  protected readonly countText = computed(() => uiFormatString(this.strings.taskCount, { done: this.clampedDone(), total: this.total() }));
  /** 0-100, as ui-progress-bar takes it; null sweeps. */
  protected readonly pct = computed(() => (this.known() ? (this.clampedDone() / this.total()) * 100 : null));

  /** Cancel, as the button does: from Escape in the dialog, for example. */
  onCancel(): void {
    if (this.stopping()) return;
    this.stopping.set(true);
    this.cancel.emit();
  }
}

/**
 * `ui-task-progress-dialog`: ui-task-progress in a small modal (like ui-confirm-dialog), for a job the
 * user waits on. Bind `[(open)]`; the backdrop doesn't close it, and Escape cancels like the Cancel
 * button. It closes only when the job sets `open` to false (Flutter: `controller.close()`).
 */
@Component({
  selector: 'ui-task-progress-dialog',
  imports: [UiModal, UiTaskProgress],
  host: { '(document:keydown.escape)': 'onEscape()' },
  template: `
    <ui-modal [(open)]="open" size="sm" [closeOnBackdrop]="false" [closeOnEscape]="false">
      <ui-task-progress [title]="title()" [done]="done()" [total]="total()" [detail]="detail()" [cancelLabel]="cancelLabel()"
        [(stopping)]="stopping" (cancel)="cancel.emit()" />
    </ui-modal>
  `,
})
export class UiTaskProgressDialog {
  private readonly doc = inject(DOCUMENT);
  readonly open = model(false);
  readonly title = input.required<string>();
  readonly done = input(0);
  readonly total = input(0);
  readonly detail = input<string | null>(null);
  readonly cancelLabel = input<string | undefined>(undefined);
  readonly stopping = model(false);
  readonly cancel = output<void>();

  private readonly progress = viewChild(UiTaskProgress, { read: ElementRef });

  constructor() {
    // ui-modal names a dialog by its title, and this one has none (its header would bring a close
    // button that skips Cancel): point the dialog at the progress title instead.
    afterRenderEffect(() => {
      if (!this.open()) return;
      const el = this.progress()?.nativeElement as HTMLElement | undefined;
      const dialog = el?.closest('[role="dialog"]');
      const title = el?.querySelector('.title');
      if (dialog && title?.id) dialog.setAttribute('aria-labelledby', title.id);
    });
  }

  protected onEscape(): void {
    if (!this.open() || this.stopping()) return;
    // Only the topmost dialog answers Escape: another one opened over this would close first.
    const layers = this.doc.querySelectorAll('[role="dialog"]');
    const last = layers[layers.length - 1];
    if (last && !last.querySelector('ui-task-progress')) return;
    this.stopping.set(true);
    this.cancel.emit();
  }
}
