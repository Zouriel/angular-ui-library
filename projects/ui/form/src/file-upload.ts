import { Component, input, output, signal } from '@angular/core';
import { HugeiconsIconComponent } from '@hugeicons/angular';
import CloudUploadIcon from '@hugeicons/core-free-icons/CloudUploadIcon';
import Delete02Icon from '@hugeicons/core-free-icons/Delete02Icon';
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
           [class.has-preview]="!!preview()" [class.fit-contain]="previewFit() === 'contain'"
           [style.--upload-aspect]="preview() ? previewAspect() : null"
           (dragover)="onDragOver($event)" (dragleave)="dragOver.set(false)" (drop)="onDrop($event)">
      <input type="file" class="native" [disabled]="disabled()" [multiple]="multiple()" [attr.accept]="accept()" (change)="onPick($event)"
             [attr.aria-label]="preview() ? (previewAlt() ? previewAlt() + '. ' : '') + (replaceLabel() ?? strings.uploadReplace) : null" />
      @if (preview(); as src) {
        <img class="preview" [src]="src" [attr.alt]="previewAlt() ?? ''" />
        <span class="replace"><hugeicons-icon [icon]="uploadIcon" [size]="16" [strokeWidth]="1.8" />{{ replaceLabel() ?? strings.uploadReplace }}</span>
      } @else {
        <span class="icon" aria-hidden="true"><hugeicons-icon [icon]="uploadIcon" [size]="22" [strokeWidth]="1.8" /></span>
        <span class="hint"><strong>{{ label() ?? strings.uploadLabel }}</strong>@if (hint() ?? strings.uploadHint; as h) { {{ ' ' + h }} }</span>
        @if (acceptLabel() ?? accept(); as label) { <span class="accept">{{ label }}</span> }
      }
    </label>
    @if (preview() && removable()) {
      <button type="button" class="remove" [disabled]="disabled()" (click)="remove.emit()">
        <hugeicons-icon [icon]="removeIcon" [size]="16" [strokeWidth]="1.8" />{{ removeLabel() ?? strings.uploadRemove }}
      </button>
    }
    @if (showFiles() && files().length && !preview()) {
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
    .dz.has-preview { position: relative; padding: 0; overflow: hidden; border-style: solid; border-color: var(--ui-color-border); min-height: 120px; aspect-ratio: var(--upload-aspect, 16 / 9); }
    .preview { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; display: block; }
    /* A contained picture (a logo) keeps clear of the label at the bottom. */
    .fit-contain .preview { object-fit: contain; padding: var(--ui-space-3) var(--ui-space-3) calc(var(--ui-space-3) + 32px); box-sizing: border-box; }
    .replace { position: absolute; left: 50%; bottom: var(--ui-space-2); transform: translateX(-50%); display: inline-flex; align-items: center;
      gap: var(--ui-space-1); max-width: calc(100% - 2 * var(--ui-space-2)); padding: var(--ui-space-1) var(--ui-space-3); border-radius: 999px;
      background: color-mix(in srgb, var(--ui-color-surface) 88%, transparent); color: var(--ui-color-text); box-shadow: var(--ui-shadow-1);
      font-family: var(--ui-font-default); font-size: var(--ui-font-size-sm); line-height: 1.35; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .dz.has-preview:not(.disabled):hover { background: var(--ui-color-surface); }
    .dz.has-preview:not(.disabled):hover .replace, .dz.has-preview.over .replace { background: var(--ui-color-primary); color: var(--ui-color-primary-contrast); }
    .remove { margin-top: var(--ui-space-2); display: inline-flex; align-items: center; gap: var(--ui-space-1); min-height: 36px;
      padding: 0 var(--ui-space-3); border: 0; border-radius: var(--ui-radius); background: transparent; color: var(--ui-color-text-muted);
      font-family: var(--ui-font-default); font-size: var(--ui-font-size-sm); cursor: pointer; }
    .remove:hover:not(:disabled) { background: var(--ui-color-surface-hover); color: var(--ui-color-danger); }
    .remove:focus-visible { outline: none; box-shadow: var(--ui-focus-ring); }
    .remove:disabled { opacity: .5; cursor: not-allowed; }
    .files { margin: var(--ui-space-2) 0 0; padding: 0; list-style: none; display: flex; flex-direction: column; gap: 2px; }
    .files li { display: flex; justify-content: space-between; gap: var(--ui-space-3); line-height: 1.35; padding: var(--ui-space-1) var(--ui-space-2);
      background: var(--ui-color-surface-raised); border-radius: var(--ui-radius-xs); font-family: var(--ui-font-default); font-size: var(--ui-font-size-sm); }
    .fn { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .sz { flex: none; color: var(--ui-color-text-muted); font-variant-numeric: tabular-nums; }
  `,
})
export class UiFileUpload {
  protected readonly uploadIcon = CloudUploadIcon;
  protected readonly removeIcon = Delete02Icon;

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
  /**
   * A picture already uploaded (its URL). The box then shows it, and clicking it picks a replacement
   * ("Click to change", the uploadReplace string, or `replaceLabel`). Null or '' shows the empty dropzone.
   */
  preview = input<string | null | undefined>(null);
  previewAlt = input<string | undefined>(undefined);
  /** `cover` fills the box (photos); `contain` shows all of it with room around (logos, transparent pictures). */
  previewFit = input<'cover' | 'contain'>('cover');
  /** The box's shape while it shows a picture, CSS aspect-ratio (e.g. '16 / 9', '1'). */
  previewAspect = input<string>('16 / 9');
  replaceLabel = input<string | undefined>(undefined);
  /** Shows a Remove button under the picture (the uploadRemove string, or `removeLabel`) that emits `(remove)`. */
  removable = input(false);
  removeLabel = input<string | undefined>(undefined);
  remove = output<void>();
  /**
   * List the picked files (name and size) under the box. Turn it off when the app shows its own list, such as
   * one with each file's upload progress (0.80.0).
   */
  showFiles = input(true);
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
