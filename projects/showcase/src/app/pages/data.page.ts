import { Component, signal } from '@angular/core';
import { HugeiconsIconComponent } from '@hugeicons/angular';
import PencilEdit02Icon from '@hugeicons/core-free-icons/PencilEdit02Icon';
import Rocket01Icon from '@hugeicons/core-free-icons/Rocket01Icon';
import Settings01Icon from '@hugeicons/core-free-icons/Settings01Icon';
import Folder01Icon from '@hugeicons/core-free-icons/Folder01Icon';
import File01Icon from '@hugeicons/core-free-icons/File01Icon';
import FileScriptIcon from '@hugeicons/core-free-icons/FileScriptIcon';
import Package01Icon from '@hugeicons/core-free-icons/Package01Icon';
import Flag01Icon from '@hugeicons/core-free-icons/Flag01Icon';
import CheckmarkCircle02Icon from '@hugeicons/core-free-icons/CheckmarkCircle02Icon';
import Money03Icon from '@hugeicons/core-free-icons/Money03Icon';
import UserGroupIcon from '@hugeicons/core-free-icons/UserGroupIcon';
import StethoscopeIcon from '@hugeicons/core-free-icons/StethoscopeIcon';
import AmbulanceIcon from '@hugeicons/core-free-icons/AmbulanceIcon';
import Medicine01Icon from '@hugeicons/core-free-icons/Medicine01Icon';
import Calendar03Icon from '@hugeicons/core-free-icons/Calendar03Icon';
import { UiText } from '@zouriel/ui/text';
import { UiTable, type UiColumn, type UiRowAction } from '@zouriel/ui/table';
import { UiList, UiListItem } from '@zouriel/ui/list';
import { UiAccordion, UiAccordionItem } from '@zouriel/ui/accordion';
import { UiBadge, UiChip, UiAvatar, UiAvatarGroup } from '@zouriel/ui/badge';
import { UiCard, UiStatCard, UiFeatureCard, type UiFeatureLayout } from '@zouriel/ui/card';
import { UiSegmented } from '@zouriel/ui/button';
import {
  UiDescriptionList, UiTimeline, UiCodeBlock, UiTree, UiTreeTable,
  type UiTreeNode, type UiTreeTableRow, type UiTreeTableColumn, type UiTimelineItem, type UiDescriptionItem,
} from '@zouriel/ui/data';
import { UiChatBubble } from '@zouriel/ui/chat-bubble';
import { DocPage, DocSection, DocDemo, type ApiRow } from '../docs/docs-ui';

interface Row extends Record<string, unknown> { name: string; role: string; score: number | null; email: string | null; }
const STATUS = "'neutral' | 'primary' | 'success' | 'warning' | 'danger'";

