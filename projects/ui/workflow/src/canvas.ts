import { Component, Injectable, computed, inject, input, output, signal } from '@angular/core';
import { HugeiconsIconComponent } from '@hugeicons/angular';
import { UiMenu, type UiMenuItem } from '@zouriel/ui/overlay';
import { WfDnd, type WfDropTarget } from './dnd';
import { UI_WF_STEP_TYPES, describeStep, describeTrigger, stepInfo, stepName, stepSlots, type UiWfStepCategory, type UiWfSlot } from './definition';
import { WF_ICONS, WF_STEP_ICONS, WF_TRIGGER_ICONS } from './icons';
import type { UiWfStep, UiWfStepType } from './schema';
import { WfBuilderStore } from './store';
import { WF_SHARED_STYLES } from './styles';

export type WfLayout = 'wide' | 'medium' | 'narrow';

/** UI requests shared by the builder's parts (open the step picker, ask before deleting…). */
@Injectable()
export class WfBuilderUi {
  readonly layout = signal<WfLayout>('wide');
  /** Where the step picker will insert; null when it is closed. */
  readonly addTarget = signal<WfDropTarget | null>(null);
  readonly deleteRequest = signal<string | null>(null);
  /** Bumped when a card asks for its settings (on narrow screens this opens the sheet). */
  readonly inspectRequest = signal(0);
  /** Collapsed branch columns on narrow screens, by list id. */
  readonly collapsed = signal<ReadonlySet<string>>(new Set());

  toggleCollapsed(listId: string): void {
    this.collapsed.update((s) => {
      const n = new Set(s);
      if (n.has(listId)) n.delete(listId); else n.add(listId);
      return n;
    });
  }
}

/** The trigger card at the top of an automation. */
@Component({
  selector: 'ui-wf-trigger-card',
  imports: [HugeiconsIconComponent],
  template: `
    <button type="button" class="card trigger" [class.selected]="selected()" [class.bad]="problems().length" (click)="select()"
      [attr.aria-label]="'Trigger: ' + summary()" [attr.aria-pressed]="selected()">
      <span class="ico"><hugeicons-icon aria-hidden="true" [icon]="icon()" [size]="16" [strokeWidth]="1.8" /></span>
      <span class="body">
        <span class="kicker">Starts</span>
        <span class="title">{{ summary() }}</span>
        @if (condition()) { <span class="sub">Only when conditions hold</span> }
      </span>
      @if (problems().length) { <span class="wf-chip" data-tone="danger" [attr.title]="problems()[0].message">{{ problems().length }}</span> }
    </button>
  `,
  styles: [WF_SHARED_STYLES, `
    /*
     * Long titles never widen the canvas: cards take their column's width and truncate. On a canvas
     * widened by a branch further down, top-level cards stay readable and centred, menus in reach.
     */
    :host { display: block; contain: inline-size; width: 100%; max-width: 560px; margin-inline: auto; }
    .card { display: flex; align-items: center; gap: 10px; width: 100%; padding: 10px 12px; text-align: left; cursor: pointer; font: inherit; color: var(--ui-color-text);
      background: var(--ui-color-surface); border: 1px solid var(--ui-color-border); border-radius: var(--ui-radius); box-shadow: var(--ui-shadow-1);
      transition: border-color var(--ui-motion-fast), box-shadow var(--ui-motion-fast); }
    .card:hover { border-color: color-mix(in srgb, var(--ui-color-primary) 45%, var(--ui-color-border)); }
    .card:focus-visible { outline: none; box-shadow: var(--ui-focus-ring); }
    .card.selected { border-color: var(--ui-color-primary); box-shadow: 0 0 0 1px var(--ui-color-primary); }
    .card.bad { border-color: color-mix(in srgb, var(--ui-color-danger) 55%, var(--ui-color-border)); }
    .ico { display: grid; place-items: center; width: 30px; height: 30px; flex: none; border-radius: 8px;
      color: var(--ui-color-primary-contrast); background: var(--ui-color-primary); }
    .body { display: flex; flex-direction: column; min-width: 0; flex: 1; }
    .kicker { font-size: 11px; font-weight: 650; letter-spacing: 0.05em; text-transform: uppercase; color: var(--ui-color-text-muted); }
    .title { font-size: 13.5px; font-weight: 600; line-height: 1.3; }
    .sub { font-size: 12px; color: var(--ui-color-text-secondary); }
  `],
})
export class WfTriggerCard {
  protected readonly store = inject(WfBuilderStore);
  private readonly ui = inject(WfBuilderUi);
  protected readonly selected = computed(() => this.store.selection()?.kind === 'trigger');
  protected readonly summary = computed(() => describeTrigger(this.store.def().trigger, this.store.describeContext()));
  protected readonly icon = computed(() => WF_TRIGGER_ICONS[this.store.def().trigger?.type ?? 'fieldChanged'] ?? WF_ICONS.FlashIcon);
  protected readonly condition = computed(() => { const w = this.store.def().trigger?.when; return !!w && (!('conditions' in w) || w.conditions.length > 0); });
  protected readonly problems = computed(() => (this.store.problemsByNode().get(null) ?? []).filter((p) => p.severity === 'error'));

