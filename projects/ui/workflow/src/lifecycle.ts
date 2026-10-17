import { Component, DestroyRef, computed, inject, signal, viewChild } from '@angular/core';
import { HugeiconsIconComponent } from '@hugeicons/angular';
import { UiButton, UiSegmented } from '@zouriel/ui/button';
import { UiCanvasViewport, type UiMinimapItem } from '@zouriel/ui/canvas';
import { WfBuilderUi, WfStepList } from './canvas';
import { listSteps, transitionAllows } from './definition';
import { WF_ICONS } from './icons';
import { WF_NODE_H, WF_NODE_W, autoLayout, edgePath, type UiWfPoint } from './layout';
import type { UiWfState, UiWfTransition } from './schema';
import { WfBuilderStore } from './store';
import { WF_SHARED_STYLES } from './styles';

interface DrawnEdge {
  id: string;
  transition: UiWfTransition;
  d: string;
  label: UiWfPoint;
  auto: boolean;
  selected: boolean;
}

/**
 * The lifecycle diagram: states as cards, transitions as arrows. Drag a card to move it, drag
 * from its handle onto another card to add a transition (on touch: tap the handle, then the
 * target), and use "Tidy up" to lay everything out again.
 */
@Component({
  selector: 'ui-wf-lifecycle-canvas',
  imports: [HugeiconsIconComponent, UiButton, UiSegmented, UiCanvasViewport],
  template: `
    <div class="bar">
      <ui-segmented size="sm" label="View" [options]="views" [value]="view()" (valueChange)="view.set($any($event))" />
      <span class="grow"></span>
      @if (connectFrom()) {
        <span class="connect-hint">Now tap the state it goes to <button type="button" class="wf-link" (click)="connectFrom.set(null)">Cancel</button></span>
      }
      <ui-button size="sm" variant="ghost" (click)="tidy()" [disabled]="!hasManual()"><hugeicons-icon aria-hidden="true" [icon]="icons.GridViewIcon" [size]="14" [strokeWidth]="1.8" />Tidy up</ui-button>
      <ui-button size="sm" variant="outline" (click)="addState()"><hugeicons-icon aria-hidden="true" [icon]="icons.Add01Icon" [size]="14" [strokeWidth]="1.8" />State</ui-button>
    </div>

    @if (view() === 'diagram') {
      <ui-canvas-viewport class="vp" [contentWidth]="layout().width + 120" [contentHeight]="layout().height + 160" [minimap]="true" [minimapItems]="minimap()"
        label="Lifecycle diagram" (backgroundClick)="background()">
        <svg class="edges" [attr.width]="layout().width + 120" [attr.height]="layout().height + 160" aria-hidden="true">
          <defs>
            <marker id="wf-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 z" class="head" /></marker>
            <marker id="wf-arrow-on" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 z" class="head on" /></marker>
          </defs>
          @for (e of edges(); track e.id) {
            <path class="edge" [class.on]="e.selected" [class.auto]="e.auto" [attr.d]="e.d" [attr.marker-end]="e.selected ? 'url(#wf-arrow-on)' : 'url(#wf-arrow)'" />
          }
          @if (rubber(); as r) { <path class="edge rubber" [attr.d]="'M ' + r.x1 + ' ' + r.y1 + ' L ' + r.x2 + ' ' + r.y2" /> }
        </svg>
        @for (e of edges(); track e.id) {
          <button type="button" class="edge-label" data-viewport-no-pan [class.on]="e.selected" [class.auto]="e.auto" [style.left.px]="e.label.x" [style.top.px]="e.label.y"
            (click)="selectTransition(e.transition.id)" [attr.aria-label]="'Transition ' + e.transition.label">
            @if (e.auto) { <hugeicons-icon aria-hidden="true" [icon]="icons.Clock02Icon" [size]="11" [strokeWidth]="2" /> }{{ e.transition.label }}
          </button>
        }
        @for (s of states(); track s.id) {
          <div class="state" data-viewport-no-pan tabindex="0" role="button" [attr.data-state]="s.id" [attr.data-tone]="s.tone ?? 'neutral'"
            [class.selected]="isSelected(s.id)" [class.initial]="s.category === 'initial'" [class.terminal]="s.category === 'terminal'"
            [class.target]="connectFrom() && connectFrom() !== s.id" [class.bad]="hasErrors(s.id)"
            [style.left.px]="pos(s.id).x" [style.top.px]="pos(s.id).y" [style.width.px]="nodeW" [style.height.px]="nodeH"
            [attr.aria-label]="s.label + (s.category === 'initial' ? ', starting state' : s.category === 'terminal' ? ', final state' : '')"
            (pointerdown)="pressState($event, s)" (click)="clickState(s)" (keydown)="stateKey($event, s)">
            <span class="kind">{{ s.category === 'initial' ? 'Start' : s.category === 'terminal' ? 'Final' : '' }}</span>
            <span class="name">{{ s.label }}</span>
            <span class="meta">{{ outCount(s.id) }} way{{ outCount(s.id) === 1 ? '' : 's' }} out@if (s.sla) { · time limit }</span>
          </div>
          <!-- A sibling of the card, not inside it: a control can't sit inside another control. -->
          @if (s.category !== 'terminal') {
            <button type="button" class="handle" data-viewport-no-pan [class.on]="isSelected(s.id) || connectFrom() === s.id"
              [style.left.px]="pos(s.id).x + nodeW" [style.top.px]="pos(s.id).y + nodeH / 2"
              (pointerdown)="pressHandle($event, s)" (click)="tapHandle(s)"
              [attr.aria-label]="'Add a transition from ' + s.label"></button>
          }
        }
      </ui-canvas-viewport>
      @if (anyState().length) {
        <div class="any">
          <span class="wf-label">From any state</span>
          @for (t of anyState(); track t.id) {
            <button type="button" class="wf-chip anychip" [class.on]="isTransitionSelected(t.id)" (click)="selectTransition(t.id)">{{ t.label }} → {{ stateLabel(t.to) }}</button>
          }
        </div>
      }
    } @else {
      <div class="list" role="list">
        @for (s of states(); track s.id) {
          <section class="lstate" role="listitem" [class.selected]="isSelected(s.id)" [attr.data-tone]="s.tone ?? 'neutral'">
            <button type="button" class="lhead" (click)="clickState(s)">
              <span class="name">{{ s.label }}</span>
              @if (s.category !== 'active') { <span class="wf-chip">{{ s.category === 'initial' ? 'Start' : 'Final' }}</span> }
            </button>
            <ul class="louts" role="list">
              @for (t of outgoing(s.id); track t.id) {
                <li><button type="button" class="lt" [class.on]="isTransitionSelected(t.id)" (click)="selectTransition(t.id)">
                  <span>{{ t.label }}</span><span class="to">→ {{ stateLabel(t.to) }}</span>
                  @if (t.auto) { <span class="wf-chip">automatic</span> }
                </button></li>
              }
              @if (s.category !== 'terminal') {
                <li><button type="button" class="wf-link" (click)="addFromList(s)">Add a transition</button></li>
              }
            </ul>
          </section>
        }
      </div>
    }
  `,
  styles: [WF_SHARED_STYLES, `
    :host { display: flex; flex-direction: column; min-height: 0; position: relative; }
    .bar { display: flex; align-items: center; gap: var(--ui-space-2); padding: 6px var(--ui-space-2); flex: none; flex-wrap: wrap;
      border-bottom: 1px solid var(--ui-color-border-subtle, var(--ui-color-border)); background: var(--ui-color-surface); }
    .bar ui-button hugeicons-icon { margin-right: 4px; }
    .grow { flex: 1; }
    .connect-hint { font-size: 12.5px; color: var(--ui-color-primary); display: inline-flex; gap: 8px; align-items: center; }
    .vp { flex: 1; min-height: 220px; }
    .edges { position: absolute; left: 0; top: 0; overflow: visible; pointer-events: none; }
    .edge { fill: none; stroke: color-mix(in srgb, var(--ui-color-text) 32%, transparent); stroke-width: 1.6; }
    .edge.auto { stroke-dasharray: 5 4; }
    .edge.on { stroke: var(--ui-color-primary); stroke-width: 2.2; }
    .edge.rubber { stroke: var(--ui-color-primary); stroke-dasharray: 4 3; }
    .head { fill: color-mix(in srgb, var(--ui-color-text) 40%, transparent); }
    .head.on { fill: var(--ui-color-primary); }
    .edge-label { position: absolute; transform: translate(-50%, -50%); display: inline-flex; align-items: center; gap: 3px; max-width: 150px; height: 20px; padding: 0 7px;
      border: 1px solid var(--ui-color-border); border-radius: 10px; background: var(--ui-color-surface); color: var(--ui-color-text-secondary);
      font: inherit; font-size: 11px; font-weight: 550; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; cursor: pointer; z-index: 1; }
    .edge-label:hover { border-color: var(--ui-color-primary); color: var(--ui-color-text); }
    .edge-label.on { border-color: var(--ui-color-primary); background: var(--ui-color-primary); color: var(--ui-color-primary-contrast); }
    .edge-label:focus-visible { outline: none; box-shadow: var(--ui-focus-ring); }
    .state { position: absolute; box-sizing: border-box; display: flex; flex-direction: column; justify-content: center; gap: 1px; padding: 6px 12px 6px 14px;
      border: 1px solid var(--ui-color-border); border-radius: 10px; background: var(--ui-color-surface); box-shadow: var(--ui-shadow-1); cursor: grab; user-select: none; touch-action: none; z-index: 2;
      transition: border-color var(--ui-motion-fast), box-shadow var(--ui-motion-fast); }
    .state::before { content: ''; position: absolute; left: 0; top: 8px; bottom: 8px; width: 3px; border-radius: 0 3px 3px 0; background: var(--wf-tone); }
    .state[data-tone="neutral"] { --wf-tone: var(--ui-color-text-muted); }
    .state[data-tone="info"] { --wf-tone: var(--ui-color-primary); }
    .state[data-tone="success"] { --wf-tone: var(--ui-color-success); }
    .state[data-tone="warning"] { --wf-tone: var(--ui-color-warning); }
    .state[data-tone="danger"] { --wf-tone: var(--ui-color-danger); }
    .state.terminal { box-shadow: var(--ui-shadow-1), inset 0 0 0 3px var(--ui-color-surface), inset 0 0 0 4px var(--ui-color-border); }
    .state:hover { border-color: color-mix(in srgb, var(--ui-color-primary) 45%, var(--ui-color-border)); }
    .state.selected { border-color: var(--ui-color-primary); box-shadow: 0 0 0 1px var(--ui-color-primary), var(--ui-shadow-2); }
    .state.bad { border-color: color-mix(in srgb, var(--ui-color-danger) 60%, var(--ui-color-border)); }
    .state.target { border-style: dashed; border-color: var(--ui-color-primary); }
    .state:focus-visible { outline: none; box-shadow: var(--ui-focus-ring); }
    .state.dragging { cursor: grabbing; box-shadow: var(--ui-shadow-3); z-index: 3; }
    .kind { font-size: 11px; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; color: var(--ui-color-text-muted); min-height: 0; }
    .kind:empty { display: none; }
    .name { font-size: 13px; font-weight: 600; line-height: 1.25; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .meta { font-size: 11px; color: var(--ui-color-text-muted); }
    .handle { position: absolute; width: 14px; height: 14px; margin: -7px 0 0 -7px; padding: 0; border-radius: 50%; cursor: crosshair; touch-action: none; z-index: 1;
      border: 2px solid var(--ui-color-surface); background: var(--ui-color-primary); opacity: 0; transition: opacity var(--ui-motion-fast), transform var(--ui-motion-fast); }
    .state:hover + .handle, .state:focus-visible + .handle, .handle.on, .handle:hover { opacity: 1; }
    .handle:hover { transform: scale(1.25); }
    .handle:focus-visible { opacity: 1; outline: none; box-shadow: var(--ui-focus-ring); }
    @media (pointer: coarse) { .handle { opacity: 1; width: 24px; height: 24px; margin: -12px 0 0 -12px; } }
    .any { display: flex; align-items: center; flex-wrap: wrap; gap: 6px; padding: 6px var(--ui-space-2); border-top: 1px solid var(--ui-color-border-subtle, var(--ui-color-border)); background: var(--ui-color-surface); }
    .any .wf-label { margin: 0; }
    .anychip { border: 0; cursor: pointer; font: inherit; font-size: 11.5px; height: 22px; }
    .anychip.on { background: var(--ui-color-primary); color: var(--ui-color-primary-contrast); }
    .list { flex: 1; overflow: auto; padding: var(--ui-space-2); display: flex; flex-direction: column; gap: var(--ui-space-2); }
    .lstate { border: 1px solid var(--ui-color-border); border-left: 3px solid var(--wf-tone, var(--ui-color-border)); border-radius: var(--ui-radius); background: var(--ui-color-surface); }
    .lstate[data-tone="info"] { --wf-tone: var(--ui-color-primary); }
    .lstate[data-tone="success"] { --wf-tone: var(--ui-color-success); }
    .lstate[data-tone="warning"] { --wf-tone: var(--ui-color-warning); }
    .lstate[data-tone="danger"] { --wf-tone: var(--ui-color-danger); }
    .lstate.selected { border-color: var(--ui-color-primary); }
    .lhead { display: flex; align-items: center; gap: 8px; width: 100%; padding: 8px 10px; border: 0; background: transparent; font: inherit; color: var(--ui-color-text); cursor: pointer; text-align: left; }
    .lhead .name { flex: 1; }
    .louts { list-style: none; margin: 0; padding: 0 10px 8px 18px; display: flex; flex-direction: column; gap: 2px; }
    .lt { display: flex; gap: 8px; align-items: center; width: 100%; min-height: 32px; padding: 4px 8px; border: 0; border-radius: var(--ui-radius-xs); background: transparent;
      font: inherit; font-size: 13px; color: var(--ui-color-text); text-align: left; cursor: pointer; }
    .lt:hover { background: var(--ui-color-surface-hover); }
    .lt.on { background: color-mix(in srgb, var(--ui-color-primary) 12%, transparent); }
    .to { color: var(--ui-color-text-muted); }
  `],
})
export class WfLifecycleCanvas {
  protected readonly store = inject(WfBuilderStore);
  private readonly ui = inject(WfBuilderUi);
  private readonly destroyed = inject(DestroyRef).onDestroy(() => this.unlisten());
  private readonly viewport = viewChild(UiCanvasViewport);
  protected readonly icons = WF_ICONS;
  protected readonly nodeW = WF_NODE_W;
  protected readonly nodeH = WF_NODE_H;
  protected readonly views = [{ value: 'diagram', label: 'Diagram' }, { value: 'list', label: 'List' }];
  protected readonly view = signal<'diagram' | 'list'>('diagram');
  protected readonly connectFrom = signal<string | null>(null);
  protected readonly rubber = signal<{ x1: number; y1: number; x2: number; y2: number } | null>(null);
  /** Live position of the card being dragged (committed on release). */
  private readonly dragPos = signal<{ id: string; x: number; y: number } | null>(null);

