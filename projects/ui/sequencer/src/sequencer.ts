import { NgTemplateOutlet } from '@angular/common';
import {
  Component, ElementRef, NgZone, OnDestroy, inject, input, model, output, signal, viewChild,
} from '@angular/core';

export interface UiSequencerKeyframe {
  id: string;
  /** Position within the row's bar: 0 is its start, 1 its end. */
  at: number;
  label?: string;
}

export interface UiSequencerRow {
  id: string;
  label: string;
  /** Bar start and end, in timeline units (0 … `length`). */
  start: number;
  end: number;
  keyframes?: readonly UiSequencerKeyframe[];
  /** Nesting level, for rows inside a group. */
  depth?: number;
  muted?: boolean;
  locked?: boolean;
  /** A short type label shown before the name. */
  kind?: string;
  /** Its length can't be trimmed — the bar only moves, and has no edges to drag. */
  fixed?: boolean;
}

export interface UiSequencerMarker {
  at: number;
  label: string;
}

export interface UiSequencerRangeChange {
  rowId: string;
  start: number;
  end: number;
  /** False while dragging, true once on release — commit on true. */
  final: boolean;
}

export interface UiSequencerKeyframeChange {
  rowId: string;
  keyframeId: string;
  at: number;
  final: boolean;
}

export interface UiSequencerKeyframeRef {
  rowId: string;
  keyframeId: string;
  clientX: number;
  clientY: number;
}

type DragKind = 'move' | 'start' | 'end' | 'keyframe' | 'playhead' | 'reorder' | 'lift';

/** How long a bar is held before it lifts and can go anywhere — along the timeline and up or down the layers. */
const LONG_PRESS_MS = 380;
/** How far a finger can wander and still count as holding still, or as a tap. */
const TOUCH_SLOP = 8;
/** How long the name shown after a tap stays up. */
const TIP_MS = 2600;

/**
 * `ui-sequencer` — a timeline editor: one row per layer, a bar for the range each is active, diamonds
 * for its keyframes, a draggable playhead and labelled markers along a ruler.
 *
 * Drag a bar to move it, its edges to trim it, a diamond to retime it (clamped to its bar). Bars,
 * edges and diamonds snap to markers, the playhead and other bars' edges — hold Alt to place freely.
 * Drag a row's grip to reorder. Everything is reported, nothing is mutated: the host owns the rows.
 *
 * Without labels (`showLabels` false) the rows are bars only, the way phone video editors show clips:
 * a tap on a bar selects it and shows its name for a moment; holding a bar lifts it, and then it
 * follows the finger both ways — along the timeline to move it, up or down to reorder. A plain swipe
 * scrolls, two fingers pinch to zoom (Ctrl + wheel with a mouse), and the edges still trim.
 *
 * Keyboard: a focused bar moves with ←/→ (Shift for a larger step) and trims with [ and ]; a focused
 * diamond retimes with ←/→, Delete removes it, and the context-menu key opens its menu.
 */
