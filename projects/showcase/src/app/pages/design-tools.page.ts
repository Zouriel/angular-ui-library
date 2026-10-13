import { Component, computed, signal, viewChild } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  UiPathEditor, UiTransformBox, UiSnapGuides, archContour, ellipseContour, insideContour, pathD, polygonContour, rectContour, starContour,
  uiSnap, uiRotatedBounds, type UiBox, type UiBrushKind, type UiGuide, type UiInkStroke, type UiPathContour, type UiPathEditorMode, type UiPathItem,
} from '@zouriel/ui/canvas';
import { UiScrubber, UiSequencer, type UiSequencerRow } from '@zouriel/ui/sequencer';
import { UiTokenInput, UiNumberInput, UiNumberLabel, type UiTokenRun } from '@zouriel/ui/form';
import { HugeiconsIconComponent } from '@hugeicons/angular';
// One file per icon: importing from the package root makes the bundler read all ~4,000 icons,
// which ran the production build out of memory on the server.
import ArrowExpand01Icon from '@hugeicons/core-free-icons/ArrowExpand01Icon';
import DropletIcon from '@hugeicons/core-free-icons/DropletIcon';
import RotateClockwiseIcon from '@hugeicons/core-free-icons/RotateClockwiseIcon';
import { UiMeter } from '@zouriel/ui/progress';
import { UiDeviceFrame } from '@zouriel/ui/media';
import { UiResizeHandle } from '@zouriel/ui/layout';
import { UiButton, UiSegmented } from '@zouriel/ui/button';
import { DocPage, DocSection, DocDemo, type ApiRow } from '../docs/docs-ui';