  protected readonly lifecycle = computed(() => this.store.def().lifecycle);
  protected readonly states = computed(() => this.lifecycle()?.states ?? []);
  protected readonly layout = computed(() => {
    const lc = this.lifecycle();
    return lc ? autoLayout(lc) : { positions: {}, edges: [], width: WF_NODE_W, height: WF_NODE_H };
  });
  protected readonly hasManual = computed(() => !!this.lifecycle()?.layout && Object.keys(this.lifecycle()!.layout!).length > 0);
  protected readonly anyState = computed(() => (this.lifecycle()?.transitions ?? []).filter((t) => t.from === '*'));
  protected readonly edges = computed<DrawnEdge[]>(() => {
    const lc = this.lifecycle();
    if (!lc) return [];
    const lanes = new Map<string, number>();
    const sel = this.store.selection();
    return this.layout().edges.map((e) => {
      const pair = [e.from, e.to].sort().join('|');
      const lane = lanes.get(pair) ?? 0;
      lanes.set(pair, lane + 1);
      const t = lc.transitions.find((x) => e.id.startsWith(`${x.id}:`))!;
      const { d, label } = edgePath(this.pos(e.from), this.pos(e.to), e.back, lane);
      return { id: e.id, transition: t, d, label, auto: !!t.auto, selected: sel?.kind === 'transition' && sel.id === t.id };
    });
  });
  protected readonly minimap = computed<UiMinimapItem[]>(() =>
    this.states().map((s) => ({ ...this.pos(s.id), w: WF_NODE_W, h: WF_NODE_H, active: this.isSelected(s.id) })));