@Component({
  selector: 'ui-sequencer',
  imports: [NgTemplateOutlet],
  host: {
    class: 'ui-sequencer', '[class.compact]': 'compact()', '[class.no-labels]': '!showLabels()', '[class.lifting]': 'liftedId() !== null',
    '[style.--label-w.px]': 'showLabels() ? labelWidth() : 0', '[style.--row-h.px]': 'rowHeight()',
    '(touchstart)': 'onTouchStart($event)', '(touchmove)': 'onTouchMove($event)', '(touchend)': 'onTouchEnd($event)',
    '(touchcancel)': 'onTouchEnd($event)', '(contextmenu)': 'onContextMenu($event)', '(wheel)': 'onWheel($event)',
  },
  template: `
    <div class="scroller" #scroller>
      <div class="grid" [style.width]="'calc(var(--label-w) + ' + zoom() * 100 + '% - ' + zoom() + ' * var(--label-w))'">
        <!-- Ruler -->
        @if (showLabels()) { <div class="corner">{{ title() }}</div> }
        <div class="ruler" #ruler (pointerdown)="startPlayhead($event)">
          @for (m of markers(); track $index) {
            <span class="marker" [class.end]="pct(m.at) > 88" [style.left.%]="pct(m.at)" [style.width.%]="pct(markerSpan($index))"><span class="mlabel">{{ m.label }}</span></span>
          }
          <span class="playhead-knob" [style.left.%]="pct(playhead())" role="slider" tabindex="0"
            aria-label="Playhead" [attr.aria-valuemin]="0" [attr.aria-valuemax]="length()" [attr.aria-valuenow]="round(playhead())"
            (keydown)="onPlayheadKey($event)"></span>
        </div>

        <!-- Rows -->
        @for (row of rows(); track row.id; let i = $index) {
          @if (showLabels()) {
          <div class="label" [class.selected]="row.id === selectedRowId()" [class.muted]="row.muted"
            [class.drop-before]="dropIndex() === i" [style.padding-left.px]="8 + (row.depth ?? 0) * 14"
            (click)="selectRow(row.id)">
            @if (reorderable()) {
              <span class="grip" title="Drag to reorder" (pointerdown)="startReorder($event, row, i)" aria-hidden="true">⋮⋮</span>
            }
            @if (row.kind) { <span class="kind">{{ row.kind }}</span> }
            <span class="name" [title]="row.label">{{ row.label }}</span>
            <ng-container [ngTemplateOutlet]="toggleButtons" [ngTemplateOutletContext]="{ $implicit: row }" />
          </div>
          }
          <div class="lane" [class.selected]="row.id === selectedRowId()" [class.drop-before]="!showLabels() && dropIndex() === i" (pointerdown)="laneDown($event)">
            @for (m of markers(); track $index) { <span class="gridline" [style.left.%]="pct(m.at)"></span> }
            <div class="bar" tabindex="0" role="button" [attr.data-row]="row.id" [attr.title]="showLabels() ? null : row.label"
              [attr.aria-label]="row.label + ': ' + round(row.start) + ' to ' + round(row.end)"
              [class.selected]="row.id === selectedRowId()" [class.muted]="row.muted" [class.locked]="row.locked" [class.lifted]="liftedId() === row.id"
              [style.left.%]="pct(row.start)" [style.width.%]="pct(row.end - row.start)"
              (pointerdown)="startBar($event, row, 'move')" (keydown)="onBarKey($event, row)" (focus)="selectRow(row.id)">
              @if (!row.fixed) {
                <span class="edge start" (pointerdown)="startBar($event, row, 'start')"></span>
                <span class="edge end" (pointerdown)="startBar($event, row, 'end')"></span>
              }
              @for (k of row.keyframes ?? []; track k.id) {
                <span class="diamond" tabindex="0" role="button"
                  [class.selected]="k.id === selectedKeyframeId()" [style.left.%]="k.at * 100"
                  [attr.aria-label]="'Keyframe ' + (k.label ?? '') + ' at ' + round(k.at * 100) + '%'"
                  [title]="k.label ?? ''"
                  (pointerdown)="startKeyframe($event, row, k)" (keydown)="onKeyframeKey($event, row, k)"
                  (contextmenu)="openKeyframeMenu($event, row, k)"></span>
              }
            </div>
          </div>
        }
        @if (rows().length === 0) {
          <div class="empty">{{ emptyText() }}</div>
        }
        @if (end() !== null && end()! < length()) {
          <div class="beyond" aria-hidden="true" [style.left]="'calc(var(--label-w) + (100% - var(--label-w)) * ' + pct(end()!) / 100 + ')'"></div>
        }
        @if (tip(); as t) {
          @for (row of rows(); track row.id; let i = $index) {
            @if (row.id === t) {
              <div class="tip" role="status" [class.below]="i === 0" [class.from-left]="pct((row.start + row.end) / 2) < 15" [class.from-right]="pct((row.start + row.end) / 2) > 85"
                [style.left]="'calc(var(--label-w) + (100% - var(--label-w)) * ' + pct((row.start + row.end) / 2) / 100 + ')'"
                [style.top.px]="(i === 0 ? i + 2 : i + 1) * rowHeight()">
                @if (row.kind) { <span class="kind">{{ row.kind }}</span> }
                <span class="tip-name">{{ row.label }}</span>
                <ng-container [ngTemplateOutlet]="toggleButtons" [ngTemplateOutletContext]="{ $implicit: row }" />
              </div>
            }
          }
        }
        <div class="playhead-line" aria-hidden="true"
          [style.left]="'calc(var(--label-w) + (100% - var(--label-w)) * ' + pct(playhead()) / 100 + ')'"></div>
        @if (dropIndex() === rows().length) { <div class="drop-end"></div> }
      </div>
    </div>

    <ng-template #toggleButtons let-row>
            <button type="button" class="toggle" [class.on]="row.muted" [attr.aria-pressed]="!!row.muted"
              [attr.aria-label]="(row.muted ? 'Show ' : 'Hide ') + row.label" (click)="$event.stopPropagation(); muteToggle.emit(row.id); keepTip()">
              <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
                @if (row.muted) {
                  <path d="M2 2l12 12M6.5 6.6A2 2 0 0 0 9.4 9.5M4.2 4.3C2.8 5.2 1.8 6.5 1.3 8c1.2 3 4 5 6.7 5 1.3 0 2.5-.4 3.6-1.1M7 3.1c.3 0 .7-.1 1-.1 2.7 0 5.5 2 6.7 5-.3.8-.8 1.6-1.4 2.3" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
                } @else {
                  <path d="M1.3 8C2.5 5 5.3 3 8 3s5.5 2 6.7 5c-1.2 3-4 5-6.7 5S2.5 11 1.3 8z" fill="none" stroke="currentColor" stroke-width="1.4"/><circle cx="8" cy="8" r="2" fill="currentColor"/>
                }
              </svg>
            </button>
            <button type="button" class="toggle lock" [class.on]="row.locked" [attr.aria-pressed]="!!row.locked"
              [attr.aria-label]="(row.locked ? 'Unlock ' : 'Lock ') + row.label" (click)="$event.stopPropagation(); lockToggle.emit(row.id); keepTip()">
              <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
                <rect x="3" y="7" width="10" height="7" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.4"/>
                <path [attr.d]="row.locked ? 'M5 7V5a3 3 0 0 1 6 0v2' : 'M5 7V5a3 3 0 0 1 5.8-1'" fill="none" stroke="currentColor" stroke-width="1.4"/>
              </svg>
            </button>
    </ng-template>
  `,
  styles: `
    :host { display: block; position: relative; min-height: 0; height: 100%; color: var(--ui-color-text);
      font: 12px/1.3 var(--ui-font-default); background: var(--ui-color-surface); user-select: none; }
    .scroller { position: absolute; inset: 0; overflow: auto; }
    .grid { position: relative; display: grid; grid-template-columns: var(--label-w) 1fr; grid-auto-rows: var(--row-h); min-width: 100%; }
    .corner, .label { position: sticky; left: 0; z-index: 2; background: var(--ui-color-surface); border-right: 1px solid var(--ui-color-border); }
    .corner { top: 0; z-index: 4; display: flex; align-items: center; padding: 0 10px; font-weight: 600; color: var(--ui-color-text-muted);
      border-bottom: 1px solid var(--ui-color-border); text-transform: uppercase; letter-spacing: .06em; font-size: 10.5px; }
    .ruler { position: sticky; top: 0; z-index: 3; background: var(--ui-color-surface-subtle); border-bottom: 1px solid var(--ui-color-border); cursor: ew-resize; }
    .marker { position: absolute; top: 0; bottom: 0; border-left: 1px solid var(--ui-color-border-strong); }
    .marker.end .mlabel { left: auto; right: 4px; }
    .mlabel { position: absolute; left: 4px; top: 50%; translate: 0 -50%; max-width: calc(100% - 8px); overflow: hidden; text-overflow: clip;
      white-space: nowrap; color: var(--ui-color-text-muted); font-size: 10.5px; font-family: var(--ui-font-mono); }
    .playhead-knob { position: absolute; bottom: 0; width: 12px; height: 12px; margin-left: -6px; background: var(--ui-color-primary);
      clip-path: polygon(0 0, 100% 0, 100% 55%, 50% 100%, 0 55%); cursor: ew-resize; }
    .playhead-knob:focus-visible { outline: none; box-shadow: var(--ui-focus-ring); }
    .playhead-line { position: absolute; top: var(--row-h); bottom: 0; width: 1.5px; margin-left: -0.75px; background: var(--ui-color-primary); pointer-events: none; z-index: 1; }
    .label { display: flex; align-items: center; gap: 6px; padding-right: 4px; border-bottom: 1px solid var(--ui-color-border-subtle); cursor: pointer; min-width: 0; }
    .label.selected { background: var(--ui-color-selected); }
    .label.muted .name, .label.muted .kind { opacity: .5; }
    .label.drop-before { box-shadow: inset 0 2px 0 var(--ui-color-primary); }
    .grip { cursor: grab; color: var(--ui-color-text-muted); letter-spacing: -2px; font-size: 11px; padding: 0 2px; }
    .kind { flex: none; font-size: 9.5px; text-transform: uppercase; letter-spacing: .05em; color: var(--ui-color-text-muted);
      border: 1px solid var(--ui-color-border); border-radius: var(--ui-radius-xs); padding: 0 4px; }
    .name { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .toggle { flex: none; display: grid; place-items: center; width: 22px; height: 22px; padding: 0; border: 0; border-radius: var(--ui-radius-xs);
      background: transparent; color: var(--ui-color-text-muted); cursor: pointer; opacity: .55; }
    .toggle.on, .label:hover .toggle { opacity: 1; }
    .toggle:hover { background: var(--ui-color-surface-hover); color: var(--ui-color-text); }
    .toggle:focus-visible { outline: none; box-shadow: var(--ui-focus-ring); opacity: 1; }
    .lane { position: relative; border-bottom: 1px solid var(--ui-color-border-subtle); }
    .lane.selected { background: color-mix(in srgb, var(--ui-color-selected) 60%, transparent); }
    .gridline { position: absolute; top: 0; bottom: 0; border-left: 1px dashed var(--ui-color-border-subtle); }
    .bar { position: absolute; top: 5px; bottom: 5px; min-width: 6px; box-sizing: border-box; border-radius: var(--ui-radius-sm);
      background: color-mix(in srgb, var(--ui-color-primary) 22%, var(--ui-color-surface)); border: 1px solid color-mix(in srgb, var(--ui-color-primary) 55%, transparent);
      cursor: grab; }
    .bar.selected { background: color-mix(in srgb, var(--ui-color-primary) 38%, var(--ui-color-surface)); border-color: var(--ui-color-primary); }
    .bar.muted { opacity: .45; }
    .bar.locked { cursor: not-allowed; background-image: repeating-linear-gradient(135deg, transparent 0 5px, color-mix(in srgb, var(--ui-color-text) 8%, transparent) 5px 7px); }
    .bar:focus-visible { outline: none; box-shadow: var(--ui-focus-ring); }
    .edge { position: absolute; top: -2px; bottom: -2px; width: 8px; cursor: ew-resize; z-index: 2; }
    .edge.start { left: -4px; } .edge.end { right: -4px; }
    .bar.locked .edge { display: none; }
    .diamond { position: absolute; top: 50%; width: 10px; height: 10px; margin: -5px 0 0 -5px; rotate: 45deg; box-sizing: border-box;
      background: var(--ui-color-surface); border: 1.5px solid var(--ui-color-primary); cursor: ew-resize; z-index: 1; }
    .diamond.selected { background: var(--ui-color-primary); }
    .diamond:focus-visible { outline: none; box-shadow: var(--ui-focus-ring); }
    .empty { grid-column: 1 / -1; display: flex; align-items: center; justify-content: center; color: var(--ui-color-text-muted); height: calc(var(--row-h) * 2); }
    .drop-end { grid-column: 1 / 2; height: 0; box-shadow: 0 -2px 0 var(--ui-color-primary); }
    .beyond { position: absolute; top: var(--row-h); bottom: 0; right: 0; pointer-events: none; z-index: 1;
      background: repeating-linear-gradient(135deg, color-mix(in srgb, var(--ui-color-text) 5%, transparent) 0 6px, transparent 6px 12px);
      border-left: 1.5px dashed var(--ui-color-border-strong); }
    .tip { position: absolute; z-index: 6; display: flex; align-items: center; gap: 4px; max-width: min(260px, 80vw); translate: -50% calc(-100% - 2px);
      padding: 3px 4px 3px 10px; border-radius: 999px; background: var(--ui-color-surface-raised, var(--ui-color-surface)); color: var(--ui-color-text);
      border: 1px solid var(--ui-color-border); box-shadow: var(--ui-shadow-md, 0 4px 14px rgb(0 0 0 / .18)); white-space: nowrap; animation: tip-in .14s ease-out; }
    .tip.below { translate: -50% 2px; }
    .tip.from-left { translate: -12px calc(-100% - 2px); } .tip.from-left.below { translate: -12px 2px; }
    .tip.from-right { translate: calc(-100% + 12px) calc(-100% - 2px); } .tip.from-right.below { translate: calc(-100% + 12px) 2px; }
    .tip-name { min-width: 0; overflow: hidden; text-overflow: ellipsis; font-weight: 600; }
    .tip .toggle { opacity: 1; }
    @keyframes tip-in { from { opacity: 0; scale: .92; } }
    .bar.lifted { z-index: 5; cursor: grabbing; box-shadow: 0 6px 18px rgb(0 0 0 / .28); scale: 1.04 1.25;
      background: color-mix(in srgb, var(--ui-color-primary) 48%, var(--ui-color-surface)); }
    :host(.lifting) { cursor: grabbing; }
    .lane.drop-before { box-shadow: inset 0 2px 0 var(--ui-color-primary); }

    /* No labels: bars only, the full width to the timeline. */
    :host(.no-labels) .grid { grid-template-columns: minmax(0, 1fr); }
    :host(.no-labels) .drop-end { grid-column: 1 / -1; }
    :host(.no-labels) { -webkit-touch-callout: none; }

    /* Compact: for narrow screens. The label column keeps what identifies a row — its name — and
       drops the type badge and lock toggle, which the host offers elsewhere. */
    :host(.compact) .label .kind, :host(.compact) .label .toggle.lock { display: none; }
    :host(.compact) .grip { padding: 0; }
    :host(.compact) .corner { padding: 0 8px; }

    /* Touch. A finger drag the browser might read as a scroll never reaches pointer events, so each
       draggable part says which directions are its own: the small handles take every direction, and
       the ruler, lanes and bars take sideways drags while leaving vertical ones to scroll the rows. */
    .playhead-knob, .edge, .diamond, .grip { touch-action: none; }
    .ruler, .lane, .bar { touch-action: pan-y; }
    /* Bars-only: a swipe scrolls both ways and a hold lifts a bar, so the browser keeps panning (never pinch, which zooms the timeline). */
    :host(.no-labels) .lane, :host(.no-labels) .bar { touch-action: pan-x pan-y; }
    @media (pointer: coarse) {
      .playhead-knob { width: 18px; height: 18px; margin-left: -9px; }
      .playhead-knob::after, .diamond::after, .grip::after { content: ''; position: absolute; inset: -10px; }
      .grip { position: relative; padding: 0 6px; font-size: 14px; }
      .diamond { width: 14px; height: 14px; margin: -7px 0 0 -7px; }
      /* Outside the bar, so a keyframe diamond sitting at 0% or 100% can't cover them; shown on the selected bar. */
      .edge { width: 22px; } .edge.start { left: -22px; } .edge.end { right: -22px; }
      .bar.selected .edge::before { content: ''; position: absolute; top: 20%; bottom: 20%; width: 4px; border-radius: 2px; background: var(--ui-color-primary); }
      .bar.selected .edge.start::before { right: 3px; } .bar.selected .edge.end::before { left: 3px; }
      .toggle { width: 32px; height: 32px; opacity: 1; }
    }
  `,
})
export class UiSequencer implements OnDestroy {
  private readonly zone = inject(NgZone);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly ruler = viewChild<ElementRef<HTMLElement>>('ruler');

