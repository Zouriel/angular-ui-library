import { Component, inject, signal } from '@angular/core';
import { UiText } from 'ui/text';
import { UiButton } from 'ui/button';
import { UiTooltip, UiPopover, UiMenu, UiContextMenu, type UiMenuItem } from 'ui/overlay';
import { UiModal, UiDrawer, UiConfirmDialog, UiToastService } from 'ui/dialog';
import { DocPage, DocSection, DocDemo, type ApiRow } from '../docs/docs-ui';

const MENU_ITEM = "interface UiMenuItem {\n  label: string;\n  value: string;\n  disabled?: boolean;\n  danger?: boolean;\n}";

@Component({
  selector: 'page-overlays',
  imports: [
    UiText, UiButton, UiTooltip, UiPopover, UiMenu, UiContextMenu, UiModal, UiDrawer, UiConfirmDialog,
    DocPage, DocSection, DocDemo,
  ],
  template: `
    <doc-page eyebrow="Components" title="Overlays & dialogs"
      lead="Anchored overlays (tooltip, popover, menu, context-menu) use the CDK Overlay; dialogs (modal, drawer, confirm) trap focus and lock scroll. Toasts are a service.">

      <doc-section name="Tooltip" selector="[uiTooltip]" [api]="tooltipApi"
        summary="Directive. Hover/focus tooltip backed by the CDK Overlay; sets aria-describedby on the host. The text is the directive value.">
        <doc-demo code="<button uiTooltip=&quot;Saved to cloud&quot; uiTooltipPosition=&quot;top&quot;>Hover</button>">
          <ui-button variant="outline" uiTooltip="Backed by the CDK Overlay">Hover me</ui-button>
        </doc-demo>
      </doc-section>

      <doc-section name="Popover" selector="ui-popover" [api]="popoverApi" [outputs]="openOut"
        summary="Click-triggered floating panel. Project [popover-trigger] and default content. open is a two-way model. Dismisses on outside click / Esc.">
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
        summary="Dropdown menu with Arrow/Home/End/Enter keyboard nav. Project [menu-trigger]; pass items; listen to (select).">
        <doc-demo code="<ui-menu [items]=&quot;items&quot; (select)=&quot;run($event)&quot;>
  <ui-button menu-trigger>Menu ▾</ui-button>
</ui-menu>">
          <ui-menu [items]="menuItems" (select)="toast.info($event.label)">
            <ui-button menu-trigger variant="outline">Menu ▾</ui-button>
          </ui-menu>
        </doc-demo>
      </doc-section>

      <doc-section name="Context menu" selector="[uiContextMenu]" [api]="ctxApi" [outputs]="ctxOut" [shapes]="MENU_ITEM"
        summary="Directive. Right-click menu opened at the pointer. The directive value is the items array.">
        <doc-demo code="<div [uiContextMenu]=&quot;items&quot; (contextSelect)=&quot;run($event)&quot;>Right-click</div>">
          <div class="ctx" [uiContextMenu]="menuItems" (contextSelect)="toast.info($event.label)">Right-click me</div>
        </doc-demo>
      </doc-section>

      <doc-section name="Modal" selector="ui-modal" [api]="modalApi" [outputs]="openOut"
        summary="Centered dialog. open is a two-way model. Traps focus (CDK a11y), locks body scroll, animates scale + backdrop-fade. Project default content + [modal-footer].">
        <doc-demo code="<ui-modal [(open)]=&quot;open&quot; title=&quot;Title&quot; size=&quot;md&quot;>
  Body…
  <div modal-footer><ui-button>Save</ui-button></div>
</ui-modal>">
          <ui-button (click)="modal.set(true)">Open modal</ui-button>
        </doc-demo>
      </doc-section>

      <doc-section name="Drawer" selector="ui-drawer" [api]="drawerApi" [outputs]="openOut"
        summary="Edge-anchored sheet that slides in from side. open is a two-way model. Traps focus, locks scroll.">
        <doc-demo code="<ui-drawer [(open)]=&quot;open&quot; side=&quot;right&quot; title=&quot;Panel&quot;> … </ui-drawer>">
          <ui-button variant="outline" (click)="drawer.set(true)">Open drawer</ui-button>
        </doc-demo>
      </doc-section>

      <doc-section name="Confirm dialog" selector="ui-confirm-dialog" [api]="confirmApi" [outputs]="confirmOut"
        summary="Focused confirm/cancel prompt built on ui-modal. Bind [(open)]; listen to (confirm)/(cancel).">
        <doc-demo code="<ui-confirm-dialog [(open)]=&quot;open&quot; title=&quot;Delete?&quot; message=&quot;…&quot;
  confirmLabel=&quot;Delete&quot; [destructive]=&quot;true&quot; (confirm)=&quot;remove()&quot; />">
          <ui-button variant="destructive" (click)="confirm.set(true)">Delete…</ui-button>
        </doc-demo>
      </doc-section>

      <doc-section name="Toast" selector="UiToastService · ui-toast-host" [api]="toastApi"
        summary="Imperative notifications. Render <ui-toast-host /> once near the app root, then call the service: show/info/success/warning/danger(message, title?). Returns an id; dismiss(id) to remove."
        [shapes]="TOAST">
        <doc-demo code="toast = inject(UiToastService);
this.toast.success('Saved', 'Done');
this.toast.show({ message: 'Hi', duration: 0 });">
          <div class="row">
            <ui-button variant="secondary" (click)="toast.success('Changes saved', 'Success')">Success</ui-button>
            <ui-button variant="ghost" (click)="toast.danger('Could not connect', 'Error')">Error</ui-button>
          </div>
        </doc-demo>
      </doc-section>
    </doc-page>

    <ui-modal [(open)]="modal" title="Modal title">
      <ui-text variant="body">Traps focus, locks scroll, closes on Esc / backdrop.</ui-text>
      <div modal-footer><ui-button variant="ghost" size="sm" (click)="modal.set(false)">Cancel</ui-button><ui-button size="sm" (click)="modal.set(false)">Save</ui-button></div>
    </ui-modal>
    <ui-drawer [(open)]="drawer" side="right" title="Drawer"><ui-text variant="body">A right-anchored sheet.</ui-text></ui-drawer>
    <ui-confirm-dialog [(open)]="confirm" title="Delete item?" message="This cannot be undone." confirmLabel="Delete" [destructive]="true" (confirm)="toast.warning('Deleted')" />
  `,
  styles: `
    .row { display: flex; flex-wrap: wrap; gap: var(--ui-space-3); }
    .ctx { display: inline-flex; align-items: center; padding: 0 var(--ui-space-4); height: var(--ui-size-md);
      border: 1px dashed var(--ui-color-border); border-radius: var(--ui-radius); color: var(--ui-color-text-muted);
      font-size: var(--ui-font-size-sm); user-select: none; }
  `,
})
export class OverlaysPage {
  protected readonly toast = inject(UiToastService);
  protected readonly MENU_ITEM = MENU_ITEM;
  protected readonly TOAST = `interface UiToastOptions {
  message: string;
  title?: string;
  tone?: 'info' | 'success' | 'warning' | 'danger';
  duration?: number;   // ms; 0 = sticky; default 4000
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
  protected readonly menuOut: ApiRow[] = [{ name: 'select', type: 'UiMenuItem', default: '—', desc: 'Chosen item.' }];
  protected readonly ctxApi: ApiRow[] = [
    { name: 'uiContextMenu', type: 'UiMenuItem[]', default: '[]', desc: 'Items (the directive value).' },
  ];
  protected readonly ctxOut: ApiRow[] = [{ name: 'contextSelect', type: 'UiMenuItem', default: '—', desc: 'Chosen item.' }];
  protected readonly modalApi: ApiRow[] = [
    { name: 'open', type: 'boolean (model)', default: 'false', desc: 'Two-way open state.' },
    { name: 'title', type: 'string', default: '—', desc: 'Header title (adds aria-labelledby).' },
    { name: 'size', type: "'sm' | 'md' | 'lg'", default: "'md'", desc: 'Max width.' },
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
  ];
  protected readonly confirmApi: ApiRow[] = [
    { name: 'open', type: 'boolean (model)', default: 'false', desc: 'Two-way open state.' },
    { name: 'title', type: 'string', default: "'Are you sure?'", desc: 'Prompt title.' },
    { name: 'message', type: 'string', default: "''", desc: 'Body text.' },
    { name: 'confirmLabel', type: 'string', default: "'Confirm'", desc: 'Confirm button text.' },
    { name: 'cancelLabel', type: 'string', default: "'Cancel'", desc: 'Cancel button text.' },
    { name: 'destructive', type: 'boolean', default: 'false', desc: 'Red confirm button.' },
  ];
  protected readonly confirmOut: ApiRow[] = [
    { name: 'confirm', type: 'void', default: '—', desc: 'Confirm pressed.' },
    { name: 'cancel', type: 'void', default: '—', desc: 'Cancel pressed.' },
  ];
  protected readonly toastApi: ApiRow[] = [
    { name: 'host: position', type: "'top-right'|'top-left'|'bottom-right'|'bottom-left'", default: "'bottom-right'", desc: 'ui-toast-host corner.' },
    { name: 'service.show(opts)', type: '(UiToastOptions) => number', default: '—', desc: 'Enqueue; returns id.' },
    { name: 'service.dismiss(id)', type: '(number) => void', default: '—', desc: 'Remove a toast.' },
  ];
}