@Component({
  selector: 'page-design-tools',
  imports: [
    DecimalPipe, FormsModule, UiTransformBox, UiSnapGuides, UiPathEditor, UiSequencer, UiScrubber, UiTokenInput, UiNumberInput, UiNumberLabel,
    UiMeter, UiDeviceFrame, UiResizeHandle, UiButton, UiSegmented, HugeiconsIconComponent, DocPage, DocSection, DocDemo,
  ],
  template: `
    <doc-page eyebrow="Flagship" title="Design tools"
      lead="The pieces of a visual editor, as used by the invites.blog designer: handles for placing things on a stage, a vector editor for drawing and reshaping outlines, a timeline for when things move, text with inline variables, and the meters and frames around them.">

      <doc-section name="Transform box" selector="ui-transform-box" [api]="transformApi"
        summary="Move, resize and rotate handles for an element on a positioned stage. It never mutates the box — it reports live changes and a final one. Shift keeps proportions and snaps rotation to 15°; Alt resizes from the centre; arrows nudge. Pair with uiSnap() and ui-snap-guides for alignment guides.">
        <doc-demo code="<div class=&quot;stage&quot;>
  <ui-transform-box [box]=&quot;box()&quot; [scale]=&quot;1&quot; showSize
    (transform)=&quot;live($event)&quot; (transformEnd)=&quot;commit($event)&quot; />
  <ui-snap-guides [guides]=&quot;guides()&quot; />
</div>">
          <div class="stage">
            @for (o of others; track $index) {
              <div class="thing" [style.left.px]="o.x" [style.top.px]="o.y" [style.width.px]="o.w" [style.height.px]="o.h"></div>
            }
            <div class="thing mine" [style.left.px]="box().x" [style.top.px]="box().y" [style.width.px]="box().w" [style.height.px]="box().h"
              [style.transform]="'rotate(' + box().rotate + 'deg)'">Drag me</div>
            <ui-transform-box [box]="box()" [showSize]="true" label="Card"
              (transform)="onTransform($event)" (transformEnd)="onTransformEnd($event)" />
            <ui-snap-guides [guides]="guides()" />
          </div>
        </doc-demo>
      </doc-section>

      <doc-section name="Path editor" selector="ui-path-editor" [api]="pathApi" [outputs]="pathOutputs"
        summary="A vector surface for outlines, as in a shape tool. Objects selects, moves, scales and rotates; Points edits points and curve handles (tap an edge to add one, double-tap to switch corner/curve); Pen places points (drag for a curve, tap the first point to close); Draw paints with pressure-sensitive brushes, and holding still at the end of a stroke snaps it to a line, circle, rectangle or triangle. Pinch or wheel zooms. It never changes items itself: each finished edit comes back once through (itemsChange), so the host owns undo.">
        <doc-demo code="<ui-path-editor #editor [items]=&quot;items()&quot; [width]=&quot;400&quot; [height]=&quot;260&quot; [mode]=&quot;mode()&quot; [brush]=&quot;brush()&quot;
  [(selectedId)]=&quot;selectedId&quot; (itemsChange)=&quot;commit($event)&quot; (stroke)=&quot;addStroke($event)&quot; />
<ui-button (click)=&quot;editor.fit()&quot;>Fit</ui-button>">
          <div class="pe-bar">
            <ui-segmented size="sm" label="Mode" [options]="peModes" [value]="peMode()" (valueChange)="peMode.set($any($event))" />
            @if (peMode() === 'draw') {
              <ui-segmented size="sm" label="Brush" [options]="brushes" [value]="brushKind()" (valueChange)="brushKind.set($any($event))" />
            }
            <span class="grow"></span>
            <ui-button size="sm" variant="outline" (click)="addShape('rect')">Rectangle</ui-button>
            <ui-button size="sm" variant="outline" (click)="addShape('ellipse')">Ellipse</ui-button>
            <ui-button size="sm" variant="outline" (click)="addShape('star')">Star</ui-button>
            <ui-button size="sm" variant="ghost" [disabled]="!pathHistory().length" (click)="undoPath()">Undo</ui-button>
            <ui-button size="sm" variant="ghost" (click)="pathEditor.fit()">Fit</ui-button>
          </div>
          <div class="pe-stage">
            <ui-path-editor #pathEditor label="Shape editor demo" [items]="pathItems()" [width]="400" [height]="260" [mode]="peMode()"
              [brush]="{ kind: brushKind(), size: brushKind() === 'marker' ? 12 : 5 }" [(selectedId)]="peSelected"
              (itemsChange)="commitPath($event)" (stroke)="onStroke($event)" />
          </div>
          <p class="note">{{ peHints[peMode()] }}</p>
        </doc-demo>
      </doc-section>

      <doc-section name="Path & ink helpers" selector="@zouriel/ui/canvas" [api]="pathHelpersApi"
        summary="The pure functions under the editor, for building shapes in code, turning them into SVG and reading hand-drawn strokes. An outline is a UiPathContour { points, closed }, where each point may carry in/out curve handles; a UiPathItem is a list of them plus an optional fill and boolean op (cut, intersect, exclude).">
        <doc-demo lang="ts" code="const star = starContour(0, 0, 100, 100, 5, 0.45);
const d = pathD([star]);                 // SVG path data for <path [attr.d]>
const box = pathBounds([star]);          // { x, y, w, h }
const shape = recognizeShape(samples);   // a line, ellipse or polygon, or null for a scribble">
          <div class="shapes">
            @for (s of sampleShapes; track s.name) {
              <figure><svg viewBox="-4 -4 108 108" aria-hidden="true"><path [attr.d]="s.d" /></svg><figcaption>{{ s.name }}</figcaption></figure>
            }
          </div>
        </doc-demo>
      </doc-section>

      <doc-section name="Sequencer" selector="ui-sequencer" [api]="sequencerApi"
        summary="A timeline: a bar per layer for when it's active, diamonds for its keyframes, markers along a ruler and a playhead. Bars, edges and diamonds snap to markers, the playhead and other bars (hold Alt to place freely). Rows reorder by their grip.">
        <doc-demo code="<ui-sequencer [rows]=&quot;rows()&quot; [length]=&quot;1000&quot; [markers]=&quot;markers&quot;
  [(playhead)]=&quot;playhead&quot; (rangeChange)=&quot;onRange($event)&quot; (keyframeChange)=&quot;onKey($event)&quot; />">
          <div class="seq">
            <ui-sequencer [rows]="rows()" [length]="1000" [markers]="markers" [(playhead)]="playhead"
              (rangeChange)="onRange($event)" (keyframeChange)="onKeyframe($event)" (rowReorder)="onReorder($event)"
              (muteToggle)="toggle($event, 'muted')" (lockToggle)="toggle($event, 'locked')" />
          </div>
          <p class="note">Playhead: {{ playhead() | number: '1.0-0' }}</p>
        </doc-demo>
        <doc-demo code="<ui-sequencer [rows]=&quot;rows()&quot; [length]=&quot;1000&quot; [showLabels]=&quot;false&quot; [end]=&quot;700&quot; [(zoom)]=&quot;zoom&quot; ... />">
          <p class="note">Bars only, like a phone video editor: tap a bar for its name, hold it to drag it along or up and down, pinch (or Ctrl + wheel) to zoom. Past <code>end</code> is shaded; with <code>endDraggable</code> the End has a grip — drag it (to the edge to keep going) or use the arrow keys.</p>
          <div class="seq">
            <ui-sequencer [rows]="rows()" [length]="demoLength()" [showLabels]="false" [end]="demoEnd()" [endDraggable]="true" (endChange)="onEnd($event)" [rowHeight]="26" [(playhead)]="playhead"
              (rangeChange)="onRange($event)" (keyframeChange)="onKeyframe($event)" (rowReorder)="onReorder($event)"
              (muteToggle)="toggle($event, 'muted')" (lockToggle)="toggle($event, 'locked')" />
          </div>
        </doc-demo>
      </doc-section>

      <doc-section name="Scrubber" selector="ui-scrubber" [api]="scrubberApi"
        summary="The phone answer to a timeline ruler: the strip slides under a playhead fixed at its centre, so the finger drags content rather than a tiny handle. Flicks glide, two fingers pinch to zoom, and it is a keyboard slider too. Built on touch events, so a sideways drag works on a phone.">
        <doc-demo code="<ui-scrubber [length]=&quot;3376&quot; [markers]=&quot;markers&quot; [ticks]=&quot;ticks&quot; [(value)]=&quot;at&quot; [(zoom)]=&quot;zoom&quot; />">
          <div class="scrub-demo">
            <ui-scrubber [length]="3376" [markers]="scrubMarkers" [ticks]="scrubTicks" [(value)]="scrubAt" [(zoom)]="scrubZoom" label="Scroll position" />
            <span class="mono">{{ scrubAt() | number: '1.0-0' }} · zoom {{ scrubZoom() | number: '1.2-2' }}</span>
            <ui-scrubber [length]="3376" [lanes]="scrubLanes" [end]="2600" [(value)]="scrubAt" [(zoom)]="scrubZoom" label="Layers, flattened — hold to open"
              (longPress)="scrubPresses.set(scrubPresses() + 1)" />
            <span class="mono">long presses: {{ scrubPresses() }}</span>
          </div>
        </doc-demo>
      </doc-section>

      <doc-section name="Token input" selector="ui-token-input" [api]="tokenApi"
        summary="Rich text where variables are atomic chips. Ctrl/⌘+B and I mark text; paste is always plain. insertToken() drops a chip at the caret.">
        <doc-demo code="<ui-token-input #t [(ngModel)]=&quot;runs&quot; [tokenLabel]=&quot;labelFor&quot; />
<ui-button (click)=&quot;t.insertToken('event.date')&quot;>Insert date</ui-button>">
          <ui-token-input #tokens [(ngModel)]="runs" [tokenLabel]="labelFor" placeholder="Type, then insert a variable" />
          <div class="row">
            <ui-button size="sm" variant="outline" (mousedown)="$event.preventDefault()" (click)="tokens.insertToken('guest.name')">+ Guest name</ui-button>
            <ui-button size="sm" variant="outline" (mousedown)="$event.preventDefault()" (click)="tokens.insertToken('event.date')">+ Date</ui-button>
          </div>
          <pre class="json">{{ runsJson() }}</pre>
        </doc-demo>
      </doc-section>

      <doc-section name="Scrubbable number" selector="ui-number-input" [api]="numberApi"
        summary="ui-number-input with a label you drag left and right to change the value — Shift for bigger steps, Alt for finer — plus a unit suffix and rounding.">
        <doc-demo code="<ui-number-input label=&quot;X&quot; suffix=&quot;px&quot; [(ngModel)]=&quot;x&quot; size=&quot;sm&quot; [steppers]=&quot;false&quot; />">
          <div class="row">
            <ui-number-input label="X" suffix="px" size="sm" [steppers]="false" [(ngModel)]="nx" />
            <ui-number-input label="↻" suffix="°" size="sm" [steppers]="false" [min]="-180" [max]="180" [(ngModel)]="nr" ariaLabel="Rotation" />
            <ui-number-input label="α" size="sm" [steppers]="false" [min]="0" [max]="1" [step]="0.01" [precision]="2" [(ngModel)]="na" ariaLabel="Opacity" />
          </div>
        </doc-demo>
        <doc-demo code="<ui-number-input label=&quot;Rotation&quot; suffix=&quot;°&quot; size=&quot;sm&quot; [steppers]=&quot;false&quot; [(ngModel)]=&quot;r&quot; ariaLabel=&quot;Rotation&quot;>
  <hugeicons-icon uiNumberLabel [icon]=&quot;RotateClockwiseIcon&quot; [size]=&quot;14&quot; />
</ui-number-input>">
          <p class="note">An icon instead of a text label: put any element marked <code>uiNumberLabel</code> inside. It scrubs like the label does; keep <code>ariaLabel</code> set for screen readers.</p>
          <div class="row">
            <ui-number-input label="Rotation" suffix="°" size="sm" [steppers]="false" [min]="-180" [max]="180" [(ngModel)]="nr" ariaLabel="Rotation">
              <hugeicons-icon uiNumberLabel [icon]="icons.rotate" [size]="14" [strokeWidth]="1.8" />
            </ui-number-input>
            <ui-number-input label="Scale" size="sm" [steppers]="false" [min]="0" [max]="10" [step]="0.01" [precision]="2" [(ngModel)]="ns" ariaLabel="Scale">
              <hugeicons-icon uiNumberLabel [icon]="icons.scale" [size]="14" [strokeWidth]="1.8" />
            </ui-number-input>
            <ui-number-input label="Opacity" size="sm" [steppers]="false" [min]="0" [max]="1" [step]="0.01" [precision]="2" [(ngModel)]="na" ariaLabel="Opacity">
              <hugeicons-icon uiNumberLabel [icon]="icons.opacity" [size]="14" [strokeWidth]="1.8" />
            </ui-number-input>
          </div>
        </doc-demo>
      </doc-section>

      <doc-section name="Meter" selector="ui-meter" [api]="meterApi"
        summary="A value against a budget. Turns warning and danger past its thresholds, and says so in text as well as colour.">
        <doc-demo code="<ui-meter label=&quot;Size&quot; [value]=&quot;212&quot; [max]=&quot;800&quot; [warnAt]=&quot;300&quot; valueText=&quot;212 KB of 800 KB&quot; />">
          <div class="stack">
            <ui-meter label="Size" [value]="212" [max]="800" [warnAt]="300" valueText="212 KB of 800 KB" />
            <ui-meter label="Size" [value]="420" [max]="800" [warnAt]="300" valueText="420 KB of 800 KB" />
            <ui-meter label="Size" [value]="820" [max]="800" [warnAt]="300" valueText="820 KB of 800 KB" />
          </div>
        </doc-demo>
      </doc-section>

      <doc-section name="Device frame" selector="ui-device-frame" [api]="deviceApi"
        summary="A phone whose screen is exactly width × height CSS pixels, scaled to fit its container. Content lays out at true phone size.">
        <doc-demo code="<ui-device-frame [width]=&quot;390&quot; [height]=&quot;844&quot;> … </ui-device-frame>">
          <div class="device-box">
            <ui-device-frame [width]="390" [height]="844">
              <div class="phone-page"><strong>390 × 844</strong><span>Laid out at phone size</span></div>
            </ui-device-frame>
          </div>
        </doc-demo>
      </doc-section>

      <doc-section name="Resize handle" selector="ui-resize-handle" [api]="resizeApi"
        summary="A draggable panel edge bound to a pixel size, with snap points. Double-click cycles the snaps; arrows resize from the keyboard.">
        <doc-demo code="<ui-resize-handle edge=&quot;top&quot; [(size)]=&quot;height&quot; [min]=&quot;40&quot; [max]=&quot;320&quot; [snaps]=&quot;[40, 160, 320]&quot; />">
          <div class="panel-demo">
            <div class="content">Main area</div>
            <div class="bottom" [style.height.px]="panel()">
              <ui-resize-handle edge="top" [(size)]="panel" [min]="40" [max]="320" [snaps]="[40, 160, 320]" label="Resize panel" />
              <span>{{ panel() }}px</span>
            </div>
          </div>
        </doc-demo>
      </doc-section>
    </doc-page>
  `,
  styles: `
    .pe-bar { display: flex; align-items: center; gap: var(--ui-space-2); flex-wrap: wrap; margin-bottom: var(--ui-space-2); }
    .pe-bar .grow { flex: 1; }
    .pe-stage { height: 340px; border: 1px solid var(--ui-color-border); border-radius: var(--ui-radius); overflow: hidden; background: var(--ui-color-surface-subtle); }
    .pe-stage ui-path-editor { display: block; width: 100%; height: 100%; }
    .shapes { display: flex; flex-wrap: wrap; gap: var(--ui-space-4); }
    .shapes figure { margin: 0; display: grid; justify-items: center; gap: var(--ui-space-1); }
    .shapes svg { width: 72px; height: 72px; overflow: visible; }
    .shapes path { fill: color-mix(in srgb, var(--ui-color-primary) 18%, transparent); stroke: var(--ui-color-primary); stroke-width: 2; vector-effect: non-scaling-stroke; }
    .shapes figcaption { font-size: var(--ui-font-size-sm); color: var(--ui-color-text-muted); }
    .scrub-demo { display: grid; gap: 8px; max-width: 420px; }
    .scrub-demo .mono { font: var(--ui-font-size-sm) var(--ui-font-mono); color: var(--ui-color-text-muted); }
    .stage { position: relative; height: 320px; border-radius: var(--ui-radius); background: var(--ui-color-surface-subtle);
      background-image: radial-gradient(var(--ui-color-border) 1px, transparent 1px); background-size: 20px 20px; overflow: hidden; }
    .thing { position: absolute; border-radius: var(--ui-radius-sm); background: var(--ui-color-surface-raised); border: 1px dashed var(--ui-color-border-strong); }
    .thing.mine { display: grid; place-items: center; background: var(--ui-gradient-frost); border: 0; font-weight: 600; color: var(--ui-color-text); }
    .seq { height: 220px; border: 1px solid var(--ui-color-border); border-radius: var(--ui-radius); overflow: hidden; }
    .note { margin: 8px 0 0; color: var(--ui-color-text-muted); font-size: var(--ui-font-size-sm); }
    .row { display: flex; gap: var(--ui-space-2); flex-wrap: wrap; margin-top: var(--ui-space-2); }
    .row ui-number-input { width: 120px; }
    .stack { display: grid; gap: var(--ui-space-3); max-width: 420px; }
    .json { margin: var(--ui-space-2) 0 0; padding: var(--ui-space-2); background: var(--ui-color-surface-subtle); border-radius: var(--ui-radius-sm); font: 11px/1.4 var(--ui-font-mono); white-space: pre-wrap; }
    .device-box { height: 420px; }
    .phone-page { height: 100%; display: grid; place-content: center; gap: 6px; text-align: center; background: var(--ui-gradient-hero); color: var(--ui-color-text); font-size: 20px; }
    .panel-demo { height: 360px; display: flex; flex-direction: column; border: 1px solid var(--ui-color-border); border-radius: var(--ui-radius); overflow: hidden; }
    .content { flex: 1; display: grid; place-items: center; color: var(--ui-color-text-muted); }
    .bottom { position: relative; display: grid; place-items: center; background: var(--ui-color-surface-subtle); border-top: 1px solid var(--ui-color-border); }
    .bottom ui-resize-handle { position: absolute; top: -4px; left: 0; right: 0; }
  `,
})
export class DesignToolsPage {
  // Transform box
  protected readonly others = [{ x: 40, y: 40, w: 120, h: 90 }, { x: 420, y: 180, w: 160, h: 100 }];
  protected readonly box = signal<UiBox>({ x: 220, y: 90, w: 160, h: 110, rotate: 0 });
  protected readonly guides = signal<readonly UiGuide[]>([]);
  private dragOrigin: UiBox | null = null;

