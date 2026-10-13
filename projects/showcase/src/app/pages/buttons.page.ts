import { Component, signal } from '@angular/core';
import { HugeiconsIconComponent } from '@hugeicons/angular';
import Settings02Icon from '@hugeicons/core-free-icons/Settings02Icon';
import Add01Icon from '@hugeicons/core-free-icons/Add01Icon';
import Delete02Icon from '@hugeicons/core-free-icons/Delete02Icon';
import { UiText } from '@zouriel/ui/text';
import {
  UiButton, UiIconButton, UiButtonGroup, UiToggleButton, UiSplitButton, UiDropdownButton, UiSegmented,
  type UiDropdownItem,
} from '@zouriel/ui/button';
import { DocPage, DocSection, DocDemo, type ApiRow } from '../docs/docs-ui';

const VARIANT = "'primary' | 'secondary' | 'outline' | 'ghost' | 'link' | 'destructive' | 'brand'";
const SIZE = "'sm' | 'md' | 'lg'";

@Component({
  selector: 'page-buttons',
  imports: [HugeiconsIconComponent, 
    UiText, UiButton, UiIconButton, UiButtonGroup, UiToggleButton, UiSplitButton, UiDropdownButton, UiSegmented,
    DocPage, DocSection, DocDemo,
  ],
  template: `
    <doc-page eyebrow="Components" title="Buttons & actions"
      lead="Action primitives. All wire radius from UiConfig and use only design tokens, so they re-skin with the active theme.">

      <doc-section name="Button" selector="ui-button" [api]="buttonApi"
        summary="Seven variants (brand uses the --ui-gradient-brand fill), three sizes, loading and block states. Glass is opt-in (buttons are solid by default). On coarse pointers the hit area grows to 44px tall. Projects its label as content.">
        <doc-demo code="<ui-button variant=&quot;primary&quot;>Primary</ui-button>
<ui-button variant=&quot;outline&quot; size=&quot;sm&quot;>Outline</ui-button>
<ui-button variant=&quot;destructive&quot;>Delete</ui-button>
<ui-button [loading]=&quot;true&quot;>Saving</ui-button>
<ui-button [block]=&quot;true&quot;>Full width</ui-button>">
          <div class="row">
            <ui-button variant="primary">Primary</ui-button>
            <ui-button variant="secondary">Secondary</ui-button>
            <ui-button variant="outline">Outline</ui-button>
            <ui-button variant="ghost">Ghost</ui-button>
            <ui-button variant="destructive">Delete</ui-button>
            <ui-button variant="link">Link</ui-button>
          </div>
          <div class="row">
            <ui-button size="sm">Small</ui-button>
            <ui-button size="md">Medium</ui-button>
            <ui-button size="lg">Large</ui-button>
            <ui-button [loading]="true">Saving</ui-button>
            <ui-button [disabled]="true">Disabled</ui-button>
          </div>
        </doc-demo>
      </doc-section>

      <doc-section name="Icon button" selector="ui-icon-button" [api]="iconApi"
        summary="Square, icon-only action. label is REQUIRED (string) and applied as aria-label so the control is named for assistive tech. Takes every button variant. Project an icon/SVG as content; projected SVGs are sized to match. On coarse pointers an invisible hit area brings it up to 44px.">
        <doc-demo code="<ui-icon-button label=&quot;Settings&quot; variant=&quot;outline&quot;><hugeicons-icon [icon]=&quot;Settings02Icon&quot; /></ui-icon-button>
<ui-icon-button label=&quot;Add&quot; variant=&quot;primary&quot; [round]=&quot;true&quot;><hugeicons-icon [icon]=&quot;Add01Icon&quot; /></ui-icon-button>">
          <div class="row items-center">
            <ui-icon-button label="Settings" variant="outline"><hugeicons-icon aria-hidden="true" [icon]="icons.settings" [strokeWidth]="1.8" /></ui-icon-button>
            <ui-icon-button label="Add" variant="primary" [round]="true"><hugeicons-icon aria-hidden="true" [icon]="icons.add" [strokeWidth]="1.8" /></ui-icon-button>
            <ui-icon-button label="Delete" variant="ghost"><hugeicons-icon aria-hidden="true" [icon]="icons.remove" [strokeWidth]="1.8" /></ui-icon-button>
          </div>
        </doc-demo>
      </doc-section>

      <doc-section name="Button group" selector="ui-button-group" [api]="groupApi"
        summary="Visually joins a row of ui-button elements into a segmented control. Project the buttons as content.">
        <doc-demo code="<ui-button-group label=&quot;Range&quot;>
  <ui-button variant=&quot;outline&quot; size=&quot;sm&quot;>Day</ui-button>
  <ui-button variant=&quot;outline&quot; size=&quot;sm&quot;>Week</ui-button>
</ui-button-group>">
          <ui-button-group label="Range">
            <ui-button variant="outline" size="sm">Day</ui-button>
            <ui-button variant="outline" size="sm">Week</ui-button>
            <ui-button variant="outline" size="sm">Month</ui-button>
          </ui-button-group>
        </doc-demo>
      </doc-section>

      <doc-section name="Segmented" selector="ui-segmented" [api]="segmentedApi" [outputs]="segmentedOut"
        shapes="interface UiSegmentedOption {
  value: string;
  label: string;
  glyph?: string;      // short visible content; label stays the accessible name
  disabled?: boolean;
}"
        summary="Pick one of a few options, joined into one control. A radiogroup: arrow keys move the choice, Tab leaves the group. Bind [(value)] or ngModel / formControl. An option can show a short glyph instead of its label (the label stays the accessible name). Use it for modes and view switches; use toggle buttons when several can be on.">
        <doc-demo code="<ui-segmented label=&quot;Preview with&quot; [options]=&quot;[{ value: 'filled', label: 'Filled' }, { value: 'empty', label: 'Empty' }]&quot; [(value)]=&quot;mode&quot; />">
          <div class="row items-center">
            <ui-segmented label="Preview with" [options]="segOptions" [(value)]="segValue" />
            <ui-segmented size="sm" label="Mode" [options]="segModes" [(value)]="segMode" />
          </div>
          <div class="row"><span class="muted">value: {{ segValue() }} · {{ segMode() }}</span></div>
        </doc-demo>
      </doc-section>

      <doc-section name="Toggle button" selector="ui-toggle-button" [api]="toggleApi" [outputs]="toggleOut"
        summary="Two-state button with aria-pressed. pressed is a two-way model, so bind [(pressed)]. On coarse pointers the hit area grows to 44px tall.">
        <doc-demo code="<ui-toggle-button [(pressed)]=&quot;bold&quot;>Bold</ui-toggle-button>">
          <ui-toggle-button [(pressed)]="bold">Bold {{ bold() ? 'ON' : 'off' }}</ui-toggle-button>
        </doc-demo>
      </doc-section>

      <doc-section name="Split button" selector="ui-split-button" [api]="splitApi" [outputs]="splitOut"
        summary="Primary action plus a caret. (action) fires for the main click; (menu) fires for the caret so you can open an attached dropdown.">
        <doc-demo code="<ui-split-button (action)=&quot;save()&quot; (menu)=&quot;openMenu()&quot;>Save</ui-split-button>">
          <ui-split-button (action)="msg.set('action')" (menu)="msg.set('menu')">Save</ui-split-button>
          <ui-text variant="caption">last: {{ msg() }}</ui-text>
        </doc-demo>
      </doc-section>

      <doc-section name="Dropdown button" selector="ui-dropdown-button" [api]="ddApi" [outputs]="ddOut"
        summary="A button that opens a menu of actions (CDK Overlay). Pass items; listen to (select). Opening moves focus to the first item; ArrowUp/Down, Home and End move between items, Escape closes and returns focus to the trigger, Tab closes. The menu flips to stay on screen."
        shapes="interface UiDropdownItem {
  label: string;
  value: string;
  disabled?: boolean;
  danger?: boolean;   // renders the item in the danger color
}">
        <doc-demo code="<ui-dropdown-button [items]=&quot;items&quot; (select)=&quot;run($event)&quot;>Actions</ui-dropdown-button>">
          <ui-dropdown-button variant="primary" [items]="ddItems" (select)="msg.set($event.label)">Actions</ui-dropdown-button>
        </doc-demo>
      </doc-section>

      <doc-section name="FAB" selector="ui-fab" [api]="fabApi"
        summary="Floating action button pinned to a screen corner (position: fixed). label is required (aria-label). Project an icon as content. The sm size grows to 44px on coarse pointers.">
        <doc-demo code="<ui-fab label=&quot;New&quot; position=&quot;bottom-right&quot;>＋</ui-fab>"></doc-demo>
      </doc-section>
    </doc-page>
  `,
  styles: `
    .row { display: flex; flex-wrap: wrap; gap: var(--ui-space-3); }
    .items-center { align-items: center; }
    .muted { color: var(--ui-color-text-muted); font: var(--ui-font-size-sm) var(--ui-font-mono); }
  `,
})
export class ButtonsPage {
  protected readonly icons = { settings: Settings02Icon, add: Add01Icon, remove: Delete02Icon };
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
    { name: 'radius', type: 'boolean', default: 'UiConfig.radius', desc: 'Rounded corners.' },
  ];
  protected readonly iconApi: ApiRow[] = [
    { name: 'label', type: 'string (required)', default: '—', desc: 'Accessible name (aria-label).' },
    { name: 'variant', type: VARIANT, default: "'ghost'", desc: 'Visual style.' },
    { name: 'size', type: SIZE, default: "'md'", desc: 'Square dimension.' },
    { name: 'type', type: "'button' | 'submit' | 'reset'", default: "'button'", desc: 'Native button type.' },
    { name: 'disabled', type: 'boolean', default: 'false', desc: 'Disable interaction.' },
    { name: 'round', type: 'boolean', default: 'false', desc: 'Fully circular (pill).' },
    { name: 'glass', type: 'boolean', default: 'false', desc: 'Opt-in glass.' },
    { name: 'radius', type: 'boolean', default: 'UiConfig.radius', desc: 'Rounded corners.' },
  ];
  protected readonly segOptions = [{ value: 'filled', label: 'Filled' }, { value: 'empty', label: 'Empty fields' }, { value: 'roles', label: 'Two roles' }];
  protected readonly segModes = [{ value: 'edit', label: 'Edit' }, { value: 'interact', label: 'Interact' }];
  protected readonly segValue = signal<string | null>('filled');
  protected readonly segMode = signal<string | null>('edit');
  protected readonly segmentedApi: ApiRow[] = [
    { name: 'options', type: 'readonly UiSegmentedOption[]', default: '[]', desc: 'The choices, in order (see Data shapes).' },
    { name: 'value', type: 'string | null (model)', default: 'null', desc: 'Two-way selected value: [(value)]. Also works with ngModel and reactive forms.' },
    { name: 'label', type: 'string', default: "'Options'", desc: 'aria-label for the radiogroup.' },
    { name: 'size', type: SIZE, default: "'md'", desc: 'Control height.' },
  ];
  protected readonly segmentedOut: ApiRow[] = [
    { name: 'valueChange', type: 'string | null', default: '—', desc: 'Emits when the choice changes (model change).' },
  ];
  protected readonly groupApi: ApiRow[] = [
    { name: 'label', type: 'string', default: '—', desc: 'aria-label for the group.' },
  ];
  protected readonly toggleApi: ApiRow[] = [
    { name: 'pressed', type: 'boolean (model)', default: 'false', desc: 'Two-way pressed state — [(pressed)].' },
    { name: 'size', type: SIZE, default: "'md'", desc: 'Control height.' },
    { name: 'disabled', type: 'boolean', default: 'false', desc: 'Disable interaction.' },
    { name: 'radius', type: 'boolean', default: 'UiConfig.radius', desc: 'Rounded corners.' },
  ];
  protected readonly toggleOut: ApiRow[] = [
    { name: 'pressedChange', type: 'boolean', default: '—', desc: 'Emits on toggle (model change).' },
  ];
  protected readonly splitApi: ApiRow[] = [
    { name: 'variant', type: VARIANT, default: "'primary'", desc: 'Visual style.' },
    { name: 'size', type: SIZE, default: "'md'", desc: 'Control height.' },
    { name: 'disabled', type: 'boolean', default: 'false', desc: 'Disable both buttons.' },
    { name: 'radius', type: 'boolean', default: 'UiConfig.radius', desc: 'Rounded corners.' },
  ];
  protected readonly splitOut: ApiRow[] = [
    { name: 'action', type: 'void', default: '—', desc: 'Main button clicked.' },
    { name: 'menu', type: 'void', default: '—', desc: 'Caret clicked (open a dropdown).' },
  ];
  protected readonly ddApi: ApiRow[] = [
    { name: 'items', type: 'UiDropdownItem[]', default: '[]', desc: 'Menu items (see Data shapes).' },
    { name: 'variant', type: VARIANT, default: "'secondary'", desc: 'Trigger style.' },
    { name: 'size', type: SIZE, default: "'md'", desc: 'Trigger height.' },
    { name: 'disabled', type: 'boolean', default: 'false', desc: 'Disable the trigger.' },
    { name: 'radius', type: 'boolean', default: 'UiConfig.radius', desc: 'Rounded corners.' },
  ];
  protected readonly ddOut: ApiRow[] = [
    { name: 'select', type: 'UiDropdownItem', default: '—', desc: 'Chosen item.' },
  ];
  protected readonly fabApi: ApiRow[] = [
    { name: 'label', type: 'string (required)', default: '—', desc: 'Accessible name (aria-label).' },
    { name: 'position', type: "'bottom-right' | 'bottom-left' | 'top-right' | 'top-left'", default: "'bottom-right'", desc: 'Fixed corner.' },
    { name: 'size', type: "'sm' | 'md'", default: "'md'", desc: 'Diameter.' },
    { name: 'disabled', type: 'boolean', default: 'false', desc: 'Disable interaction.' },
  ];
}
