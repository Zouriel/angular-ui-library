import { Component, signal } from '@angular/core';
import { UiBadge } from '@zouriel/ui/badge';
import { UiButton } from '@zouriel/ui/button';
import { UiDragItem, UiDropTarget } from '@zouriel/ui/drag';
import { DocDemo, DocPage, DocSection, type ApiRow } from '../docs/docs-ui';

interface DemoEvent {
  id: string;
  title: string;
  count: number;
  locked?: boolean;
}

const INITIAL_EVENTS: DemoEvent[] = [
  { id: 'dinner', title: 'Friday dinner', count: 12 },
  { id: 'beach', title: 'Beach trip', count: 8 },
  { id: 'brunch', title: 'Sunday brunch', count: 5 },
  { id: 'archive', title: 'Locked archive', count: 19, locked: true },
];

@Component({
  selector: 'page-drag',
  imports: [UiDragItem, UiDropTarget, UiBadge, UiButton, DocPage, DocSection, DocDemo],
  template: `
    <doc-page
      eyebrow="Components"
      title="Drag & drop"
      lead="Drag an item onto a matching target with a mouse, a long press on touch, or the keyboard. Built for merging tiles, moving cards into buckets, and any drop-onto-target action inside scrolling lists and grids."
    >
      <doc-section
        name="Drag item & drop target"
        selector="[uiDragItem], [uiDropTarget]"
        [api]="itemApi"
        [outputs]="itemOut"
        summary="Attach uiDragItem with a data payload to anything draggable and uiDropTarget with an accepts predicate to anything that receives a drop — including the same element, so an event tile can be dragged onto another event tile to merge them. A mouse drag starts after a small move; a touch drag waits for a long press (UI_LONG_PRESS_MS) so swiping still scrolls the list. A lifted ghost follows the pointer while the original dims; valid targets show an accent ring and invalid ones ignore the drag. Holding near a scroll container's edge auto-scrolls it; Escape cancels. Keyboard: Tab to any item, press Space or Enter to pick it up, Arrow keys to step through valid targets, Enter or Space to drop, and Escape to cancel. Every drop is announced in a polite live region."
      >
        <doc-demo [code]="mergeCode">
          <div class="grid">
            @for (ev of events(); track ev.id) {
              <div
                class="tile"
                [class.locked]="ev.locked"
                [uiDragItem]="ev"
                [uiDragLabel]="ev.title"
                [uiDragDisabled]="!!ev.locked"
                [uiDropTarget]="ev.title"
                [uiDropAccepts]="canMerge(ev)"
                (dropped)="merge($event, ev)"
              >
                <div class="row">
                  <span class="title">{{ ev.title }}</span>
                  @if (ev.locked) {
                    <ui-badge tone="neutral">Locked</ui-badge>
                  } @else {
                    <ui-badge tone="primary">{{ ev.count }} guests</ui-badge>
                  }
                </div>
                <span class="hint">
                  {{ ev.locked ? 'Rejects drops (accepts returns false)' : 'Drag onto another event to merge' }}
                </span>
              </div>
            }
          </div>
          <div class="footer">
            <span class="muted">{{ log() }}</span>
            <ui-button variant="ghost" size="sm" (click)="reset()">Reset</ui-button>
          </div>
        </doc-demo>
      </doc-section>

      <doc-section
        name="Drop target API"
        selector="[uiDropTarget]"
        [api]="targetApi"
        [outputs]="targetOut"
        summary="Each drop target registers itself with UiDragService. Only enabled targets whose uiDropAccepts predicate returns true highlight on hover or appear in the keyboard target cycle."
      >
        <doc-demo [code]="targetCode">
          <span class="muted">Import from <code>&#64;zouriel/ui/drag</code>.</span>
        </doc-demo>
      </doc-section>
    </doc-page>
  `,
  styles: `
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
      gap: var(--ui-space-3);
      width: 100%;
    }
    .tile {
      display: flex;
      flex-direction: column;
      gap: var(--ui-space-2);
      padding: var(--ui-space-3);
      border-radius: var(--ui-radius);
      border: 1px solid var(--ui-color-border);
      background: var(--ui-color-surface-raised);
      cursor: grab;
      user-select: none;
      -webkit-touch-callout: none;
    }
    .tile:focus-visible {
      outline: none;
      box-shadow: var(--ui-focus-ring);
    }
    .tile.locked {
      cursor: default;
      opacity: 0.72;
    }
    .row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--ui-space-2);
    }
    .title {
      font-weight: 600;
      color: var(--ui-color-text);
    }
    .hint {
      font-size: var(--ui-font-size-sm);
      color: var(--ui-color-text-muted);
    }
    .footer {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--ui-space-3);
      width: 100%;
    }
    .muted {
      color: var(--ui-color-text-muted);
      font: var(--ui-font-size-sm) var(--ui-font-mono);
      overflow-wrap: anywhere;
    }
  `,
})
export class DragPage {
  protected readonly events = signal<DemoEvent[]>(INITIAL_EVENTS.map((e) => ({ ...e })));
  protected readonly log = signal('Drag one event tile onto another, or Tab to a tile and press Space.');

