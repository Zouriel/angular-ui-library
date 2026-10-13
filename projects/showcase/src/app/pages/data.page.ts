import { Component, signal } from '@angular/core';
import { HugeiconsIconComponent } from '@hugeicons/angular';
import PencilEdit02Icon from '@hugeicons/core-free-icons/PencilEdit02Icon';
import Rocket01Icon from '@hugeicons/core-free-icons/Rocket01Icon';
import { UiText } from '@zouriel/ui/text';
import { UiTable, type UiColumn } from '@zouriel/ui/table';
import { UiList, UiListItem } from '@zouriel/ui/list';
import { UiAccordion, UiAccordionItem } from '@zouriel/ui/accordion';
import { UiBadge, UiChip, UiAvatar, UiAvatarGroup } from '@zouriel/ui/badge';
import { UiCard, UiStatCard } from '@zouriel/ui/card';
import {
  UiDescriptionList, UiTimeline, UiCodeBlock, UiTree, UiTreeTable,
  type UiTreeNode, type UiTreeTableRow, type UiTreeTableColumn,
} from '@zouriel/ui/data';
import { DocPage, DocSection, DocDemo, type ApiRow } from '../docs/docs-ui';

interface Row extends Record<string, unknown> { name: string; role: string; score: number; }
const STATUS = "'neutral' | 'primary' | 'success' | 'warning' | 'danger'";

