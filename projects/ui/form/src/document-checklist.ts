import { Component, computed, input, output, signal } from '@angular/core';
import { HugeiconsIconComponent } from '@hugeicons/angular';
import Delete02Icon from '@hugeicons/core-free-icons/Delete02Icon';
import FileUploadIcon from '@hugeicons/core-free-icons/FileUploadIcon';
import ViewIcon from '@hugeicons/core-free-icons/ViewIcon';
import { injectUiStrings, uiFormatString } from '@zouriel/ui';
import { UiBadge, type UiBadgeTone } from '@zouriel/ui/badge';
import { UiButton } from '@zouriel/ui/button';
import { fileMatchesAccept } from './file-upload';

export type UiDocumentStatus = 'missing' | 'attached' | 'verified' | 'draft' | 'rejected';

export interface UiDocumentItem {
  id: string;
  title: string;
  requirement?: string;
  status: UiDocumentStatus;
  reason?: string;
  accept?: string;
  maxSizeMb?: number;
  source?: 'upload' | 'registry';
  fileName?: string;
}

export interface UiDocumentUploadEvent {
  id: string;
  file: File;
}

const STATUS_TONE: Record<UiDocumentStatus, UiBadgeTone> = {
  missing: 'neutral',
  attached: 'primary',
  verified: 'success',
  draft: 'warning',
  rejected: 'danger',
};

/**
 * `ui-document-checklist` — documents step of an application. Each row shows its title, muted
 * requirement, soft status badge, and state-appropriate action (choose file, replace, view, remove).
 * Registry items need no upload and show where they came from; rejected items show their reason and
 * return to upload. Does not upload itself: emits `(upload)` after validating `accept` and `maxSizeMb`.
 */
@Component({
  selector: 'ui-document-checklist',
  imports: [HugeiconsIconComponent, UiBadge, UiButton],
  template: `
    <div class="checklist">
      <div class="summary" aria-live="polite" aria-atomic="true">{{ summaryText() }}</div>
      <ul class="rows">
        @for (item of items(); track item.id) {
          <li class="row" [class.rejected]="item.status === 'rejected'" [attr.data-doc-id]="item.id">
            <div class="info">
              <div class="head">
                <span class="title">{{ item.title }}</span>
                <ui-badge appearance="soft" [tone]="statusTone(item.status)">{{ statusLabel(item.status) }}</ui-badge>
              </div>
              @if (item.requirement) {
                <p class="req">{{ item.requirement }}</p>
              }
              @if (item.fileName && item.status !== 'missing') {
                <p class="file-name">{{ item.fileName }}</p>
              }
              @if (item.status === 'rejected' && item.reason) {
                <p class="reason" role="alert">{{ item.reason }}</p>
              }
              @if (errors()[item.id]; as err) {
                <p class="error" role="alert">{{ err }}</p>
              }
            </div>

            <div class="actions">
              @if (item.source !== 'registry') {
                <input #picker type="file" class="native" tabindex="-1" aria-hidden="true"
                  [attr.accept]="item.accept ?? null"
                  [disabled]="disabled()"
                  (change)="onFilePick(item, $event)" />

                @if (item.status === 'missing' || item.status === 'rejected' || item.status === 'draft') {
                  <ui-button variant="outline" size="sm" [disabled]="disabled()" (click)="picker.click()">
                    <hugeicons-icon [icon]="uploadIcon" [size]="16" [strokeWidth]="1.8" />
                    {{ strings.docChoose }}
                  </ui-button>
                } @else if (item.status === 'attached') {
                  <ui-button variant="outline" size="sm" [disabled]="disabled()" (click)="view.emit(item.id)">
                    <hugeicons-icon [icon]="viewIcon" [size]="16" [strokeWidth]="1.8" />
                    {{ strings.docView }}
                  </ui-button>
                  <ui-button variant="outline" size="sm" [disabled]="disabled()" (click)="picker.click()">
                    {{ strings.docReplace }}
                  </ui-button>
                  <ui-button variant="ghost" size="sm" [disabled]="disabled()"
                    [ariaLabel]="removeLabel(item)" (click)="remove.emit(item.id)">
                    <hugeicons-icon [icon]="removeIcon" [size]="16" [strokeWidth]="1.8" />
                  </ui-button>
                } @else if (item.status === 'verified') {
                  <ui-button variant="outline" size="sm" [disabled]="disabled()" (click)="view.emit(item.id)">
                    <hugeicons-icon [icon]="viewIcon" [size]="16" [strokeWidth]="1.8" />
                    {{ strings.docView }}
                  </ui-button>
                }
              } @else if (item.status === 'verified' || item.status === 'attached') {
                <ui-button variant="outline" size="sm" [disabled]="disabled()" (click)="view.emit(item.id)">
                  <hugeicons-icon [icon]="viewIcon" [size]="16" [strokeWidth]="1.8" />
                  {{ strings.docView }}
                </ui-button>
              }
            </div>
          </li>
        }
      </ul>
    </div>
  `,
  styles: `
    :host { display: block; font-family: var(--ui-font-default); }
    .checklist { display: flex; flex-direction: column; gap: var(--ui-space-3); }
    .summary {
      font-size: var(--ui-font-size-sm); font-weight: 600;
      color: var(--ui-color-text-muted); font-variant-numeric: tabular-nums;
    }
    .rows {
      margin: 0; padding: 0; list-style: none;
      display: flex; flex-direction: column; gap: var(--ui-space-2);
    }
    .row {
      display: flex; align-items: center; justify-content: space-between; gap: var(--ui-space-3);
      padding: var(--ui-space-3) var(--ui-space-4);
      border: 1px solid var(--ui-color-border); border-radius: var(--ui-radius);
      background: var(--ui-color-surface);
      text-align: start;
    }
    .row.rejected { border-color: var(--ui-color-danger); }
    .info { display: flex; flex-direction: column; gap: var(--ui-space-1); min-width: 0; flex: 1 1 auto; }
    .head { display: flex; align-items: center; flex-wrap: wrap; gap: var(--ui-space-2); }
    .title { font-size: var(--ui-font-size-md); font-weight: 600; color: var(--ui-color-text); line-height: 1.35; }
    .req, .file-name, .reason, .error { margin: 0; font-size: var(--ui-font-size-sm); line-height: 1.35; overflow-wrap: anywhere; }
    .req { color: var(--ui-color-text-muted); }
    .file-name { color: var(--ui-color-text); }
    .reason, .error { color: var(--ui-color-danger); }
    .actions { display: flex; align-items: center; flex-wrap: wrap; gap: var(--ui-space-2); flex: 0 0 auto; }
    .native { position: absolute; width: 0; height: 0; opacity: 0; pointer-events: none; }
    @media (max-width: 600px) {
      .row { flex-direction: column; align-items: stretch; }
      .actions { justify-content: flex-start; }
    }
  `,
})
export class UiDocumentChecklist {
  protected readonly strings = injectUiStrings();
  protected readonly uploadIcon = FileUploadIcon;
  protected readonly viewIcon = ViewIcon;
  protected readonly removeIcon = Delete02Icon;

