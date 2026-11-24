import { DOCUMENT } from '@angular/common';
import {
  ChangeDetectionStrategy, Component, ElementRef, afterNextRender, computed, effect, forwardRef,
  inject, input, signal, viewChild,
} from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { HugeiconsIconComponent } from '@hugeicons/angular';
import ArrowTurnBackwardIcon from '@hugeicons/core-free-icons/ArrowTurnBackwardIcon';
import Delete02Icon from '@hugeicons/core-free-icons/Delete02Icon';
import { injectUiStrings } from '@zouriel/ui';
import { UiButton } from '@zouriel/ui/button';
import { UiFileUpload } from './file-upload';

/** Value emitted by `ui-signature-pad` via ControlValueAccessor. */
export interface UiSignatureValue {
  kind: 'signature' | 'thumbprint';
  /** PNG data URL on a white background, trimmed to the ink. */
  dataUrl: string;
  width: number;
  height: number;
  /** ISO 8601 capture timestamp. */
  capturedAt: string;
  /** Number of strokes (signature mode only). */
  strokes?: number;
}

/** One sampled point along a signature stroke. */
export interface UiSignaturePoint {
  x: number;
  y: number;
  pressure: number;
}

/** Minimum total ink path length (px) required before a signature counts as non-empty. */
export const UI_SIGNATURE_MIN_INK_LENGTH = 24;

/** Computes the stroke width for a pointer sample, varying with pressure when reported. */
export function uiSignatureStrokeWidth(baseWidth: number, pressure: number, pointerType: string): number {
  if (pointerType === 'pen' || (pressure > 0 && pressure !== 0.5)) {
    const clamped = Math.max(0.1, Math.min(1, pressure));
    return Math.max(0.5, baseWidth * (0.5 + clamped));
  }
  return baseWidth;
}

/** Total Euclidean path length across all strokes. */
export function uiSignatureInkLength(strokes: readonly (readonly UiSignaturePoint[])[]): number {
  let total = 0;
  for (const stroke of strokes) {
    for (let i = 1; i < stroke.length; i++) {
      const dx = stroke[i].x - stroke[i - 1].x;
      const dy = stroke[i].y - stroke[i - 1].y;
      total += Math.hypot(dx, dy);
    }
  }
  return total;
}

/** Trimmed bounding box of all signature strokes, padded and clamped to the pad dimensions. */
export function uiSignatureTrimBounds(
  strokes: readonly (readonly UiSignaturePoint[])[],
  padWidth: number,
  padHeight: number,
  padding = 8,
): { x: number; y: number; width: number; height: number } | null {
  if (padWidth <= 0 || padHeight <= 0) return null;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let count = 0;
  for (const stroke of strokes) {
    for (const p of stroke) {
      count++;
      if (p.x < minX) minX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.x > maxX) maxX = p.x;
      if (p.y > maxY) maxY = p.y;
    }
  }
  if (count === 0) return null;
  const x = Math.max(0, Math.floor(minX - padding));
  const y = Math.max(0, Math.floor(minY - padding));
  const right = Math.min(padWidth, Math.ceil(maxX + padding));
  const bottom = Math.min(padHeight, Math.ceil(maxY + padding));
  const width = Math.max(1, right - x);
  const height = Math.max(1, bottom - y);
  return { x, y, width, height };
}

/** Draws smoothed quadratic strokes onto a 2D canvas context. */
export function uiDrawSignatureStrokes(
  ctx: CanvasRenderingContext2D,
  strokes: readonly (readonly UiSignaturePoint[])[],
  baseWidth: number,
  inkColor: string,
  pointerType = 'pen',
  offsetX = 0,
  offsetY = 0,
): void {
  ctx.strokeStyle = inkColor;
  ctx.fillStyle = inkColor;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  for (const stroke of strokes) {
    if (stroke.length === 0) continue;
    if (stroke.length === 1) {
      const p = stroke[0];
      const r = uiSignatureStrokeWidth(baseWidth, p.pressure, pointerType) / 2;
      ctx.beginPath();
      ctx.arc(p.x - offsetX, p.y - offsetY, r, 0, Math.PI * 2);
      ctx.fill();
      continue;
    }
    for (let i = 1; i < stroke.length; i++) {
      const prev = stroke[i - 1];
      const curr = stroke[i];
      const prevMidX = i === 1 ? prev.x : (stroke[i - 2].x + prev.x) / 2;
      const prevMidY = i === 1 ? prev.y : (stroke[i - 2].y + prev.y) / 2;
      const midX = i === stroke.length - 1 ? curr.x : (prev.x + curr.x) / 2;
      const midY = i === stroke.length - 1 ? curr.y : (prev.y + curr.y) / 2;

      ctx.beginPath();
      ctx.lineWidth = uiSignatureStrokeWidth(baseWidth, (prev.pressure + curr.pressure) / 2, pointerType);
      ctx.moveTo(prevMidX - offsetX, prevMidY - offsetY);
      ctx.quadraticCurveTo(prev.x - offsetX, prev.y - offsetY, midX - offsetX, midY - offsetY);
      ctx.stroke();
    }
  }
}