  protected onTransform(next: UiBox): void {
    // Snap only plain moves; a resize or rotation keeps the pointer in charge.
    const prev = this.box();
    if (next.w === prev.w && next.h === prev.h && next.rotate === prev.rotate) {
      const snap = uiSnap(uiRotatedBounds(next), this.others, 6, { vertical: [320], horizontal: [160] });
      this.guides.set(snap.guides);
      this.box.set({ ...next, x: next.x + snap.dx, y: next.y + snap.dy });
      return;
    }
    this.guides.set([]);
    this.box.set(next);
  }

  protected onTransformEnd(next: UiBox): void {
    this.guides.set([]);
    const prev = this.box();
    if (next.w === prev.w && next.h === prev.h && next.rotate === prev.rotate && this.dragOrigin === null) {
      const snap = uiSnap(uiRotatedBounds(next), this.others, 6, { vertical: [320], horizontal: [160] });
      this.box.set({ ...next, x: next.x + snap.dx, y: next.y + snap.dy });
      return;
    }
    this.box.set(next);
  }

  // Sequencer
  protected readonly playhead = signal(180);
  protected readonly markers = [0, 250, 500, 750].map((at, i) => ({ at, label: `Screen ${i + 1}` }));
  protected readonly rows = signal<UiSequencerRow[]>([
    { id: 'bg', label: 'Floral corner', kind: 'svg', start: 0, end: 1000, keyframes: [{ id: 'a', at: 0 }, { id: 'b', at: 1 }] },
    { id: 'date', label: 'Date line', kind: 'text', start: 120, end: 400, keyframes: [{ id: 'c', at: 0 }, { id: 'd', at: 0.15 }, { id: 'e', at: 0.85 }, { id: 'f', at: 1 }] },
    { id: 'photos', label: 'Photo strip', kind: 'slot', start: 380, end: 700, depth: 0 },
    { id: 'rsvp', label: 'RSVP button', kind: 'rsvp', start: 720, end: 1000, keyframes: [{ id: 'g', at: 0 }, { id: 'h', at: 0.2 }] },
  ]);

