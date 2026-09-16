import { Component, computed, signal, viewChild } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { UiTransformBox, UiSnapGuides, uiSnap, uiRotatedBounds, type UiBox, type UiGuide } from '@zouriel/ui/canvas';
import { UiSequencer, type UiSequencerRow } from '@zouriel/ui/sequencer';
import { UiTokenInput, UiNumberInput, type UiTokenRun } from '@zouriel/ui/form';
import { UiMeter } from '@zouriel/ui/progress';
import { UiDeviceFrame } from '@zouriel/ui/media';
import { UiResizeHandle } from '@zouriel/ui/layout';
import { UiButton } from '@zouriel/ui/button';
import { DocPage, DocSection, DocDemo, type ApiRow } from '../docs/docs-ui';

@Component({
  selector: 'page-design-tools',
  imports: [
    DecimalPipe, FormsModule, UiTransformBox, UiSnapGuides, UiSequencer, UiTokenInput, UiNumberInput, UiMeter, UiDeviceFrame,
    UiResizeHandle, UiButton, DocPage, DocSection, DocDemo,
  ],
  template: `
    <doc-page eyebrow="Flagship" title="Design tools"
      lead="The pieces of a visual editor: handles for placing things on a stage, a timeline for when they move, text with inline variables, and the meters and frames around them.">

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

  // Number
  protected nx = 40;
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
  protected readonly sequencerApi: ApiRow[] = [
    { name: 'rows', type: 'UiSequencerRow[]', default: '[]', desc: 'id, label, start, end, keyframes (at 0…1 within the bar), depth, muted, locked, kind.' },
    { name: 'length', type: 'number', default: '100', desc: 'Timeline length in units.' },
    { name: 'markers', type: '{ at, label }[]', default: '[]', desc: 'Ruler markers; also snap targets.' },
    { name: '[(playhead)] / [(selectedRowId)] / [(selectedKeyframeId)]', type: 'model', default: '', desc: 'Two-way state.' },
    { name: 'zoom', type: 'number', default: '1', desc: '1 fits the width; larger zooms in and scrolls.' },
    { name: '(rangeChange)', type: '{ rowId, start, end, final }', default: '', desc: 'Bar moved or trimmed; final on release.' },
    { name: '(keyframeChange)', type: '{ rowId, keyframeId, at, final }', default: '', desc: 'Diamond retimed.' },
    { name: '(keyframeDelete) / (keyframeMenu)', type: 'event', default: '', desc: 'Delete key / right-click or the context-menu key.' },
    { name: '(rowReorder) / (muteToggle) / (lockToggle) / (scrub)', type: 'event', default: '', desc: 'Row grip drop, eye and lock buttons, playhead released.' },
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