@Component({
  selector: 'page-data',
  imports: [HugeiconsIconComponent, 
    UiText, UiTable, UiList, UiListItem, UiAccordion, UiAccordionItem, UiBadge, UiChip, UiAvatar, UiAvatarGroup,
    UiCard, UiStatCard, UiDescriptionList, UiTimeline, UiCodeBlock, UiTree, UiTreeTable, DocPage, DocSection, DocDemo,
  ],
  template: `
    <doc-page eyebrow="Components" title="Data display"
      lead="Present data: table, list, tree, tree-table, accordion, cards, badges, chips, avatars, stats, description-list, timeline, code-block.">

      <doc-section name="Table" selector="ui-table" [api]="tableApi" [outputs]="tableOut"
        summary="Generic over the row type. Click-to-sort headers; optional row selection with a select-all box. selectionChange emits selected rows by reference (correct across sorts). actions adds a trailing column of real buttons per row, each of which can be disabled for one row."
        [shapes]="COLUMN + ACTION">
        <doc-demo code="<ui-table [columns]=&quot;cols&quot; [data]=&quot;rows&quot; [selectable]=&quot;true&quot;
  (selectionChange)=&quot;onSelect($event)&quot; />">
          <ui-table [columns]="cols" [data]="rows" [selectable]="true" (selectionChange)="sel.set($event.length)" />
          <ui-text variant="caption">{{ sel() }} selected</ui-text>
        </doc-demo>
      </doc-section>

      <doc-section name="List" selector="ui-list · ui-list-item" [api]="listApi" [outputs]="listOut"
        summary="Semantic list. Items can be interactive (rendered as a button, taller on touch screens) with [item-leading] / [item-trailing] slots.">
        <doc-demo code="<ui-list [bordered]=&quot;true&quot;>
  <ui-list-item [interactive]=&quot;true&quot; (activate)=&quot;open()&quot;>
    <hugeicons-icon item-leading [icon]=&quot;PencilEdit02Icon&quot; [size]=&quot;16&quot; /> Title <span item-trailing>2m</span>
  </ui-list-item>
</ui-list>">
          <ui-list [bordered]="true">
            @for (a of activity; track a.id) {
              <ui-list-item [interactive]="true"><hugeicons-icon item-leading aria-hidden="true" [icon]="a.icon" [size]="16" [strokeWidth]="1.8" />{{ a.title }}<span item-trailing>{{ a.time }}</span></ui-list-item>
            }
          </ui-list>
        </doc-demo>
      </doc-section>

      <doc-section name="Tree" selector="ui-tree" [api]="treeApi" [outputs]="treeOut"
        summary="Expandable hierarchy (recursive, WAI-ARIA tree). selected is a two-way model. Every row is a tab stop; Enter or Space selects, Arrow Right expands and Arrow Left collapses."
        [shapes]="'interface UiTreeNode { label: string; value: string; icon?: string; children?: UiTreeNode[]; }'">
        <doc-demo code="<ui-tree [nodes]=&quot;nodes&quot; [(selected)]=&quot;sel&quot; (nodeSelect)=&quot;on($event)&quot; />">
          <ui-tree [nodes]="treeNodes" />
        </doc-demo>
      </doc-section>

      <doc-section name="Tree table" selector="ui-tree-table" [api]="treeTableApi"
        summary="Hierarchical table; the first column is an expandable tree. Other columns read row.data[key]."
        [shapes]="TREEROW">
        <doc-demo code="<ui-tree-table [rows]=&quot;rows&quot; [columns]=&quot;cols&quot; firstHeader=&quot;Path&quot; />">
          <ui-tree-table [rows]="treeRows" [columns]="treeCols" firstHeader="Path" />
        </doc-demo>
      </doc-section>

      <doc-section name="Accordion" selector="ui-accordion · ui-accordion-item" [api]="accApi"
        summary="Collapsible panels; single-open unless [multiple]. Each item needs a title; project its body. A closed panel is inert, so its content is out of the tab order and hidden from screen readers.">
        <doc-demo code="<ui-accordion [multiple]=&quot;false&quot;>
  <ui-accordion-item title=&quot;Section&quot;>Body…</ui-accordion-item>
</ui-accordion>">
          <ui-accordion>
            <ui-accordion-item title="What is this?">A reusable Angular component library.</ui-accordion-item>
            <ui-accordion-item title="Accessible?">Yes — @angular/aria + CDK.</ui-accordion-item>
          </ui-accordion>
        </doc-demo>
      </doc-section>

      <doc-section name="Card & stat-card" selector="ui-card · ui-stat-card" [api]="cardApi"
        summary="ui-card: surface with [card-header]/[card-footer] slots + padding; empty slots collapse. Set interactive for a hover lift when the card itself is a link. ui-stat-card: KPI tile with value, delta, trend, [stat-icon].">
        <doc-demo code="<ui-card padding=&quot;md&quot;>
  <span card-header>Title</span> Body
  <div card-footer>Footer</div>
</ui-card>
<ui-stat-card label=&quot;Revenue&quot; value=&quot;$48.2k&quot; delta=&quot;12%&quot; trend=&quot;up&quot; />">
          <div class="cols2">
            <ui-card><ui-text variant="label" card-header>Card</ui-text><ui-text variant="body">Header/footer slots.</ui-text></ui-card>
            <ui-stat-card label="Revenue" value="$48.2k" delta="12%" trend="up" />
          </div>
        </doc-demo>
      </doc-section>

      <doc-section name="Badge, chip, avatar" selector="ui-badge · ui-chip · ui-avatar(-group)" [api]="badgeApi" [outputs]="chipOut"
        summary="Status/label/token/identity primitives. ui-chip is optionally removable; ui-avatar falls back to initials from name. ui-avatar-group overlaps its avatars by --ui-avatar-overlap.">
        <doc-demo code="<ui-badge tone=&quot;success&quot;>live</ui-badge>
<ui-chip tone=&quot;primary&quot; [removable]=&quot;true&quot; label=&quot;ng&quot; (remove)=&quot;x()&quot;>ng</ui-chip>
<ui-avatar name=&quot;Ada Lovelace&quot; size=&quot;md&quot; />">
          <div class="row">
            <ui-badge tone="primary">primary</ui-badge><ui-badge tone="success">success</ui-badge>
            <ui-chip tone="primary" [removable]="true" label="angular">angular</ui-chip>
            <ui-avatar-group><ui-avatar name="Ada Lovelace" /><ui-avatar name="Grace Hopper" /><ui-avatar name="Alan Turing" /></ui-avatar-group>
          </div>
        </doc-demo>
      </doc-section>

      <doc-section name="Description list" selector="ui-description-list" [api]="dlApi"
        summary="Key/value pairs (semantic <dl>)."
        [shapes]="'interface UiDescriptionItem { term: string; detail: string; }'">
        <doc-demo code="<ui-description-list [items]=&quot;items&quot; layout=&quot;row&quot; />">
          <ui-description-list [items]="details" />
        </doc-demo>
      </doc-section>

      <doc-section name="Timeline" selector="ui-timeline" [api]="timelineApi"
        summary="Vertical sequence of events with a connector line."
        [shapes]="'interface UiTimelineItem { title: string; description?: string; meta?: string; tone?: ' + status + '; }'">
        <doc-demo code="<ui-timeline [items]=&quot;events&quot; />">
          <ui-timeline [items]="timeline" />
        </doc-demo>
      </doc-section>

      <doc-section name="Code block" selector="ui-code-block" [api]="codeApi"
        summary="Monospace code panel with language label and a copy button that says Copied after copying.">
        <doc-demo code="<ui-code-block language=&quot;ts&quot; [code]=&quot;source&quot; />">
          <ui-code-block language="ts" [code]="sample" />
        </doc-demo>
      </doc-section>
    </doc-page>
  `,
  styles: `
    .row { display: flex; flex-wrap: wrap; gap: var(--ui-space-3); align-items: center; }
    .cols2 { display: grid; grid-template-columns: 1fr 1fr; gap: var(--ui-space-3); }
    @media (max-width: 640px) { .cols2 { grid-template-columns: 1fr; } }
  `,
})
export class DataPage {
  protected readonly icons = { edit: PencilEdit02Icon, deploy: Rocket01Icon };
  protected readonly status = STATUS;
  protected readonly COLUMN = `interface UiColumn<T> {
  key: string;
  header: string;
  sortable?: boolean;
  align?: 'left' | 'right' | 'center';
  format?: (value: unknown, row: T) => string;
}`;
  protected readonly ACTION = `
interface UiRowAction<T> {
  label: string;
  run: (row: T) => void;
  disabled?: (row: T) => boolean;
  ariaLabel?: (row: T) => string;
}`;
  protected readonly TREEROW = `interface UiTreeTableRow {
  label: string; value: string;
  data?: Record<string, unknown>;
  children?: UiTreeTableRow[];
}
interface UiTreeTableColumn { key: string; header: string; align?: 'left'|'right'|'center'; }`;
  protected readonly sel = signal(0);
  protected readonly cols: UiColumn<Row>[] = [
    { key: 'name', header: 'Name', sortable: true }, { key: 'role', header: 'Role', sortable: true },
    { key: 'score', header: 'Score', sortable: true, align: 'right' },
  ];
  protected readonly rows: Row[] = [
    { name: 'Ada Lovelace', role: 'Engineer', score: 98 }, { name: 'Grace Hopper', role: 'Engineer', score: 95 },
    { name: 'Alan Turing', role: 'Researcher', score: 99 },
  ];
  protected readonly activity = [
    { id: 1, icon: PencilEdit02Icon, title: 'Edited tokens', time: '2m' }, { id: 2, icon: Rocket01Icon, title: 'Deployed', time: '1h' },
  ];
  protected readonly treeNodes: UiTreeNode[] = [
    { label: 'src', value: 'src', children: [{ label: 'app.ts', value: 'a' }, { label: 'main.ts', value: 'm' }] },
    { label: 'package.json', value: 'p' },
  ];
  protected readonly treeCols: UiTreeTableColumn[] = [{ key: 'size', header: 'Size', align: 'right' }];
  protected readonly treeRows: UiTreeTableRow[] = [
    { label: 'src', value: 's', data: { size: '—' }, children: [{ label: 'app.ts', value: 'a', data: { size: '12 KB' } }] },
    { label: 'package.json', value: 'p', data: { size: '1 KB' } },
  ];
  protected readonly details = [{ term: 'Framework', detail: 'Angular v22' }, { term: 'Styling', detail: 'CSS tokens' }];
  protected readonly timeline = [
    { title: 'Created', meta: 'Mon', tone: 'primary' as const }, { title: 'Shipped', meta: 'Wed', tone: 'success' as const },
  ];
  protected readonly sample = `import { UiTable } from '@zouriel/ui/table';`;