  protected onRange(e: { rowId: string; start: number; end: number }): void {
    this.rows.update((rows) => rows.map((r) => (r.id === e.rowId ? { ...r, start: e.start, end: e.end } : r)));
  }
  protected onKeyframe(e: { rowId: string; keyframeId: string; at: number }): void {
    this.rows.update((rows) => rows.map((r) => r.id !== e.rowId ? r
      : { ...r, keyframes: (r.keyframes ?? []).map((k) => (k.id === e.keyframeId ? { ...k, at: e.at } : k)) }));
  }
  protected onReorder(e: { rowId: string; toIndex: number }): void {
    this.rows.update((rows) => {
      const list = [...rows];
      const from = list.findIndex((r) => r.id === e.rowId);
      const [row] = list.splice(from, 1);
      list.splice(e.toIndex, 0, row);
      return list;
    });
  }
  protected toggle(id: string, key: 'muted' | 'locked'): void {
    this.rows.update((rows) => rows.map((r) => (r.id === id ? { ...r, [key]: !r[key] } : r)));
  }

  // Token input
  protected runs: UiTokenRun[] = [{ text: 'Join us on ' }, { token: 'event.date' }, { text: ', ' }, { token: 'guest.name', bold: true }];
  private readonly tokenInput = viewChild(UiTokenInput);
  protected readonly labelFor = (t: string) => ({ 'event.date': 'Date', 'guest.name': 'Guest name' } as Record<string, string>)[t] ?? t;
  protected runsJson = () => JSON.stringify(this.runs);

