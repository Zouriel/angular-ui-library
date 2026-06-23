import { Component, inject, signal } from '@angular/core';
import { UiText } from 'ui/text';
import { UiButton } from 'ui/button';
import { UiBadge } from 'ui/badge';
import { UiWindow, UiDraggable, UiResizable, UiWindowManager } from 'ui/window';
import { DocPage, DocSection, DocDemo, type ApiRow } from '../docs/docs-ui';

@Component({
  selector: 'page-window',
  imports: [UiText, UiButton, UiBadge, UiWindow, UiDraggable, UiResizable, DocPage, DocSection, DocDemo],
  template: `
    <doc-page eyebrow="Flagship" title="Window system"
      lead="A floating, draggable, resizable window shell coordinated by a manager. Drag the title bar to a screen edge to snap (left/right half, maximize); resize from any edge or corner; minimize / maximize / restore / close; focus-to-front z-stacking.">

      <doc-section name="Window" selector="ui-window" [api]="winApi" [outputs]="winOut"
        summary="Bind [(open)]. Hosts any content via <ng-content>. Self-registers with UiWindowManager for focus + bulk ops.">
        <doc-demo code="<ui-window [(open)]=&quot;open&quot; title=&quot;Inspector&quot;
  [initialX]=&quot;120&quot; [initialY]=&quot;120&quot; [initialWidth]=&quot;460&quot; [initialHeight]=&quot;300&quot;>
  …content…
</ui-window>">
          <div class="row">
            <ui-button (click)="win1.set(true)">Open window</ui-button>
            <ui-button variant="outline" (click)="win2.set(true)">Open second</ui-button>
            <ui-badge tone="primary">{{ wm.count() }} open</ui-badge>
          </div>
        </doc-demo>
      </doc-section>

      <doc-section name="Window manager" selector="UiWindowManager" [api]="mgrApi"
        summary="Injectable (providedIn root). Coordinates focus order, z-index, and bulk operations; tracks count() reactively.">
        <doc-demo code="wm = inject(UiWindowManager);
wm.tile();          // grid-arrange all open windows
wm.minimizeAll();
wm.restoreAll();
wm.focus(id); wm.dock(id, 'left');">
          <div class="row">
            <ui-button variant="ghost" size="sm" (click)="wm.tile()">Tile</ui-button>
            <ui-button variant="ghost" size="sm" (click)="wm.minimizeAll()">Minimize all</ui-button>
            <ui-button variant="ghost" size="sm" (click)="wm.restoreAll()">Restore all</ui-button>
          </div>
        </doc-demo>
      </doc-section>

      <doc-section name="uiDraggable" selector="[uiDraggable]" [api]="dragApi" [outputs]="dragOut"
        summary="Reusable behavior directive. Moves the host via a CSS transform; keeps a two-way [(position)]. Restrict the grab area with uiDragHandle."
        [shapes]="'interface UiDragPosition { x: number; y: number; }\ninterface UiDragEvent extends UiDragPosition { pointerX: number; pointerY: number; }'">
        <doc-demo code="<div uiDraggable [(position)]=&quot;pos&quot; (dragEnd)=&quot;save($event)&quot;>drag</div>">
          <div class="dz"><div class="dbox" uiDraggable>drag me</div></div>
        </doc-demo>
      </doc-section>

      <doc-section name="uiResizable" selector="[uiResizable]" [api]="rzApi" [outputs]="rzOut"
        summary="Reusable behavior directive. Adds E / S / SE resize handles to the host and resizes it in place.">
        <doc-demo code="<div uiResizable [minWidth]=&quot;120&quot; [minHeight]=&quot;70&quot; (resized)=&quot;on($event)&quot;>resize</div>">
          <div class="rbox" uiResizable [minWidth]="120" [minHeight]="70">resize me ↘</div>
        </doc-demo>
      </doc-section>
    </doc-page>

    @if (win1()) {
      <ui-window [(open)]="win1" title="Inspector" [initialX]="140" [initialY]="140" [initialWidth]="440" [initialHeight]="280">
        <ui-text variant="body">Drag the title bar; snap to an edge; resize from corners; use the chrome buttons.</ui-text>
      </ui-window>
    }
    @if (win2()) {
      <ui-window [(open)]="win2" title="Activity" [initialX]="230" [initialY]="210" [initialWidth]="360" [initialHeight]="240">
        <ui-text variant="body">A second floating window. Click to bring to front.</ui-text>
      </ui-window>
    }
  `,
  styles: `
    .row { display: flex; flex-wrap: wrap; gap: var(--ui-space-3); align-items: center; }
    .dz { position: relative; height: 120px; border: 1px dashed var(--ui-color-border); border-radius: var(--ui-radius); overflow: hidden; }
    .dbox { position: absolute; left: 12px; top: 12px; display: flex; align-items: center; justify-content: center; width: 90px; height: 50px;
      background: var(--ui-color-primary); color: var(--ui-color-primary-contrast); border-radius: var(--ui-radius); cursor: grab; font-size: var(--ui-font-size-sm); user-select: none; }
    .rbox { display: flex; align-items: flex-end; justify-content: flex-end; width: 160px; height: 90px; padding: var(--ui-space-2);
      background: var(--ui-color-surface-raised); border: 1px solid var(--ui-color-border); border-radius: var(--ui-radius); color: var(--ui-color-text-muted); font-size: var(--ui-font-size-sm); }
  `,
})
export class WindowPage {
  protected readonly wm = inject(UiWindowManager);
  protected readonly win1 = signal(false);
  protected readonly win2 = signal(false);

