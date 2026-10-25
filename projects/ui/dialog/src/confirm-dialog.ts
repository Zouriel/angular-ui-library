import { Component, input, model, output, computed } from '@angular/core';
import { UiButton } from '@zouriel/ui/button';
import { UiModal } from './modal';
import { injectUiStrings } from '@zouriel/ui';

/**
 * `ui-confirm-dialog` — a focused confirm/cancel prompt built on `ui-modal`.
 * Bind `[(open)]` and listen to `(confirm)` / `(cancel)`.
 */
@Component({
  selector: 'ui-confirm-dialog',
  imports: [UiModal, UiButton],
  template: `
    <ui-modal [(open)]="open" [title]="titleText()" size="sm">
      <p class="msg">{{ message() }}</p>
      <div modal-footer class="actions" [class.destructive]="destructive()">
        <ui-button variant="outline" size="sm" (click)="cancelClick()">{{ cancelLabelText() }}</ui-button>
        <ui-button [variant]="destructive() ? 'destructive' : 'primary'" size="sm" (click)="confirmClick()">
          {{ confirmLabelText() }}
        </ui-button>
      </div>
    </ui-modal>
  `,
  styles: `
    .msg { margin: 0; color: var(--ui-color-text-muted); font-family: var(--ui-font-default); font-size: var(--ui-font-size-sm); line-height: 1.35; }
    /* Normal confirm: right-aligned, 8px apart. Destructive: Cancel far-left, the action far-right.
       No :host here: the modal renders in an overlay on <body>, outside this host element. */
    .actions { display: flex; flex: 1 1 auto; justify-content: flex-end; gap: var(--ui-space-2); }
    .actions.destructive { justify-content: space-between; }
  `,
})
export class UiConfirmDialog {
  protected readonly strings = injectUiStrings();
  open = model(false);
  /** Default: the built-in `confirmTitle` (Are you sure?), which follows the app's language. */
  title = input<string | undefined>(undefined);
  protected readonly titleText = computed(() => this.title() ?? this.strings.confirmTitle);
  message = input('');
  /** Default: the built-in `confirm` (Confirm), which follows the app's language. */
  confirmLabel = input<string | undefined>(undefined);
  protected readonly confirmLabelText = computed(() => this.confirmLabel() ?? this.strings.confirm);
  /** Default: the built-in `cancel` (Cancel), which follows the app's language. */
  cancelLabel = input<string | undefined>(undefined);
  protected readonly cancelLabelText = computed(() => this.cancelLabel() ?? this.strings.cancel);
  destructive = input(false);
  confirm = output<void>();
  cancel = output<void>();

  protected confirmClick(): void {
    this.confirm.emit();
    this.open.set(false);
  }
  protected cancelClick(): void {
    this.cancel.emit();
    this.open.set(false);
  }
}