  // Path editor
  protected readonly peModes = [
    { value: 'objects', label: 'Objects' }, { value: 'points', label: 'Points' }, { value: 'pen', label: 'Pen' }, { value: 'draw', label: 'Draw' },
  ];
  protected readonly brushes = [
    { value: 'pen', label: 'Pen' }, { value: 'pencil', label: 'Pencil' }, { value: 'marker', label: 'Marker' },
    { value: 'calligraphy', label: 'Calligraphy' }, { value: 'eraser', label: 'Eraser' },
  ];
  protected readonly peHints: Record<UiPathEditorMode, string> = {
    objects: 'Tap a shape to select it, drag to move, corner knobs scale, the top knob rotates. Shift keeps proportions; arrows nudge; ] and [ step through shapes.',
    points: 'Drag points and handles; tap an edge to add a point; double-tap a point to switch corner/curve; Shift-click or drag a box to select several.',
    pen: 'Tap to place corners, drag to pull out a curve, tap the first point to close the shape (Enter finishes an open line).',
    draw: 'Paint with the brush (pens use pressure). Hold still at the end of a stroke to snap it to a shape. The eraser removes shapes it touches.',
  };
  protected readonly peMode = signal<UiPathEditorMode>('objects');
  protected readonly brushKind = signal<UiBrushKind>('pen');
  protected readonly peSelected = signal<string | null>(null);
  private shapeSeq = 0;
  protected readonly pathItems = signal<UiPathItem[]>([
    { id: 'arch', name: 'Arch', contours: [archContour(40, 40, 120, 180)] },
    { id: 'star', name: 'Star', contours: [starContour(230, 60, 130, 130)] },
  ]);
  protected readonly pathHistory = signal<UiPathItem[][]>([]);