  protected readonly winApi: ApiRow[] = [
    { name: 'open', type: 'boolean (model)', default: 'true', desc: 'Two-way open state.' },
    { name: 'title', type: 'string', default: "'Window'", desc: 'Title bar text + aria-label.' },
    { name: 'draggable', type: 'boolean', default: 'true', desc: 'Enable title-bar dragging.' },
    { name: 'resizable', type: 'boolean', default: 'true', desc: 'Enable edge/corner resize.' },
    { name: 'initialX / initialY', type: 'number', default: '80 / 80', desc: 'Starting position (px).' },
    { name: 'initialWidth / initialHeight', type: 'number', default: '440 / 300', desc: 'Starting size (px).' },
    { name: 'glass / radius', type: 'boolean', default: 'UiConfig', desc: 'Surface treatment.' },
  ];
  protected readonly winOut: ApiRow[] = [{ name: 'closed', type: 'void', default: '—', desc: 'Window closed.' }];
  protected readonly mgrApi: ApiRow[] = [
    { name: 'count()', type: 'Signal<number>', default: '—', desc: 'Open window count.' },
    { name: 'focusedId()', type: 'Signal<string|null>', default: '—', desc: 'Front-most window id.' },
    { name: 'tile()', type: '() => void', default: '—', desc: 'Grid-arrange all windows.' },
    { name: 'minimizeAll() / restoreAll()', type: '() => void', default: '—', desc: 'Bulk min/restore.' },
    { name: 'focus(id) / dock(id, side)', type: 'method', default: '—', desc: 'Programmatic control.' },
  ];
  protected readonly dragApi: ApiRow[] = [
    { name: 'position', type: 'UiDragPosition (model)', default: '{x:0,y:0}', desc: 'Two-way offset.' },
    { name: 'uiDragHandle', type: 'HTMLElement', default: '—', desc: 'Optional grab-only element.' },
    { name: 'uiDraggableDisabled', type: 'boolean', default: 'false', desc: 'Disable dragging.' },
  ];
  protected readonly dragOut: ApiRow[] = [
    { name: 'dragStart / dragMove / dragEnd', type: 'UiDragEvent', default: '—', desc: 'Drag lifecycle with pointer coords.' },
  ];
  protected readonly rzApi: ApiRow[] = [
    { name: 'minWidth', type: 'number', default: '80', desc: 'Minimum width (px).' },
    { name: 'minHeight', type: 'number', default: '48', desc: 'Minimum height (px).' },
    { name: 'uiResizableDisabled', type: 'boolean', default: 'false', desc: 'Disable resizing.' },
  ];
  protected readonly rzOut: ApiRow[] = [{ name: 'resized', type: '{ width, height }', default: '—', desc: 'New dimensions.' }];
}