  items = input<readonly UiDocumentItem[]>([]);
  disabled = input(false);

  upload = output<UiDocumentUploadEvent>();
  remove = output<string>();
  view = output<string>();

  protected readonly errors = signal<Record<string, string>>({});

  protected readonly summaryText = computed(() => {
    const list = this.items();
    const done = list.filter((i) => i.status === 'attached' || i.status === 'verified').length;
    return uiFormatString(this.strings.docCount, { done, total: list.length });
  });

  protected statusTone(status: UiDocumentStatus): UiBadgeTone {
    return STATUS_TONE[status];
  }

  protected statusLabel(status: UiDocumentStatus): string {
    switch (status) {
      case 'missing': return this.strings.docMissing;
      case 'attached': return this.strings.docAttached;
      case 'verified': return this.strings.docVerified;
      case 'draft': return this.strings.docDraft;
      case 'rejected': return this.strings.docRejected;
    }
  }

  protected removeLabel(item: UiDocumentItem): string {
    return uiFormatString(this.strings.remove, { label: item.title });
  }

  protected onFilePick(item: UiDocumentItem, event: Event): void {
    const inputEl = event.target as HTMLInputElement;
    const file = inputEl.files?.[0];
    inputEl.value = '';
    if (!file || this.disabled() || item.source === 'registry') return;

    if (item.accept && !fileMatchesAccept(file, item.accept)) {
      this.setError(item.id, this.strings.docInvalidType);
      return;
    }
    if (item.maxSizeMb != null && file.size > item.maxSizeMb * 1024 * 1024) {
      this.setError(item.id, uiFormatString(this.strings.docTooLarge, { max: item.maxSizeMb }));
      return;
    }

    this.clearError(item.id);
    this.upload.emit({ id: item.id, file });
  }

  private setError(id: string, message: string): void {
    this.errors.update((prev) => ({ ...prev, [id]: message }));
  }

  private clearError(id: string): void {
    if (!(id in this.errors())) return;
    this.errors.update((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }
}
