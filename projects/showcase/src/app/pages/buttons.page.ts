import { Component, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { HugeiconsIconComponent } from '@hugeicons/angular';
import Settings02Icon from '@hugeicons/core-free-icons/Settings02Icon';
import Add01Icon from '@hugeicons/core-free-icons/Add01Icon';
import Delete02Icon from '@hugeicons/core-free-icons/Delete02Icon';
import TextBoldIcon from '@hugeicons/core-free-icons/TextBoldIcon';
import { UiText } from '@zouriel/ui/text';
import { UiSwitch } from '@zouriel/ui/form';
import {
  UiButton, UiIconButton, UiButtonGroup, UiToggleButton, UiSplitButton, UiDropdownButton, UiSegmented, UiFab,
  type UiDropdownItem, type UiSegmentedOption,
} from '@zouriel/ui/button';
import { DocPage, DocSection, DocDemo, type ApiRow } from '../docs/docs-ui';

const VARIANT = 'UiButtonVariant';
const SIZE = "'sm' | 'md' | 'lg'";
const SLOT = 'Projected content is the label (text, or an icon followed by text).';

@Component({
  selector: 'page-buttons',
  imports: [HugeiconsIconComponent, ReactiveFormsModule, UiSwitch,
    UiText, UiButton, UiIconButton, UiButtonGroup, UiToggleButton, UiSplitButton, UiDropdownButton, UiSegmented, UiFab,
    DocPage, DocSection, DocDemo,
  ],
  template: `
    <doc-page eyebrow="Components" title="Buttons & actions"
      lead="Action primitives. All wire radius from UiConfig and use only design tokens, so they re-skin with the active theme.">

      <doc-section name="Button" selector="ui-button" [api]="buttonApi"
        shapes="// exported from @zouriel/ui/button; the variant input of every button here takes it
type UiButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'link' | 'destructive' | 'brand' | 'accent';"
        summary="Eight variants, three sizes, loading and block states. Brand is a pill with the theme's --ui-gradient-brand fill; keep it for the one action per view that should stand out. Accent fills with the theme's --ui-color-accent (the coral call to action in maldives; secondary in themes without an accent of their own). Loading shows a spinner, sets aria-busy and disables the button. Glass is opt-in (buttons are solid by default). The link variant is sized to its text but never smaller than 24x24. On coarse pointers the hit area grows to 44px tall. Projects its label as content.">
        <doc-demo code="<ui-button variant=&quot;primary&quot;>Primary</ui-button>
<ui-button variant=&quot;outline&quot; size=&quot;sm&quot;>Outline</ui-button>
<ui-button variant=&quot;destructive&quot;>Delete</ui-button>
<ui-button variant=&quot;brand&quot;>Get started</ui-button>
<ui-button variant=&quot;accent&quot;>Get guidance</ui-button>
<ui-button type=&quot;submit&quot; [loading]=&quot;true&quot;>Saving</ui-button>
<ui-button [block]=&quot;true&quot;>Full width</ui-button>">
          <div class="row items-center">
            <ui-button variant="primary">Primary</ui-button>
            <ui-button variant="secondary">Secondary</ui-button>
            <ui-button variant="outline">Outline</ui-button>
            <ui-button variant="destructive">Delete</ui-button>
            <ui-button variant="brand">Get started</ui-button>
            <ui-button variant="accent">Get guidance</ui-button>
          </div>
          <!-- The borderless variants get their own row: wrapped to the start of a line they read as stray text. -->
          <div class="row items-center">
            <ui-button variant="ghost">Ghost</ui-button>
            <ui-button variant="link">Link</ui-button>
          </div>
          <div class="row items-center">
            <ui-button size="sm">Small</ui-button>
            <ui-button size="md">Medium</ui-button>
            <ui-button size="lg">Large</ui-button>
            <ui-button [loading]="true">Saving</ui-button>
            <ui-button [disabled]="true">Disabled</ui-button>
          </div>
          <ui-button variant="outline" [block]="true">Full width</ui-button>
        </doc-demo>
      </doc-section>

      <doc-section name="Icon button" selector="ui-icon-button" [api]="iconApi"
        summary="Square, icon-only action. label is required and becomes the aria-label, so the control has a name for assistive tech. Takes every button variant (link draws like ghost). Project an icon as content; projected SVGs are sized to the button (14, 16 or 18px). On coarse pointers an invisible hit area brings it up to 44px.">
        <doc-demo code="<!-- import Settings02Icon from '@hugeicons/core-free-icons/Settings02Icon' and expose it on the component -->
<ui-icon-button label=&quot;Settings&quot; variant=&quot;outline&quot;><hugeicons-icon [icon]=&quot;Settings02Icon&quot; /></ui-icon-button>
<ui-icon-button label=&quot;Add&quot; variant=&quot;primary&quot; [round]=&quot;true&quot;><hugeicons-icon [icon]=&quot;Add01Icon&quot; /></ui-icon-button>">
          <div class="row items-center">
            <ui-icon-button label="Settings" variant="outline"><hugeicons-icon aria-hidden="true" [icon]="icons.settings" [strokeWidth]="1.8" /></ui-icon-button>
            <ui-icon-button label="Add" variant="primary" [round]="true"><hugeicons-icon aria-hidden="true" [icon]="icons.add" [strokeWidth]="1.8" /></ui-icon-button>
            <ui-icon-button label="Delete" variant="ghost"><hugeicons-icon aria-hidden="true" [icon]="icons.remove" [strokeWidth]="1.8" /></ui-icon-button>
          </div>
        </doc-demo>
      </doc-section>

      <doc-section name="Button group" selector="ui-button-group" [api]="groupApi"
        summary="Joins a row of ui-button elements: inner corners go square and borders overlap. It is role=group with label as its aria-label; it does not manage selection (use Segmented for one-of-many). Project the buttons as content.">
        <doc-demo code="<ui-button-group label=&quot;Range&quot;>
  <ui-button variant=&quot;outline&quot; size=&quot;sm&quot;>Day</ui-button>
  <ui-button variant=&quot;outline&quot; size=&quot;sm&quot;>Week</ui-button>
  <ui-button variant=&quot;outline&quot; size=&quot;sm&quot;>Month</ui-button>
</ui-button-group>">
          <ui-button-group label="Range">
            <ui-button variant="outline" size="sm">Day</ui-button>
            <ui-button variant="outline" size="sm">Week</ui-button>
            <ui-button variant="outline" size="sm">Month</ui-button>
          </ui-button-group>
        </doc-demo>
      </doc-section>

      <doc-section name="Segmented" selector="ui-segmented" [api]="segmentedApi"
        shapes="interface UiSegmentedOption {
  value: string;
  label: string;
  glyph?: string;      // short visible content; label stays the accessible name
  disabled?: boolean;
}"
        summary="Pick one of a few options, joined into one control. A radiogroup: arrow keys move the choice (skipping disabled options), only the chosen option is in the tab order, Tab leaves the group. Bind [(value)], or ngModel / formControl, which can also disable it. An option can show short glyph text instead of its label (the label stays the accessible name). Use it for modes and view switches; use toggle buttons when several can be on.">
        <doc-demo code="<ui-segmented label=&quot;Preview with&quot; [options]=&quot;[{ value: 'filled', label: 'Filled' }, { value: 'empty', label: 'Empty' }]&quot; [(value)]=&quot;mode&quot; />">
          <div class="row items-center">
            <ui-segmented label="Preview with" [options]="segOptions" [(value)]="segValue" />
            <ui-segmented size="sm" label="Mode" [options]="segModes" [(value)]="segMode" />
          </div>
          <div class="row"><span class="muted">value: {{ segValue() }} · {{ segMode() }}</span></div>
        </doc-demo>
        <doc-demo code="<ui-segmented label=&quot;Align&quot; [options]=&quot;aligns&quot; [formControl]=&quot;align&quot; />
<!-- align.disable() / align.enable() disables every option -->">
          <div class="row items-center">
            <ui-segmented label="Align" [options]="segAlign" [formControl]="align" />
            <ui-switch [formControl]="alignLocked">Disabled</ui-switch>
            <span class="muted">formControl: {{ alignValue() }}</span>
          </div>
        </doc-demo>
      </doc-section>

      <doc-section name="Toggle button" selector="ui-toggle-button" [api]="toggleApi"
        summary="Two-state button with aria-pressed. pressed is a two-way model, so bind [(pressed)]. It is not a form control (no ngModel). On coarse pointers the hit area grows to 44px tall. Projects its label as content.">
        <doc-demo code="<ui-toggle-button [(pressed)]=&quot;bold&quot;>Bold</ui-toggle-button>">
          <div class="row items-center">
            <ui-toggle-button [(pressed)]="bold"><hugeicons-icon aria-hidden="true" [icon]="icons.bold" [size]="16" [strokeWidth]="1.8" />Bold</ui-toggle-button>
            <span class="muted">pressed: {{ bold() }}</span>
          </div>
        </doc-demo>
      </doc-section>

      <doc-section name="Split button" selector="ui-split-button" [api]="splitApi" [outputs]="splitOut"
        summary="Primary action plus a caret button. (action) fires for the main click; (menu) fires for the caret (aria-label &quot;More actions&quot;, aria-haspopup=menu) so you can open your own menu. It draws no menu itself; for a built-in menu use the dropdown button. Projects the main label as content.">
        <doc-demo code="<ui-split-button (action)=&quot;save()&quot; (menu)=&quot;openMenu()&quot;>Save</ui-split-button>">
          <div class="row items-center">
            <ui-split-button (action)="msg.set('action')" (menu)="msg.set('menu')">Save</ui-split-button>
            <ui-split-button variant="outline" (action)="msg.set('action (outline)')" (menu)="msg.set('menu (outline)')">Export</ui-split-button>
          </div>
          <ui-text variant="caption">last: {{ msg() }}</ui-text>
        </doc-demo>
      </doc-section>

      <doc-section name="Dropdown button" selector="ui-dropdown-button" [api]="ddApi" [outputs]="ddOut"
        summary="A button that opens a menu of actions (CDK Overlay). Pass items; listen to (select). Opening moves focus to the first enabled item; ArrowUp/Down (wrapping), Home and End move between items, Enter chooses, Escape closes and returns focus to the trigger, Tab or a click outside closes. The menu flips to stay on screen. Projects the trigger label as content."
        shapes="interface UiDropdownItem {
  label: string;
  value: string;
  disabled?: boolean;
  danger?: boolean;   // renders the item in the danger color
}">
        <doc-demo code="<ui-dropdown-button [items]=&quot;items&quot; (select)=&quot;run($event)&quot;>Actions</ui-dropdown-button>">
          <div class="row items-center">
            <ui-dropdown-button variant="primary" [items]="ddItems" (select)="msg.set($event.label)">Actions</ui-dropdown-button>
            <span class="muted">last: {{ msg() }}</span>
          </div>
        </doc-demo>
      </doc-section>

      <doc-section name="FAB" selector="ui-fab" [api]="fabApi"
        summary="Floating action button pinned to a screen corner (position: fixed), offset by the device safe area. label is required (aria-label). Project an icon as content. The sm size grows to 44px on coarse pointers. The demo frame below is its own containing block, so the button sits in the frame's corner rather than the window's.">
        <doc-demo code="<ui-fab label=&quot;New item&quot; position=&quot;bottom-right&quot; (click)=&quot;create()&quot;>
  <hugeicons-icon [icon]=&quot;Add01Icon&quot; />
</ui-fab>">
          <div class="fab-frame">
            <span class="muted">clicks: {{ fabClicks() }}</span>
            <ui-fab label="New item" (click)="fabClicks.set(fabClicks() + 1)"><hugeicons-icon aria-hidden="true" [icon]="icons.add" [size]="22" [strokeWidth]="1.8" /></ui-fab>
            <ui-fab label="New item (small)" size="sm" position="top-right"><hugeicons-icon aria-hidden="true" [icon]="icons.add" [size]="18" [strokeWidth]="1.8" /></ui-fab>
          </div>
        </doc-demo>
      </doc-section>
    </doc-page>
  `,
  styles: `
    .row { display: flex; flex-wrap: wrap; gap: var(--ui-space-3); }
    .items-center { align-items: center; }
    .muted { color: var(--ui-color-text-muted); font: var(--ui-font-size-sm) var(--ui-font-mono); }
    /* transform makes this box the containing block for the fixed-position FABs inside it. */
    .fab-frame { position: relative; transform: translateZ(0); height: 160px; padding: var(--ui-space-3); overflow: hidden;
      border: 1px dashed var(--ui-color-border); border-radius: var(--ui-radius); }
  `,
})
export class ButtonsPage {
  protected readonly icons = { settings: Settings02Icon, add: Add01Icon, remove: Delete02Icon, bold: TextBoldIcon };
  protected readonly fabClicks = signal(0);
  protected readonly bold = signal(false);
  protected readonly msg = signal('—');
  protected readonly ddItems: UiDropdownItem[] = [
    { label: 'Rename', value: 'rename' }, { label: 'Duplicate', value: 'dup' }, { label: 'Delete', value: 'del', danger: true },
  ];

  protected readonly buttonApi: ApiRow[] = [
    { name: 'variant', type: VARIANT, default: "'primary'", desc: 'Visual style.' },
    { name: 'size', type: SIZE, default: "'md'", desc: 'Control height & font size.' },
    { name: 'type', type: "'button' | 'submit' | 'reset'", default: "'button'", desc: 'Native button type.' },
    { name: 'disabled', type: 'boolean', default: 'false', desc: 'Disable interaction.' },
    { name: 'loading', type: 'boolean', default: 'false', desc: 'Show spinner & disable.' },
    { name: 'block', type: 'boolean', default: 'false', desc: 'Stretch to full width.' },
    { name: 'glass', type: 'boolean', default: 'false', desc: 'Opt-in translucent glass.' },
    { name: 'radius', type: 'boolean', default: 'UiConfig.radius', desc: 'Rounded corners (brand stays a pill unless this is false).' },
    { name: '(content)', type: 'slot', default: '—', desc: SLOT },
  ];
  protected readonly iconApi: ApiRow[] = [
    { name: 'label', type: 'string (required)', default: '—', desc: 'Accessible name (aria-label).' },
    { name: 'variant', type: VARIANT, default: "'ghost'", desc: 'Visual style.' },
    { name: 'size', type: SIZE, default: "'md'", desc: 'Square dimension.' },
    { name: 'type', type: "'button' | 'submit' | 'reset'", default: "'button'", desc: 'Native button type.' },
    { name: 'disabled', type: 'boolean', default: 'false', desc: 'Disable interaction.' },
    { name: 'round', type: 'boolean', default: 'false', desc: 'Fully circular (pill).' },
    { name: 'glass', type: 'boolean', default: 'false', desc: 'Opt-in glass.' },
    { name: 'radius', type: 'boolean', default: 'UiConfig.radius', desc: 'Rounded corners (ignored when round).' },
    { name: '(content)', type: 'slot', default: '—', desc: 'The icon. Give it aria-hidden; label names the button.' },
  ];
  protected readonly segAlign: UiSegmentedOption[] = [
    { value: 'left', label: 'Left' }, { value: 'center', label: 'Centre' }, { value: 'right', label: 'Right' }, { value: 'justify', label: 'Justify', disabled: true },
  ];
  protected readonly align = new FormControl<string | null>('center');
  protected readonly alignValue = signal<string | null>('center');
  protected readonly alignLocked = new FormControl(false, { nonNullable: true });
  constructor() {
    this.align.valueChanges.subscribe((v) => this.alignValue.set(v));
    this.alignLocked.valueChanges.subscribe((off) => (off ? this.align.disable() : this.align.enable()));
  }
  protected readonly segOptions = [{ value: 'filled', label: 'Filled' }, { value: 'empty', label: 'Empty fields' }, { value: 'roles', label: 'Two roles' }];
  protected readonly segModes = [{ value: 'edit', label: 'Edit' }, { value: 'interact', label: 'Interact' }];
  protected readonly segValue = signal<string | null>('filled');
  protected readonly segMode = signal<string | null>('edit');
  protected readonly segmentedApi: ApiRow[] = [
    { name: 'options', type: 'readonly UiSegmentedOption[]', default: '[]', desc: 'The choices, in order (see Data shapes).' },
    { name: 'value', type: 'string | null (model)', default: 'null', desc: 'Two-way (`[(value)]`). The chosen option. Also a form control: ngModel, formControl, formControlName (which also disable it).' },
    { name: 'label', type: 'string', default: "'Options'", desc: 'aria-label for the radiogroup.' },
    { name: 'size', type: SIZE, default: "'md'", desc: 'Control height. Options are never under 24px tall, so sm is 28px overall.' },
  ];
  protected readonly groupApi: ApiRow[] = [
    { name: 'label', type: 'string', default: '—', desc: 'aria-label for the group.' },
    { name: '(content)', type: 'slot', default: '—', desc: 'The ui-button elements to join.' },
  ];
  protected readonly toggleApi: ApiRow[] = [
    { name: 'pressed', type: 'boolean (model)', default: 'false', desc: 'Two-way (`[(pressed)]`). Whether it is on; mirrored to aria-pressed.' },
    { name: 'size', type: SIZE, default: "'md'", desc: 'Control height.' },
    { name: 'disabled', type: 'boolean', default: 'false', desc: 'Disable interaction.' },
    { name: 'radius', type: 'boolean', default: 'UiConfig.radius', desc: 'Rounded corners.' },
    { name: '(content)', type: 'slot', default: '—', desc: SLOT },
  ];
  protected readonly splitApi: ApiRow[] = [
    { name: 'variant', type: VARIANT, default: "'primary'", desc: 'Visual style. link, brand and accent have no style of their own here and draw as a plain surface button.' },
    { name: 'size', type: SIZE, default: "'md'", desc: 'Control height.' },
    { name: 'disabled', type: 'boolean', default: 'false', desc: 'Disable both buttons.' },
    { name: 'radius', type: 'boolean', default: 'UiConfig.radius', desc: 'Rounded corners.' },
    { name: '(content)', type: 'slot', default: '—', desc: 'The main button label.' },
  ];
  protected readonly splitOut: ApiRow[] = [
    { name: 'action', type: 'void', default: '—', desc: 'Main button clicked.' },
    { name: 'menu', type: 'void', default: '—', desc: 'Caret clicked (open a dropdown).' },
  ];
  protected readonly ddApi: ApiRow[] = [
    { name: 'items', type: 'UiDropdownItem[]', default: '[]', desc: 'Menu items (see Data shapes).' },
    { name: 'variant', type: VARIANT, default: "'secondary'", desc: 'Trigger style. link, brand and accent have no style of their own here and draw as a plain surface button.' },
    { name: 'size', type: SIZE, default: "'md'", desc: 'Trigger height.' },
    { name: 'disabled', type: 'boolean', default: 'false', desc: 'Disable the trigger.' },
    { name: 'radius', type: 'boolean', default: 'UiConfig.radius', desc: 'Rounded corners.' },
    { name: '(content)', type: 'slot', default: '—', desc: 'The trigger label (a caret is drawn after it).' },
  ];
  protected readonly ddOut: ApiRow[] = [
    { name: 'select', type: 'UiDropdownItem', default: '—', desc: 'Chosen item. Disabled items never emit.' },
  ];
  protected readonly fabApi: ApiRow[] = [
    { name: 'label', type: 'string (required)', default: '—', desc: 'Accessible name (aria-label).' },
    { name: 'position', type: "'bottom-right' | 'bottom-left' | 'top-right' | 'top-left'", default: "'bottom-right'", desc: 'Fixed corner.' },
    { name: 'size', type: "'sm' | 'md'", default: "'md'", desc: 'Diameter: 40px or 52px.' },
    { name: 'disabled', type: 'boolean', default: 'false', desc: 'Disable interaction.' },
    { name: '(content)', type: 'slot', default: '—', desc: 'The icon. Give it aria-hidden; label names the button.' },
  ];
}
