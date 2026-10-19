import { Component, computed, inject, input, output, signal } from '@angular/core';
import { HugeiconsIconComponent, type IconSvgObject } from '@hugeicons/angular';
import { FIELD_ICONS, GROUP_ICON, REPEAT_ICON, STATIC_ICONS, FB_ICONS } from './builder-icons';
import { FbDnd, type FbDragPayload } from './builder-dnd';
import { FbBuilderStore } from './builder-store';
import { FB_SHARED_STYLES } from './builder-styles';
import { createField, createGroup, createStatic, type UiFbDropTarget } from './definition';
import { UI_FB_FIELD_TYPES, UI_FB_STATIC_TYPES } from './field-types';
import type { UiFbElement } from './schema';

interface PaletteItem {
  id: string;
  label: string;
  description: string;
  icon: IconSvgObject;
  category: string;
  create: () => UiFbElement;
}

/**
 * `ui-fb-palette` — the list of things to add. Click to add (after the
 * selection, or at `target`), or drag onto the canvas.
 */
@Component({
  selector: 'ui-fb-palette',
  imports: [HugeiconsIconComponent],
  template: `
    <div class="search">
      <hugeicons-icon [icon]="searchIcon" [size]="14" [strokeWidth]="1.8" aria-hidden="true" />
      <input type="search" placeholder="Find a field type…" aria-label="Find a field type" autocomplete="off" [value]="query()" (input)="query.set($any($event.target).value)" />
    </div>
    <div class="groups" [class.compact]="compact()">
      @for (cat of categories(); track cat.name) {
        <section>
          <h3>{{ cat.name }}</h3>
          <ul role="list">
            @for (item of cat.items; track item.id) {
              <li>
                <button type="button" class="item" [title]="item.description" (pointerdown)="press(item, $event)" (click)="click(item)">
                  <span class="ico"><hugeicons-icon aria-hidden="true" [icon]="item.icon" [size]="15" [strokeWidth]="1.8" /></span>
                  <span class="txt">
                    <span class="name">{{ item.label }}</span>
                    @if (compact()) { <span class="desc">{{ item.description }}</span> }
                  </span>
                </button>
              </li>
            }
          </ul>
        </section>
      } @empty {
        <p class="none">Nothing matches “{{ query() }}”.</p>
      }
    </div>
    @if (!compact()) { <p class="tip">Click to add, or drag onto the form.</p> }
    <p class="fb-sr" aria-live="polite">{{ query() ? resultCount() + (resultCount() === 1 ? ' match' : ' matches') : '' }}</p>
  `,
  styles: [FB_SHARED_STYLES, `
    :host { display: flex; flex-direction: column; min-height: 0; }
    .search { position: relative; display: flex; align-items: center; margin: 0 0 var(--ui-space-2); }
    .search hugeicons-icon { position: absolute; left: 9px; color: var(--ui-color-text-muted); pointer-events: none; }
    .search input {
      width: 100%; height: 30px; padding: 0 var(--ui-space-2) 0 28px; box-sizing: border-box;
      border: 1px solid var(--ui-control-border); border-radius: var(--ui-radius); background: var(--ui-color-surface);
      color: var(--ui-color-text); font: inherit; font-size: 13px;
    }
    .search input:focus { outline: none; border-color: var(--ui-color-primary); box-shadow: 0 0 0 3px color-mix(in srgb, var(--ui-color-primary) 28%, transparent); }
    .groups { display: flex; flex-direction: column; gap: var(--ui-space-3); overflow: auto; min-height: 0; padding-bottom: var(--ui-space-2); }
    section h3 { margin: 0 0 2px; padding: 0 6px; font-size: 11px; font-weight: 600; color: var(--ui-color-text-muted); }
    ul { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: 1fr; gap: 1px; }
    .compact ul { grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 2px var(--ui-space-2); }
    .item {
      display: flex; align-items: center; gap: var(--ui-space-2); width: 100%; min-height: 30px; padding: 3px 6px;
      border: 0; border-radius: var(--ui-radius-xs); background: transparent; color: var(--ui-color-text);
      font: inherit; font-size: 13px; text-align: left; cursor: grab; touch-action: pan-y; user-select: none; -webkit-user-select: none;
      -webkit-touch-callout: none;
    }
    .item:hover { background: var(--ui-color-surface-hover); }
    .item:active { cursor: grabbing; }
    .item:focus-visible { outline: none; box-shadow: var(--ui-focus-ring); }
    .ico { display: inline-grid; place-items: center; width: 24px; height: 24px; flex: none; border-radius: var(--ui-radius-xs);
      color: var(--ui-color-text-secondary); background: var(--ui-color-surface-subtle, var(--ui-color-surface-hover)); border: 1px solid var(--ui-color-border-subtle, var(--ui-color-border)); }
    .txt { display: flex; flex-direction: column; min-width: 0; }
    .name { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    /* Up to two lines: a description cut after a few words says nothing. */
    .desc { font-size: 12px; line-height: 1.35; color: var(--ui-color-text-muted); overflow: hidden; display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; }
    .compact .item { min-height: 44px; padding-block: var(--ui-space-1); }
    .tip, .none { margin: var(--ui-space-2) 6px 0; font-size: 12px; color: var(--ui-color-text-muted); }
    @media (pointer: coarse) { .item { min-height: 44px; } }
  `],
})
export class FbPalette {
  private readonly store = inject(FbBuilderStore);
  private readonly dnd = inject(FbDnd);

  /** Show descriptions in a roomier grid (sheets and popovers). */
  readonly compact = input(false);
  /** Where clicks add to; defaults to after the selection. */
  readonly target = input<UiFbDropTarget | null>(null);
  readonly added = output<void>();

  protected readonly searchIcon = FB_ICONS.Search01Icon;
  protected readonly query = signal('');

  private readonly items: PaletteItem[] = [
    ...UI_FB_FIELD_TYPES.map((t) => ({
      id: t.type, label: t.label, description: t.description, icon: FIELD_ICONS[t.type], category: t.category,
      create: () => createField(t.type, this.store.def()),
    })),
    { id: 'group', label: 'Section', description: 'Groups questions, with its own rules', icon: GROUP_ICON, category: 'Layout', create: () => createGroup(this.store.def()) },
    { id: 'repeat', label: 'Repeating section', description: 'People can add it several times', icon: REPEAT_ICON, category: 'Layout', create: () => createGroup(this.store.def(), true) },
    ...UI_FB_STATIC_TYPES.map((t) => ({
      id: t.type, label: t.label, description: t.description, icon: STATIC_ICONS[t.type], category: 'Layout', create: () => createStatic(t.type),
    })),
  ];

  protected readonly categories = computed(() => {
    const q = this.query().trim().toLowerCase();
    const hits = this.items.filter((i) => !q || i.label.toLowerCase().includes(q) || i.description.toLowerCase().includes(q));
    const order = ['Text', 'Choice', 'Number & date', 'Other', 'Layout'];
    return order.map((name) => ({ name, items: hits.filter((i) => i.category === name) })).filter((c) => c.items.length);
  });

  protected readonly resultCount = computed(() => this.categories().reduce((n, c) => n + c.items.length, 0));

  protected press(item: PaletteItem, e: PointerEvent): void {
    const payload: FbDragPayload = { kind: 'new', label: item.label, icon: item.icon, create: item.create };
    this.dnd.begin(payload, e);
  }

  protected click(item: PaletteItem): void {
    if (this.dnd.consumeClick()) return;
    this.store.add(item.create(), this.target() ?? undefined);
    this.added.emit();
  }
}
