import { Component, inject, signal } from '@angular/core';
import { HugeiconsIconComponent } from '@hugeicons/angular';
import ArrowDown01Icon from '@hugeicons/core-free-icons/ArrowDown01Icon';
import FileAddIcon from '@hugeicons/core-free-icons/FileAddIcon';
import Copy01Icon from '@hugeicons/core-free-icons/Copy01Icon';
import Delete02Icon from '@hugeicons/core-free-icons/Delete02Icon';
import Settings01Icon from '@hugeicons/core-free-icons/Settings01Icon';
import Moon02Icon from '@hugeicons/core-free-icons/Moon02Icon';
import { UiText } from '@zouriel/ui/text';
import { UiButton } from '@zouriel/ui/button';
import { UiBackdrop, UiTooltip, UiPopover, UiMenu, UiContextMenu, type UiMenuItem } from '@zouriel/ui/overlay';
import { UiModal, UiDrawer, UiConfirmDialog, UiToastService, UiBottomSheet, UiSnackbar, UiSnackbarService } from '@zouriel/ui/dialog';
import { UiCommandPalette, type UiCommand } from '@zouriel/ui/command-palette';
import { DocPage, DocSection, DocDemo, type ApiRow } from '../docs/docs-ui';

const MENU_ITEM = "interface UiMenuItem {\n  label: string;\n  value: string;\n  disabled?: boolean;\n  danger?: boolean;\n}";