  protected pos(id: string): UiWfPoint {
    const d = this.dragPos();
    if (d?.id === id) return { x: d.x, y: d.y };
    return this.layout().positions[id] ?? { x: 0, y: 0 };
  }

  protected isSelected(id: string): boolean {
    const s = this.store.selection();
    return s?.kind === 'state' && s.id === id;
  }

  protected isTransitionSelected(id: string): boolean {
    const s = this.store.selection();
    return s?.kind === 'transition' && s.id === id;
  }

  protected hasErrors(id: string): boolean {
    return (this.store.problemsByNode().get(id) ?? []).some((p) => p.severity === 'error');
  }

  protected stateLabel(id: string): string {
    return this.states().find((s) => s.id === id)?.label ?? '?';
  }

  protected outgoing(stateId: string): UiWfTransition[] {
    return (this.lifecycle()?.transitions ?? []).filter((t) => transitionAllows(this.store.def(), t, stateId));
  }

  protected outCount(stateId: string): number {
    return this.outgoing(stateId).length;
  }

  protected background(): void {
    this.connectFrom.set(null);
    this.store.selection.set({ kind: 'workflow' });
  }

  protected selectTransition(id: string): void {
    this.store.selection.set({ kind: 'transition', id });
    this.ui.inspectRequest.update((n) => n + 1);
  }

