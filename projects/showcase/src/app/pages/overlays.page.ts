import { Component, inject, signal } from '@angular/core';
import { UiText } from '@zouriel/ui/text';
import { UiButton } from '@zouriel/ui/button';
import { UiBackdrop, UiTooltip, UiPopover, UiMenu, UiContextMenu, type UiMenuItem } from '@zouriel/ui/overlay';
import { UiModal, UiDrawer, UiConfirmDialog, UiToastService, UiBottomSheet } from '@zouriel/ui/dialog';
import { DocPage, DocSection, DocDemo, type ApiRow } from '../docs/docs-ui';

const MENU_ITEM = "interface UiMenuItem {\n  label: string;\n  value: string;\n  disabled?: boolean;\n  danger?: boolean;\n}";

@Component({
  selector: 'page-overlays',
  imports: [ UiBottomSheet, UiBackdrop,
    UiText, UiButton, UiTooltip, UiPopover, UiMenu, UiContextMenu, UiModal, UiDrawer, UiConfirmDialog,
    DocPage, DocSection, DocDemo,
  ],
  template: `
    <doc-page eyebrow="Components" title="Overlays & dialogs"
      lead="Anchored overlays (tooltip, popover, menu, context-menu) use the CDK Overlay; dialogs (modal, drawer, confirm) trap focus and lock scroll. Toasts are a service.">

      <doc-section name="Tooltip" selector="[uiTooltip]" [api]="tooltipApi"
        summary="Directive. Hover/focus tooltip backed by the CDK Overlay; sets aria-describedby on the host while shown. The text is the directive value; an empty string shows nothing.">
        <doc-demo code="<button uiTooltip=&quot;Saved to cloud&quot; uiTooltipPosition=&quot;top&quot;>Hover</button>">
          <ui-button variant="outline" uiTooltip="Backed by the CDK Overlay">Hover me</ui-button>
        </doc-demo>
      </doc-section>

      <doc-section name="Popover" selector="ui-popover" [api]="popoverApi" [outputs]="openOut"
        summary="Click-triggered floating panel (role=&quot;dialog&quot;). Project [popover-trigger] and default content. open is a two-way model. Dismisses on outside click / Esc, and flips or shifts to stay on screen.">
        <doc-demo code="<ui-popover [(open)]=&quot;open&quot; placement=&quot;bottom-start&quot;>
  <ui-button popover-trigger>Open</ui-button>
  Panel content
</ui-popover>">
          <ui-popover>
            <ui-button popover-trigger variant="outline">Open popover</ui-button>
            <ui-text variant="label">Popover</ui-text>
            <ui-text variant="caption">Anchored to its trigger.</ui-text>
          </ui-popover>
        </doc-demo>
      </doc-section>

      <doc-section name="Menu" selector="ui-menu" [api]="menuApi" [outputs]="menuOut" [shapes]="MENU_ITEM"
        summary="Dropdown menu (WAI-ARIA menu). Opening focuses the first item; ArrowUp/Down, Home and End move focus, Enter activates, Escape closes. Project [menu-trigger]; pass items; listen to (select). Flips to stay on screen.">
        <doc-demo code="<ui-menu [items]=&quot;items&quot; (select)=&quot;run($event)&quot;>
  <ui-button menu-trigger>Menu ▾</ui-button>
</ui-menu>">
          <ui-menu [items]="menuItems" (select)="toast.info($event.label)">
            <ui-button menu-trigger variant="outline">Menu ▾</ui-button>
          </ui-menu>
        </doc-demo>
      </doc-section>

      <doc-section name="Context menu" selector="[uiContextMenu]" [api]="ctxApi" [outputs]="ctxOut" [shapes]="MENU_ITEM"
        summary="Directive. Right-click menu opened at the pointer; it flips and shifts so it never runs off the edge. The first item gets focus on open, ArrowUp/Down, Home and End move between items, Escape closes. The directive value is the items array.">
        <doc-demo code="<div [uiContextMenu]=&quot;items&quot; (contextSelect)=&quot;run($event)&quot;>Right-click</div>">
          <div class="ctx" [uiContextMenu]="menuItems" (contextSelect)="toast.info($event.label)">Right-click me</div>
        </doc-demo>
      </doc-section>

      <doc-section name="Modal" selector="ui-modal" [api]="modalApi" [outputs]="openOut"
        summary="Centered dialog. open is a two-way model. Traps focus (CDK a11y), locks body scroll, closes on Esc / backdrop click, animates scale + backdrop-fade. size=&quot;full&quot; fills the screen with no padding, for editors opened over a page. Project default content + [modal-footer].">
        <doc-demo code="<ui-modal [(open)]=&quot;open&quot; title=&quot;Title&quot; size=&quot;md&quot;>
  Body…
  <div modal-footer><ui-button>Save</ui-button></div>
</ui-modal>">
          <ui-button (click)="modal.set(true)">Open modal</ui-button>
        </doc-demo>
      </doc-section>

      <doc-section name="Drawer" selector="ui-drawer" [api]="drawerApi" [outputs]="openOut"
        summary="Edge-anchored sheet that slides in from side. open is a two-way model. Traps focus, locks scroll, closes on Esc / backdrop click. Project the body as content.">
        <doc-demo code="<ui-drawer [(open)]=&quot;open&quot; side=&quot;right&quot; title=&quot;Panel&quot;> … </ui-drawer>">
          <ui-button variant="outline" (click)="drawer.set(true)">Open drawer</ui-button>
        </doc-demo>
      </doc-section>

      <doc-section name="Confirm dialog" selector="ui-confirm-dialog" [api]="confirmApi" [outputs]="confirmOut"
        summary="Focused confirm/cancel prompt built on a small ui-modal. Bind [(open)]; listen to (confirm)/(cancel). Normally both buttons sit right-aligned; with destructive the confirm button turns red and Cancel moves to the far left, away from it.">
        <doc-demo code="<ui-confirm-dialog [(open)]=&quot;open&quot; title=&quot;Delete?&quot; message=&quot;…&quot;
  confirmLabel=&quot;Delete&quot; [destructive]=&quot;true&quot; (confirm)=&quot;remove()&quot; />">
          <ui-button variant="destructive" (click)="confirm.set(true)">Delete…</ui-button>
        </doc-demo>
      </doc-section>

      <doc-section name="Backdrop" selector="ui-backdrop" [api]="backdropApi" [outputs]="backdropOut"
        summary="The dimmed full-screen layer behind an overlay of your own. Render it with @if; it fades in and out with the shared backdrop animation and reports clicks so you can close what it sits behind.">
        <doc-demo code="@if (open()) {
  <ui-backdrop [blur]=&quot;true&quot; (backdropClick)=&quot;open.set(false)&quot; />
  <my-panel />
}">
          <ui-button variant="outline" (click)="backdrop.set(true)">Show backdrop</ui-button>
        </doc-demo>
      </doc-section>

      <doc-section name="Bottom sheet" selector="ui-bottom-sheet" [api]="sheetApi" [outputs]="sheetOut"
        summary="A panel that rests at the bottom of the screen and is dragged between heights: the mobile stand-in for a sidebar. Drag or flick the header; dragging the body moves the sheet when the content is already at its top. The handle is a button that steps through the snaps (ArrowUp/Down on it do the same); Escape closes. Non-modal unless backdrop is set. Fingers are followed with touch events, so it drags on a phone even inside scrolling pages. While an on-screen keyboard is up it rests on top of it. Positioned fixed, so keep it out of transformed ancestors.">
        <doc-demo code="<ui-bottom-sheet [(snap)]=&quot;snap&quot; [snaps]=&quot;[0, 0.4, 0.9]&quot; title=&quot;Layers&quot; [offset]=&quot;56&quot;>
  …content…
</ui-bottom-sheet>">
          <div class="row">
            <ui-button variant="secondary" (click)="sheetSnap.set(1)">Open half</ui-button>
            <ui-button variant="ghost" (click)="sheetSnap.set(2)">Open full</ui-button>
            <span class="sheet-state">snap: {{ sheetSnap() }}</span>
          </div>
        </doc-demo>
      </doc-section>

      <doc-section name="Toast" selector="UiToastService · ui-toast-host" [api]="toastApi"
        summary="Imperative notifications. Render <ui-toast-host /> once near the app root, then call the service: show/info/success/warning/danger(message, title?). Returns an id; dismiss(id) to remove. The countdown pauses while the pointer or focus is on a toast and resumes with the time left. Warning and danger toasts use role=&quot;alert&quot;, the rest role=&quot;status&quot;."
        [shapes]="TOAST">
        <doc-demo code="toast = inject(UiToastService);
this.toast.success('Saved', 'Done');
this.toast.show({ message: 'Hi', duration: 0 });
this.toast.show({ message: 'Layer deleted', duration: 6000, action: { label: 'Undo', run: () => undo() } });">
          <div class="row">
            <ui-button variant="secondary" (click)="toast.success('Changes saved', 'Success')">Success</ui-button>
            <ui-button variant="ghost" (click)="toast.danger('Could not connect', 'Error')">Error</ui-button>
            <ui-button variant="outline" (click)="toast.show({ message: 'Layer deleted', duration: 6000, action: { label: 'Undo', run: undoToast } })">With action</ui-button>
          </div>
        </doc-demo>
      </doc-section>
    </doc-page>

    <ui-bottom-sheet [(snap)]="sheetSnap" [snaps]="[0, 0.4, 0.9]" title="Layers" [hasHeader]="true">
      <ui-button sheet-actions size="sm" variant="ghost">Add</ui-button>
      <div class="sheet-rows">
        @for (n of sheetRows; track n) { <div class="sheet-row">Layer {{ n }}</div> }
      </div>
    </ui-bottom-sheet>

    @if (backdrop()) {
      <ui-backdrop [blur]="true" (backdropClick)="backdrop.set(false)" />
      <div class="floating" role="dialog" aria-label="Example panel">
        <ui-text variant="body">Click anywhere outside to close.</ui-text>
      </div>
    }
    <ui-modal [(open)]="modal" title="Modal title">
      <ui-text variant="body">Traps focus, locks scroll, closes on Esc / backdrop.</ui-text>
      <div modal-footer><ui-button variant="ghost" size="sm" (click)="modal.set(false)">Cancel</ui-button><ui-button size="sm" (click)="modal.set(false)">Save</ui-button></div>
    </ui-modal>
    <ui-drawer [(open)]="drawer" side="right" title="Drawer"><ui-text variant="body">A right-anchored sheet.</ui-text></ui-drawer>
    <ui-confirm-dialog [(open)]="confirm" title="Delete item?" message="This cannot be undone." confirmLabel="Delete" [destructive]="true" (confirm)="toast.warning('Deleted')" />
  `,
  styles: `
    .row { display: flex; flex-wrap: wrap; gap: var(--ui-space-3); }
    .floating { position: fixed; z-index: calc(var(--ui-z-overlay) + 1); left: 50%; top: 50%; transform: translate(-50%, -50%);
      padding: var(--ui-space-4); border-radius: var(--ui-radius); background: var(--ui-color-surface-raised); border: 1px solid var(--ui-color-border);
      box-shadow: var(--ui-shadow-3); }
    .sheet-state { align-self: center; color: var(--ui-color-text-muted); font: var(--ui-font-size-sm) var(--ui-font-mono); }
    .sheet-rows { display: grid; }
    .sheet-row { padding: var(--ui-space-3) var(--ui-space-4); border-bottom: 1px solid var(--ui-color-border-subtle); }
    .ctx { display: inline-flex; align-items: center; padding: 0 var(--ui-space-4); height: var(--ui-size-md);
      border: 1px dashed var(--ui-color-border); border-radius: var(--ui-radius); color: var(--ui-color-text-muted);
      font-size: var(--ui-font-size-sm); user-select: none; }
  `,
})
export class OverlaysPage {
  protected readonly toast = inject(UiToastService);
  protected readonly backdrop = signal(false);
  protected readonly backdropApi: ApiRow[] = [
    { name: 'blur', type: 'boolean', default: 'false', desc: 'Blur what is behind it as well as dimming it.' },
  ];
  protected readonly backdropOut: ApiRow[] = [
    { name: 'backdropClick', type: 'void', default: '—', desc: 'The backdrop itself was clicked.' },
  ];
  protected readonly MENU_ITEM = MENU_ITEM;
  protected readonly TOAST = `interface UiToastOptions {
  message: string;
  title?: string;
  tone?: 'info' | 'success' | 'warning' | 'danger';
  duration?: number;   // ms; 0 = sticky; default 4000
  action?: UiToastAction;
}
interface UiToastAction {
  label: string;
  run: () => void;   // the toast is dismissed after it runs
}`;
  protected readonly modal = signal(false);
  protected readonly drawer = signal(false);
  protected readonly confirm = signal(false);
  protected readonly menuItems: UiMenuItem[] = [
    { label: 'Edit', value: 'edit' }, { label: 'Duplicate', value: 'dup' }, { label: 'Delete', value: 'del', danger: true },
  ];