  protected select(): void {
    this.store.selection.set({ kind: 'trigger' });
    this.ui.inspectRequest.update((n) => n + 1);
  }
}

/** One step: icon, name, one-line summary, problems, and a menu. */
@Component({
  selector: 'ui-wf-step-card',
  imports: [HugeiconsIconComponent, UiMenu],
  template: `
    <div class="card" [class.selected]="selected()" [class.off]="step().disabled" [class.bad]="errors().length" [attr.data-cat]="info().category">
      <button type="button" class="grip" (pointerdown)="grab($event)" [attr.aria-label]="'Move ' + name() + ' (or use the menu)'" tabindex="-1">
        <hugeicons-icon aria-hidden="true" [icon]="icons.DragDropVerticalIcon" [size]="14" [strokeWidth]="1.8" />
      </button>
      <button type="button" class="main" (click)="select()" (pointerdown)="press($event)" [attr.aria-pressed]="selected()"
        [attr.aria-label]="name() + ': ' + summary()" [attr.aria-describedby]="errors().length ? 'p-' + step().id : null">
        <span class="ico"><hugeicons-icon aria-hidden="true" [icon]="icon()" [size]="15" [strokeWidth]="1.8" /></span>
        <span class="body">
          <span class="title">{{ name() }}@if (step().disabled) { <span class="wf-chip off-chip">Off</span> }</span>
          <span class="sub">{{ summary() }}</span>
        </span>
      </button>
      @if (errors().length) {
        <span class="wf-chip" data-tone="danger" [id]="'p-' + step().id" [attr.title]="errors()[0].message">{{ errors().length }}</span>
      } @else if (warnings().length) {
        <span class="wf-chip" data-tone="warning" [attr.title]="warnings()[0].message">!</span>
      }
      <ui-menu [items]="menu()" (select)="onMenu($event)">
        <button menu-trigger type="button" class="wf-icon-btn" [attr.aria-label]="'More for ' + name()">
          <hugeicons-icon aria-hidden="true" [icon]="icons.MoreHorizontalIcon" [size]="15" [strokeWidth]="1.8" />
        </button>
      </ui-menu>
    </div>
  `,
  styles: [WF_SHARED_STYLES, `
    /*
     * Long titles never widen the canvas: cards take their column's width and truncate. On a canvas
     * widened by a branch further down, top-level cards stay readable and centred, menus in reach.
     */
    :host { display: block; contain: inline-size; width: 100%; max-width: 560px; margin-inline: auto; }
    :host-context(.read-only) .grip, :host-context(.read-only) ui-menu { visibility: hidden; }
    .card { position: relative; display: flex; align-items: center; gap: 2px; padding: 4px 4px 4px 0; min-height: 46px; box-sizing: border-box;
      background: var(--ui-color-surface); border: 1px solid var(--ui-color-border); border-radius: var(--ui-radius); box-shadow: var(--ui-shadow-1);
      transition: border-color var(--ui-motion-fast), box-shadow var(--ui-motion-fast), opacity var(--ui-motion-fast); }
    .card:hover { border-color: color-mix(in srgb, var(--ui-color-primary) 40%, var(--ui-color-border)); }
    .card.selected { border-color: var(--ui-color-primary); box-shadow: 0 0 0 1px var(--ui-color-primary); }
    .card.bad { border-color: color-mix(in srgb, var(--ui-color-danger) 55%, var(--ui-color-border)); }
    .card.off { opacity: 0.6; }
    .grip { display: grid; place-items: center; width: 18px; align-self: stretch; flex: none; padding: 0; border: 0; background: transparent;
      color: var(--ui-color-text-muted); cursor: grab; touch-action: none; opacity: 0; transition: opacity var(--ui-motion-fast); border-radius: var(--ui-radius) 0 0 var(--ui-radius); }
    .card:hover .grip, .card.selected .grip { opacity: 1; }
    @media (pointer: coarse) { .grip { opacity: 1; width: 26px; } }
    .main { display: flex; align-items: center; gap: 10px; flex: 1; min-width: 0; padding: 2px 4px; border: 0; background: transparent;
      font: inherit; color: var(--ui-color-text); text-align: left; cursor: pointer; border-radius: var(--ui-radius-xs); }
    .main:focus-visible { outline: none; box-shadow: var(--ui-focus-ring); }
    .ico { display: grid; place-items: center; width: 28px; height: 28px; flex: none; border-radius: 7px;
      color: var(--wf-cat, var(--ui-color-primary)); background: color-mix(in srgb, var(--wf-cat, var(--ui-color-primary)) 14%, transparent); }
    .card[data-cat="People"] { --wf-cat: var(--ui-color-primary); }
    .card[data-cat="Logic"] { --wf-cat: var(--ui-color-warning); }
    .card[data-cat="Timing"] { --wf-cat: var(--ui-color-info, var(--ui-color-primary)); }
    .card[data-cat="Data"] { --wf-cat: var(--ui-color-success); }
    .card[data-cat="Messages"] { --wf-cat: var(--ui-color-primary); }
    .card[data-cat="Advanced"] { --wf-cat: var(--ui-color-text-secondary); }
    .body { display: flex; flex-direction: column; min-width: 0; }
    .title { display: flex; align-items: center; gap: 6px; font-size: 13px; font-weight: 600; line-height: 1.3; }
    .sub { font-size: 12px; line-height: 1.35; color: var(--ui-color-text-secondary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .off-chip { height: 16px; font-size: 11px; }
  `],
})
export class WfStepCard {
  protected readonly store = inject(WfBuilderStore);
  private readonly dnd = inject(WfDnd);
  private readonly ui = inject(WfBuilderUi);
  readonly step = input.required<UiWfStep>();
  protected readonly icons = WF_ICONS;
  protected readonly info = computed(() => stepInfo(this.step().type));
  protected readonly icon = computed(() => WF_STEP_ICONS[this.step().type] ?? WF_ICONS.FlashIcon);
  protected readonly name = computed(() => stepName(this.step()));
  protected readonly summary = computed(() => describeStep(this.step(), this.store.describeContext(this.store.tokens({ stepId: this.step().id }))));
  protected readonly selected = computed(() => { const s = this.store.selection(); return s?.kind === 'step' && s.id === this.step().id; });
  protected readonly errors = computed(() => (this.store.problemsByNode().get(this.step().id) ?? []).filter((p) => p.severity === 'error'));
  protected readonly warnings = computed(() => (this.store.problemsByNode().get(this.step().id) ?? []).filter((p) => p.severity === 'warning'));
  protected readonly menu = computed<UiMenuItem[]>(() => {
    const loc = this.store.steps().get(this.step().id);
    const siblings = loc ? this.siblingCount(loc.listId) : 0;
    return [
      { value: 'up', label: 'Move up', disabled: !loc || loc.index === 0 },
      { value: 'down', label: 'Move down', disabled: !loc || loc.index >= siblings - 1 },
      { value: 'duplicate', label: 'Duplicate' },
      { value: 'toggle', label: this.step().disabled ? 'Turn on' : 'Turn off (skip it)' },
      { value: 'delete', label: 'Delete', danger: true },
    ];
  });