  protected commitPath(items: UiPathItem[]): void {
    this.pathHistory.update((h) => [...h.slice(-49), this.pathItems()]);
    this.pathItems.set(items);
  }
  protected undoPath(): void {
    const h = this.pathHistory();
    if (!h.length) return;
    this.pathItems.set(h[h.length - 1]);
    this.pathHistory.set(h.slice(0, -1));
  }
  protected addShape(kind: 'rect' | 'ellipse' | 'star'): void {
    const n = ++this.shapeSeq;
    const at = 30 + ((n * 37) % 200);
    const contour = kind === 'rect' ? rectContour(at, 70, 110, 80, 12) : kind === 'ellipse' ? ellipseContour(at + 55, 120, 55, 40) : starContour(at, 60, 110, 110);
    const id = `${kind}-${n}`;
    this.commitPath([...this.pathItems(), { id, name: kind, contours: [contour] }]);
    this.peSelected.set(id);
  }
  /** Draw mode reports strokes; the host decides what they become. Here: a snapped shape becomes that
   *  shape, a free stroke becomes its painted area, and the eraser removes shapes it passes over. */
  protected onStroke(s: UiInkStroke): void {
    if (s.brush.kind === 'eraser') {
      const hit = (item: UiPathItem) => s.samples.some((p) => item.contours.some((c) => c.closed && insideContour(c, p)));
      const kept = this.pathItems().filter((item) => !hit(item));
      if (kept.length !== this.pathItems().length) this.commitPath(kept);
      return;
    }
    const id = `ink-${++this.shapeSeq}`;
    let contours: UiPathContour[];
    if (s.shape?.kind === 'ellipse') contours = [ellipseContour(s.shape.cx, s.shape.cy, s.shape.rx, s.shape.ry)];
    else if (s.shape?.kind === 'polygon') contours = [{ closed: true, points: s.shape.points.map((p) => ({ x: p.x, y: p.y })) }];
    else contours = s.pieces.map((piece) => ({ closed: true, points: piece.map((p) => ({ x: p.x, y: p.y })) }));
    this.commitPath([...this.pathItems(), { id, name: 'Drawing', contours }]);
  }
  protected readonly sampleShapes = [
    { name: 'rectContour', d: pathD([rectContour(0, 10, 100, 80, 14)]) },
    { name: 'ellipseContour', d: pathD([ellipseContour(50, 50, 50, 36)]) },
    { name: 'polygonContour', d: pathD([polygonContour(0, 0, 100, 100, 6)]) },
    { name: 'starContour', d: pathD([starContour(0, 0, 100, 100, 5, 0.45)]) },
    { name: 'archContour', d: pathD([archContour(15, 0, 70, 100)]) },
  ];
  protected readonly pathApi: ApiRow[] = [
    { name: 'items', type: 'UiPathItem[]', default: 'required', desc: '{ id, contours, fill?, op?, name? }. Never mutated.' },
    { name: 'width / height', type: 'number', default: '100 / 100', desc: 'The artboard, in editor units; the view fits it on first layout and on fit().' },
    { name: 'mode', type: "'objects' | 'points' | 'pen' | 'draw'", default: "'objects'", desc: 'What a press does.' },
    { name: '[(selectedId)] / [(selectedPoint)] / [(selectedPoints)]', type: 'model', default: 'null / null / []', desc: 'The selected item, the point being worked on, and every selected point.' },
    { name: 'brush', type: 'UiBrush', default: "{ kind: 'pen', size: 4 }", desc: 'pen, marker, pencil, brush, calligraphy or eraser, and its width.' },
    { name: 'fill', type: 'string | null', default: 'null', desc: 'Paint for ink as it goes down and for items the pen makes.' },
    { name: 'fingerDraws', type: "boolean | 'auto'", default: "'auto'", desc: 'After a pen is seen, fingers pan instead of drawing (palm rejection).' },
    { name: 'snapToShape / freeHandles / lockAspect', type: 'boolean', default: 'true / false / false', desc: 'Hold-to-snap strokes; handles move independently (Alt for touch); keep proportions when scaling.' },
    { name: 'showArtboard / label', type: 'boolean / string', default: "true / 'Shape editor'", desc: 'Draw the artboard; accessible name.' },
    { name: 'fit() / zoomBy(f) / selectAllPoints()', type: 'methods', default: '', desc: 'View and selection helpers.' },
    { name: 'finishPen(closed) / undoPenPoint() / cancelPen()', type: 'methods', default: '', desc: 'Pen-mode controls for a toolbar.' },
  ];
  protected readonly pathOutputs: ApiRow[] = [
    { name: 'itemsChange', type: 'UiPathItem[]', desc: 'A finished edit: the whole list, for the host to keep (and undo).' },
    { name: 'stroke', type: 'UiInkStroke', desc: 'A finished draw-mode stroke: samples, brush, painted pieces, and the snapped shape if any.' },
    { name: 'pointTap', type: 'UiPointRef', desc: 'A point was tapped (not dragged), e.g. to pick ends to join.' },
    { name: 'penDetected', type: 'void', desc: 'A pen touched the surface for the first time.' },
  ];
  protected readonly pathHelpersApi: ApiRow[] = [
    { name: 'rectContour / ellipseContour / polygonContour / starContour / archContour', type: '(x, y, w, h, …) => UiPathContour', default: '', desc: 'Ready-made outlines (rect takes a corner radius; star spikes and inner ratio).' },
    { name: 'pathD(contours) / segmentPathD(contour, i)', type: 'string', default: '', desc: 'SVG path data for a whole item, or one segment.' },
    { name: 'pathBounds / flattenContour / contourArea / insideContour', type: 'measure', default: '', desc: 'Bounding box, a polyline approximation, signed area, point-in-outline.' },
    { name: 'translateContours / scaleContours / rotateContours / mapContours', type: 'transform', default: '', desc: 'Return moved copies; inputs are never mutated.' },
    { name: 'insertPoint / deletePoint(s) / movePoint(s) / moveHandle / pullHandles', type: 'edit points', default: '', desc: 'What the editor does on each gesture, available to toolbars and keyboard shortcuts.' },
    { name: 'toggleSmooth / toggleClosed / breakAt / joinEnds / reverseContour / orientContours', type: 'edit outlines', default: '', desc: 'Corner/curve, open/close, cut and join, direction for fill rules.' },
    { name: 'nearestOnPath / pointOnSegment / segmentCount / allPoints', type: 'query', default: '', desc: 'Hit-testing and walking an outline.' },
    { name: 'recognizeShape(samples)', type: 'UiInkShape | null', default: '', desc: 'Reads a stroke as a line, ellipse or polygon (rectangle, triangle…), or null.' },
    { name: 'inkArea / inkD / inkRadii / shapeSamples / thinSamples', type: 'ink', default: '', desc: 'Turn pressure samples into a painted outline, and a recognised shape back into samples.' },
    { name: 'brushSteadiness / brushUsesPressure / simulatedPressure', type: 'brush', default: '', desc: 'How each brush smooths and responds; pressure from speed for a mouse or finger.' },
  ];
  protected readonly icons = { rotate: RotateClockwiseIcon, scale: ArrowExpand01Icon, opacity: DropletIcon };