  protected clickState(s: UiWfState): void {
    if (this.suppressClick) { this.suppressClick = false; return; }
    const from = this.connectFrom();
    if (from && from !== s.id) {
      this.connectFrom.set(null);
      this.store.addTransition(from, s.id);
      this.ui.inspectRequest.update((n) => n + 1);
      return;
    }
    this.store.selection.set({ kind: 'state', id: s.id });
    this.ui.inspectRequest.update((n) => n + 1);
  }

  protected addState(): void {
    const v = this.viewport();
    const l = this.layout();
    const at: [number, number] = [Math.round(l.width + 40), Math.round(Math.max(0, l.height / 2 - WF_NODE_H / 2))];
    this.store.addState('New state', at);
    this.ui.inspectRequest.update((n) => n + 1);
    queueMicrotask(() => v?.reveal(at[0], at[1], WF_NODE_W, WF_NODE_H));
  }

  protected tidy(): void {
    this.store.tidyLayout();
    queueMicrotask(() => this.viewport()?.fit());
  }

  protected addFromList(s: UiWfState): void {
    const target = this.states().find((x) => x.id !== s.id && x.category !== 'initial') ?? this.states().find((x) => x.id !== s.id);
    if (target) this.store.addTransition(s.id, target.id);
    this.ui.inspectRequest.update((n) => n + 1);
  }