  private siblingCount(listId: string): number {
    let n = 0;
    for (const l of this.store.steps().values()) if (l.listId === listId) n++;
    return n;
  }

  protected select(): void {
    if (this.dnd.consumeClick()) return;
    this.store.selection.set({ kind: 'step', id: this.step().id });
    this.ui.inspectRequest.update((n) => n + 1);
  }

  /** Grip: drag at once (it has touch-action: none, so the list still scrolls everywhere else). */
  protected grab(e: PointerEvent): void {
    e.preventDefault();
    this.dnd.begin({ kind: 'move', id: this.step().id, label: this.name(), icon: this.icon() }, e, { immediate: true });
  }

  /** The card body: a mouse drag or a long press on touch also moves it. */
  protected press(e: PointerEvent): void {
    this.dnd.begin({ kind: 'move', id: this.step().id, label: this.name(), icon: this.icon() }, e);
  }

  protected onMenu(item: UiMenuItem): void {
    const s = this.step();
    const loc = this.store.steps().get(s.id);
    switch (item.value) {
      case 'up': if (loc) this.store.moveStep(s.id, loc.listId, loc.index - 1); break;
      case 'down': if (loc) this.store.moveStep(s.id, loc.listId, loc.index + 2); break;
      case 'duplicate': this.store.duplicateStep(s.id); break;
      case 'toggle': this.store.updateStep(s.id, { disabled: s.disabled ? undefined : true }); break;
      case 'delete': this.ui.deleteRequest.set(s.id); break;
    }
  }
}

