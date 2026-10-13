import { Component, computed, inject, signal } from '@angular/core';
import { UiText } from '@zouriel/ui/text';
import { UiButton } from '@zouriel/ui/button';
import { UiBadge } from '@zouriel/ui/badge';
import { UiWindow, UiDraggable, UiResizable, UiWindowManager, type UiDragPosition, type UiResizeEvent } from '@zouriel/ui/window';
import { DocPage, DocSection, DocDemo, type ApiRow } from '../docs/docs-ui';

@Component({
  selector: 'page-window',
  imports: [UiText, UiButton, UiBadge, UiWindow, UiDraggable, UiResizable, DocPage, DocSection, DocDemo],
  template: `
    <doc-page eyebrow="Flagship" title="Window system"
      lead="A floating, draggable, resizable window shell coordinated by a manager. Drag the title bar to a screen edge to snap (left/right half, bottom half, maximize); resize from any edge or corner; minimize / maximize / restore / close; focus-to-front z-stacking.">

      <doc-section name="Window" selector="ui-window" [api]="winApi" [outputs]="winOut"
        summary="A fixed-position window (role=dialog, named by title) that hosts any content. It opens inside the viewport, shrinking and moving the initial bounds if they would reach past it. Bind [(open)]: the Close button sets it false and emits (closed), and a closed window is removed from the screen and from UiWindowManager until it is opened again. Drag the title bar to move it with mouse, pen or touch; release with the pointer within 24px of the top edge to maximize, the left or right edge for that half, or the bottom edge for the bottom half. A drag keeps at least 48px of the title bar on screen, never above the top edge or below the bottom, so the window can always be grabbed again. Dragging never gives the top half (the top edge maximizes, as on desktop systems); dock('top') does. Double-click the title bar to maximize or restore. Resize from all eight edges and corners (minimum 220 × 120 px). The chrome buttons' hit areas and the resize handles grow on coarse pointers. Moving and resizing are pointer-only; there is no keyboard move.">
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
        [shapes]="'type UiDockSide = &quot;left&quot; | &quot;right&quot; | &quot;top&quot; | &quot;bottom&quot; | &quot;maximize&quot; | null;\ninterface UiWindowBounds { x: number; y: number; width: number; height: number; }\ninterface UiWindowHandle { id: string; minimize(): void; restore(): void; dock(side: UiDockSide): void; focus(): void; setBounds(bounds: UiWindowBounds): void; }'"
        summary="Injectable (providedIn root). Every open ui-window registers with it. It hands out z-indexes so the last focused window is in front, tracks count() and focusedId() reactively, and runs bulk operations. tile() fills the viewport with a grid.">
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
        summary="Moves the host with a CSS transform (translate) and keeps a two-way [(position)] offset. Works with mouse, pen and touch (it sets touch-action: none on the host); there is no keyboard move. Pass an element to [uiDragHandle] to grab only from there. The host's own transform is overwritten."
        [shapes]="'interface UiDragPosition { x: number; y: number; }\ninterface UiDragEvent extends UiDragPosition { pointerX: number; pointerY: number; }'">
        <doc-demo code="<div uiDraggable [uiDragHandle]=&quot;grip&quot; [(position)]=&quot;pos&quot; (dragEnd)=&quot;save($event)&quot;>
  <span #grip>Drag here</span> …
</div>">
          <div class="dz"><div class="dbox" uiDraggable [(position)]="dragPos">Drag me</div></div>
          <p class="note">Offset: {{ dragPos().x }}, {{ dragPos().y }}</p>
        </doc-demo>
      </doc-section>

      <doc-section name="uiResizable" selector="[uiResizable]" [api]="rzApi" [outputs]="rzOut"
        [shapes]="'interface UiResizeEvent { width: number; height: number; }\ntype UiResizeEdge = &quot;e&quot; | &quot;s&quot; | &quot;se&quot;;'"
        summary="Adds right, bottom and bottom-right resize handles to the host and resizes it in place by setting inline width and height. Works with mouse, pen and touch; there is no keyboard resize. It sets position: relative on the host, so the host should have its own size and not rely on another position value.">
        <doc-demo code="<div uiResizable [minWidth]=&quot;120&quot; [minHeight]=&quot;70&quot; (resized)=&quot;on($event)&quot;>resize</div>">
          <div class="rbox" uiResizable [minWidth]="120" [minHeight]="70" (resized)="rzSize.set($event)">{{ rzLabel() }}</div>
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
    .note { margin: var(--ui-space-2) 0 0; font-size: var(--ui-font-size-sm); color: var(--ui-color-text-muted); }
    .rbox { display: flex; align-items: flex-end; justify-content: flex-end; width: 160px; height: 90px; padding: var(--ui-space-2);
      background: var(--ui-color-surface-raised); border: 1px solid var(--ui-color-border); border-radius: var(--ui-radius); color: var(--ui-color-text-muted); font-size: var(--ui-font-size-sm); }
  `,
})
export class WindowPage {
  protected readonly wm = inject(UiWindowManager);
  protected readonly win1 = signal(false);
  protected readonly win2 = signal(false);
  protected readonly dragPos = signal<UiDragPosition>({ x: 0, y: 0 });
  protected readonly rzSize = signal<UiResizeEvent | null>(null);
  protected readonly rzLabel = computed(() => {
    const z = this.rzSize();
    return z ? `${Math.round(z.width)} × ${Math.round(z.height)}` : 'Drag the right or bottom edge';
  });