  private suppressClick = false;
  /** Removes the window listeners of the drag in progress (also when the diagram goes away mid-drag). */
  private unlisten: () => void = () => undefined;

  private listen(move: (e: PointerEvent) => void, up: (e: PointerEvent) => void): void {
    this.unlisten();
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
    this.unlisten = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
      this.unlisten = () => undefined;
    };
  }

  /** Drag a card to move it; a short press is a click. */
  protected pressState(e: PointerEvent, s: UiWfState): void {
    if (e.button !== 0) return;
    const vp = this.viewport();
    if (!vp) return;
    const start = vp.toWorld(e.clientX, e.clientY);
    const origin = this.pos(s.id);
    const el = e.currentTarget as HTMLElement;
    let moved = false;
    const move = (ev: PointerEvent) => {
      if (ev.pointerId !== e.pointerId) return;
      const w = vp.toWorld(ev.clientX, ev.clientY);
      const dx = w.x - start.x, dy = w.y - start.y;
      if (!moved && Math.hypot(dx, dy) < 4) return;
      moved = true;
      el.classList.add('dragging');
      // Snap to an 8px grid so cards line up.
      this.dragPos.set({ id: s.id, x: Math.round((origin.x + dx) / 8) * 8, y: Math.round((origin.y + dy) / 8) * 8 });
    };
    const up = (ev: PointerEvent) => {
      if (ev.pointerId !== e.pointerId) return;
      this.unlisten();
      el.classList.remove('dragging');
      const d = this.dragPos();
      this.dragPos.set(null);
      if (moved && d && ev.type === 'pointerup') {
        this.suppressClick = true;
        setTimeout(() => (this.suppressClick = false), 0);
        this.store.placeState(s.id, d.x, d.y);
      }
    };
    this.listen(move, up);
  }

  /** Drag from the handle onto another card to add a transition. */
  protected pressHandle(e: PointerEvent, s: UiWfState): void {
    e.stopPropagation();
    if (e.pointerType === 'touch') return; // touch uses tap-tap (tapHandle)
    const vp = this.viewport();
    if (!vp) return;
    e.preventDefault();
    const p = this.pos(s.id);
    const x1 = p.x + WF_NODE_W, y1 = p.y + WF_NODE_H / 2;
    const move = (ev: PointerEvent) => {
      const w = vp.toWorld(ev.clientX, ev.clientY);
      this.rubber.set({ x1, y1, x2: w.x, y2: w.y });
    };
    const up = (ev: PointerEvent) => {
      this.unlisten();
      this.rubber.set(null);
      const target = (document.elementFromPoint(ev.clientX, ev.clientY) as HTMLElement | null)?.closest<HTMLElement>('[data-state]');
      const to = target?.dataset['state'];
      if (to && to !== s.id && ev.type === 'pointerup') {
        // The pointerup lands on the target card and its click follows; swallow just that one.
        this.suppressClick = true;
        setTimeout(() => (this.suppressClick = false), 0);
        this.store.addTransition(s.id, to);
        this.ui.inspectRequest.update((n) => n + 1);
      }
    };
    this.listen(move, up);
  }

  protected tapHandle(s: UiWfState): void {
    this.connectFrom.set(this.connectFrom() === s.id ? null : s.id);
  }

  /** Keyboard: Enter selects, arrows move the card (one undo step per key press). */
  protected stateKey(e: KeyboardEvent, s: UiWfState): void {
    const p = this.pos(s.id);
    const step = e.shiftKey ? 40 : 8;
    const moves: Record<string, [number, number]> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); this.clickState(s); return; }
    const m = moves[e.key];
    if (!m) return;
    e.preventDefault();
    this.store.placeState(s.id, Math.max(0, p.x + m[0]), Math.max(0, p.y + m[1]));
  }
}