/** A "+" between steps: click to pick a step for this place. */
@Component({
  selector: 'ui-wf-add-slot',
  imports: [HugeiconsIconComponent],
  template: `
    <button type="button" class="plus" (click)="open()" [attr.aria-label]="label()">
      <hugeicons-icon aria-hidden="true" [icon]="icons.Add01Icon" [size]="12" [strokeWidth]="2.2" />
    </button>
  `,
  styles: [`
    :host { display: flex; justify-content: center; position: relative; height: 26px; }
    /* Someone only looking can't add steps: the connector stays, the + goes. */
    :host-context(.read-only) button { visibility: hidden; }
    :host::before { content: ''; position: absolute; left: 50%; top: 0; bottom: 0; width: 2px; transform: translateX(-1px);
      background: var(--ui-color-border); }
    :host(.first)::before { top: 50%; }
    .plus { position: relative; z-index: 1; align-self: center; display: grid; place-items: center; width: 20px; height: 20px; padding: 0;
      border: 1px solid var(--ui-color-border); border-radius: 50%; background: var(--ui-color-bg); color: var(--ui-color-text-muted); cursor: pointer;
      transition: transform var(--ui-motion-fast), color var(--ui-motion-fast), border-color var(--ui-motion-fast), background var(--ui-motion-fast); }
    .plus:hover, .plus:focus-visible { color: var(--ui-color-primary-contrast); background: var(--ui-color-primary); border-color: var(--ui-color-primary); transform: scale(1.12); outline: none; }
    @media (pointer: coarse) { :host { height: 34px; } .plus { width: 28px; height: 28px; } }
  `],
})
export class WfAddSlot {
  private readonly ui = inject(WfBuilderUi);
  readonly listId = input.required<string>();
  readonly index = input.required<number>();
  readonly label = input('Add a step here');
  protected readonly icons = WF_ICONS;

  protected open(): void {
    this.ui.addTarget.set({ listId: this.listId(), index: this.index() });
  }
}