  protected readonly winApi: ApiRow[] = [
    { name: 'open', type: 'boolean', default: 'true', desc: 'Two-way (`[(open)]`). Whether the window is shown; Close sets it false.' },
    { name: 'title', type: 'string', default: "'Window'", desc: 'Title bar text + aria-label.' },
    { name: 'draggable', type: 'boolean', default: 'true', desc: 'Enable title-bar dragging.' },
    { name: 'resizable', type: 'boolean', default: 'true', desc: 'Enable edge/corner resize.' },
    { name: 'initialX / initialY', type: 'number', default: '80 / 80', desc: 'Starting position (px).' },
    { name: 'initialWidth / initialHeight', type: 'number', default: '440 / 300', desc: 'Starting size (px).' },
    { name: 'glass / radius', type: 'boolean', default: 'UiConfig', desc: 'Glass surface and rounded corners; defaults come from provideUi() config.' },
    { name: 'id', type: 'string', default: 'generated', desc: 'Read-only id the window registers under, for UiWindowManager.focus(id) / dock(id, side).' },
    { name: 'dock(side)', type: 'method', default: '—', desc: "Snap to the 'left', 'right', 'top' or 'bottom' half of the viewport, or 'maximize'; null restores. 'top' is only reachable this way, since a drag to the top edge maximizes." },
    { name: 'restore()', type: 'method', default: '—', desc: 'Un-minimize / un-maximize and return to the bounds before docking.' },
    { name: 'setBounds(b)', type: 'method', default: '—', desc: 'Set x / y / width / height (UiWindowBounds) directly.' },
  ];
  protected readonly winOut: ApiRow[] = [{ name: 'closed', type: 'void', default: '—', desc: 'The Close button was pressed (open is now false).' }];
  protected readonly mgrApi: ApiRow[] = [
    { name: 'count', type: 'WritableSignal<number>', default: '—', desc: 'Number of open windows.' },
    { name: 'focusedId', type: 'WritableSignal<string | null>', default: '—', desc: 'Front-most window id.' },
    { name: 'tile()', type: 'method', default: '—', desc: 'Arrange all open windows in a grid covering the viewport.' },
    { name: 'minimizeAll() / restoreAll()', type: 'method', default: '—', desc: 'Minimize or restore every open window.' },
    { name: 'focus(id) / dock(id, side)', type: 'method', default: '—', desc: 'Bring a window to the front, or dock it (UiDockSide).' },
    { name: 'register(handle) / unregister(id)', type: 'method', default: '—', desc: 'Used by ui-window itself; call them only for a custom window that implements UiWindowHandle.' },
    { name: 'nextId() / bringToFront(id)', type: 'method', default: '—', desc: 'Id allocation and the next z-index, for the same custom-window case.' },
  ];
  protected readonly dragApi: ApiRow[] = [
    { name: 'position', type: 'UiDragPosition', default: '{ x: 0, y: 0 }', desc: 'Two-way (`[(position)]`). Offset from where the host sits in layout, in px.' },
    { name: 'uiDragHandle', type: 'HTMLElement', default: '—', desc: 'Only presses inside this element start a drag.' },
    { name: 'uiDraggableDisabled', type: 'boolean', default: 'false', desc: 'Disable dragging.' },
  ];
  protected readonly dragOut: ApiRow[] = [
    { name: 'dragStart', type: 'UiDragEvent', default: '—', desc: 'A drag began; the starting position and pointer.' },
    { name: 'dragMove', type: 'UiDragEvent', default: '—', desc: 'Every pointer move during a drag.' },
    { name: 'dragEnd', type: 'UiDragEvent', default: '—', desc: 'The pointer was released (or the gesture cancelled).' },
  ];
  protected readonly rzApi: ApiRow[] = [
    { name: 'minWidth', type: 'number', default: '80', desc: 'Minimum width (px).' },
    { name: 'minHeight', type: 'number', default: '48', desc: 'Minimum height (px).' },
    { name: 'uiResizableDisabled', type: 'boolean', default: 'false', desc: 'Disable resizing.' },
  ];
  protected readonly rzOut: ApiRow[] = [{ name: 'resized', type: 'UiResizeEvent', default: '—', desc: 'New width and height in px, emitted on every pointer move.' }];
}
