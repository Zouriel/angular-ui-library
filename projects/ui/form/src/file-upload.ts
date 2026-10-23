import { Component, input, output, signal } from '@angular/core';
import { HugeiconsIconComponent } from '@hugeicons/angular';
import CloudUploadIcon from '@hugeicons/core-free-icons/CloudUploadIcon';
import { injectUiStrings } from '@zouriel/ui';

/**
 * `ui-file-upload` — drag-and-drop / click dropzone. Emits `(filesSelected)`. Dropped files are checked
 * against `accept` the same way the file dialog filters them; files that don't match go to `(rejected)`.
 */
@Component({
  selector: 'ui-file-upload',
  imports: [HugeiconsIconComponent],
  template: `
    <label class="dz" [class.over]="dragOver()" [class.no-radius]="!radius()" [class.disabled]="disabled()"
           (dragover)="onDragOver($event)" (dragleave)="dragOver.set(false)" (drop)="onDrop($event)">
      <input type="file" class="native" [disabled]="disabled()" [multiple]="multiple()" [attr.accept]="accept()" (change)="onPick($event)" />
      <span class="icon" aria-hidden="true"><hugeicons-icon [icon]="uploadIcon" [size]="22" [strokeWidth]="1.8" /></span>
      <span class="hint"><strong>{{ label() ?? strings.uploadLabel }}</strong>@if (hint() ?? strings.uploadHint; as h) { {{ ' ' + h }} }</span>
      @if (acceptLabel() ?? accept(); as label) { <span class="accept">{{ label }}</span> }
    </label>
    @if (files().length) {
      <ul class="files">
        @for (f of files(); track f.name) {
          <li><span class="fn" [attr.title]="f.name">{{ f.name }}</span><span class="sz">{{ size(f.size) }}</span></li>
        }
      </ul>
    }
  `,
  styles: `
    :host { display: block; }
    .dz { display: flex; flex-direction: column; align-items: center; gap: var(--ui-space-1);
      padding: var(--ui-space-6) var(--ui-space-4); text-align: center; cursor: pointer;
      border: 1px dashed var(--ui-control-border); border-radius: var(--ui-radius); background: var(--ui-color-surface);
      font-family: var(--ui-font-default); line-height: 1.35; transition: border-color var(--ui-motion-base) var(--ui-ease-standard), background var(--ui-motion-base) var(--ui-ease-standard); }
    .dz.no-radius { border-radius: 0; }
    .dz.disabled { opacity: .5; cursor: not-allowed; }
    .dz:not(.disabled):hover, .dz.over { border-color: var(--ui-color-primary); background: color-mix(in srgb, var(--ui-color-primary) 8%, var(--ui-color-surface)); }
    .dz:focus-within { outline: none; box-shadow: var(--ui-focus-ring); }
    .native { position: absolute; width: 0; height: 0; opacity: 0; }
    .icon { font-size: calc(22px * var(--ui-font-scale)); color: var(--ui-color-text-muted); }
    .hint { font-size: var(--ui-font-size-md); color: var(--ui-color-text); }
    .accept { font-size: var(--ui-font-size-sm); color: var(--ui-color-text-muted); overflow-wrap: anywhere; }
    .hint { overflow-wrap: anywhere; }
    .files { margin: var(--ui-space-2) 0 0; padding: 0; list-style: none; display: flex; flex-direction: column; gap: 2px; }
    .files li { display: flex; justify-content: space-between; gap: var(--ui-space-3); line-height: 1.35; padding: var(--ui-space-1) var(--ui-space-2);
      background: var(--ui-color-surface-raised); border-radius: var(--ui-radius-xs); font-family: var(--ui-font-default); font-size: var(--ui-font-size-sm); }
    .fn { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .sz { flex: none; color: var(--ui-color-text-muted); font-variant-numeric: tabular-nums; }
  `,
})
export class UiFileUpload {
  protected readonly uploadIcon = CloudUploadIcon;

  multiple = input(false);
  accept = input<string>();
  /** What to show for the accepted types, when `accept` itself reads badly (e.g. "PNG, JPEG or WebP"). */
  acceptLabel = input<string>();
  /** The action, in bold; defaults to the built-in uploadLabel string ("Click to upload"). */
  label = input<string | undefined>(undefined);
  /** What follows it ("or drag & drop" by default, the uploadHint string); '' hides it (a phone has nothing to drag from). */
  hint = input<string | undefined>(undefined);
  protected readonly strings = injectUiStrings();
  radius = input(true);
  disabled = input(false);
  filesSelected = output<File[]>();
  /** Dropped files that don't match `accept`. */
  rejected = output<File[]>();
  protected readonly files = signal<File[]>([]);
  protected readonly dragOver = signal(false);

  protected onDragOver(e: DragEvent): void { e.preventDefault(); if (!this.disabled()) this.dragOver.set(true); }
  protected onDrop(e: DragEvent): void {
    e.preventDefault();
    this.dragOver.set(false);
    if (this.disabled()) return;
    const dropped = Array.from(e.dataTransfer?.files ?? []);
    const ok = dropped.filter((f) => fileMatchesAccept(f, this.accept()));
    if (ok.length < dropped.length) this.rejected.emit(dropped.filter((f) => !ok.includes(f)));
    if (ok.length) this.commit(ok);
  }
  protected onPick(e: Event): void {
    this.commit(Array.from((e.target as HTMLInputElement).files ?? []));
  }
  private commit(list: File[]): void {
    const files = this.multiple() ? list : list.slice(0, 1);
    this.files.set(files);
    this.filesSelected.emit(files);
  }
  protected size(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  }
}

/**
 * Whether a file matches an `accept` list the way the browser's file dialog reads it: comma-separated
 * extensions (`.pdf`), exact MIME types (`image/png`) or wildcards (`image/*`). No list accepts all.
 */
export function fileMatchesAccept(file: File, accept: string | undefined): boolean {
  const rules = (accept ?? '').split(',').map((r) => r.trim().toLowerCase()).filter(Boolean);
  if (!rules.length) return true;
  const name = file.name.toLowerCase();
  const type = (file.type || '').toLowerCase();
  return rules.some((r) => (r.startsWith('.') ? name.endsWith(r) : r.endsWith('/*') ? type.startsWith(r.slice(0, -1)) : type === r));
}