  rows = input<readonly UiSequencerRow[]>([]);
  /** The timeline's length in units. */
  length = input(100);
  markers = input<readonly UiSequencerMarker[]>([]);
  title = input('Layers');
  emptyText = input('Nothing here yet');
  labelWidth = input(200);
  rowHeight = input(30);
  /** Snap distance in screen pixels. */
  snapPixels = input(6);
  /** Keyboard step as a fraction of the length. */
  keyStep = input(0.01);
  reorderable = input(true);
  /** 1 fits the width; larger values zoom in and scroll horizontally. A pinch or Ctrl + wheel changes it. */
  zoom = model(1);
  maxZoom = input(16);
  /** Show the label column (name, grip, toggles). Off: bars only, names on tap. */
  showLabels = input(true);
  /** Where the content ends, if the timeline runs on past it; what's beyond is shaded. */
  end = input<number | null>(null);
  /** Narrow screens: the label column shows the grip, name and visibility toggle only. */
  compact = input(false);

  playhead = model(0);
  selectedRowId = model<string | null>(null);
  selectedKeyframeId = model<string | null>(null);

  readonly rangeChange = output<UiSequencerRangeChange>();
  readonly keyframeChange = output<UiSequencerKeyframeChange>();
  readonly keyframeDelete = output<{ rowId: string; keyframeId: string }>();
  readonly keyframeMenu = output<UiSequencerKeyframeRef>();
  readonly rowReorder = output<{ rowId: string; toIndex: number }>();
  readonly muteToggle = output<string>();
  readonly lockToggle = output<string>();
  /** A click on an empty part of a lane or the ruler, after the playhead moved there. */
  readonly scrub = output<number>();