let nextId = 0;

/**
 * `ui-signature-pad` — captures a handwritten signature on a fixed-ink/paper canvas, or attaches
 * a thumbprint photo via `ui-file-upload` (`capture="environment"`). Implements `ControlValueAccessor`
 * with `UiSignatureValue | null`.
 */
@Component({
  selector: 'ui-signature-pad',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [HugeiconsIconComponent, UiButton, UiFileUpload],
  providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => UiSignaturePad), multi: true }],
  template: `
    <div class="root" [class.invalid]="invalid()" [class.disabled]="isDisabled()">
      @if (description(); as desc) {
        <span class="sr" [id]="descId">{{ desc }}</span>
      }
      @if (mode() === 'signature') {
        <div class="pad-box" [style.height.px]="height()">
          <canvas
            #pad
            class="pad"
            role="img"
            [attr.aria-label]="ariaName()"
            [attr.aria-describedby]="description() ? descId : null"
            [attr.aria-disabled]="isDisabled() ? 'true' : null"
            (pointerdown)="onPointerDown($event)"
            (pointermove)="onPointerMove($event)"
            (pointerup)="onPointerUp($event)"
            (pointercancel)="onPointerCancel($event)"
          ></canvas>
          @if (!hasInk()) {
            <div class="baseline" aria-hidden="true">
              <span class="sign-here">{{ strings.signHere }}</span>
              <span class="rule"></span>
            </div>
          }
        </div>
        <div class="actions">
          <ui-button
            variant="ghost"
            size="sm"
            [disabled]="isDisabled() || !canUndo()"
            (click)="undo()"
          >
            <hugeicons-icon [icon]="undoIcon" [size]="16" [strokeWidth]="1.8" />
            {{ strings.signatureUndo }}
          </ui-button>
          <ui-button
            variant="ghost"
            size="sm"
            [disabled]="isDisabled() || !hasInk()"
            (click)="clear()"
          >
            <hugeicons-icon [icon]="clearIcon" [size]="16" [strokeWidth]="1.8" />
            {{ strings.signatureClear }}
          </ui-button>
        </div>
      } @else {
        <div class="thumbprint" [attr.aria-label]="ariaName()" [attr.aria-describedby]="description() ? descId : null">
          <ui-file-upload
            accept="image/*"
            capture="environment"
            [cameraAction]="thumbPreview() ? null : 'environment'"
            [cameraLabel]="strings.thumbprintTake"
            [preview]="thumbPreview()"
            [previewAlt]="ariaName()"
            previewAspect="1"
            previewFit="cover"
            [replaceLabel]="strings.thumbprintRetake"
            [removable]="true"
            [removeLabel]="strings.signatureClear"
            [showFiles]="false"
            [disabled]="isDisabled()"
            (filesSelected)="onThumbSelected($event)"
            (remove)="clear()"
          />
        </div>
      }
    </div>
  `,
  styles: `
    :host { display: block; font-family: var(--ui-font-default); }
    .root { display: flex; flex-direction: column; gap: var(--ui-space-2); }
    .pad-box {
      position: relative;
      width: 100%;
      border: 1px solid var(--ui-control-border);
      border-radius: var(--ui-radius);
      background: var(--ui-signature-paper);
      overflow: hidden;
      transition: border-color var(--ui-motion-fast) var(--ui-ease-standard);
    }
    .root.invalid .pad-box { border-color: var(--ui-color-danger); }
    .root.disabled .pad-box { opacity: 0.6; cursor: not-allowed; }
    .pad {
      display: block;
      width: 100%;
      height: 100%;
      touch-action: none;
      cursor: crosshair;
    }
    .root.disabled .pad { cursor: not-allowed; pointer-events: none; }
    .baseline {
      position: absolute;
      inset-inline: var(--ui-space-4);
      bottom: var(--ui-space-5);
      display: flex;
      flex-direction: column;
      gap: var(--ui-space-1);
      pointer-events: none;
      user-select: none;
    }
    .sign-here {
      font-size: var(--ui-font-size-xs);
      color: var(--ui-signature-ink);
      opacity: 0.55;
      text-align: start;
    }
    .rule {
      display: block;
      width: 100%;
      border-bottom: 1px dashed var(--ui-signature-ink);
      opacity: 0.25;
    }
    .actions {
      display: flex;
      align-items: center;
      justify-content: flex-end;
      gap: var(--ui-space-2);
    }
    .thumbprint { max-width: 240px; }
    .sr {
      position: absolute;
      width: 1px;
      height: 1px;
      margin: -1px;
      padding: 0;
      overflow: hidden;
      clip: rect(0 0 0 0);
      clip-path: inset(50%);
      white-space: nowrap;
      border: 0;
    }
  `,
})
export class UiSignaturePad implements ControlValueAccessor {
  private readonly doc = inject(DOCUMENT);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  protected readonly strings = injectUiStrings();
  protected readonly undoIcon = ArrowTurnBackwardIcon;
  protected readonly clearIcon = Delete02Icon;
  protected readonly descId = `ui-sig-desc-${nextId++}`;