@Component({
  selector: 'page-data',
  imports: [HugeiconsIconComponent,
    UiText, UiTable, UiList, UiListItem, UiAccordion, UiAccordionItem, UiBadge, UiChip, UiAvatar, UiAvatarGroup,
    UiCard, UiStatCard, UiFeatureCard, UiSegmented, UiDescriptionList, UiTimeline, UiCodeBlock, UiTree, UiTreeTable, UiChatBubble, DocPage, DocSection, DocDemo,
  ],
  template: `
    <doc-page eyebrow="Components" title="Data display"
      lead="Present data: table, list, tree, tree-table, accordion, cards, badges, chips, avatars, stats, description-list, timeline, code-block.">

      <doc-section name="Table" selector="ui-table" [api]="tableApi" [outputs]="tableOut"
        summary="Generic over the row type. Sortable headers are buttons; each click goes ascending, descending, then back to the original order, and the header carries aria-sort. Sorting reads the raw value (not the formatted text): numbers compare as numbers, text compares case-insensitively with numbers inside it in numeric order, and empty values go last. selectable adds a checkbox per row and a select-all box; selectionChange emits the selected rows by reference, and a row that leaves data stops counting as selected. actions adds a trailing column of real buttons, each of which can be disabled for one row. With no rows, emptyText spans the whole table. On a narrow screen the table scrolls sideways inside its border.">
        <doc-demo lang="ts + html" code="<ui-table [columns]=&quot;cols&quot; [data]=&quot;rows&quot; [selectable]=&quot;true&quot; [actions]=&quot;actions&quot;
  (selectionChange)=&quot;onSelect($event)&quot; />

cols: UiColumn<Row>[] = [
  { key: 'name', header: 'Name', sortable: true },
  { key: 'score', header: 'Score', sortable: true, align: 'right', format: (v) => v == null ? '—' : String(v) },
];
actions: UiRowAction<Row>[] = [
  { label: 'Email', run: (row) => this.email(row), disabled: (row) => !row.email, ariaLabel: (row) => 'Email ' + row.name },
];">
          <ui-table [columns]="cols" [data]="rows" [selectable]="true" [actions]="actions" (selectionChange)="sel.set($event.length)" />
          <ui-text variant="caption">{{ sel() }} selected · {{ lastAction() }}</ui-text>
        </doc-demo>
        <doc-demo code="<ui-table [columns]=&quot;cols&quot; [data]=&quot;[]&quot; emptyText=&quot;No people match this filter&quot; />">
          <ui-table [columns]="cols" [data]="[]" emptyText="No people match this filter" />
        </doc-demo>
      </doc-section>

      <doc-section name="List" selector="ui-list · ui-list-item" [api]="listApi" [outputs]="listOut"
        summary="Semantic list (role=list, each item role=listitem). An interactive item renders as a button, so it is focusable and works with Enter and Space; it grows to a 44px touch target on touch screens. selected and disabled only apply to interactive items. Slots: [item-leading] and [item-trailing]; empty slots collapse.">
        <doc-demo code="<ui-list [bordered]=&quot;true&quot;>
  <ui-list-item [interactive]=&quot;true&quot; [selected]=&quot;current === 'edit'&quot; (activate)=&quot;current = 'edit'&quot;>
    <hugeicons-icon item-leading [icon]=&quot;PencilEdit02Icon&quot; [size]=&quot;16&quot; />
    Edited tokens
    <span item-trailing>2m</span>
  </ui-list-item>
</ui-list>">
          <ui-list [bordered]="true">
            @for (a of activity; track a.id) {
              <ui-list-item [interactive]="true" [selected]="current() === a.id" [disabled]="a.disabled" (activate)="current.set(a.id)">
                <hugeicons-icon item-leading aria-hidden="true" [icon]="a.icon" [size]="16" [strokeWidth]="1.8" />{{ a.title }}<span item-trailing>{{ a.time }}</span>
              </ui-list-item>
            }
          </ui-list>
          <ui-text variant="caption">Selected: {{ current() }}</ui-text>
        </doc-demo>
      </doc-section>

      <doc-section name="Tree" selector="ui-tree" [api]="treeApi" [outputs]="treeOut"
        summary="Expandable hierarchy following the WAI-ARIA tree view pattern. The container is role=tree (named by label); each node is a role=treeitem with aria-level, aria-setsize, aria-posinset and aria-selected, parents also carry aria-expanded, and open children sit in a role=group inside their parent. The tree is a single tab stop: Tab lands on the last focused item, else the selected one, else the first. Arrow Up and Down move through visible items, Home and End jump to the first and last. Arrow Right opens a closed parent or moves to the first child of an open one; Arrow Left closes an open parent or moves to the parent. Enter or Space selects, typing a letter jumps to the next item starting with it, and * opens every sibling of the focused item. Clicking a row selects it; clicking its chevron only opens or closes it. Node icons take a HugeIcons icon or a short string. Each value must be unique."
        [shapes]="TREENODE">
        <doc-demo lang="ts + html" code="<ui-tree label=&quot;Project files&quot; [nodes]=&quot;nodes&quot; [(selected)]=&quot;selected&quot; (nodeSelect)=&quot;open($event)&quot; />

import Folder01Icon from '@hugeicons/core-free-icons/Folder01Icon';
nodes: UiTreeNode[] = [
  { label: 'src', value: 'src', icon: Folder01Icon, children: [
    { label: 'main.ts', value: 'main', icon: FileScriptIcon },
  ] },
];">
          <ui-tree label="Project files" [nodes]="treeNodes" [(selected)]="treeSel" />
          <ui-text variant="caption">Selected: {{ treeSel() ?? 'none' }}</ui-text>
        </doc-demo>
      </doc-section>

      <doc-section name="Tree table" selector="ui-tree-table" [api]="treeTableApi"
        summary="Hierarchical table; the first column is an expandable tree and shows row.label. Other columns read row.data[key]. Rows with children get a chevron button with a 24px target (aria-expanded, labelled Expand or Collapse plus the row label). Rows are tracked by value, so each value must be unique. Scrolls sideways on narrow screens."
        [shapes]="TREEROW">
        <doc-demo code="<ui-tree-table [rows]=&quot;rows&quot; [columns]=&quot;cols&quot; firstHeader=&quot;Path&quot; />">
          <ui-tree-table [rows]="treeRows" [columns]="treeCols" firstHeader="Path" />
        </doc-demo>
      </doc-section>

      <doc-section name="Accordion" selector="ui-accordion · ui-accordion-item" [api]="accApi"
        summary="Collapsible panels; single-open unless multiple is set. Each item needs a title; project its body. The header is a button inside an h3 with aria-expanded and aria-controls, and the panel is a labelled region. A closed panel is inert, so its content is out of the tab order and hidden from screen readers. An item used outside ui-accordion toggles on its own.">
        <doc-demo code="<ui-accordion [multiple]=&quot;false&quot;>
  <ui-accordion-item title=&quot;Section&quot;>Body…</ui-accordion-item>
</ui-accordion>">
          <ui-accordion>
            <ui-accordion-item title="What is this?">A reusable Angular component library.</ui-accordion-item>
            <ui-accordion-item title="Can I open two at once?">Not here. Set [multiple]="true" on ui-accordion to allow it.</ui-accordion-item>
            <ui-accordion-item title="Is a closed panel reachable by keyboard?">No. Closed panels are inert until opened.</ui-accordion-item>
          </ui-accordion>
        </doc-demo>
      </doc-section>

      <doc-section name="Card & stat-card" selector="ui-card · ui-stat-card" [api]="cardApi"
        summary="ui-card: surface with [card-header] and [card-footer] slots; empty slots collapse, and the body stretches so footers line up across a grid of cards. Set interactive for a hover lift when the card itself is a link. ui-stat-card: KPI tile with a label, value, optional delta and an [stat-icon] slot; the delta arrow follows trend and screen readers hear Up or Down before it.">
        <doc-demo code="<ui-card padding=&quot;md&quot;>
  <span card-header>Title</span>
  Body
  <div card-footer>Footer</div>
</ui-card>
<ui-stat-card label=&quot;Revenue&quot; value=&quot;$48.2k&quot; delta=&quot;12%&quot; trend=&quot;up&quot;>
  <hugeicons-icon stat-icon [icon]=&quot;Money03Icon&quot; [size]=&quot;16&quot; />
</ui-stat-card>">
          <div class="cols3">
            <ui-card>
              <ui-text variant="label" card-header>Card</ui-text>
              <ui-text variant="body">Header, body and footer.</ui-text>
              <ui-text variant="caption" card-footer>Updated 2m ago</ui-text>
            </ui-card>
            <ui-stat-card label="Revenue" value="$48.2k" delta="12%" trend="up">
              <hugeicons-icon stat-icon aria-hidden="true" [icon]="icons.money" [size]="16" [strokeWidth]="1.8" />
            </ui-stat-card>
            <ui-stat-card label="Active users" value="1,204" delta="3%" trend="down">
              <hugeicons-icon stat-icon aria-hidden="true" [icon]="icons.users" [size]="16" [strokeWidth]="1.8" />
            </ui-stat-card>
          </div>
        </doc-demo>
      </doc-section>

      <doc-section name="Feature card" selector="ui-feature-card" [api]="featureApi"
        summary="A product or service card for a landing page: an icon in a tinted badge, an optional eyebrow, a title, a description and an action. With actionLabel (or href) the whole card is the target: the action is one real button (or link) whose hit area covers the card, so a click anywhere activates it and screen readers hear one control, named by the title and the action and described by the description. tone sets the badge and a faint wash over the surface (brand puts the theme's brand gradient on the edge and around the badge); layout puts the badge above or beside the text; the action sits at the bottom so a row of cards lines up. The title is a heading (headingLevel). The arrow follows the reading direction.">
        <doc-demo code="<ui-feature-card title=&quot;Find a doctor&quot; eyebrow=&quot;Clinics&quot;
  description=&quot;Book a visit at a clinic near you.&quot;
  actionLabel=&quot;Book now&quot; tone=&quot;primary&quot; (action)=&quot;open('doctors')&quot;>
  <hugeicons-icon feature-icon [icon]=&quot;StethoscopeIcon&quot; />
</ui-feature-card>">
          <div class="row fc-controls">
            <ui-segmented size="sm" label="Layout" [options]="fcLayouts" [value]="fcLayout()" (valueChange)="fcLayout.set($any($event))" />
            <ui-segmented size="sm" label="Size" [options]="fcSizes" [value]="fcSize()" (valueChange)="fcSize.set($any($event))" />
          </div>
          <div class="fc-grid" [class.wide]="fcLayout() === 'horizontal'">
            <ui-feature-card title="Find a doctor" eyebrow="Clinics" description="Book a visit at a clinic near you, today or later this week."
              actionLabel="Book now" tone="primary" [layout]="fcLayout()" [size]="fcSize()" (action)="fcLast.set('Find a doctor')">
              <hugeicons-icon feature-icon [icon]="icons.doctor" [strokeWidth]="1.8" />
            </ui-feature-card>
            <ui-feature-card title="Nurse at home" eyebrow="New" description="A nurse comes to you for injections, dressings and checks."
              actionLabel="Request a visit" tone="accent" [layout]="fcLayout()" [size]="fcSize()" (action)="fcLast.set('Nurse at home')">
              <hugeicons-icon feature-icon [icon]="icons.ambulance" [strokeWidth]="1.8" />
            </ui-feature-card>
            <ui-feature-card title="Pharmacy" description="Order prescriptions and have them delivered."
              actionLabel="Order" tone="brand" [layout]="fcLayout()" [size]="fcSize()" (action)="fcLast.set('Pharmacy')">
              <hugeicons-icon feature-icon [icon]="icons.medicine" [strokeWidth]="1.8" />
            </ui-feature-card>
            <ui-feature-card title="Appointments" description="See and change your bookings."
              actionLabel="Coming soon" tone="neutral" disabled [layout]="fcLayout()" [size]="fcSize()">
              <hugeicons-icon feature-icon [icon]="icons.calendar" [strokeWidth]="1.8" />
            </ui-feature-card>
          </div>
          <p class="fc-last" aria-live="polite">{{ fcLast() ? 'Opened: ' + fcLast() : 'Click a card.' }}</p>
        </doc-demo>
      </doc-section>

      <doc-section name="Badge, chip, avatar" selector="ui-badge · ui-chip · ui-avatar · ui-avatar-group" [api]="badgeApi" [outputs]="chipOut"
        summary="Status, token and identity primitives. ui-badge holds a short label or count, or a bare dot. ui-chip can show a remove button; it only emits remove, so the host removes the chip. ui-avatar shows src, or initials from name when there is no image or it fails to load; sizes sm to xl (26 to 56px), or dimension for any pixel size (a profile photo). ui-avatar-group overlaps its avatars by --ui-avatar-overlap and rings them in --ui-avatar-ring.">
        <doc-demo code="<ui-badge tone=&quot;success&quot;>live</ui-badge>
<ui-badge tone=&quot;danger&quot; [dot]=&quot;true&quot; role=&quot;img&quot; aria-label=&quot;Offline&quot; />
<ui-chip tone=&quot;primary&quot; [removable]=&quot;true&quot; label=&quot;angular&quot; (remove)=&quot;drop('angular')&quot;>angular</ui-chip>
<ui-avatar-group style=&quot;--ui-avatar-ring: var(--ui-color-surface)&quot;>
  <ui-avatar name=&quot;Ada Lovelace&quot; />
  <ui-avatar name=&quot;Grace Hopper&quot; src=&quot;/grace.jpg&quot; alt=&quot;Grace Hopper&quot; />
</ui-avatar-group>">
          <div class="row">
            <ui-badge>neutral</ui-badge><ui-badge tone="primary">primary</ui-badge><ui-badge tone="success">success</ui-badge>
            <ui-badge tone="warning">3</ui-badge><ui-badge tone="danger" [dot]="true" role="img" aria-label="Offline" />
          </div>
          <div class="row">
            @for (t of tags(); track t) {
              <ui-chip tone="primary" [removable]="true" [label]="t" (remove)="dropTag(t)">{{ t }}</ui-chip>
            } @empty {
              <ui-text variant="caption">All chips removed. <button type="button" class="linkish" (click)="resetTags()">Reset</button></ui-text>
            }
            <ui-chip>neutral</ui-chip><ui-chip tone="success">success</ui-chip><ui-chip tone="warning">warning</ui-chip><ui-chip tone="danger">danger</ui-chip>
          </div>
          <div class="row">
            <ui-avatar name="Ada Lovelace" size="sm" /><ui-avatar name="Ada Lovelace" /><ui-avatar name="Ada Lovelace" size="lg" />
            <ui-avatar name="Ada Lovelace" size="xl" /><ui-avatar name="Aminath Hassan" [dimension]="96" />
            <ui-avatar name="Square Team" [square]="true" />
            <ui-avatar-group class="on-surface"><ui-avatar name="Ada Lovelace" /><ui-avatar name="Grace Hopper" /><ui-avatar name="Alan Turing" /></ui-avatar-group>
          </div>
        </doc-demo>
      </doc-section>

      <doc-section name="Description list" selector="ui-description-list" [api]="dlApi"
        summary="Term and detail pairs in a semantic dl. row puts each term beside its detail; stacked puts the term above."
        [shapes]="'interface UiDescriptionItem { term: string; detail: string; }'">
        <doc-demo code="<ui-description-list [items]=&quot;items&quot; layout=&quot;row&quot; />
<ui-description-list [items]=&quot;items&quot; layout=&quot;stacked&quot; />">
          <div class="cols2">
            <ui-description-list [items]="details" />
            <ui-description-list [items]="details" layout="stacked" />
          </div>
        </doc-demo>
      </doc-section>

      <doc-section name="Chat bubble" anchor="chat-bubble" selector="ui-chat-bubble" [api]="bubbleApi"
        summary="From @zouriel/ui/chat-bubble. One message in a conversation. Your own (mine) sit at the inline end in the primary colour, the other side's at the inline start on the raised surface; in RTL they swap. meta is a small line under the text (the time, read status). The corner nearest the speaker is tucked in. Put them in a column and they align themselves; text wraps at 80% of it.">
        <doc-demo code="<ui-chat-bubble meta=&quot;09:40&quot;>Hello, I'm on my way to you.</ui-chat-bubble>
<ui-chat-bubble [mine]=&quot;true&quot; meta=&quot;09:41 · Read&quot;>Thank you! The gate code is 2468.</ui-chat-bubble>">
          <div class="chat">
            <ui-chat-bubble meta="09:40">Hello, I'm on my way to you.</ui-chat-bubble>
            <ui-chat-bubble [mine]="true" meta="09:41 · Read">Thank you! The gate code is 2468.</ui-chat-bubble>
            <ui-chat-bubble meta="09:43">Arriving in about ten minutes. Is there parking nearby?</ui-chat-bubble>
          </div>
          <div class="chat" dir="rtl">
            <ui-chat-bubble meta="09:40">އައްސަލާމު ޢަލައިކުމް</ui-chat-bubble>
            <ui-chat-bubble [mine]="true" meta="09:41">ޝުކުރިއްޔާ</ui-chat-bubble>
          </div>
        </doc-demo>
      </doc-section>

      <doc-section name="Timeline" selector="ui-timeline" [api]="timelineApi"
        summary="Vertical sequence of events in an ordered list, joined by a connector line. Each event shows a tone-coloured dot, or a marker holding its icon when icon is set (a HugeIcons icon or a short string such as a step number). Markers are decorative; the title and description carry the meaning. In a flow, give items a state: done (as without one), current (aria-current=&quot;step&quot; and a halo) or upcoming (muted, with a hollow dot)."
        [shapes]="TIMELINE">
        <doc-demo code="<ui-timeline [items]=&quot;events&quot; />

events: UiTimelineItem[] = [
  { title: 'Created', meta: 'Mon', icon: Flag01Icon },
  { title: 'Shipped', meta: 'Wed', tone: 'success', icon: CheckmarkCircle02Icon },
];">
          <div class="cols2">
            <ui-timeline [items]="timeline" />
            <ui-timeline [items]="timelineIcons" />
            <ui-timeline [items]="timelineFlow" />
          </div>
        </doc-demo>
      </doc-section>

      <doc-section name="Code block" selector="ui-code-block" [api]="codeApi"
        summary="Monospace code panel with a language label and a copy button. The button says Copied when the clipboard took the text and Copy failed when the browser refused (for example on a page not served over HTTPS), announced politely to screen readers. Long lines scroll sideways.">
        <doc-demo code="<ui-code-block language=&quot;ts&quot; [code]=&quot;source&quot; />">
          <ui-code-block language="ts" [code]="sample" />
        </doc-demo>
      </doc-section>
    </doc-page>
  `,
  styles: `
    .chat { display: flex; flex-direction: column; gap: var(--ui-space-2); max-width: 420px; margin-bottom: var(--ui-space-4); }
    .row { display: flex; flex-wrap: wrap; gap: var(--ui-space-3); align-items: center; }
    .cols2 { display: grid; grid-template-columns: 1fr 1fr; gap: var(--ui-space-6); }
    .cols3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: var(--ui-space-3); }
    @media (max-width: 640px) { .cols2 { grid-template-columns: 1fr; }
      /* Phones: the card takes the full row and the two stat tiles share the next one. */
      .cols3 { grid-template-columns: 1fr 1fr; } .cols3 > ui-card { grid-column: 1 / -1; } }
    /* The demo sits on a surface, so ring the stacked avatars in that colour. */
    .on-surface { --ui-avatar-ring: var(--ui-color-surface); }
    .fc-controls { margin-bottom: var(--ui-space-3); }
    .fc-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: var(--ui-space-4); }
    .fc-grid.wide { grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); }
    @media (max-width: 640px) { .fc-grid, .fc-grid.wide { grid-template-columns: 1fr; } }
    .fc-last { margin: var(--ui-space-3) 0 0; font-size: var(--ui-font-size-sm); color: var(--ui-color-text-muted); }
    .linkish { background: none; border: none; padding: 0; font: inherit; color: var(--ui-color-primary); text-decoration: underline; cursor: pointer; border-radius: var(--ui-radius-xs); }
    .linkish:focus-visible { outline: none; box-shadow: var(--ui-focus-ring); }
  `,
})
export class DataPage {
  protected readonly icons = { money: Money03Icon, users: UserGroupIcon, doctor: StethoscopeIcon, ambulance: AmbulanceIcon, medicine: Medicine01Icon, calendar: Calendar03Icon };
  protected readonly fcLayout = signal<UiFeatureLayout>('vertical');
  protected readonly fcSize = signal<'md' | 'lg'>('md');
  protected readonly fcLast = signal('');
  protected readonly fcLayouts = [{ value: 'vertical', label: 'Vertical' }, { value: 'horizontal', label: 'Horizontal' }];
  protected readonly fcSizes = [{ value: 'md', label: 'md' }, { value: 'lg', label: 'lg' }];
  protected readonly featureApi: ApiRow[] = [
    { name: 'title', type: 'string (required)', default: '—', desc: 'The heading.' },
    { name: 'description', type: 'string', default: "''", desc: 'Text under the title; also describes the action to screen readers.' },
    { name: 'eyebrow', type: 'string', default: "''", desc: 'A short tag above the title.' },
    { name: 'actionLabel', type: 'string', default: "''", desc: 'The action\'s words. With it (or href) the whole card is clickable.' },
    { name: 'href / target', type: 'string', default: '—', desc: 'Makes the action a link. With href and no actionLabel, the title is the link.' },
    { name: 'tone', type: "'primary' | 'accent' | 'brand' | 'neutral'", default: "'primary'", desc: 'Badge tint and surface treatment.' },
    { name: 'layout', type: "'vertical' | 'horizontal'", default: "'vertical'", desc: 'Badge above the text, or beside it at the start.' },
    { name: 'size', type: "'md' | 'lg'", default: "'md'", desc: 'Padding 24 / 32, badge 48 / 56, bigger title.' },
    { name: 'disabled', type: 'boolean', default: 'false', desc: 'Dimmed; the action does nothing and (action) is not emitted.' },
    { name: 'headingLevel', type: 'number', default: '3', desc: 'The title\'s aria-level.' },
    { name: 'glass / radius', type: 'boolean', default: 'UiConfig', desc: 'Translucent surface; rounded corners.' },
    { name: '(action)', type: 'MouseEvent', default: '—', desc: 'The card was activated.' },
    { name: '[feature-icon]', type: 'slot', default: '—', desc: 'The icon, shown in the badge (decorative). [icon] works too, except on hugeicons-icon.' },
  ];
  protected readonly COLUMN = `interface UiColumn<T = Record<string, unknown>> {
  key: string;
  header: string;
  sortable?: boolean;
  align?: 'left' | 'right' | 'center';
  /** Cell text; receives the raw value and the row. Sorting still uses the raw value. */
  format?: (value: unknown, row: T) => string;
}

interface UiRowAction<T = Record<string, unknown>> {
  label: string;
  run: (row: T) => void;
  disabled?: (row: T) => boolean;
  ariaLabel?: (row: T) => string;
}`;
  protected readonly TREENODE = `interface UiTreeNode {
  label: string;
  value: string;                   // unique across the tree
  icon?: string | IconSvgObject;   // HugeIcons icon or a short string
  children?: UiTreeNode[];
}`;
  protected readonly TREEROW = `interface UiTreeTableRow {
  label: string;                   // shown in the tree column
  value: string;                   // unique; tracks expansion
  data?: Record<string, unknown>;  // read by the other columns
  children?: UiTreeTableRow[];
}
interface UiTreeTableColumn { key: string; header: string; align?: 'left' | 'right' | 'center'; }`;
  protected readonly TIMELINE = `interface UiTimelineItem {
  title: string;
  description?: string;
  meta?: string;                   // e.g. a date, shown beside the title
  tone?: ${STATUS};   // default 'primary'
  icon?: string | IconSvgObject;   // replaces the dot with a marker
  state?: 'done' | 'current' | 'upcoming'; // a flow's steps
}`;