  protected readonly dropIndex = signal<number | null>(null);
  /** The row whose name is showing after a tap. */
  protected readonly tip = signal<string | null>(null);
  /** The row lifted by a long press, following the pointer both ways. */
  protected readonly liftedId = signal<string | null>(null);
  private readonly scroller = viewChild<ElementRef<HTMLElement>>('scroller');
  private tipTimer: ReturnType<typeof setTimeout> | null = null;
  private pressTimer: ReturnType<typeof setTimeout> | null = null;
  private touch: { id: number; x: number; y: number; rowId: string | null; lane: boolean; moved: boolean } | null = null;
  private pinch: { distance: number; zoom: number; frac: number; anchorX: number } | null = null;
  private lift: {
    row: UiSequencerRow; index: number; x: number; y: number; unitsPerPx: number; rowTop: number;
    scrollLeft: number; scrollTop: number; start: number; moved: boolean;
  } | null = null;

  private drag: {
    kind: DragKind;
    row?: UiSequencerRow;
    keyframe?: UiSequencerKeyframe;
    index?: number;
    startX: number;
    startY: number;
    origStart: number;
    origEnd: number;
    origAt: number;
    unitsPerPx: number;
    pointerId: number;
    moved: boolean;
    last?: { start: number; end: number; at: number };
    rowTop?: number;
  } | null = null;

  private readonly onMove = (e: PointerEvent) => this.move(e);
  private readonly onUp = (e: PointerEvent) => this.up(e);