  private readonly padRef = viewChild<ElementRef<HTMLCanvasElement>>('pad');

  /** `'signature'` (pointer canvas) or `'thumbprint'` (reuses `ui-file-upload` with `capture="environment"`). */
  mode = input<'signature' | 'thumbprint'>('signature');
  /** Height of the signature pad in px. Width follows the parent. */
  height = input(180);
  /** Base stroke width in px; varies with pointer pressure where reported. */
  penWidth = input(2.5);
  /** Accessible name for the pad or thumbprint control. */
  label = input<string | undefined>(undefined);
  /** Optional accessible description linked via `aria-describedby`. */
  description = input<string | undefined>(undefined);
  /** Disables drawing and actions. */
  disabled = input(false);
  /** Marks the pad border as invalid. */
  invalid = input(false);

  private readonly cvaDisabled = signal(false);
  protected readonly isDisabled = computed(() => this.disabled() || this.cvaDisabled());
  protected readonly ariaName = computed(() => this.label() || this.strings.signHere);

  private readonly strokes = signal<UiSignaturePoint[][]>([]);
  private readonly currentStroke = signal<UiSignaturePoint[] | null>(null);
  private readonly currentValue = signal<UiSignatureValue | null>(null);
  private activePointerId: number | null = null;
  private lastPointerType = 'mouse';

  protected readonly hasInk = computed(() =>
    this.strokes().length > 0 || (this.currentStroke()?.length ?? 0) > 0 || this.currentValue() !== null,
  );
  protected readonly canUndo = computed(() => this.strokes().length > 0);
  protected readonly thumbPreview = computed(() => {
    const v = this.currentValue();
    return v?.kind === 'thumbprint' ? v.dataUrl : null;
  });

  private onChange: (value: UiSignatureValue | null) => void = () => {};
  private onTouched: () => void = () => {};

  constructor() {
    afterNextRender(() => this.syncCanvasSize());
    effect(() => {
      this.mode();
      this.height();
      queueMicrotask(() => {
        this.syncCanvasSize();
        this.redraw();
      });
    });
  }

  writeValue(value: UiSignatureValue | null): void {
    this.currentValue.set(value ?? null);
    this.strokes.set([]);
    this.currentStroke.set(null);
    this.redraw();
  }

  registerOnChange(fn: (value: UiSignatureValue | null) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.cvaDisabled.set(isDisabled);
  }

  /** Returns true when no valid signature or thumbprint is present (under minimum ink length counts as empty). */
  isEmpty(): boolean {
    if (this.mode() === 'thumbprint') {
      return this.currentValue()?.kind !== 'thumbprint';
    }
    if (this.currentValue()?.kind === 'signature' && this.strokes().length === 0) {
      return false;
    }
    return uiSignatureInkLength(this.strokes()) < UI_SIGNATURE_MIN_INK_LENGTH;
  }

