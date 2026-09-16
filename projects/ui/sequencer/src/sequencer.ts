import {
  Component, ElementRef, NgZone, OnDestroy, computed, inject, input, model, output, signal, viewChild,
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

type DragKind = 'move' | 'start' | 'end' | 'keyframe' | 'playhead' | 'reorder';

/**
 * `ui-sequencer` — a timeline editor: one row per layer, a bar for the range each is active, diamonds
 * for its keyframes, a draggable playhead and labelled markers along a ruler.
 *
 * Drag a bar to move it, its edges to trim it, a diamond to retime it (clamped to its bar). Bars,
 * edges and diamonds snap to markers, the playhead and other bars' edges — hold Alt to place freely.
 * Drag a row's grip to reorder. Everything is reported, nothing is mutated: the host owns the rows.
 *
 * Keyboard: a focused bar moves with ←/→ (Shift for a larger step) and trims with [ and ]; a focused
 * diamond retimes with ←/→, Delete removes it, and the context-menu key opens its menu.
 */
@Component({
  selector: 'ui-sequencer',
  host: { class: 'ui-sequencer', '[style.--label-w.px]': 'labelWidth()', '[style.--row-h.px]': 'rowHeight()' },
  template: `
    <div class="scroller" #scroller>
      <div class="grid" [style.width]="'calc(var(--label-w) + ' + zoom() * 100 + '% - ' + zoom() + ' * var(--label-w))'">
        <!-- Ruler -->
        <div class="corner">{{ title() }}</div>
        <div class="ruler" #ruler (pointerdown)="startPlayhead($event)">
          @for (m of markers(); track $index) {
            <span class="marker" [style.left.%]="pct(m.at)"><span class="mlabel">{{ m.label }}</span></span>
          }
          <span class="playhead-knob" [style.left.%]="pct(playhead())" role="slider" tabindex="0"
            aria-label="Playhead" [attr.aria-valuemin]="0" [attr.aria-valuemax]="length()" [attr.aria-valuenow]="round(playhead())"
            (keydown)="onPlayheadKey($event)"></span>
        </div>

        <!-- Rows -->
        @for (row of rows(); track row.id; let i = $index) {
          <div class="label" [class.selected]="row.id === selectedRowId()" [class.muted]="row.muted"
            [class.drop-before]="dropIndex() === i" [style.padding-left.px]="8 + (row.depth ?? 0) * 14"
            (click)="selectRow(row.id)">
            @if (reorderable()) {
              <span class="grip" title="Drag to reorder" (pointerdown)="startReorder($event, row, i)" aria-hidden="true">⋮⋮</span>
            }
            @if (row.kind) { <span class="kind">{{ row.kind }}</span> }
            <span class="name" [title]="row.label">{{ row.label }}</span>
            <button type="button" class="toggle" [class.on]="row.muted" [attr.aria-pressed]="!!row.muted"
              [attr.aria-label]="(row.muted ? 'Show ' : 'Hide ') + row.label" (click)="$event.stopPropagation(); muteToggle.emit(row.id)">
              <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
                @if (row.muted) {
                  <path d="M2 2l12 12M6.5 6.6A2 2 0 0 0 9.4 9.5M4.2 4.3C2.8 5.2 1.8 6.5 1.3 8c1.2 3 4 5 6.7 5 1.3 0 2.5-.4 3.6-1.1M7 3.1c.3 0 .7-.1 1-.1 2.7 0 5.5 2 6.7 5-.3.8-.8 1.6-1.4 2.3" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
                } @else {
                  <path d="M1.3 8C2.5 5 5.3 3 8 3s5.5 2 6.7 5c-1.2 3-4 5-6.7 5S2.5 11 1.3 8z" fill="none" stroke="currentColor" stroke-width="1.4"/><circle cx="8" cy="8" r="2" fill="currentColor"/>
                }
              </svg>
            </button>
            <button type="button" class="toggle" [class.on]="row.locked" [attr.aria-pressed]="!!row.locked"
              [attr.aria-label]="(row.locked ? 'Unlock ' : 'Lock ') + row.label" (click)="$event.stopPropagation(); lockToggle.emit(row.id)">
              <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
                <rect x="3" y="7" width="10" height="7" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.4"/>
                <path [attr.d]="row.locked ? 'M5 7V5a3 3 0 0 1 6 0v2' : 'M5 7V5a3 3 0 0 1 5.8-1'" fill="none" stroke="currentColor" stroke-width="1.4"/>
              </svg>
            </button>
          </div>
          <div class="lane" [class.selected]="row.id === selectedRowId()" (pointerdown)="laneDown($event)">
            @for (m of markers(); track $index) { <span class="gridline" [style.left.%]="pct(m.at)"></span> }
            <div class="bar" tabindex="0" role="button"
              [attr.aria-label]="row.label + ': ' + round(row.start) + ' to ' + round(row.end)"
              [class.selected]="row.id === selectedRowId()" [class.muted]="row.muted" [class.locked]="row.locked"
              [style.left.%]="pct(row.start)" [style.width.%]="pct(row.end - row.start)"
              (pointerdown)="startBar($event, row, 'move')" (keydown)="onBarKey($event, row)" (focus)="selectRow(row.id)">
              <span class="edge start" (pointerdown)="startBar($event, row, 'start')"></span>
              <span class="edge end" (pointerdown)="startBar($event, row, 'end')"></span>
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
        <div class="playhead-line" aria-hidden="true"
          [style.left]="'calc(var(--label-w) + (100% - var(--label-w)) * ' + pct(playhead()) / 100 + ')'"></div>
        @if (dropIndex() === rows().length) { <div class="drop-end"></div> }
      </div>
    </div>
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
    .mlabel { position: absolute; left: 4px; top: 50%; translate: 0 -50%; white-space: nowrap; color: var(--ui-color-text-muted); font-size: 10.5px; font-family: var(--ui-font-mono); }
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
    .edge { position: absolute; top: -2px; bottom: -2px; width: 8px; cursor: ew-resize; }
    .edge.start { left: -4px; } .edge.end { right: -4px; }
    .bar.locked .edge { display: none; }
    .diamond { position: absolute; top: 50%; width: 10px; height: 10px; margin: -5px 0 0 -5px; rotate: 45deg; box-sizing: border-box;
      background: var(--ui-color-surface); border: 1.5px solid var(--ui-color-primary); cursor: ew-resize; z-index: 1; }
    .diamond.selected { background: var(--ui-color-primary); }
    .diamond:focus-visible { outline: none; box-shadow: var(--ui-focus-ring); }
    .empty { grid-column: 1 / -1; display: flex; align-items: center; justify-content: center; color: var(--ui-color-text-muted); height: calc(var(--row-h) * 2); }
    .drop-end { grid-column: 1 / 2; height: 0; box-shadow: 0 -2px 0 var(--ui-color-primary); }
  `,
})
export class UiSequencer implements OnDestroy {
  private readonly zone = inject(NgZone);
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
  /** 1 fits the width; larger values zoom in and scroll horizontally. */
  zoom = input(1);

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
    this.setPlayheadFromPointer(e.clientX);
    this.scrub.emit(this.playhead());
    this.begin(e, { kind: 'playhead', origStart: 0, origEnd: 0, origAt: 0 });
  }

  protected startBar(e: PointerEvent, row: UiSequencerRow, kind: 'move' | 'start' | 'end'): void {
    if (e.button !== 0) return;
    e.stopPropagation();
    this.selectedRowId.set(row.id);
    if (row.locked) return;
    e.preventDefault();
    this.begin(e, { kind, row, origStart: row.start, origEnd: row.end, origAt: 0 });
  }

  protected startKeyframe(e: PointerEvent, row: UiSequencerRow, k: UiSequencerKeyframe): void {
    if (e.button !== 0) return;
    e.stopPropagation();
    this.selectedRowId.set(row.id);
    this.selectedKeyframeId.set(k.id);
    if (row.locked) return;
    e.preventDefault();
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
    const dxPx = e.clientX - d.startX;
    if (!d.moved && Math.abs(dxPx) < 2 && Math.abs(e.clientY - d.startY) < 2) return;
    d.moved = true;
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
    this.zone.run(() => {
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
    for (const r of this.rows()) if (r.id !== excludeRow) candidates.push(r.start, r.end);
    let best = units;
    let bestDist = threshold;
    for (const c of candidates) {
      const dist = Math.abs(c - units);
      if (dist <= bestDist) { best = c; bestDist = dist; }
    }
    return best;
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
  }
}