  protected canMerge = (target: DemoEvent) => (payload: DemoEvent) => !target.locked && payload.id !== target.id;

  protected merge(from: DemoEvent, onto: DemoEvent): void {
    this.events.update((list) =>
      list
        .filter((e) => e.id !== from.id)
        .map((e) => (e.id === onto.id ? { ...e, count: e.count + from.count } : e)),
    );
    this.log.set(`Merged "${from.title}" into "${onto.title}" (${onto.count + from.count} guests).`);
  }

  protected reset(): void {
    this.events.set(INITIAL_EVENTS.map((e) => ({ ...e })));
    this.log.set('Reset events.');
  }

  protected readonly mergeCode = `<div
  [uiDragItem]="ev"
  [uiDragLabel]="ev.title"
  [uiDropTarget]="ev.title"
  [uiDropAccepts]="canMerge(ev)"
  (dropped)="merge($event, ev)"
>
  {{ ev.title }}
</div>`;

  protected readonly targetCode = `import { UiDragItem, UiDropTarget } from '@zouriel/ui/drag';`;

  protected readonly itemApi: ApiRow[] = [
    { name: 'uiDragItem', type: 'T (required)', default: '—', desc: 'Payload carried by the drag.' },
    { name: 'uiDragLabel', type: 'string', default: "''", desc: 'Item name read in live-region announcements.' },
    { name: 'uiDragDisabled', type: 'boolean', default: 'false', desc: 'Disables dragging and removes the keyboard hint.' },
    { name: 'uiDragDescription', type: 'string', default: "'Press Space or Enter...'", desc: 'Sets aria-description explaining how to move the item.' },
    { name: 'tabindex', type: 'number | string', default: '0', desc: 'Makes the host keyboard-focusable while enabled.' },
  ];

  protected readonly itemOut: ApiRow[] = [
    { name: 'dragStart', type: 'T', desc: 'Emitted when a pointer or keyboard drag begins.' },
    { name: 'dragCancel', type: 'T', desc: 'Emitted when cancelled via Escape, pointer cancel, or off-target drop.' },
    { name: 'dragEnd', type: 'T', desc: 'Emitted when the drag finishes (dropped or cancelled).' },
  ];

  protected readonly targetApi: ApiRow[] = [
    { name: 'uiDropTarget', type: 'string', default: "''", desc: 'Target name read in live-region announcements ("Dropped X on Y").' },
    { name: 'uiDropAccepts', type: '(payload: T) => boolean', default: '() => true', desc: 'Only targets returning true highlight and accept the drop.' },
    { name: 'uiDropDisabled', type: 'boolean', default: 'false', desc: 'Disables this target.' },
  ];

  protected readonly targetOut: ApiRow[] = [
    { name: 'dropped', type: 'T', desc: 'Emitted with the dragged payload when dropped on this valid target.' },
    { name: 'dragOver', type: 'boolean', desc: 'Emitted when a valid dragged item enters or leaves this target.' },
  ];
}