/**
 * The steps that run for the selected state (on entering, on leaving, when late) or transition
 * ("then do"), shown under the diagram as a step list.
 */
@Component({
  selector: 'ui-wf-lifecycle-runs',
  imports: [UiSegmented, WfStepList],
  // With nothing selected the pane shrinks to its hint, leaving the room to the diagram.
  host: { '[class.idle]': '!lists().length' },
  template: `
    @if (lists().length) {
      <div class="head">
        <span class="title">{{ title() }}</span>
        @if (lists().length > 1) {
          <ui-segmented size="sm" label="Which steps" [options]="tabOptions()" [value]="activeList()" (valueChange)="tab.set($any($event))" />
        }
      </div>
      <div class="scroll" data-wf-scroll>
        <div class="flow">
          <p class="wf-hint lead">{{ hint() }}</p>
          <ui-wf-steps [listId]="activeList()" [steps]="activeSteps()" />
        </div>
      </div>
    } @else {
      <p class="empty">Select a state or a transition to see the steps it runs.</p>
    }
  `,
  styles: [WF_SHARED_STYLES, `
    :host { display: flex; flex-direction: column; min-height: 0; background: var(--ui-color-bg); }
    .head { display: flex; align-items: center; gap: var(--ui-space-3); flex-wrap: wrap; padding: 6px var(--ui-space-3); flex: none;
      border-bottom: 1px solid var(--ui-color-border-subtle, var(--ui-color-border)); background: var(--ui-color-surface); }
    .title { font-size: 13px; font-weight: 650; }
    .scroll { flex: 1; min-height: 0; overflow: auto; padding: var(--ui-space-3); }
    .flow { max-width: 720px; margin: 0 auto; }
    .lead { margin: 0 0 4px; text-align: center; }
    .empty { margin: 0; padding: var(--ui-space-3); text-align: center; color: var(--ui-color-text-muted); font-size: 13px; }
  `],
})
export class WfLifecycleRuns {
  protected readonly store = inject(WfBuilderStore);
  protected readonly tab = signal<string | null>(null);