  /** Width of a marker's stretch, up to the next marker, in timeline units — so its label can't run into the next. */
  protected markerSpan(index: number): number {
    const markers = this.markers();
    const next = markers[index + 1]?.at ?? this.length();
    return Math.max(0, next - markers[index].at);
  }

  protected pct(units: number): number {
    const len = this.length() || 1;
    return (units / len) * 100;
  }

  protected round(v: number): number {
    return Math.round(v);
  }

  protected selectRow(id: string): void {
    this.selectedRowId.set(id);
  }

  // ----- Pointer ------------------------------------------------------------------------------------

  private unitsPerPx(): number {
    const width = this.ruler()?.nativeElement.getBoundingClientRect().width || 1;
    return (this.length() || 1) / width;
  }

  private begin(e: PointerEvent, init: Omit<NonNullable<UiSequencer['drag']>, 'startX' | 'startY' | 'unitsPerPx' | 'pointerId' | 'moved'>): void {
    this.drag = { ...init, startX: e.clientX, startY: e.clientY, unitsPerPx: this.unitsPerPx(), pointerId: e.pointerId, moved: false };
    this.zone.runOutsideAngular(() => {
      window.addEventListener('pointermove', this.onMove);
      window.addEventListener('pointerup', this.onUp);
      window.addEventListener('pointercancel', this.onUp);
    });
  }

  protected startPlayhead(e: PointerEvent): void {
    if (e.button !== 0) return;
    e.preventDefault();
    this.setPlayheadFromPointer(e.clientX);
    this.begin(e, { kind: 'playhead', origStart: 0, origEnd: 0, origAt: 0 });
  }

  protected laneDown(e: PointerEvent): void {
    if (e.button !== 0 || e.target !== e.currentTarget) return;
    // Bars-only on a finger: a swipe over the lanes scrolls, so the playhead moves on a tap instead (see onTouchEnd).
    if (e.pointerType === 'touch' && !this.showLabels()) return;
    this.setPlayheadFromPointer(e.clientX);
    this.scrub.emit(this.playhead());
    this.begin(e, { kind: 'playhead', origStart: 0, origEnd: 0, origAt: 0 });
  }

  protected startBar(e: PointerEvent, row: UiSequencerRow, kind: 'move' | 'start' | 'end'): void {
    if (e.button !== 0) return;
    // Bars-only on a finger: taps, holds and swipes on a bar are touch gestures (see onTouchStart).
    if (kind === 'move' && e.pointerType === 'touch' && !this.showLabels()) return;
    e.stopPropagation();
    this.selectedRowId.set(row.id);
    if (row.locked) {
      if (kind === 'move' && !this.showLabels()) this.showTip(row.id);
      return;
    }
    e.preventDefault();
    this.hideTip();
    this.begin(e, { kind, row, origStart: row.start, origEnd: row.end, origAt: 0 });
    if (kind === 'move' && !this.showLabels()) {
      const drag = this.drag;
      const x = e.clientX, y = e.clientY;
      this.clearPress();
      this.pressTimer = setTimeout(() => {
        if (this.drag !== drag || !drag || drag.moved) return;
        drag.kind = 'lift';
        this.zone.run(() => this.startLift(row, x, y));
      }, LONG_PRESS_MS);
    }
  }

  protected startKeyframe(e: PointerEvent, row: UiSequencerRow, k: UiSequencerKeyframe): void {
    if (e.button !== 0) return;
    e.stopPropagation();
    this.selectedRowId.set(row.id);
    this.selectedKeyframeId.set(k.id);
    if (row.locked) {
      if (!this.showLabels()) this.showTip(row.id);
      return;
    }
    e.preventDefault();
    this.hideTip();
    this.begin(e, { kind: 'keyframe', row, keyframe: k, origStart: row.start, origEnd: row.end, origAt: k.at });
  }

  protected startReorder(e: PointerEvent, row: UiSequencerRow, index: number): void {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    const labelEl = (e.target as HTMLElement).closest('.label') as HTMLElement | null;
    const rowTop = (labelEl?.getBoundingClientRect().top ?? e.clientY) - index * this.rowHeight();
    this.begin(e, { kind: 'reorder', row, index, origStart: 0, origEnd: 0, origAt: 0, rowTop });
  }