/** A list of steps with "+" slots between them; containers render their own lists below them. */
@Component({
  selector: 'ui-wf-steps',
  imports: [HugeiconsIconComponent, WfStepCard, WfAddSlot],
  template: `
    <div class="list" [attr.data-wf-list]="listId()" [class.over]="dropOver()">
      <ui-wf-add-slot [listId]="listId()" [index]="0" [class.first]="!lead()" />
      @for (step of steps(); track step.id; let i = $index) {
        <div class="item" [attr.data-wf-item]="step.id">
          <ui-wf-step-card [step]="step" />
          @if (slotsOf(step); as slots) {
            @if (slots.length) {
              <div class="fork" [class.stacked]="stacked()" [attr.data-count]="slots.length">
                @for (s of slots; track s.slot) {
                  <section class="lane" [attr.data-kind]="s.kind" [attr.data-tone]="s.tone ?? null">
                    <button type="button" class="lane-head" (click)="toggle(step.id + '/' + s.slot)" [attr.aria-expanded]="!isCollapsed(step.id + '/' + s.slot)">
                      <span class="lane-label">{{ s.label }}</span>
                      <span class="lane-count">{{ s.steps.length || '' }}</span>
                      @if (stacked()) { <hugeicons-icon aria-hidden="true" [icon]="isCollapsed(step.id + '/' + s.slot) ? icons.ArrowDown01Icon : icons.ArrowUp01Icon" [size]="12" [strokeWidth]="2" /> }
                    </button>
                    @if (!isCollapsed(step.id + '/' + s.slot)) {
                      <ui-wf-steps [listId]="step.id + '/' + s.slot" [steps]="s.steps" [lead]="true" />
                    }
                  </section>
                }
              </div>
            }
          }
        </div>
        <ui-wf-add-slot [listId]="listId()" [index]="i + 1" />
      }
      @if (!steps().length && !lead()) {
        <p class="empty">No steps yet. Press + to add one{{ canDrag() ? ', or drag one in from the left' : '' }}.</p>
      }
    </div>
  `,
  styles: [`
    :host { display: block; min-width: 0; }
    .list { display: flex; flex-direction: column; min-width: 0; border-radius: var(--ui-radius); }
    .list.over { background: color-mix(in srgb, var(--ui-color-primary) 5%, transparent); }
    .item { display: flex; flex-direction: column; min-width: 0; }
    /* Columns never shrink below a readable width: the canvas as a whole scrolls sideways instead. */
    .fork { position: relative; display: grid; grid-auto-flow: column; grid-auto-columns: minmax(230px, 1fr); gap: var(--ui-space-3); margin-top: 0;
      padding: 0 0 var(--ui-space-1); }
    .fork::before { content: ''; position: absolute; left: 50%; top: 0; height: 10px; width: 2px; transform: translateX(-1px); background: var(--ui-color-border); }
    .fork.stacked { grid-auto-flow: row; grid-auto-columns: auto; }
    .lane { display: flex; flex-direction: column; min-width: 0; margin-top: 10px; padding: 6px 6px 2px; border-radius: var(--ui-radius);
      border: 1px dashed var(--ui-color-border); background: color-mix(in srgb, var(--ui-color-surface) 55%, transparent); }
    .lane-head { display: flex; align-items: center; gap: 6px; align-self: center; max-width: 100%; height: 22px; padding: 0 8px; border: 0; border-radius: 11px;
      font: inherit; font-size: 11.5px; font-weight: 600; cursor: pointer; color: var(--ui-color-text-secondary); background: var(--ui-color-surface-hover); }
    .lane-head:focus-visible { outline: none; box-shadow: var(--ui-focus-ring); }
    .lane-label { max-width: 190px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .lane-count { color: var(--ui-color-text-muted); font-weight: 500; }
    .lane[data-tone="success"] .lane-head { color: var(--ui-color-success); background: color-mix(in srgb, var(--ui-color-success) 13%, transparent); }
    .lane[data-tone="danger"] .lane-head { color: var(--ui-color-danger); background: color-mix(in srgb, var(--ui-color-danger) 12%, transparent); }
    .lane[data-tone="warning"] .lane-head { color: var(--ui-color-warning); background: color-mix(in srgb, var(--ui-color-warning) 14%, transparent); }
    .lane[data-kind="error"] { border-color: color-mix(in srgb, var(--ui-color-danger) 40%, var(--ui-color-border)); }
    .fork.stacked .lane-head { align-self: stretch; justify-content: space-between; }
    .empty { margin: 4px 0 0; text-align: center; font-size: 12.5px; color: var(--ui-color-text-muted); }
  `],
})
export class WfStepList {
  private readonly ui = inject(WfBuilderUi);
  private readonly dnd = inject(WfDnd);
  readonly listId = input.required<string>();
  readonly steps = input.required<readonly UiWfStep[]>();
  /** Inside a container (no empty-state message, connector starts at the top). */
  readonly lead = input(false);
  protected readonly icons = WF_ICONS;
  protected readonly stacked = computed(() => this.ui.layout() === 'narrow');
  protected readonly canDrag = computed(() => this.ui.layout() === 'wide');
  protected readonly dropOver = computed(() => this.dnd.drop()?.target?.listId === this.listId() && this.dnd.drop()!.valid);

