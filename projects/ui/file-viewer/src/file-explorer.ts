import { Component, computed, input, output, signal } from '@angular/core';
import { HugeiconsIconComponent } from '@hugeicons/angular';
import ArrowRight01Icon from '@hugeicons/core-free-icons/ArrowRight01Icon';
import File01Icon from '@hugeicons/core-free-icons/File01Icon';
import Folder01Icon from '@hugeicons/core-free-icons/Folder01Icon';
import Image02Icon from '@hugeicons/core-free-icons/Image02Icon';
import MusicNote02Icon from '@hugeicons/core-free-icons/MusicNote02Icon';
import Pdf01Icon from '@hugeicons/core-free-icons/Pdf01Icon';
import SourceCodeIcon from '@hugeicons/core-free-icons/SourceCodeIcon';
import Video02Icon from '@hugeicons/core-free-icons/Video02Icon';
import { injectUiStrings } from '@zouriel/ui';

export interface UiFileNode {
  name: string;
  type: 'file' | 'dir';
  /** File URL (for files), used when opening into a viewer. */
  url?: string;
  /** MIME/extension hint. */
  kind?: string;
  children?: UiFileNode[];
}

/** `ui-file-explorer` — directory browser: breadcrumb path + list view, typed icons, open-into-viewer. */
@Component({
  selector: 'ui-file-explorer',
  imports: [HugeiconsIconComponent],
  template: `
    <div class="fx">
      <nav class="crumbs" [attr.aria-label]="strings.path">
        <button type="button" class="crumb" [attr.aria-current]="trail().length ? null : 'location'" (click)="goTo(-1)">{{ root().name || 'root' }}</button>
        @for (seg of trail(); track $index) {
          <span class="sep" aria-hidden="true">/</span>
          <button type="button" class="crumb" [attr.aria-current]="$last ? 'location' : null" (click)="goTo($index)">{{ seg.name }}</button>
        }
      </nav>
      <ul class="list" role="list">
        @for (node of entries(); track node.name) {
          <li>
            <button type="button" class="row" [class.dir]="node.type === 'dir'"
                    (click)="node.type === 'dir' ? enter(node) : open.emit(node)">
              <span class="icon" aria-hidden="true"><hugeicons-icon [icon]="iconFor(node)" [size]="16" [strokeWidth]="1.6" /></span>
              <span class="name">{{ node.name }}</span>
              @if (node.type === 'dir') { <span class="chev" aria-hidden="true"><hugeicons-icon [icon]="chevIcon" [size]="14" [strokeWidth]="1.8" /></span> }
            </button>
          </li>
        } @empty {
          <li class="empty">Empty folder</li>
        }
      </ul>
    </div>
  `,
  styles: `
    :host { display: block; }
    .fx { border: 1px solid var(--ui-color-border); border-radius: var(--ui-radius); overflow: hidden; font-family: var(--ui-font-default); line-height: 1.35; }
    .crumbs { display: flex; flex-wrap: wrap; align-items: center; gap: var(--ui-space-1); padding: var(--ui-space-1) var(--ui-space-2);
      background: var(--ui-color-surface-raised); border-bottom: 1px solid var(--ui-color-border); }
    .crumb { box-sizing: border-box; height: var(--ui-size-sm); max-width: 16em; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
      background: none; border: none; color: var(--ui-color-text-muted); cursor: pointer; font: inherit; font-size: var(--ui-font-size-sm); padding: 0 var(--ui-space-1); border-radius: var(--ui-radius-xs);
      transition: background var(--ui-motion-base) var(--ui-ease-standard), color var(--ui-motion-base) var(--ui-ease-standard); }
    .crumb:hover { color: var(--ui-color-text); background: var(--ui-color-elevated-hover); }
    .crumb:focus-visible { outline: none; box-shadow: var(--ui-focus-ring); }
    .crumb[aria-current] { color: var(--ui-color-text); }
    .sep { color: var(--ui-color-text-muted); }
    .list { margin: 0; padding: var(--ui-space-1); list-style: none; max-height: 280px; overflow: auto; }
    .row { box-sizing: border-box; display: flex; align-items: center; gap: var(--ui-space-2); width: 100%; min-height: var(--ui-size-md);
      padding: var(--ui-space-1) var(--ui-space-2);
      background: none; border: none; border-radius: var(--ui-radius-xs); cursor: pointer; color: var(--ui-color-text); font: inherit; text-align: left;
      transition: background var(--ui-motion-base) var(--ui-ease-standard); }
    .row:hover { background: var(--ui-color-surface-hover); }
    /* Inset: the list scrolls, and an outset ring would be clipped at its edges. */
    .row:focus-visible { outline: none; box-shadow: inset 0 0 0 2px var(--ui-color-border-focus); }
    .icon, .chev { display: inline-flex; flex: none; color: var(--ui-color-text-muted); }
    .name { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: var(--ui-font-size-sm); }
    @media (pointer: coarse) { .row { min-height: var(--ui-size-touch); } }
    .empty { padding: var(--ui-space-4); text-align: center; color: var(--ui-color-text-muted); font-size: var(--ui-font-size-sm); }
  `,
})
export class UiFileExplorer {
  protected readonly strings = injectUiStrings();
  root = input.required<UiFileNode>();
  open = output<UiFileNode>();
  private readonly path = signal<UiFileNode[]>([]);

  protected readonly trail = computed(() => this.path());
  protected readonly entries = computed(() => {
    const dir = this.path().at(-1) ?? this.root();
    const kids = [...(dir.children ?? [])];
    return kids.sort((a, b) => (a.type === b.type ? a.name.localeCompare(b.name) : a.type === 'dir' ? -1 : 1));
  });

  protected enter(node: UiFileNode): void { this.path.update((p) => [...p, node]); }
  protected goTo(index: number): void {
    this.path.update((p) => (index < 0 ? [] : p.slice(0, index + 1)));
  }
  protected readonly chevIcon = ArrowRight01Icon;

  protected iconFor(node: UiFileNode): typeof File01Icon {
    if (node.type === 'dir') return Folder01Icon;
    const k = (node.kind || node.name.split('.').pop() || '').toLowerCase();
    if (/(png|jpe?g|gif|webp|svg|image)/.test(k)) return Image02Icon;
    if (/(mp4|webm|mov|video)/.test(k)) return Video02Icon;
    if (/(mp3|wav|ogg|audio)/.test(k)) return MusicNote02Icon;
    if (/pdf/.test(k)) return Pdf01Icon;
    if (/(ts|js|json|css|html|code)/.test(k)) return SourceCodeIcon;
    return File01Icon;
  }
}