  /** The selected state or transition, or the one that holds the selected step. */
  private readonly owner = computed(() => {
    const s = this.store.selection();
    if (!s) return null;
    if (s.kind === 'state' || s.kind === 'transition') return s;
    if (s.kind === 'step') {
      const root = this.store.steps().get(s.id)?.path[0];
      if (!root || root === 'root') return null;
      const [kind, id] = root.split(':');
      return kind === 'transition' ? { kind: 'transition' as const, id } : { kind: 'state' as const, id };
    }
    return null;
  });

  protected readonly lists = computed(() => {
    const o = this.owner();
    if (!o) return [];
    if (o.kind === 'transition') return [{ value: `transition:${o.id}`, label: 'Then do' }];
    const st = this.store.def().lifecycle?.states.find((x) => x.id === o.id);
    if (!st) return [];
    const out = [{ value: `onEnter:${o.id}`, label: 'On entering' }];
    if (st.category !== 'initial') out.push({ value: `onExit:${o.id}`, label: 'On leaving' });
    if (st.sla) out.push({ value: `sla:${o.id}`, label: 'When late' });
    return out;
  });
  protected readonly tabOptions = computed(() => this.lists());
  protected readonly activeList = computed(() => {
    const ls = this.lists();
    const sel = this.store.selection();
    // A selected step shows the list it is in.
    if (sel?.kind === 'step') {
      const root = this.store.steps().get(sel.id)?.path[0];
      if (root && ls.some((l) => l.value === root)) return root;
    }
    const t = this.tab();
    return ls.find((l) => l.value === t)?.value ?? ls[0]?.value ?? '';
  });
  protected readonly activeSteps = computed(() => listSteps(this.store.def(), this.activeList()) ?? []);
  protected readonly title = computed(() => {
    const o = this.owner();
    const lc = this.store.def().lifecycle;
    if (o?.kind === 'transition') return `After “${lc?.transitions.find((t) => t.id === o.id)?.label ?? ''}”`;
    return `In “${lc?.states.find((s) => s.id === o?.id)?.label ?? ''}”`;
  });
  protected readonly hint = computed(() => {
    const k = this.activeList().split(':')[0];
    return k === 'transition' ? 'These run right after the record moves (the person who moved it is “whoever started it”).'
      : k === 'onEnter' ? 'These run every time a record arrives in this state. They stop if it leaves.'
        : k === 'onExit' ? 'These run every time a record leaves this state.'
          : 'These run once if a record stays in this state longer than its time limit.';
  });
}