  /** Clears all strokes or the attached thumbprint and emits `null`. */
  clear(): void {
    this.strokes.set([]);
    this.currentStroke.set(null);
    this.activePointerId = null;
    this.currentValue.set(null);
    this.redraw();
    this.onChange(null);
    this.onTouched();
  }

  /** Removes the last stroke and updates the emitted value (or emits `null` if under minimum ink). */
  undo(): void {
    if (this.mode() !== 'signature') return;
    const list = this.strokes();
    if (list.length === 0) return;
    const next = list.slice(0, -1);
    this.strokes.set(next);
    this.redraw();
    this.emitSignature(next);
    this.onTouched();
  }

  /** Exports the current trimmed signature/thumbprint as a PNG `Blob`, or `null` when empty. */
  async toBlob(): Promise<Blob | null> {
    if (this.isEmpty()) return null;
    if (this.mode() === 'thumbprint') {
      const val = this.currentValue();
      if (!val) return null;
      const res = await fetch(val.dataUrl);
      return res.blob();
    }
    const canvas = this.buildTrimmedCanvas(this.strokes());
    if (!canvas) return null;
    return new Promise((resolve) => canvas.toBlob((blob) => resolve(blob), 'image/png'));
  }

  protected onPointerDown(e: PointerEvent): void {
    if (this.isDisabled() || e.button > 0) return;
    const canvas = this.padRef()?.nativeElement;
    if (!canvas) return;
    this.syncCanvasSize();
    this.activePointerId = e.pointerId;
    this.lastPointerType = e.pointerType || 'mouse';
    canvas.setPointerCapture?.(e.pointerId);
    const pt = this.pointFromEvent(canvas, e);
    this.currentStroke.set([pt]);
    this.redraw();
  }

  protected onPointerMove(e: PointerEvent): void {
    if (this.activePointerId !== e.pointerId || this.isDisabled()) return;
    const canvas = this.padRef()?.nativeElement;
    const stroke = this.currentStroke();
    if (!canvas || !stroke) return;
    const pt = this.pointFromEvent(canvas, e);
    this.currentStroke.set([...stroke, pt]);
    this.redraw();
  }

  protected onPointerUp(e: PointerEvent): void {
    if (this.activePointerId !== e.pointerId) return;
    this.finishStroke(e);
  }

  protected onPointerCancel(e: PointerEvent): void {
    if (this.activePointerId !== e.pointerId) return;
    this.finishStroke(e);
  }

  private finishStroke(e: PointerEvent): void {
    const canvas = this.padRef()?.nativeElement;
    if (canvas?.hasPointerCapture?.(e.pointerId)) {
      canvas.releasePointerCapture(e.pointerId);
    }
    this.activePointerId = null;
    const stroke = this.currentStroke();
    this.currentStroke.set(null);
    if (!stroke || stroke.length === 0) return;
    const next = [...this.strokes(), stroke];
    this.strokes.set(next);
    this.redraw();
    this.emitSignature(next);
    this.onTouched();
  }

  protected onThumbSelected(files: File[]): void {
    const file = files[0];
    if (!file || this.isDisabled()) return;
    const reader = new FileReader();
    reader.onload = () => {
      const rawUrl = typeof reader.result === 'string' ? reader.result : '';
      if (!rawUrl) return;
      this.normalizeThumbprint(rawUrl).then((val) => {
        this.currentValue.set(val);
        this.onChange(val);
        this.onTouched();
      });
    };
    reader.readAsDataURL(file);
  }