  private move(e: PointerEvent): void {
    const d = this.drag;
    if (!d || e.pointerId !== d.pointerId) return;
    if (d.kind === 'lift') {
      d.moved = true;
      this.zone.run(() => this.moveLift(e.clientX, e.clientY, e.altKey));
      return;
    }
    const dxPx = e.clientX - d.startX;
    if (!d.moved) {
      const dyPx = e.clientY - d.startY;
      // A finger needs a clearer sideways intent than a mouse before a bar or diamond starts moving;
      // a mostly vertical drag is the rows being scrolled, which the browser takes over.
      const slop = e.pointerType === 'touch' ? 6 : 2;
      if (Math.abs(dxPx) < slop && Math.abs(dyPx) < slop) return;
      if (e.pointerType === 'touch' && d.kind !== 'reorder' && d.kind !== 'playhead' && Math.abs(dyPx) > Math.abs(dxPx)) return;
    }
    d.moved = true;
    this.clearPress();
    const du = dxPx * d.unitsPerPx;
    const len = this.length();
    const free = e.altKey;

    this.zone.run(() => {
      switch (d.kind) {
        case 'playhead':
          this.setPlayheadFromPointer(e.clientX);
          break;
        case 'move': {
          const span = d.origEnd - d.origStart;
          let start = Math.min(Math.max(0, d.origStart + du), len - span);
          if (!free) {
            const snappedStart = this.snap(start, d.row!.id, d.unitsPerPx);
            const snappedEnd = this.snap(start + span, d.row!.id, d.unitsPerPx);
            if (snappedStart !== start) start = snappedStart;
            else if (snappedEnd !== start + span) start = snappedEnd - span;
            start = Math.min(Math.max(0, start), len - span);
          }
          d.last = { start, end: start + span, at: 0 };
          this.rangeChange.emit({ rowId: d.row!.id, start, end: start + span, final: false });
          break;
        }
        case 'start': {
          let start = Math.min(Math.max(0, d.origStart + du), d.origEnd - d.unitsPerPx * 8);
          if (!free) start = Math.min(this.snap(start, d.row!.id, d.unitsPerPx), d.origEnd - d.unitsPerPx * 8);
          d.last = { start, end: d.origEnd, at: 0 };
          this.rangeChange.emit({ rowId: d.row!.id, start, end: d.origEnd, final: false });
          break;
        }
        case 'end': {
          let end = Math.max(Math.min(len, d.origEnd + du), d.origStart + d.unitsPerPx * 8);
          if (!free) end = Math.max(this.snap(end, d.row!.id, d.unitsPerPx), d.origStart + d.unitsPerPx * 8);
          d.last = { start: d.origStart, end, at: 0 };
          this.rangeChange.emit({ rowId: d.row!.id, start: d.origStart, end, final: false });
          break;
        }
        case 'keyframe': {
          const span = d.origEnd - d.origStart || 1;
          let units = d.origStart + d.origAt * span + du;
          if (!free) units = this.snap(units, null, d.unitsPerPx);
          const at = Math.min(1, Math.max(0, (units - d.origStart) / span));
          d.last = { start: d.origStart, end: d.origEnd, at };
          this.keyframeChange.emit({ rowId: d.row!.id, keyframeId: d.keyframe!.id, at, final: false });
          break;
        }
        case 'reorder': {
          const index = Math.round((e.clientY - (d.rowTop ?? 0)) / this.rowHeight() - 0.5 + 0.5);
          this.dropIndex.set(Math.max(0, Math.min(this.rows().length, index)));
          break;
        }
      }
    });
  }

  private up(e: PointerEvent): void {
    const d = this.drag;
    if (!d || e.pointerId !== d.pointerId) return;
    this.detach();
    this.drag = null;
    this.clearPress();
    if (d.kind === 'lift') {
      this.zone.run(() => (e.type === 'pointercancel' ? this.cancelLift() : this.endLift()));
      return;
    }
    // A click on a bar, bars-only: show whose it is.
    // A tap on a diamond too: phones steer a tap near one onto it, and it's still that bar being asked about.
    if (!d.moved && (d.kind === 'move' || d.kind === 'keyframe') && !this.showLabels() && e.type === 'pointerup') this.zone.run(() => this.showTip(d.row!.id));
    // The browser took the gesture (a scroll): put back whatever was being dragged.
    if (e.type === 'pointercancel' && d.moved && d.last) d.last = { start: d.origStart, end: d.origEnd, at: d.origAt };
    this.zone.run(() => {
      if (e.type === 'pointercancel' && d.kind === 'reorder') this.dropIndex.set(null);
      if (!d.moved) return;
      if ((d.kind === 'move' || d.kind === 'start' || d.kind === 'end') && d.last)
        this.rangeChange.emit({ rowId: d.row!.id, start: d.last.start, end: d.last.end, final: true });
      else if (d.kind === 'keyframe' && d.last)
        this.keyframeChange.emit({ rowId: d.row!.id, keyframeId: d.keyframe!.id, at: d.last.at, final: true });
      else if (d.kind === 'reorder') {
        const to = this.dropIndex();
        this.dropIndex.set(null);
        if (to !== null && to !== d.index && to !== (d.index ?? 0) + 1)
          this.rowReorder.emit({ rowId: d.row!.id, toIndex: to > (d.index ?? 0) ? to - 1 : to });
      } else if (d.kind === 'playhead') this.scrub.emit(this.playhead());
    });
  }

  private setPlayheadFromPointer(clientX: number): void {
    const rect = this.ruler()?.nativeElement.getBoundingClientRect();
    if (!rect) return;
    const units = ((clientX - rect.left) / rect.width) * this.length();
    this.playhead.set(Math.min(this.length(), Math.max(0, units)));
  }

  /** Snaps a position to markers, the playhead and other rows' edges within `snapPixels`. */
  private snap(units: number, excludeRow: string | null, unitsPerPx: number): number {
    const threshold = this.snapPixels() * unitsPerPx;
    const candidates = [0, this.length(), this.playhead(), ...this.markers().map((m) => m.at)];
    if (this.end() !== null) candidates.push(this.end()!);
    for (const r of this.rows()) if (r.id !== excludeRow) candidates.push(r.start, r.end);
    let best = units;
    let bestDist = threshold;
    for (const c of candidates) {
      const dist = Math.abs(c - units);
      if (dist <= bestDist) { best = c; bestDist = dist; }
    }
    return best;
  }

  // ----- Bars only: tap for the name, hold to lift ------------------------------------------------------

  protected showTip(rowId: string): void {
    this.tip.set(rowId);
    this.keepTip();
  }

  protected keepTip(): void {
    if (this.tipTimer) clearTimeout(this.tipTimer);
    this.tipTimer = setTimeout(() => this.tip.set(null), TIP_MS);
  }

  private hideTip(): void {
    if (this.tipTimer) clearTimeout(this.tipTimer);
    this.tip.set(null);
  }

  private clearPress(): void {
    if (this.pressTimer) clearTimeout(this.pressTimer);
    this.pressTimer = null;
  }

  private startLift(row: UiSequencerRow, x: number, y: number): void {
    const index = this.rows().findIndex((r) => r.id === row.id);
    const scroller = this.scroller()?.nativeElement;
    const bar = Array.from(this.host.nativeElement.querySelectorAll<HTMLElement>('.bar')).find((b) => b.dataset['row'] === row.id);
    const laneTop = bar?.parentElement?.getBoundingClientRect().top ?? y;
    this.lift = {
      row, index, x, y, unitsPerPx: this.unitsPerPx(), rowTop: laneTop - index * this.rowHeight(),
      scrollLeft: scroller?.scrollLeft ?? 0, scrollTop: scroller?.scrollTop ?? 0, start: row.start, moved: false,
    };
    this.hideTip();
    this.selectedRowId.set(row.id);
    this.liftedId.set(row.id);
    navigator.vibrate?.(12);
  }