  protected readonly sel = signal(0);
  protected readonly lastAction = signal('no action yet');
  protected readonly cols: UiColumn<Row>[] = [
    { key: 'name', header: 'Name', sortable: true }, { key: 'role', header: 'Role', sortable: true },
    { key: 'score', header: 'Score', sortable: true, align: 'right', format: (v) => (v == null ? '—' : String(v)) },
  ];
  protected readonly rows: Row[] = [
    { name: 'Ada Lovelace', role: 'Engineer', score: 98, email: 'ada@example.com' },
    { name: 'grace Hopper', role: 'Engineer', score: 95, email: 'grace@example.com' },
    { name: 'Alan Turing', role: 'Researcher', score: null, email: null },
    { name: 'Katherine Johnson', role: 'Mathematician', score: 100, email: 'katherine@example.com' },
  ];
  protected readonly actions: UiRowAction<Row>[] = [
    {
      label: 'Email', run: (row) => this.lastAction.set(`emailed ${row.name}`),
      disabled: (row) => !row.email, ariaLabel: (row) => `Email ${row.name}`,
    },
  ];
  protected readonly current = signal('edit');
  protected readonly activity = [
    { id: 'edit', icon: PencilEdit02Icon, title: 'Edited tokens', time: '2m', disabled: false },
    { id: 'deploy', icon: Rocket01Icon, title: 'Deployed', time: '1h', disabled: false },
    { id: 'settings', icon: Settings01Icon, title: 'Settings (disabled)', time: '—', disabled: true },
  ];
  protected readonly treeSel = signal<string | null>(null);
  protected readonly treeNodes: UiTreeNode[] = [
    {
      label: 'src', value: 'src', icon: Folder01Icon, children: [
        { label: 'app', value: 'src/app', icon: Folder01Icon, children: [{ label: 'app.ts', value: 'src/app/app.ts', icon: FileScriptIcon }] },
        { label: 'main.ts', value: 'src/main.ts', icon: FileScriptIcon },
      ],
    },
    { label: 'package.json', value: 'package.json', icon: Package01Icon },
    { label: 'README.md', value: 'README.md', icon: File01Icon },
  ];
  protected readonly treeCols: UiTreeTableColumn[] = [
    { key: 'type', header: 'Type' },
    { key: 'size', header: 'Size', align: 'right' },
  ];
  protected readonly treeRows: UiTreeTableRow[] = [
    {
      label: 'src', value: 'src', data: { type: 'Folder', size: '—' }, children: [
        { label: 'app.ts', value: 'src/app.ts', data: { type: 'TypeScript', size: '12 KB' } },
        { label: 'main.ts', value: 'src/main.ts', data: { type: 'TypeScript', size: '1 KB' } },
      ],
    },
    { label: 'package.json', value: 'package.json', data: { type: 'JSON', size: '1 KB' } },
  ];
  protected readonly tags = signal(['angular', 'signals', 'tokens']);
  protected dropTag(t: string): void { this.tags.update((list) => list.filter((x) => x !== t)); }
  protected resetTags(): void { this.tags.set(['angular', 'signals', 'tokens']); }
  protected readonly details: UiDescriptionItem[] = [
    { term: 'Framework', detail: 'Angular v22' }, { term: 'Styling', detail: 'CSS tokens' }, { term: 'Change detection', detail: 'Zoneless, signals' },
  ];
  protected readonly timeline: UiTimelineItem[] = [
    { title: 'Created', meta: 'Mon', description: 'Draft opened.' },
    { title: 'Review', meta: 'Tue', tone: 'warning', description: 'Two comments to address.' },
    { title: 'Shipped', meta: 'Wed', tone: 'success' },
  ];
  protected readonly timelineFlow = [
    { title: 'Request sent', meta: '09:12', state: 'done' as const },
    { title: 'Nurse assigned', meta: '09:20', description: 'Aminath Hassan, RN', state: 'done' as const },
    { title: 'On the way', meta: 'Now', state: 'current' as const },
    { title: 'Visit', state: 'upcoming' as const },
    { title: 'Payment', state: 'upcoming' as const },
  ];
  protected readonly timelineIcons = [
    { title: 'Created', meta: 'Mon', icon: Flag01Icon },
    { title: 'Edited', meta: 'Tue', icon: PencilEdit02Icon, tone: 'neutral' as const },
    { title: 'Shipped', meta: 'Wed', tone: 'success' as const, icon: CheckmarkCircle02Icon },
    { title: 'Step 4', meta: 'Next', tone: 'neutral' as const, icon: '4' },
  ];
  protected readonly sample = `import { UiTable, type UiColumn } from '@zouriel/ui/table';

const cols: UiColumn[] = [{ key: 'name', header: 'Name', sortable: true }];`;