  protected readonly tableApi: ApiRow[] = [
    { name: 'columns', type: 'UiColumn<T>[]', default: '[]', desc: 'Column defs (see Data shapes).' },
    { name: 'data', type: 'T[]', default: '[]', desc: 'Row objects.' },
    { name: 'selectable', type: 'boolean', default: 'false', desc: 'Show selection checkboxes.' },
    { name: 'actions', type: 'UiRowAction<T>[]', default: '[]', desc: 'Per-row buttons in a trailing column; none renders no column.' },
    { name: 'emptyText', type: 'string', default: "'No data'", desc: 'Empty-state text.' },
    { name: 'radius', type: 'boolean', default: 'UiConfig.radius', desc: 'Rounded corners.' },
  ];
  protected readonly tableOut: ApiRow[] = [{ name: 'selectionChange', type: 'T[]', default: '—', desc: 'Selected rows (by reference).' }];
  protected readonly listApi: ApiRow[] = [
    { name: 'list: bordered', type: 'boolean', default: 'false', desc: 'Outer border + row dividers.' },
    { name: 'item: [item-leading] / [item-trailing]', type: 'slot', default: '—', desc: 'Content before and after the main text.' },
    { name: 'item: interactive', type: 'boolean', default: 'false', desc: 'Render as a button.' },
    { name: 'item: selected', type: 'boolean', default: 'false', desc: 'Selected styling.' },
    { name: 'item: disabled', type: 'boolean', default: 'false', desc: 'Disable interaction.' },
  ];
  protected readonly listOut: ApiRow[] = [{ name: 'item: activate', type: 'void', default: '—', desc: 'Interactive item clicked.' }];
  protected readonly treeApi: ApiRow[] = [
    { name: 'nodes', type: 'UiTreeNode[]', default: '[]', desc: 'Root nodes.' },
    { name: 'selected', type: 'string | null (model)', default: 'null', desc: 'Selected value — [(selected)].' },
  ];
  protected readonly treeOut: ApiRow[] = [
    { name: 'nodeSelect', type: 'UiTreeNode', default: '—', desc: 'Node chosen by click, Enter or Space.' },
    { name: 'selectedChange', type: 'string | null', default: '—', desc: 'From [(selected)].' },
  ];
  protected readonly treeTableApi: ApiRow[] = [
    { name: 'rows', type: 'UiTreeTableRow[]', default: '[]', desc: 'Hierarchical rows.' },
    { name: 'columns', type: 'UiTreeTableColumn[]', default: '[]', desc: 'Trailing columns.' },
    { name: 'firstHeader', type: 'string', default: "'Name'", desc: 'Header of the tree column.' },
  ];
  protected readonly accApi: ApiRow[] = [
    { name: 'accordion: multiple', type: 'boolean', default: 'false', desc: 'Allow multiple open.' },
    { name: 'item: title', type: 'string (required)', default: '—', desc: 'Header label.' },
  ];
  protected readonly cardApi: ApiRow[] = [
    { name: 'card: padding', type: "'sm' | 'md' | 'lg'", default: "'md'", desc: 'Inner padding.' },
    { name: 'card: glass/radius', type: 'boolean', default: 'UiConfig', desc: 'Surface treatment.' },
    { name: 'card: interactive', type: 'boolean', default: 'false', desc: 'Hover lift, for cards that are a clickable target.' },
    { name: 'card: [card-header] / [card-footer]', type: 'slot', default: '—', desc: 'Header and footer; hidden when empty.' },
    { name: 'stat: label / value', type: 'string | number', default: "''", desc: 'Caption / KPI value.' },
    { name: 'stat: delta', type: 'string | number', default: '—', desc: 'Change indicator.' },
    { name: 'stat: trend', type: "'up' | 'down'", default: "'up'", desc: 'Delta color/arrow.' },
    { name: 'stat: glass/radius', type: 'boolean', default: 'UiConfig', desc: 'Surface treatment.' },
    { name: 'stat: [stat-icon]', type: 'slot', default: '—', desc: 'Icon beside the label.' },
  ];
  protected readonly badgeApi: ApiRow[] = [
    { name: 'badge: tone', type: STATUS, default: "'neutral'", desc: 'Color.' },
    { name: 'badge: dot', type: 'boolean', default: 'false', desc: 'Bare status dot.' },
    { name: 'chip: tone', type: STATUS, default: "'neutral'", desc: 'Color.' },
    { name: 'chip: removable', type: 'boolean', default: 'false', desc: 'Show a remove button.' },
    { name: 'chip: label', type: 'string', default: '—', desc: "Builds the remove button's accessible name." },
    { name: 'chip: radius', type: 'boolean', default: 'UiConfig.radius', desc: 'Rounded corners.' },
    { name: 'avatar: src / alt', type: 'string', default: '—', desc: 'Image and its alt text.' },
    { name: 'avatar: name', type: 'string', default: '—', desc: 'Initials fallback and accessible name.' },
    { name: 'avatar: size', type: "'sm' | 'md' | 'lg'", default: "'md'", desc: 'Avatar size.' },
    { name: 'avatar: square', type: 'boolean', default: 'false', desc: 'Square instead of round.' },
    { name: 'avatar-group: max', type: 'number', default: '—', desc: 'Informational cap; you trim the list yourself.' },
    { name: '--ui-avatar-overlap', type: 'CSS length', default: 'var(--ui-space-2)', desc: 'How far grouped avatars overlap.' },
  ];
  protected readonly chipOut: ApiRow[] = [{ name: 'chip: remove', type: 'void', default: '—', desc: 'Remove button pressed.' }];
  protected readonly dlApi: ApiRow[] = [
    { name: 'items', type: 'UiDescriptionItem[]', default: '[]', desc: 'Term/detail pairs.' },
    { name: 'layout', type: "'stacked' | 'row'", default: "'row'", desc: 'Pair layout.' },
  ];
  protected readonly timelineApi: ApiRow[] = [{ name: 'items', type: 'UiTimelineItem[]', default: '[]', desc: 'Events.' }];
  protected readonly codeApi: ApiRow[] = [
    { name: 'code', type: 'string', default: "''", desc: 'Source text.' },
    { name: 'language', type: 'string', default: "'text'", desc: 'Language label.' },
    { name: 'radius', type: 'boolean', default: 'true', desc: 'Rounded corners.' },
  ];
}