  private moveLift(x: number, y: number, free: boolean): void {
    const l = this.lift;
    if (!l) return;
    const scroller = this.scroller()?.nativeElement;
    // Near an edge, the timeline scrolls under the lifted bar.
    const r = scroller?.getBoundingClientRect();
    if (scroller && r && r.width > 0 && r.height > 0) {
      const edge = 28;
      if (x < r.left + edge) scroller.scrollLeft -= 12;
      else if (x > r.right - edge) scroller.scrollLeft += 12;
      if (y < r.top + this.rowHeight() + edge) scroller.scrollTop -= 8;
      else if (y > r.bottom - edge) scroller.scrollTop += 8;
    }
    const scrolledX = (scroller?.scrollLeft ?? 0) - l.scrollLeft;
    const scrolledY = (scroller?.scrollTop ?? 0) - l.scrollTop;
    const span = l.row.end - l.row.start;
    const len = this.length();
    let start = Math.min(Math.max(0, l.row.start + (x - l.x + scrolledX) * l.unitsPerPx), len - span);
    if (!free) {
      const snappedStart = this.snap(start, l.row.id, l.unitsPerPx);
      const snappedEnd = this.snap(start + span, l.row.id, l.unitsPerPx);
      if (snappedStart !== start) start = snappedStart;
      else if (snappedEnd !== start + span) start = snappedEnd - span;
      start = Math.min(Math.max(0, start), len - span);
    }
    if (start !== l.start) {
      l.start = start;
      l.moved = true;
      this.rangeChange.emit({ rowId: l.row.id, start, end: start + span, final: false });
    }
    // Up or down: only once the bar has left its own row, so a sideways move never reorders by accident.
    const rowTop = l.rowTop - scrolledY;
    const over = (y - rowTop) / this.rowHeight();
    if (Math.abs(y - l.y - scrolledY) < this.rowHeight() * 0.6) this.dropIndex.set(null);
    else this.dropIndex.set(Math.max(0, Math.min(this.rows().length, Math.round(over))));
  }

  private endLift(): void {
    const l = this.lift;
    this.lift = null;
    this.liftedId.set(null);
    if (!l) return;
    const span = l.row.end - l.row.start;
    if (l.moved) this.rangeChange.emit({ rowId: l.row.id, start: l.start, end: l.start + span, final: true });
    const to = this.dropIndex();
    this.dropIndex.set(null);
    if (to !== null && to !== l.index && to !== l.index + 1)
      this.rowReorder.emit({ rowId: l.row.id, toIndex: to > l.index ? to - 1 : to });
  }

  private cancelLift(): void {
    const l = this.lift;
    this.lift = null;
    this.liftedId.set(null);
    this.dropIndex.set(null);
    if (l?.moved) this.rangeChange.emit({ rowId: l.row.id, start: l.row.start, end: l.row.end, final: true });
  }

  // ----- Touch (bars only): taps, holds, swipes and pinches ----------------------------------------------

  protected onTouchStart(e: TouchEvent): void {
    if (this.showLabels()) return;
    if (e.touches.length >= 2) {
      this.clearPress();
      if (this.lift) this.cancelLift();
      this.touch = null;
      this.beginPinch(distance(e.touches[0], e.touches[1]), (e.touches[0].clientX + e.touches[1].clientX) / 2);
      return;
    }
    const t = e.changedTouches[0];
    const target = e.target as Element | null;
    if (!t || !target || target.closest('.edge, .diamond, .playhead-knob, .ruler, .tip, .toggle')) {
      this.touch = null;
      return;
    }
    const bar = target.closest<HTMLElement>('.bar');
    const rowId = bar?.dataset['row'] ?? null;
    this.touch = { id: t.identifier, x: t.clientX, y: t.clientY, rowId, lane: !!target.closest('.lane'), moved: false };
    const row = rowId ? this.rows().find((r) => r.id === rowId) : null;
    this.clearPress();
    if (row && !row.locked) {
      const touch = this.touch;
      this.pressTimer = setTimeout(() => {
        if (this.touch !== touch || touch.moved) return;
        this.zone.run(() => this.startLift(row, touch.x, touch.y));
      }, LONG_PRESS_MS);
    }
  }

  protected onTouchMove(e: TouchEvent): void {
    if (this.showLabels()) return;
    if (this.pinch && e.touches.length >= 2) {
      if (e.cancelable) e.preventDefault();
      this.movePinch(distance(e.touches[0], e.touches[1]) / Math.max(1, this.pinch.distance));
      return;
    }
    const d = this.touch;
    if (!d) return;
    const t = Array.from(e.changedTouches).find((x) => x.identifier === d.id);
    if (!t) return;
    if (this.lift) {
      if (e.cancelable) e.preventDefault();
      this.moveLift(t.clientX, t.clientY, false);
      return;
    }
    if (Math.hypot(t.clientX - d.x, t.clientY - d.y) > TOUCH_SLOP) {
      d.moved = true;
      this.clearPress();
      this.hideTip();
    }
  }

  protected onTouchEnd(e: TouchEvent): void {
    if (this.showLabels()) return;
    if (this.pinch) {
      if (e.touches.length < 2) this.pinch = null;
      return;
    }
    const d = this.touch;
    if (!d || !Array.from(e.changedTouches).some((x) => x.identifier === d.id)) return;
    this.touch = null;
    this.clearPress();
    if (this.lift) {
      if (e.cancelable) e.preventDefault();
      if (e.type === 'touchcancel') this.cancelLift();
      else this.endLift();
      return;
    }
    if (d.moved || e.type !== 'touchend') return;
    if (d.rowId) {
      this.selectedRowId.set(d.rowId);
      this.showTip(d.rowId);
    } else if (d.lane) {
      this.hideTip();
      this.setPlayheadFromPointer(d.x);
      this.scrub.emit(this.playhead());
    }
  }