  protected readonly tableApi: ApiRow[] = [
    { name: 'columns', type: 'UiColumn<T>[]', default: '[]', desc: 'Column definitions (see Data shapes).' },
    { name: 'data', type: 'T[]', default: '[]', desc: 'Row objects. Selection is tracked by object reference.' },
    { name: 'selectable', type: 'boolean', default: 'false', desc: 'Show a checkbox per row and a select-all box.' },
    { name: 'actions', type: 'UiRowAction<T>[]', default: '[]', desc: 'Per-row buttons in a trailing column, space-2 apart at the row end; an empty list renders no column.' },
    { name: 'ui-row-actions', type: "component: align 'start' | 'end' = 'end'", default: '—', desc: 'For a table you build yourself: wrap a row\'s buttons in it and they keep space-2 apart, at the end, wrapping when the cell is narrow.' },
    { name: 'emptyText', type: 'string', default: "'No data'", desc: 'Shown across the table when data is empty.' },
    { name: 'radius', type: 'boolean', default: 'UiConfig.radius', desc: 'Rounded corners.' },
  ];
  protected readonly tableOut: ApiRow[] = [{ name: 'selectionChange', type: 'T[]', default: '—', desc: 'Selected rows (by reference), after each checkbox change.' }];
  protected readonly listApi: ApiRow[] = [
    { name: 'list: bordered', type: 'boolean', default: 'false', desc: 'Outer border + row dividers.' },
    { name: 'item: interactive', type: 'boolean', default: 'false', desc: 'Render the row as a button.' },
    { name: 'item: selected', type: 'boolean', default: 'false', desc: 'Selected styling (interactive items only).' },
    { name: 'item: disabled', type: 'boolean', default: 'false', desc: 'Disable the button (interactive items only).' },
    { name: 'item: [item-leading] / [item-trailing]', type: 'slot', default: '—', desc: 'Content before and after the main text.' },
  ];
  protected readonly listOut: ApiRow[] = [{ name: 'item: activate', type: 'void', default: '—', desc: 'Interactive item clicked, or activated with Enter or Space.' }];
  protected readonly treeApi: ApiRow[] = [
    { name: 'nodes', type: 'UiTreeNode[]', default: '[]', desc: 'Root nodes.' },
    { name: 'selected', type: 'string | null', default: 'null', desc: 'Two-way (`[(selected)]`). Value of the selected node.' },
    { name: 'label', type: 'string', default: "''", desc: 'Accessible name of the tree (aria-label on role=tree).' },
  ];
  protected readonly treeOut: ApiRow[] = [
    { name: 'nodeSelect', type: 'UiTreeNode', default: '—', desc: 'Node chosen by click, Enter or Space.' },
  ];
  protected readonly treeTableApi: ApiRow[] = [
    { name: 'rows', type: 'UiTreeTableRow[]', default: '[]', desc: 'Hierarchical rows.' },
    { name: 'columns', type: 'UiTreeTableColumn[]', default: '[]', desc: 'Columns after the tree column.' },
    { name: 'firstHeader', type: 'string', default: "'Name'", desc: 'Header of the tree column.' },
  ];
  protected readonly accApi: ApiRow[] = [
    { name: 'accordion: multiple', type: 'boolean', default: 'false', desc: 'Allow more than one open item.' },
    { name: 'item: title', type: 'string (required)', default: '—', desc: 'Header label.' },
    { name: 'item: open', type: 'WritableSignal<boolean>', default: 'false', desc: 'Read or set from a template reference (#item) to open an item in code.' },
  ];
  protected readonly cardApi: ApiRow[] = [
    { name: 'card: padding', type: "'sm' | 'md' | 'lg'", default: "'md'", desc: 'Padding of the header, body and footer.' },
    { name: 'card: glass', type: 'boolean', default: 'UiConfig.glass', desc: 'Translucent, blurred surface.' },
    { name: 'card: radius', type: 'boolean', default: 'UiConfig.radius', desc: 'Rounded corners.' },
    { name: 'card: interactive', type: 'boolean', default: 'false', desc: 'Hover lift and a focus ring around the whole card, for cards that are a clickable target.' },
    { name: 'card: [card-header] / [card-footer]', type: 'slot', default: '—', desc: 'Header and footer; hidden when empty.' },
    { name: 'stat: label', type: 'string', default: "''", desc: 'Caption above the value.' },
    { name: 'stat: value', type: 'string | number', default: "''", desc: 'The KPI value.' },
    { name: 'stat: delta', type: 'string | number', default: '—', desc: 'Change indicator; hidden when unset.' },
    { name: 'stat: trend', type: "'up' | 'down'", default: "'up'", desc: 'Delta colour and arrow.' },
    { name: 'stat: glass', type: 'boolean', default: 'UiConfig.glass', desc: 'Translucent, blurred surface.' },
    { name: 'stat: radius', type: 'boolean', default: 'UiConfig.radius', desc: 'Rounded corners.' },
    { name: 'stat: [stat-icon]', type: 'slot', default: '—', desc: 'Icon beside the label.' },
  ];
  protected readonly badgeApi: ApiRow[] = [
    { name: 'badge: tone', type: STATUS, default: "'neutral'", desc: 'Colour.' },
    { name: 'badge: dot', type: 'boolean', default: 'false', desc: 'Bare 8px status dot. It has no text, so give the host role="img" and an aria-label.' },
    { name: 'chip: tone', type: STATUS, default: "'neutral'", desc: 'Colour.' },
    { name: 'chip: removable', type: 'boolean', default: 'false', desc: 'Show a remove button.' },
    { name: 'chip: label', type: 'string', default: '—', desc: "Builds the remove button's accessible name (Remove <label>)." },
    { name: 'chip: radius', type: 'boolean', default: 'UiConfig.radius', desc: 'Pill shape; false gives the standard radius.' },
    { name: 'avatar: src', type: 'string', default: '—', desc: 'Image URL. Initials show instead if it fails to load.' },
    { name: 'avatar: alt', type: 'string', default: '—', desc: 'Accessible name; falls back to name, then "avatar".' },
    { name: 'avatar: name', type: 'string', default: '—', desc: 'Initials (first and last word) and fallback accessible name.' },
    { name: 'avatar: size', type: "'sm' | 'md' | 'lg' | 'xl'", default: "'md'", desc: 'Avatar size: 26, 30, 38 or 56px.' },
    { name: 'avatar: dimension', type: 'number | null', default: 'null', desc: 'Any pixel size (96, 128 for a profile photo); overrides size, and the initials scale with it.' },
    { name: 'avatar: square', type: 'boolean', default: 'false', desc: 'Rounded square instead of a circle.' },
    { name: 'avatar-group: max', type: 'number', default: '—', desc: 'Informational only; trim the list yourself.' },
    { name: '--ui-avatar-overlap', type: 'CSS length', default: 'var(--ui-space-1)', desc: 'How far grouped avatars overlap.' },
    { name: '--ui-avatar-ring', type: 'CSS colour', default: 'var(--ui-color-bg)', desc: 'Ring around grouped avatars; set it to the colour behind them.' },
  ];
  protected readonly chipOut: ApiRow[] = [{ name: 'chip: remove', type: 'void', default: '—', desc: 'Remove button pressed.' }];
  protected readonly dlApi: ApiRow[] = [
    { name: 'items', type: 'UiDescriptionItem[]', default: '[]', desc: 'Term/detail pairs.' },
    { name: 'layout', type: "'stacked' | 'row'", default: "'row'", desc: 'Term beside (row) or above (stacked) its detail.' },
  ];
  protected readonly bubbleApi: ApiRow[] = [
    { name: 'mine', type: 'boolean', default: 'false', desc: 'Your own message: inline end, primary colour.' },
    { name: 'meta', type: 'string', default: '—', desc: 'A small line under the text: the time, read status.' },
    { name: 'ariaLabel', type: 'string', default: '—', desc: 'Names the message (e.g. "You, 09:41") when the text alone does not say who sent it.' },
    { name: '(content)', type: 'slot', default: '—', desc: 'The message; line breaks are kept.' },
  ];
  protected readonly timelineApi: ApiRow[] = [
    { name: 'items', type: 'UiTimelineItem[]', default: '[]', desc: 'Events, top to bottom.' },
    { name: 'item.state', type: "UiTimelineState: 'done' | 'current' | 'upcoming'", default: '—', desc: 'Place in a flow. current is aria-current=&quot;step&quot; with a halo; upcoming is muted with a hollow dot; unset or done look as before.' },
    { name: '--ui-timeline-ring', type: 'CSS colour', default: 'var(--ui-color-surface)', desc: 'Ring around each marker; set it to the colour behind the timeline.' },
  ];
  protected readonly codeApi: ApiRow[] = [
    { name: 'code', type: 'string', default: "''", desc: 'Source text, shown as is.' },
    { name: 'language', type: 'string', default: "'text'", desc: 'Label in the top bar. No syntax highlighting.' },
    { name: 'radius', type: 'boolean', default: 'true', desc: 'Rounded corners.' },
  ];
}