  private async normalizeThumbprint(rawUrl: string): Promise<UiSignatureValue> {
    const capturedAt = new Date().toISOString();
    const { paper } = this.resolveColors();
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const size = Math.max(1, Math.min(img.naturalWidth || 256, img.naturalHeight || 256, 512));
        const canvas = this.doc.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve({ kind: 'thumbprint', dataUrl: rawUrl, width: size, height: size, capturedAt });
          return;
        }
        ctx.fillStyle = paper;
        ctx.fillRect(0, 0, size, size);
        const srcSize = Math.min(img.naturalWidth || size, img.naturalHeight || size);
        const sx = ((img.naturalWidth || size) - srcSize) / 2;
        const sy = ((img.naturalHeight || size) - srcSize) / 2;
        ctx.drawImage(img, sx, sy, srcSize, srcSize, 0, 0, size, size);
        resolve({
          kind: 'thumbprint',
          dataUrl: canvas.toDataURL('image/png'),
          width: size,
          height: size,
          capturedAt,
        });
      };
      img.onerror = () => {
        resolve({ kind: 'thumbprint', dataUrl: rawUrl, width: 256, height: 256, capturedAt });
      };
      img.src = rawUrl;
    });
  }

  private pointFromEvent(canvas: HTMLCanvasElement, e: PointerEvent): UiSignaturePoint {
    const rect = canvas.getBoundingClientRect();
    const width = rect.width || canvas.clientWidth || canvas.width || 300;
    const height = rect.height || canvas.clientHeight || this.height() || 180;
    const x = Math.max(0, Math.min(width, e.clientX - rect.left));
    const y = Math.max(0, Math.min(height, e.clientY - rect.top));
    return { x, y, pressure: typeof e.pressure === 'number' ? e.pressure : 0.5 };
  }

  private syncCanvasSize(): void {
    const canvas = this.padRef()?.nativeElement;
    if (!canvas) return;
    const w = canvas.clientWidth || canvas.parentElement?.clientWidth || 300;
    const h = this.height();
    if (canvas.width !== w) canvas.width = w;
    if (canvas.height !== h) canvas.height = h;
  }

  private redraw(): void {
    const canvas = this.padRef()?.nativeElement;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { ink, paper } = this.resolveColors();
    const w = canvas.width || 300;
    const h = canvas.height || this.height();
    ctx.fillStyle = paper;
    ctx.fillRect(0, 0, w, h);
    const all = this.currentStroke() ? [...this.strokes(), this.currentStroke()!] : this.strokes();
    uiDrawSignatureStrokes(ctx, all, this.penWidth(), ink, this.lastPointerType);
  }

  private emitSignature(strokes: readonly (readonly UiSignaturePoint[])[]): void {
    if (uiSignatureInkLength(strokes) < UI_SIGNATURE_MIN_INK_LENGTH) {
      this.currentValue.set(null);
      this.onChange(null);
      return;
    }
    const trimmed = this.buildTrimmedCanvas(strokes);
    const padW = this.padRef()?.nativeElement.width || 300;
    const padH = this.padRef()?.nativeElement.height || this.height();
    const bounds = uiSignatureTrimBounds(strokes, padW, padH, Math.ceil(this.penWidth() * 2 + 4));
    const val: UiSignatureValue = {
      kind: 'signature',
      dataUrl: trimmed ? trimmed.toDataURL('image/png') : 'data:image/png;base64,',
      width: trimmed?.width ?? bounds?.width ?? 1,
      height: trimmed?.height ?? bounds?.height ?? 1,
      capturedAt: new Date().toISOString(),
      strokes: strokes.length,
    };
    this.currentValue.set(val);
    this.onChange(val);
  }

  private buildTrimmedCanvas(strokes: readonly (readonly UiSignaturePoint[])[]): HTMLCanvasElement | null {
    const pad = this.padRef()?.nativeElement;
    const padW = pad?.width || 300;
    const padH = pad?.height || this.height();
    const bounds = uiSignatureTrimBounds(strokes, padW, padH, Math.ceil(this.penWidth() * 2 + 4));
    if (!bounds) return null;
    const out = this.doc.createElement('canvas');
    out.width = bounds.width;
    out.height = bounds.height;
    const ctx = out.getContext('2d');
    if (!ctx) return out;
    const { ink, paper } = this.resolveColors();
    ctx.fillStyle = paper;
    ctx.fillRect(0, 0, bounds.width, bounds.height);
    uiDrawSignatureStrokes(ctx, strokes, this.penWidth(), ink, this.lastPointerType, bounds.x, bounds.y);
    return out;
  }

  private resolveColors(): { ink: string; paper: string } {
    const cs = this.doc.defaultView?.getComputedStyle(this.host.nativeElement);
    const ink = cs?.getPropertyValue('--ui-signature-ink').trim() || '#0f1433';
    const paper = cs?.getPropertyValue('--ui-signature-paper').trim() || '#ffffff';
    return { ink, paper };
  }
}