  protected slotsOf(step: UiWfStep): UiWfSlot[] {
    return stepSlots(step);
  }

  protected isCollapsed(listId: string): boolean {
    return this.stacked() && this.ui.collapsed().has(listId);
  }

  protected toggle(listId: string): void {
    if (this.stacked()) this.ui.toggleCollapsed(listId);
  }
}

/** The step catalogue: search, categories, click to add or drag onto the canvas. */
@Component({
  selector: 'ui-wf-step-picker',
  imports: [HugeiconsIconComponent],
  template: `
    <label class="search">
      <hugeicons-icon aria-hidden="true" [icon]="icons.Search01Icon" [size]="14" [strokeWidth]="1.8" />
      <input type="search" placeholder="Search steps" [value]="query()" (input)="query.set($any($event.target).value)" aria-label="Search steps" />
    </label>
    <div class="cats">
      @for (c of groups(); track c.name) {
        <section>
          <h3>{{ c.name }}</h3>
          <div class="grid" [class.compact]="compact()">
            @for (t of c.types; track t.type) {
              <button type="button" class="type" (click)="choose(t.type)" (pointerdown)="drag($event, t.type, t.label)" [attr.data-cat]="t.category">
                <span class="ico"><hugeicons-icon aria-hidden="true" [icon]="iconOf(t.type)" [size]="15" [strokeWidth]="1.8" /></span>
                <span class="txt"><span class="nm">{{ t.label }}</span>@if (compact()) { <span class="ds">{{ t.description }}</span> }</span>
              </button>
            }
          </div>
        </section>
      } @empty {
        <p class="none">No step matches “{{ query() }}”.</p>
      }
    </div>
  `,
  styles: [WF_SHARED_STYLES, `
    :host { display: flex; flex-direction: column; gap: var(--ui-space-2); min-height: 0; }
    .search { display: flex; align-items: center; gap: 6px; height: var(--ui-size-md); padding: 0 var(--ui-space-2); border: 1px solid var(--ui-control-border);
      border-radius: var(--ui-radius); background: var(--ui-color-surface); color: var(--ui-color-text-muted); }
    .search:focus-within { border-color: var(--ui-color-primary); box-shadow: 0 0 0 3px color-mix(in srgb, var(--ui-color-primary) 25%, transparent); }
    .search input { flex: 1; min-width: 0; border: 0; outline: none; background: transparent; color: var(--ui-color-text); font: inherit; font-size: 13px; }
    .cats { display: flex; flex-direction: column; gap: var(--ui-space-3); overflow: auto; min-height: 0; padding-bottom: var(--ui-space-2); }
    h3 { margin: 0 0 4px; font-size: 11px; font-weight: 650; letter-spacing: 0.05em; text-transform: uppercase; color: var(--ui-color-text-muted); }
    .grid { display: grid; grid-template-columns: 1fr; gap: 2px; }
    .grid.compact { grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 4px; }
    .type { display: flex; align-items: center; gap: 8px; padding: 5px 6px; border: 1px solid transparent; border-radius: var(--ui-radius); background: transparent;
      color: var(--ui-color-text); font: inherit; text-align: left; cursor: pointer; touch-action: pan-y; }
    .grid.compact .type { border-color: var(--ui-color-border-subtle, var(--ui-color-border)); padding: 8px; }
    .type:hover, .type:focus-visible { background: var(--ui-color-surface-hover); outline: none; }
    .type:focus-visible { box-shadow: var(--ui-focus-ring); }
    .ico { display: grid; place-items: center; width: 26px; height: 26px; flex: none; border-radius: 7px; color: var(--wf-cat); background: color-mix(in srgb, var(--wf-cat) 14%, transparent); }
    .type[data-cat="People"], .type[data-cat="Messages"] { --wf-cat: var(--ui-color-primary); }
    .type[data-cat="Logic"] { --wf-cat: var(--ui-color-warning); }
    .type[data-cat="Timing"] { --wf-cat: var(--ui-color-info, var(--ui-color-primary)); }
    .type[data-cat="Data"] { --wf-cat: var(--ui-color-success); }
    .type[data-cat="Advanced"] { --wf-cat: var(--ui-color-text-secondary); }
    .txt { display: flex; flex-direction: column; min-width: 0; }
    .nm { font-size: 13px; font-weight: 550; }
    .ds { font-size: 12px; color: var(--ui-color-text-secondary); line-height: 1.3; }
    .none { margin: var(--ui-space-4) 0; text-align: center; color: var(--ui-color-text-muted); font-size: 13px; }
  `],
})
export class WfStepPicker {
  private readonly dnd = inject(WfDnd, { optional: true });
  readonly compact = input(false);
  /** When false, pressing a type never starts a drag (the picker is in a dialog). */
  readonly draggable = input(true);
  readonly chosen = output<UiWfStepType>();
  protected readonly icons = WF_ICONS;
  protected readonly query = signal('');
  protected readonly groups = computed(() => {
    const q = this.query().trim().toLowerCase();
    const order: UiWfStepCategory[] = ['People', 'Logic', 'Timing', 'Data', 'Messages', 'Advanced'];
    return order
      .map((name) => ({ name, types: UI_WF_STEP_TYPES.filter((t) => t.category === name && (!q || `${t.label} ${t.description}`.toLowerCase().includes(q))) }))
      .filter((g) => g.types.length);
  });