@Component({
  selector: 'page-overlays',
  imports: [ UiBottomSheet, UiBackdrop, UiCommandPalette, HugeiconsIconComponent,
    UiText, UiButton, UiTooltip, UiPopover, UiMenu, UiContextMenu, UiModal, UiDrawer, UiConfirmDialog, UiSnackbar,
    DocPage, DocSection, DocDemo,
  ],
  template: `
    <doc-page eyebrow="Components" title="Overlays & dialogs"
      lead="Anchored overlays (tooltip, popover, menu, context menu) use the CDK Overlay and flip or shift to stay on screen. Dialogs (modal, drawer, confirm) trap focus, lock scroll and give focus back on close. Also here: backdrop, bottom sheet, toasts and the command palette. Overlays come from @zouriel/ui/overlay, dialogs and toasts from @zouriel/ui/dialog, the palette from @zouriel/ui/command-palette.">

      <doc-section name="Tooltip" selector="[uiTooltip]" [api]="tooltipApi"
        summary="Directive. Shows on hover and keyboard focus, hides on leave, blur and Escape. Backed by the CDK Overlay: if there is no room on the chosen side it flips to the opposite one, and it is kept 8px inside the viewport. Sets aria-describedby on the host while shown. The text is the directive value; an empty string shows nothing.">
        <doc-demo code="import { UiTooltip } from '@zouriel/ui/overlay';

<button uiTooltip=&quot;Saved to cloud&quot; uiTooltipPosition=&quot;top&quot;>Hover</button>">
          <ui-button variant="outline" uiTooltip="Backed by the CDK Overlay">Hover me</ui-button>
        </doc-demo>
      </doc-section>

      <doc-section name="Popover" selector="ui-popover" [api]="popoverApi"
        summary="Click-triggered floating panel (role=&quot;dialog&quot;). Project the trigger with [popover-trigger] and the panel body as default content. Closes on outside click and Escape. Focus is not moved into the panel; when Escape closes it from inside, focus goes back to the trigger. The panel is named by label (aria-label) when set, otherwise by the trigger's text (aria-labelledby). Falls back to above the trigger when there is no room below, and shifts sideways to stay on screen.">
        <doc-demo code="<ui-popover [(open)]=&quot;open&quot; placement=&quot;bottom-start&quot; label=&quot;Popover&quot;>
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
        summary="Dropdown menu (role=&quot;menu&quot;). Project the trigger with [menu-trigger]; pass items; listen to (select). Opening focuses the first enabled item; ArrowUp/Down, Home and End move focus, Enter activates. Choosing an item or pressing Escape closes it and puts focus back on the trigger; Tab closes it and moves on. Flips above, or lines up with the trigger's right edge, to stay on screen.">
        <doc-demo code="import { UiMenu, type UiMenuItem } from '@zouriel/ui/overlay';

<ui-menu [items]=&quot;items&quot; (select)=&quot;run($event)&quot;>
  <ui-button menu-trigger>Actions</ui-button>
</ui-menu>">
          <ui-menu [items]="menuItems" (select)="toast.info($event.label)">
            <ui-button menu-trigger variant="outline">Actions <hugeicons-icon aria-hidden="true" [icon]="icons.chevron" [size]="16" [strokeWidth]="1.8" /></ui-button>
          </ui-menu>
        </doc-demo>
      </doc-section>

      <doc-section name="Context menu" selector="[uiContextMenu]" [api]="ctxApi" [outputs]="ctxOut" [shapes]="MENU_ITEM"
        summary="Directive. Right-click menu opened at the pointer; it flips and shifts so it never runs off the edge. The first item gets focus on open, ArrowUp/Down, Home and End move between items. Escape or choosing an item closes it and gives focus back to what had it before; an outside click or scrolling the page also closes it. The directive value is the items array.">
        <doc-demo code="<div [uiContextMenu]=&quot;items&quot; (contextSelect)=&quot;run($event)&quot;>Right-click</div>">
          <div class="ctx" [uiContextMenu]="menuItems" (contextSelect)="toast.info($event.label)">Right-click me</div>
        </doc-demo>
      </doc-section>

      <doc-section name="Modal" selector="ui-modal" [api]="modalApi"
        summary="Centered dialog (role=&quot;dialog&quot;, aria-modal). Opens on its own layer at the end of <body>, so a transformed or clipped ancestor cannot squash it. Moves focus inside and traps it (CDK a11y), gives focus back to what had it when it closes, locks body scroll, and closes on Escape or a backdrop click. Only the body scrolls; the header and footer stay put. size=&quot;full&quot; fills the screen with no padding, for editors opened over a page.">
        <doc-demo code="import { UiModal } from '@zouriel/ui/dialog';

<ui-modal [(open)]=&quot;open&quot; title=&quot;Title&quot; size=&quot;md&quot;>
  Body…
  <div modal-footer><ui-button>Save</ui-button></div>
</ui-modal>">
          <ui-button (click)="modal.set(true)">Open modal</ui-button>
        </doc-demo>
      </doc-section>

      <doc-section name="Drawer" selector="ui-drawer" [api]="drawerApi"
        summary="Edge-anchored panel that slides in from side (role=&quot;dialog&quot;, aria-modal). Like the modal it opens on its own layer at the end of <body>, traps focus and gives it back on close, locks scroll, and closes on Escape or a backdrop click. Left and right drawers are up to 360px wide; top and bottom ones up to 320px tall. Project the body as content.">
        <doc-demo code="<ui-drawer [(open)]=&quot;open&quot; side=&quot;right&quot; title=&quot;Panel&quot;>…</ui-drawer>">
          <ui-button variant="outline" (click)="drawer.set(true)">Open drawer</ui-button>
        </doc-demo>
      </doc-section>

      <doc-section name="Confirm dialog" selector="ui-confirm-dialog" [api]="confirmApi" [outputs]="confirmOut"
        summary="Confirm/cancel prompt built on a small ui-modal, so it traps and returns focus the same way. Bind [(open)]; listen to (confirm) and (cancel). (cancel) fires only for the Cancel button: Escape, the backdrop and the close button just set open to false. Normally both buttons sit right-aligned; with destructive the confirm button turns red and Cancel moves to the far left, away from it.">
        <doc-demo code="<ui-confirm-dialog [(open)]=&quot;open&quot; title=&quot;Delete?&quot; message=&quot;…&quot;
  confirmLabel=&quot;Delete&quot; [destructive]=&quot;true&quot; (confirm)=&quot;remove()&quot; />">
          <ui-button variant="destructive" (click)="confirm.set(true)">Delete…</ui-button>
        </doc-demo>
      </doc-section>

      <doc-section name="Backdrop" selector="ui-backdrop" [api]="backdropApi" [outputs]="backdropOut"
        summary="The dimmed full-screen layer behind an overlay of your own. Render it with @if; it fades in and out with the shared backdrop animation and reports clicks so you can close what it sits behind. It does nothing else: focus, Escape and scroll locking are up to you.">
        <doc-demo code="@if (open()) {
  <ui-backdrop [blur]=&quot;true&quot; (backdropClick)=&quot;open.set(false)&quot; />
  <my-panel />
}">
          <ui-button variant="outline" (click)="backdrop.set(true)">Show backdrop</ui-button>
        </doc-demo>
      </doc-section>

      <doc-section name="Bottom sheet" selector="ui-bottom-sheet" [api]="sheetApi" [outputs]="sheetOut"
        summary="A panel that rests at the bottom of the screen and is dragged between heights: the mobile stand-in for a sidebar. Drag or flick the header; dragging the body moves the sheet when the content is already at its top. The handle is a button that steps through the snaps (ArrowUp/Down on it do the same). Non-modal by default: opening it does not move focus and Tab can leave it. With backdrop it is modal while open: the page dims and a tap on it closes the sheet, the sheet is aria-modal, focus moves in (to the element marked cdkFocusInitial, else the handle) and Tab is trapped inside. Escape closes it while focus is inside; closing either way sends focus back to where it came from. Fingers are followed with touch events, so it drags on a phone even inside scrolling pages. While an on-screen keyboard is up it rests on top of it. Positioned fixed, so keep it out of transformed ancestors.">
        <doc-demo code="import { UiBottomSheet } from '@zouriel/ui/dialog';

<ui-bottom-sheet [(snap)]=&quot;snap&quot; [snaps]=&quot;[0, 0.4, 0.9]&quot; title=&quot;Layers&quot; [offset]=&quot;56&quot;>
  …content…
</ui-bottom-sheet>">
          <div class="row">
            <ui-button variant="secondary" (click)="sheetSnap.set(1)">Open half</ui-button>
            <ui-button variant="ghost" (click)="sheetSnap.set(2)">Open full</ui-button>
            <ui-button variant="outline" (click)="sheetModal.set(true); sheetSnap.set(1)">Open with backdrop</ui-button>
            <span class="sheet-state">snap: {{ sheetSnap() }}</span>
          </div>
        </doc-demo>
      </doc-section>

      <doc-section name="Toast" selector="UiToastService · ui-toast-host" [api]="toastApi"
        summary="Imperative notifications. Render <ui-toast-host /> once near the app root (this site does), then call the service: show(options), or info/success/warning/danger(message, title?). Each returns an id; dismiss(id) removes it. Toasts stack at the host's position (a corner, or centred on the top or bottom edge), newest last, slide in from that edge and back out toward it, and leave on their own after duration ms (4000 by default; 0 keeps them). The countdown pauses while the pointer or focus is on a toast and resumes with the time left, at least one more second. Warning and danger toasts use role=&quot;alert&quot;, the rest role=&quot;status&quot;, inside an aria-live=&quot;polite&quot; region. For a quick note about something the person just did, like Deleted with Undo, use the snackbar below."
        [shapes]="TOAST">
        <doc-demo lang="ts" code="import { UiToastService, UiToastHost } from '@zouriel/ui/dialog';

// once, in the root component's template: <ui-toast-host position=&quot;bottom-right&quot; />
toast = inject(UiToastService);
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

      <doc-section name="Snackbar" selector="UiSnackbarService · ui-snackbar-host · ui-snackbar" [api]="snackApi" [shapes]="SNACK"
        summary="A short note about something the person just did, with at most one action: Deleted with Undo, Grouped, Keyframe added. It is a compact inverted bar centred at the bottom of the screen, the one the form builder uses. Only one shows at a time; a new one replaces it. Render <ui-snackbar-host /> once near the app root (this site does) and call the service: show('Saved'), or show({ message, title?, action?, duration? }). It leaves after 4 s, or 10 s when it has an action so there is time to reach Undo, and holds while the pointer or focus is on it. offset lifts it above a bottom bar. Screen readers hear it through an always-present polite live region. Use toasts instead for messages that should stack or carry a tone, such as errors. Editors that place it themselves (the form builder does) can use the bare ui-snackbar.">
        <doc-demo lang="ts" code="import { UiSnackbarService, UiSnackbarHost } from '@zouriel/ui/dialog';

// once, in the root component's template: <ui-snackbar-host [offset]=&quot;bottomBarHeight&quot; />
snackbar = inject(UiSnackbarService);
this.snackbar.show('Grouped');
this.snackbar.show({ message: 'Deleted “Title”', action: { label: 'Undo', run: () => store.undo() } });

// or just the bar, positioned by you:
<ui-snackbar message=&quot;Deleted “Title”&quot; actionLabel=&quot;Undo&quot; (action)=&quot;undo()&quot; />">
          <div class="row">
            <ui-button variant="secondary" (click)="snackbar.show('Grouped')">Simple</ui-button>
            <ui-button variant="outline" (click)="snackbar.show({ message: 'Deleted “Title”', action: { label: 'Undo', run: undoSnack } })">Deleted, with Undo</ui-button>
            <ui-button variant="ghost" (click)="snackbar.show({ title: 'Stopped at a keyframe', message: 'Move or delete that keyframe to trim further.' })">With a title</ui-button>
          </div>
          <div class="row"><ui-snackbar message="Deleted “Title”" actionLabel="Undo" /></div>
        </doc-demo>
      </doc-section>

      <doc-section name="Command palette" selector="ui-command-palette" [api]="paletteApi" [outputs]="paletteOut" [shapes]="COMMAND"
        summary="A search-and-run dialog for commands, like the Search docs button in this site's header. Bind [(open)], pass commands, listen to (run). Typing filters by case-insensitive substring over label, group and keywords. ArrowUp/Down move the highlight (the field keeps focus, with aria-activedescendant), Enter runs it, and so does a click; running closes the palette. Escape or a backdrop click closes it. Focus is trapped while it is open and goes back to where it was on close. It binds no keyboard shortcut of its own: listen for Ctrl/Cmd+K yourself, as in the snippet. While open it sits on its own layer at the end of <body>, so a transformed or clipped ancestor cannot trap it, and page scroll is blocked (CDK block scroll strategy; needs @angular/cdk/overlay-prebuilt.css, like the other overlays).">
        <doc-demo lang="ts" code="import { UiCommandPalette, type UiCommand } from '@zouriel/ui/command-palette';
import FileAddIcon from '@hugeicons/core-free-icons/FileAddIcon';

// template
<ui-command-palette [(open)]=&quot;paletteOpen&quot; [commands]=&quot;commands&quot; (run)=&quot;run($event)&quot; />

// component
paletteOpen = signal(false);
commands: UiCommand[] = [
  { label: 'New file', value: 'new', group: 'File', icon: FileAddIcon, shortcut: 'Ctrl+N' },
  { label: 'Toggle dark mode', value: 'theme', group: 'View', keywords: 'theme night' },
];
@HostListener('document:keydown', ['$event'])
onKey(e: KeyboardEvent) {
  if ((e.ctrlKey || e.metaKey) &amp;&amp; e.key.toLowerCase() === 'k') { e.preventDefault(); this.paletteOpen.set(true); }
}">
          <div class="row">
            <ui-button variant="outline" (click)="palette.set(true)">Open command palette</ui-button>
          </div>
        </doc-demo>
      </doc-section>
    </doc-page>

    <ui-command-palette [(open)]="palette" [commands]="commands" (run)="toast.info($event.label, 'Ran command')" />

    <ui-bottom-sheet [(snap)]="sheetSnap" (snapChange)="$event === 0 && sheetModal.set(false)" [snaps]="[0, 0.4, 0.9]" title="Layers" [hasHeader]="true" [backdrop]="sheetModal()">
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
  protected readonly icons = { chevron: ArrowDown01Icon };
  protected readonly palette = signal(false);
  protected readonly commands: UiCommand[] = [
    { label: 'New file', value: 'new', group: 'File', icon: FileAddIcon, shortcut: 'Ctrl+N' },
    { label: 'Duplicate', value: 'dup', group: 'Edit', icon: Copy01Icon, shortcut: 'Ctrl+D' },
    { label: 'Delete', value: 'del', group: 'Edit', icon: Delete02Icon, keywords: 'remove trash' },
    { label: 'Settings', value: 'settings', group: 'App', icon: Settings01Icon, keywords: 'preferences options' },
    { label: 'Toggle dark mode', value: 'theme', group: 'View', icon: Moon02Icon, keywords: 'theme night' },
  ];
  protected readonly COMMAND = `interface UiCommand {
  label: string;
  value: string;                   // unique; also the list's track key
  group?: string;                  // shown at the end of the row, and searched
  icon?: string | IconSvgObject;   // a HugeIcons icon, or a short string
  shortcut?: string;               // display only; the palette does not bind it
  keywords?: string;               // searched, not shown
}`;
  protected readonly paletteApi: ApiRow[] = [
    { name: 'open', type: 'boolean', default: 'false', desc: 'Two-way (`[(open)]`). Whether the palette is showing; opening clears the query and highlights the first command.' },
    { name: 'commands', type: 'UiCommand[]', default: '[]', desc: 'Everything it can run.' },
    { name: 'placeholder', type: 'string', default: "'Type a command or search…'", desc: 'Search field placeholder.' },
    { name: 'glass', type: 'boolean', default: 'UiConfig.glass', desc: 'Glass panel.' },
    { name: 'radius', type: 'boolean', default: 'UiConfig.radius', desc: 'Rounded corners.' },
  ];
  protected readonly paletteOut: ApiRow[] = [
    { name: 'run', type: 'UiCommand', default: '—', desc: 'A command was chosen (Enter or click). The palette closes after emitting.' },
  ];
  protected readonly SNACK = `interface UiSnackbarOptions {
  message: string;
  title?: string;               // bold first line
  action?: UiSnackbarAction;    // usually Undo
  duration?: number;            // ms; 0 = stays; default 4000, or 10000 with an action
}
interface UiSnackbarAction {
  label: string;
  run: () => void;              // the snackbar is dismissed first
}
// What service.current() holds: the options with the duration filled in, plus the id.
interface UiSnack { id: number; message: string; title?: string; action?: UiSnackbarAction; duration: number }`;
  protected readonly TOAST = `type UiToastTone = 'info' | 'success' | 'warning' | 'danger';
type UiToastPosition = 'top-right' | 'top-left' | 'top-center' | 'bottom-right' | 'bottom-left' | 'bottom-center';
interface UiToastOptions {
  message: string;
  title?: string;
  tone?: UiToastTone;   // default 'info'
  duration?: number;    // ms; 0 = stays until dismissed; default 4000
  action?: UiToastAction;
}
// What service.toasts() holds: the options with defaults filled in, plus the id.
interface UiToast {
  id: number;
  message: string;
  title?: string;
  tone: UiToastTone;
  duration: number;
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

  protected readonly tooltipApi: ApiRow[] = [
    { name: 'uiTooltip', type: 'string (required)', default: '—', desc: 'Tooltip text (the directive value). Read when it opens.' },
    { name: 'uiTooltipPosition', type: "UiTooltipPosition: 'top' | 'bottom' | 'left' | 'right'", default: "'top'", desc: 'Preferred side. The opposite side is used when this one has no room.' },
  ];
  protected readonly popoverApi: ApiRow[] = [
    { name: 'open', type: 'boolean', default: 'false', desc: 'Two-way (`[(open)]`). Whether the panel is showing.' },
    { name: 'placement', type: "UiPopoverPlacement: 'bottom' | 'top' | 'bottom-start' | 'bottom-end'", default: "'bottom-start'", desc: 'Preferred position. Falls back to top (centred) when it does not fit.' },
    { name: 'glass', type: 'boolean', default: 'UiConfig.glass', desc: 'Glass panel.' },
    { name: 'radius', type: 'boolean', default: 'UiConfig.radius', desc: 'Rounded corners.' },
    { name: 'label', type: 'string', default: "''", desc: "Accessible name for the panel (aria-label). Empty: the panel is labelled by the trigger's text." },
    { name: '[popover-trigger]', type: 'slot', default: '—', desc: 'The element that toggles the panel on click.' },
    { name: '(default)', type: 'slot', default: '—', desc: 'Panel content.' },
  ];
  protected readonly menuApi: ApiRow[] = [
    { name: 'open', type: 'boolean', default: 'false', desc: 'Two-way (`[(open)]`). Whether the menu is showing.' },
    { name: 'items', type: 'UiMenuItem[]', default: '[]', desc: 'Menu items. Disabled ones are skipped by the arrow keys.' },
    { name: 'glass', type: 'boolean', default: 'UiConfig.glass', desc: 'Glass panel.' },
    { name: 'radius', type: 'boolean', default: 'UiConfig.radius', desc: 'Rounded corners.' },
    { name: '[menu-trigger]', type: 'slot', default: '—', desc: 'The element that toggles the menu on click; focus returns to it on close.' },
  ];
  protected readonly menuOut: ApiRow[] = [
    { name: 'select', type: 'UiMenuItem', default: '—', desc: 'Chosen item.' },
  ];
  protected readonly ctxApi: ApiRow[] = [
    { name: 'uiContextMenu', type: 'UiMenuItem[]', default: '[]', desc: 'Items (the directive value). Read when the menu opens.' },
  ];
  protected readonly ctxOut: ApiRow[] = [{ name: 'contextSelect', type: 'UiMenuItem', default: '—', desc: 'Chosen item.' }];
  protected readonly modalApi: ApiRow[] = [
    { name: 'open', type: 'boolean', default: 'false', desc: 'Two-way (`[(open)]`). Whether the dialog is showing.' },
    { name: 'title', type: 'string', default: 'undefined', desc: 'Header title, also the dialog\'s accessible name. Without it there is no header or close button, so give the dialog a way out in its content.' },
    { name: 'size', type: "'sm' | 'md' | 'lg' | 'full'", default: "'md'", desc: 'Max width: 360, 480 or 720px. full fills the screen with no padding.' },
    { name: 'closeOnBackdrop', type: 'boolean', default: 'true', desc: 'Click backdrop to close.' },
    { name: 'closeOnEscape', type: 'boolean', default: 'true', desc: 'Esc to close.' },
    { name: 'glass', type: 'boolean', default: 'UiConfig.glass', desc: 'Glass panel.' },
    { name: 'radius', type: 'boolean', default: 'UiConfig.radius', desc: 'Rounded corners.' },
    { name: '(default)', type: 'slot', default: '—', desc: 'Body; scrolls when it is taller than the dialog.' },
    { name: '[modal-footer]', type: 'slot', default: '—', desc: 'Footer actions, right-aligned. A wrapping div lays its children out in a row with a gap.' },
  ];
  protected readonly drawerApi: ApiRow[] = [
    { name: 'open', type: 'boolean', default: 'false', desc: 'Two-way (`[(open)]`). Whether the drawer is showing.' },
    { name: 'side', type: "UiDrawerSide: 'left' | 'right' | 'top' | 'bottom'", default: "'right'", desc: 'Edge it slides in from.' },
    { name: 'title', type: 'string', default: 'undefined', desc: 'Header title, also the accessible name. Without it there is no header or close button.' },
    { name: 'closeOnBackdrop', type: 'boolean', default: 'true', desc: 'Click backdrop to close.' },
    { name: 'closeOnEscape', type: 'boolean', default: 'true', desc: 'Esc to close.' },
    { name: 'glass', type: 'boolean', default: 'UiConfig.glass', desc: 'Glass surface.' },
    { name: 'radius', type: 'boolean', default: 'UiConfig.radius', desc: 'Rounded corners.' },
    { name: '(default)', type: 'slot', default: '—', desc: 'Body; scrolls when it is taller than the drawer.' },
  ];
  protected readonly confirmApi: ApiRow[] = [
    { name: 'open', type: 'boolean', default: 'false', desc: 'Two-way (`[(open)]`). Whether the prompt is showing; both buttons set it to false.' },
    { name: 'title', type: 'string', default: "'Are you sure?'", desc: 'Prompt title.' },
    { name: 'message', type: 'string', default: "''", desc: 'Body text.' },
    { name: 'confirmLabel', type: 'string', default: "'Confirm'", desc: 'Confirm button text.' },
    { name: 'cancelLabel', type: 'string', default: "'Cancel'", desc: 'Cancel button text.' },
    { name: 'destructive', type: 'boolean', default: 'false', desc: 'Red confirm button, with Cancel moved to the far left.' },
  ];
  protected readonly confirmOut: ApiRow[] = [
    { name: 'confirm', type: 'void', default: '—', desc: 'Confirm pressed.' },
    { name: 'cancel', type: 'void', default: '—', desc: 'Cancel pressed. Not emitted for Escape, the backdrop or the close button.' },
  ];
  protected readonly sheetSnap = signal(0);
  protected readonly sheetModal = signal(false);
  protected readonly sheetRows = Array.from({ length: 30 }, (_, i) => i + 1);
  protected readonly sheetApi: ApiRow[] = [
    { name: 'snaps', type: 'readonly number[]', default: '[0, 0.5, 1]', desc: 'Resting heights as fractions of the room it has, ascending. A first snap of 0 is closed.' },
    { name: 'snap', type: 'number', default: '0', desc: 'Two-way (`[(snap)]`). Index into snaps it rests at.' },
    { name: 'title', type: 'string', default: "''", desc: 'Header title and aria-label. A title, or hasHeader, shows the header row.' },
    { name: 'offset', type: 'number', default: '0', desc: 'Px kept free below it, for a toolbar it sits on.' },
    { name: 'topInset', type: 'number', default: '0', desc: 'Px kept free above its tallest snap.' },
    { name: 'backdrop', type: 'boolean', default: 'false', desc: 'Makes it modal while open: dims the page, closes on a backdrop tap, sets aria-modal, moves focus in and traps Tab.' },
    { name: 'closable', type: 'boolean', default: 'true', desc: 'Close button in the header.' },
    { name: 'hasHeader', type: 'boolean', default: 'false', desc: 'Show the header row without a title, for the close button and [sheet-actions].' },
    { name: 'expandOnFocus', type: 'boolean', default: 'true', desc: 'Rise to the tallest snap when a field inside gains focus on a touch screen.' },
    { name: '[sheet-actions]', type: 'slot', default: '—', desc: 'Header controls.' },
    { name: 'data-sheet-nodrag', type: 'attribute', default: '—', desc: 'On content that keeps its own drags.' },
    { name: 'close()', type: 'method', default: '—', desc: 'Close it (snap 0). If focus is inside, it goes back to where it came from first.' },
    { name: 'cdkFocusInitial', type: 'attribute', default: '—', desc: 'With backdrop: the element that gets focus on open (default: the first focusable one, the handle).' },
    { name: '(default)', type: 'slot', default: '—', desc: 'Body; scrolls inside the sheet.' },
    { name: '--ui-sheet-z', type: 'CSS variable', default: 'var(--ui-z-overlay)', desc: 'Stacking level, e.g. to sit under a toolbar but below dialogs.' },
  ];
  protected readonly sheetOut: ApiRow[] = [
    { name: 'heightChange', type: 'number', default: '—', desc: 'Px height once it settles.' },
    { name: 'coverChange', type: 'number', default: '—', desc: 'Px of the screen it takes from the bottom once settled, including what it rests on (offset or keyboard).' },
  ];
  protected readonly toastApi: ApiRow[] = [
    { name: 'host: position', type: 'UiToastPosition', default: "'bottom-right'", desc: 'Where ui-toast-host stacks toasts: a corner, or centred on the top or bottom edge. Toasts slide in from that side.' },
    { name: 'service.show(opts)', type: '(UiToastOptions) => number', default: '—', desc: 'Enqueue; returns id.' },
    { name: 'service.info / success / warning / danger', type: '(message: string, title?: string) => number', default: '—', desc: 'Shorthands for show() with a tone.' },
    { name: 'service.dismiss(id)', type: '(number) => void', default: '—', desc: 'Remove a toast.' },
    { name: 'service.act(id)', type: '(number) => void', default: '—', desc: "Dismiss the toast and run its action. The action button calls this." },
    { name: 'service.pause(id) / resume(id)', type: '(number) => void', default: '—', desc: 'Hold or restart the countdown. The host calls these on hover and focus.' },
    { name: 'service.toasts', type: 'Signal<UiToast[]>', default: '[]', desc: 'The live queue.' },
    { name: 'opts.action', type: 'UiToastAction', default: '—', desc: 'One button in the toast, e.g. Undo. Running it dismisses the toast.' },
  ];
  protected readonly undoToast = () => this.toast.success('Restored');
  protected readonly snackbar = inject(UiSnackbarService);
  protected readonly undoSnack = () => this.snackbar.show('Restored “Title”');
  protected readonly snackApi: ApiRow[] = [
    { name: 'host: offset', type: 'number', default: '0', desc: 'Extra px below the snackbar, e.g. the height of a bottom navigation bar or editor dock. The safe-area inset is added for you.' },
    { name: 'service.show(opts | message)', type: '(UiSnackbarOptions | string) => number', default: '—', desc: 'Show a notice, replacing any current one; returns its id.' },
    { name: 'service.dismiss(id?)', type: '(number?) => void', default: '—', desc: 'Hide it; with an id, only if that notice is still the one showing.' },
    { name: 'service.act()', type: '() => void', default: '—', desc: 'Dismiss and run the action. The action button calls this.' },
    { name: 'service.pause() / resume()', type: '() => void', default: '—', desc: 'Hold or restart the countdown with the time left. The host calls these on hover and focus.' },
    { name: 'service.current', type: 'Signal<UiSnack | null>', default: 'null', desc: 'The notice showing now.' },
    { name: 'ui-snackbar: message / title / actionLabel', type: 'string', default: '—', desc: 'The bare bar. actionLabel shows the action button, which emits (action).' },
  ];
}