  // Number
  protected nx = 40;
  protected ns = 1;
  protected nr = 0;
  protected na = 1;

  // Resize
  protected readonly panel = signal(160);

  protected readonly transformApi: ApiRow[] = [
    { name: 'box', type: 'UiBox', default: 'required', desc: 'x, y, w, h and rotate (degrees) in stage units.' },
    { name: 'scale', type: 'number', default: '1', desc: 'Screen pixels per stage unit.' },
    { name: 'resizable / rotatable', type: 'boolean', default: 'true', desc: 'Show resize handles / the rotation knob.' },
    { name: 'lockAspect', type: 'boolean', default: 'false', desc: 'Always keep proportions (Shift does it per drag).' },
    { name: 'minSize', type: 'number', default: '4', desc: 'Smallest width and height, in units.' },
    { name: 'cornersOnly', type: 'boolean', default: 'false', desc: 'Only the four corner handles.' },
    { name: 'showSize', type: 'boolean', default: 'false', desc: 'Show a W × H readout.' },
    { name: '(transform) / (transformEnd)', type: 'UiBox', default: '', desc: 'Every pointer move / once on release or a key nudge.' },
    { name: '(activate)', type: 'void', default: '', desc: 'Double-click — e.g. start editing text.' },
    { name: 'uiSnap(moving, targets, threshold, extra?)', type: 'function', default: '', desc: 'Edges-and-centres snapping; returns { dx, dy, guides }.' },
  ];
  protected readonly demoEnd = signal(700);
  protected readonly demoLength = signal(1000);
  protected onEnd(e: { end: number; final: boolean }): void {
    this.demoEnd.set(Math.round(e.end));
    if (e.end > this.demoLength() - 40) this.demoLength.update((l) => l + 200);
    if (e.final) this.demoLength.set(Math.max(1000, Math.round(e.end) + 200));
  }
  protected readonly sequencerApi: ApiRow[] = [
    { name: 'rows', type: 'UiSequencerRow[]', default: '[]', desc: 'id, label, start, end, keyframes (at 0…1 within the bar), depth, muted, locked, kind, fixed (no trim edges).' },
    { name: 'showLabels', type: 'boolean', default: 'true', desc: 'Off: bars only. Tap a bar for its name (with hide/lock), hold to lift it and drag both ways, pinch to zoom.' },
    { name: 'end', type: 'number | null', default: 'null', desc: 'Where the content ends; the rest of the timeline is shaded.' },
    { name: 'endDraggable', type: 'boolean', default: 'false', desc: 'Give the End a grip; drags and arrow keys report (endChange) {end, final}, not clamped to length so the host can grow it.' },
    { name: 'length', type: 'number', default: '100', desc: 'Timeline length in units.' },
    { name: 'markers', type: '{ at, label }[]', default: '[]', desc: 'Ruler markers; also snap targets.' },
    { name: '[(playhead)] / [(selectedRowId)] / [(selectedKeyframeId)]', type: 'model', default: '', desc: 'Two-way state.' },
    { name: 'zoom / maxZoom', type: 'number (model) / number', default: '1 / 16', desc: '1 fits the width; larger zooms in and scrolls. Pinch or Ctrl + wheel changes it — [(zoom)].' },
    { name: '(rangeChange)', type: '{ rowId, start, end, final }', default: '', desc: 'Bar moved or trimmed; final on release.' },
    { name: '(keyframeChange)', type: '{ rowId, keyframeId, at, final }', default: '', desc: 'Diamond retimed.' },
    { name: '(keyframeDelete) / (keyframeMenu)', type: 'event', default: '', desc: 'Delete key / right-click or the context-menu key.' },
    { name: '(rowReorder) / (muteToggle) / (lockToggle) / (scrub)', type: 'event', default: '', desc: 'Row grip drop, eye and lock buttons, playhead released.' },
  ];
  protected readonly scrubAt = signal(600);
  protected readonly scrubZoom = signal(0.25);
  protected readonly scrubMarkers = [{ at: 0, label: 'Screen 1' }, { at: 844, label: 'Screen 2' }, { at: 1688, label: 'Screen 3' }, { at: 2532, label: 'Screen 4' }];
  protected readonly scrubTicks = [{ at: 400 }, { at: 900 }, { at: 1800, active: true }];
  protected readonly scrubLanes = [{ start: 0, end: 900 }, { start: 300, end: 1500, selected: true }, { start: 1200, end: 2100 }, { start: 1700, end: 2600 }];
  protected readonly scrubPresses = signal(0);
  protected readonly scrubberApi: ApiRow[] = [
    { name: 'length', type: 'number', default: '100', desc: 'Length in units.' },
    { name: 'value', type: 'number (model)', default: '0', desc: 'Position under the playhead — [(value)].' },
    { name: 'zoom', type: 'number (model)', default: '0.25', desc: 'Pixels per unit; a pinch changes it — [(zoom)].' },
    { name: 'markers', type: '{ at, label }[]', default: '[]', desc: 'Labelled segments along the strip.' },
    { name: 'ticks', type: '{ at, active? }[]', default: '[]', desc: 'Points of interest, e.g. keyframes.' },
    { name: 'lanes', type: '{ start, end, selected?, muted? }[]', default: '[]', desc: 'Layers as thin stacked lines — a flattened timeline.' },
    { name: 'end', type: 'number | null', default: 'null', desc: 'Where the content ends; shaded after.' },
    { name: '(longPress)', type: 'void', default: '—', desc: 'Held still; the value is put back. E.g. open the full timeline.' },
    { name: 'label / valueText', type: 'string', default: "'Position' / ''", desc: 'Slider name and spoken value.' },
    { name: 'minZoom / maxZoom', type: 'number', default: '0.02 / 4', desc: 'Pinch limits.' },
    { name: '(settle)', type: 'number', default: '—', desc: 'Once, when a drag, glide, wheel or key change comes to rest.' },
  ];
  protected readonly tokenApi: ApiRow[] = [
    { name: 'ngModel', type: 'UiTokenRun[]', default: '[]', desc: '{ text } or { token }, each optionally bold / italic.' },
    { name: 'tokenLabel', type: '(token) => string', default: 'identity', desc: 'What a chip shows.' },
    { name: 'multiline', type: 'boolean', default: 'true', desc: 'Enter inserts a line break; off keeps one line.' },
    { name: 'insertToken(token)', type: 'method', default: '', desc: 'Insert a chip at the caret (or the end).' },
    { name: '(tokenClick)', type: 'string', default: '', desc: 'A chip was clicked.' },
  ];
  protected readonly numberApi: ApiRow[] = [
    { name: 'label', type: 'string', default: "''", desc: 'Drag-to-scrub prefix.' },
    { name: 'suffix', type: 'string', default: "''", desc: 'Unit after the number.' },
    { name: 'precision', type: 'number | null', default: 'null', desc: 'Decimal places kept.' },
    { name: 'steppers', type: 'boolean', default: 'true', desc: 'Show ▲▼.' },
    { name: '[uiNumberLabel]', type: 'directive', default: '', desc: 'Mark a projected icon to show (and scrub) in place of the text label.' },
  ];
  protected readonly meterApi: ApiRow[] = [
    { name: 'value / max', type: 'number', default: '0 / 100', desc: 'The measurement and the scale.' },
    { name: 'warnAt / dangerAt', type: 'number | null', default: 'null / max', desc: 'Thresholds.' },
    { name: 'label / valueText', type: 'string', default: "''", desc: 'Heading and how the value is written.' },
    { name: 'warnText / dangerText', type: 'string', default: '', desc: 'Said alongside the colour.' },
  ];
  protected readonly deviceApi: ApiRow[] = [
    { name: 'width / height', type: 'number', default: '390 / 844', desc: 'Screen size in CSS pixels.' },
    { name: 'bezel / island', type: 'boolean', default: 'true', desc: 'Draw the phone body / the camera island.' },
    { name: 'maxScale', type: 'number', default: '1', desc: 'Never scale above this.' },
    { name: 'scale', type: 'Signal<number>', default: '', desc: 'Current scale, for overlays.' },
  ];
  protected readonly resizeApi: ApiRow[] = [
    { name: '[(size)]', type: 'number', default: '240', desc: 'Panel size in px.' },
    { name: 'edge', type: "'top' | 'bottom' | 'left' | 'right'", default: "'top'", desc: 'Where the handle sits on the panel.' },
    { name: 'min / max / snaps', type: 'number / number[]', default: '', desc: 'Bounds and snap points.' },
    { name: '(resizeEnd)', type: 'number', default: '', desc: 'After a drag, double-click or key.' },
  ];

  protected readonly unused = computed(() => this.tokenInput());
}