  protected readonly openOut: ApiRow[] = [{ name: 'openChange', type: 'boolean', default: '—', desc: 'Two-way open model change.' }];
  protected readonly tooltipApi: ApiRow[] = [
    { name: 'uiTooltip', type: 'string (required)', default: '—', desc: 'Tooltip text (the directive value).' },
    { name: 'uiTooltipPosition', type: "'top'|'bottom'|'left'|'right'", default: "'top'", desc: 'Placement.' },
  ];
  protected readonly popoverApi: ApiRow[] = [
    { name: 'open', type: 'boolean (model)', default: 'false', desc: 'Two-way open state.' },
    { name: 'placement', type: "'bottom'|'top'|'bottom-start'|'bottom-end'", default: "'bottom-start'", desc: 'Anchor placement.' },
    { name: 'glass', type: 'boolean', default: 'UiConfig.glass', desc: 'Glass panel.' },
    { name: 'radius', type: 'boolean', default: 'UiConfig.radius', desc: 'Rounded corners.' },
  ];
  protected readonly menuApi: ApiRow[] = [
    { name: 'open', type: 'boolean (model)', default: 'false', desc: 'Two-way open state.' },
    { name: 'items', type: 'UiMenuItem[]', default: '[]', desc: 'Menu items.' },
    { name: 'glass', type: 'boolean', default: 'UiConfig.glass', desc: 'Glass panel.' },
    { name: 'radius', type: 'boolean', default: 'UiConfig.radius', desc: 'Rounded corners.' },
  ];
  protected readonly menuOut: ApiRow[] = [
    { name: 'select', type: 'UiMenuItem', default: '—', desc: 'Chosen item.' },
    { name: 'openChange', type: 'boolean', default: '—', desc: 'Two-way open model change.' },
  ];
  protected readonly ctxApi: ApiRow[] = [
    { name: 'uiContextMenu', type: 'UiMenuItem[]', default: '[]', desc: 'Items (the directive value).' },
  ];
  protected readonly ctxOut: ApiRow[] = [{ name: 'contextSelect', type: 'UiMenuItem', default: '—', desc: 'Chosen item.' }];
  protected readonly modalApi: ApiRow[] = [
    { name: 'open', type: 'boolean (model)', default: 'false', desc: 'Two-way open state.' },
    { name: 'title', type: 'string', default: '—', desc: 'Header title (adds aria-labelledby).' },
    { name: 'size', type: "'sm' | 'md' | 'lg' | 'full'", default: "'md'", desc: 'Max width. full fills the screen with no padding.' },
    { name: 'closeOnBackdrop', type: 'boolean', default: 'true', desc: 'Click backdrop to close.' },
    { name: 'closeOnEscape', type: 'boolean', default: 'true', desc: 'Esc to close.' },
    { name: 'glass', type: 'boolean', default: 'UiConfig.glass', desc: 'Glass panel.' },
    { name: 'radius', type: 'boolean', default: 'UiConfig.radius', desc: 'Rounded corners.' },
  ];
  protected readonly drawerApi: ApiRow[] = [
    { name: 'open', type: 'boolean (model)', default: 'false', desc: 'Two-way open state.' },
    { name: 'side', type: "'left'|'right'|'top'|'bottom'", default: "'right'", desc: 'Anchor edge.' },
    { name: 'title', type: 'string', default: '—', desc: 'Header title.' },
    { name: 'closeOnBackdrop', type: 'boolean', default: 'true', desc: 'Click backdrop to close.' },
    { name: 'closeOnEscape', type: 'boolean', default: 'true', desc: 'Esc to close.' },
    { name: 'glass', type: 'boolean', default: 'UiConfig.glass', desc: 'Glass surface.' },
    { name: 'radius', type: 'boolean', default: 'UiConfig.radius', desc: 'Rounded corners.' },
  ];
  protected readonly confirmApi: ApiRow[] = [
    { name: 'open', type: 'boolean (model)', default: 'false', desc: 'Two-way open state.' },
    { name: 'title', type: 'string', default: "'Are you sure?'", desc: 'Prompt title.' },
    { name: 'message', type: 'string', default: "''", desc: 'Body text.' },
    { name: 'confirmLabel', type: 'string', default: "'Confirm'", desc: 'Confirm button text.' },
    { name: 'cancelLabel', type: 'string', default: "'Cancel'", desc: 'Cancel button text.' },
    { name: 'destructive', type: 'boolean', default: 'false', desc: 'Red confirm button, with Cancel moved to the far left.' },
  ];
  protected readonly confirmOut: ApiRow[] = [
    { name: 'confirm', type: 'void', default: '—', desc: 'Confirm pressed.' },
    { name: 'cancel', type: 'void', default: '—', desc: 'Cancel pressed.' },
    { name: 'openChange', type: 'boolean', default: '—', desc: 'Two-way open model change.' },
  ];
  protected readonly sheetSnap = signal(0);
  protected readonly sheetRows = Array.from({ length: 30 }, (_, i) => i + 1);
  protected readonly sheetApi: ApiRow[] = [
    { name: 'snaps', type: 'readonly number[]', default: '[0, 0.5, 1]', desc: 'Resting heights as fractions of the room it has, ascending. A first snap of 0 is closed.' },
    { name: 'snap', type: 'number (model)', default: '0', desc: 'Index it rests at — [(snap)].' },
    { name: 'title', type: 'string', default: "''", desc: 'Header title and aria-label.' },
    { name: 'offset', type: 'number', default: '0', desc: 'Px kept free below it, for a toolbar it sits on.' },
    { name: 'topInset', type: 'number', default: '0', desc: 'Px kept free above its tallest snap.' },
    { name: 'backdrop', type: 'boolean', default: 'false', desc: 'Modal: dims the page and closes on a backdrop tap.' },
    { name: 'closable', type: 'boolean', default: 'true', desc: 'Close button in the header.' },
    { name: 'hasHeader', type: 'boolean', default: 'false', desc: 'Show the header row without a title, for the close button and [sheet-actions].' },
    { name: 'expandOnFocus', type: 'boolean', default: 'true', desc: 'Rise to the tallest snap when a field inside gains focus on a touch screen.' },
    { name: '[sheet-actions]', type: 'slot', default: '—', desc: 'Header controls.' },
    { name: 'data-sheet-nodrag', type: 'attribute', default: '—', desc: 'On content that keeps its own drags.' },
    { name: '--ui-sheet-z', type: 'CSS variable', default: 'var(--ui-z-overlay)', desc: 'Stacking level, e.g. to sit under a toolbar but below dialogs.' },
  ];
  protected readonly sheetOut: ApiRow[] = [
    { name: 'snapChange', type: 'number', default: '—', desc: 'Snap index model change.' },
    { name: 'heightChange', type: 'number', default: '—', desc: 'Px height once it settles.' },
    { name: 'coverChange', type: 'number', default: '—', desc: 'Px of the screen it takes from the bottom once settled, including what it rests on (offset or keyboard).' },
  ];
  protected readonly toastApi: ApiRow[] = [
    { name: 'host: position', type: "'top-right'|'top-left'|'bottom-right'|'bottom-left'", default: "'bottom-right'", desc: 'ui-toast-host corner.' },
    { name: 'service.show(opts)', type: '(UiToastOptions) => number', default: '—', desc: 'Enqueue; returns id.' },
    { name: 'service.info / success / warning / danger', type: '(message: string, title?: string) => number', default: '—', desc: 'Shorthands for show() with a tone.' },
    { name: 'service.dismiss(id)', type: '(number) => void', default: '—', desc: 'Remove a toast.' },
    { name: 'service.pause(id) / resume(id)', type: '(number) => void', default: '—', desc: 'Hold or restart the countdown. The host calls these on hover and focus.' },
    { name: 'service.toasts', type: 'Signal<UiToast[]>', default: '[]', desc: 'The live queue.' },
    { name: 'opts.action', type: '{ label: string; run: () => void }', default: '—', desc: 'One button in the toast, e.g. Undo. Running it dismisses the toast.' },
  ];
  protected readonly undoToast = () => this.toast.success('Restored');
}