  /** A held finger opens the browser's menu on some phones; a lifted bar never wants it. */
  protected onContextMenu(e: Event): void {
    if (!this.showLabels() && (this.touch || this.lift || (e.target as Element | null)?.closest('.bar'))) e.preventDefault();
  }

  protected onWheel(e: WheelEvent): void {
    if (!e.ctrlKey && !e.metaKey) return;
    e.preventDefault();
    this.beginPinch(0, e.clientX);
    this.movePinch(Math.exp(-e.deltaY * 0.01));
    this.pinch = null;
  }

  private beginPinch(dist: number, anchorX: number): void {
    const scroller = this.scroller()?.nativeElement;
    const labelW = this.showLabels() ? this.labelWidth() : 0;
    const laneW = Math.max(1, ((scroller?.clientWidth ?? 1) - labelW) * this.zoom());
    const left = scroller?.getBoundingClientRect().left ?? 0;
    const frac = ((scroller?.scrollLeft ?? 0) + anchorX - left - labelW) / laneW;
    this.pinch = { distance: dist, zoom: this.zoom(), frac, anchorX };
    this.hideTip();
  }

  /** Zooms about the pinch's midpoint, so what's under the fingers stays under them. */
  private movePinch(ratio: number): void {
    const p = this.pinch;
    const scroller = this.scroller()?.nativeElement;
    if (!p || !scroller) return;
    const zoom = Math.min(this.maxZoom(), Math.max(1, p.zoom * ratio));
    if (zoom === this.zoom()) return;
    this.zone.run(() => this.zoom.set(zoom));
    const labelW = this.showLabels() ? this.labelWidth() : 0;
    const grid = scroller.firstElementChild as HTMLElement | null;
    // Resize now rather than on the next change detection, so the scroll position can be set in the same frame.
    if (grid) grid.style.width = `calc(var(--label-w) + ${zoom * 100}% - ${zoom} * var(--label-w))`;
    const laneW = (scroller.clientWidth - labelW) * zoom;
    scroller.scrollLeft = p.frac * laneW + labelW - (p.anchorX - scroller.getBoundingClientRect().left);
  }

  // ----- Keyboard -----------------------------------------------------------------------------------

  protected onPlayheadKey(e: KeyboardEvent): void {
    const step = this.length() * this.keyStep() * (e.shiftKey ? 10 : 1);
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      e.preventDefault();
      const next = this.playhead() + (e.key === 'ArrowLeft' ? -step : step);
      this.playhead.set(Math.min(this.length(), Math.max(0, next)));
      this.scrub.emit(this.playhead());
    } else if (e.key === 'Home' || e.key === 'End') {
      e.preventDefault();
      this.playhead.set(e.key === 'Home' ? 0 : this.length());
      this.scrub.emit(this.playhead());
    }
  }

  protected onBarKey(e: KeyboardEvent, row: UiSequencerRow): void {
    if (e.target !== e.currentTarget || row.locked) return;
    const len = this.length();
    const step = len * this.keyStep() * (e.shiftKey ? 10 : 1);
    let start = row.start;
    let end = row.end;
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      const delta = e.key === 'ArrowLeft' ? -step : step;
      const span = end - start;
      start = Math.min(Math.max(0, start + delta), len - span);
      end = start + span;
    } else if (e.key === '[') start = Math.min(Math.max(0, start - step), end - step);
    else if (e.key === ']') end = Math.max(Math.min(len, end + step), start + step);
    else if (e.key === '{') start = Math.min(start + step, end - step);
    else if (e.key === '}') end = Math.max(end - step, start + step);
    else return;
    e.preventDefault();
    this.rangeChange.emit({ rowId: row.id, start, end, final: true });
  }

  protected onKeyframeKey(e: KeyboardEvent, row: UiSequencerRow, k: UiSequencerKeyframe): void {
    e.stopPropagation();
    if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault();
      if (!row.locked) this.keyframeDelete.emit({ rowId: row.id, keyframeId: k.id });
      return;
    }
    if (e.key === 'ContextMenu' || (e.shiftKey && e.key === 'F10')) {
      e.preventDefault();
      const rect = (e.target as HTMLElement).getBoundingClientRect();
      this.keyframeMenu.emit({ rowId: row.id, keyframeId: k.id, clientX: rect.right, clientY: rect.bottom });
      return;
    }
    if ((e.key === 'ArrowLeft' || e.key === 'ArrowRight') && !row.locked) {
      e.preventDefault();
      const delta = (e.shiftKey ? 0.1 : 0.01) * (e.key === 'ArrowLeft' ? -1 : 1);
      this.keyframeChange.emit({ rowId: row.id, keyframeId: k.id, at: Math.min(1, Math.max(0, k.at + delta)), final: true });
    }
  }

  protected openKeyframeMenu(e: MouseEvent, row: UiSequencerRow, k: UiSequencerKeyframe): void {
    e.preventDefault();
    this.selectedRowId.set(row.id);
    this.selectedKeyframeId.set(k.id);
    this.keyframeMenu.emit({ rowId: row.id, keyframeId: k.id, clientX: e.clientX, clientY: e.clientY });
  }

  private detach(): void {
    window.removeEventListener('pointermove', this.onMove);
    window.removeEventListener('pointerup', this.onUp);
    window.removeEventListener('pointercancel', this.onUp);
  }

  ngOnDestroy(): void {
    this.detach();
    this.clearPress();
    if (this.tipTimer) clearTimeout(this.tipTimer);
  }
}

function distance(a: Touch, b: Touch): number {
  return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
}