  protected iconOf(type: UiWfStepType) {
    return WF_STEP_ICONS[type] ?? WF_ICONS.FlashIcon;
  }

  protected choose(type: UiWfStepType): void {
    if (this.dnd?.consumeClick()) return;
    this.chosen.emit(type);
  }

  protected drag(e: PointerEvent, type: UiWfStepType, label: string): void {
    if (!this.draggable() || !this.dnd) return;
    this.dnd.begin({ kind: 'new', type, label, icon: this.iconOf(type) }, e);
  }
}

/** The automation canvas: trigger card, then the steps. */
@Component({
  selector: 'ui-wf-automation-canvas',
  imports: [WfTriggerCard, WfStepList],
  template: `
    <div class="scroll" data-wf-scroll (click)="backgroundClick($event)">
      <div class="flow">
        <ui-wf-trigger-card />
        <ui-wf-steps listId="root" [steps]="store.def().steps ?? []" [lead]="true" />
        <div class="end" aria-hidden="true">End</div>
      </div>
    </div>
  `,
  styles: [`
    :host { display: block; min-height: 0; position: relative; }
    .scroll { position: absolute; inset: 0; overflow: auto; padding: var(--ui-space-4) var(--ui-space-3) var(--ui-space-12);
      background-image: radial-gradient(color-mix(in srgb, var(--ui-color-text) 9%, transparent) 1px, transparent 1px); background-size: 18px 18px; }
    /* 760px for a plain list; wider when branches need room, then the whole canvas scrolls. */
    .flow { width: max-content; min-width: min(760px, 100%); max-width: none; margin: 0 auto; display: flex; flex-direction: column; }
    .end { align-self: center; margin-top: 2px; padding: 2px 10px; border-radius: 10px; font-size: 11px; font-weight: 600; color: var(--ui-color-text-muted);
      background: var(--ui-color-surface-hover); }
  `],
})
export class WfAutomationCanvas {
  protected readonly store = inject(WfBuilderStore);

  protected backgroundClick(e: MouseEvent): void {
    // Clicking empty canvas shows the workflow's own settings.
    const el = e.target as HTMLElement;
    if (el.classList.contains('scroll') || el.classList.contains('flow')) this.store.selection.set({ kind: 'workflow' });
  }
}
