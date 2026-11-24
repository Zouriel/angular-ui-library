import { ChangeDetectionStrategy, Component, ElementRef, computed, effect, input, viewChild } from '@angular/core';
import { injectUiStrings } from '@zouriel/ui';
import { uiQrMatrix, type UiQrErrorCorrection } from './qr-matrix';

/**
 * `ui-qr-code` — renders a crisp inline SVG QR code for a string (verification URLs, passes,
 * receipts). Always rendered dark-on-white (`--ui-qr-dark` on `--ui-qr-light`) regardless of the
 * surrounding theme so every scanner can read it.
 */
@Component({
  selector: 'ui-qr-code',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="qr-wrap">
      @if (encoded().error) {
        <div class="qr-error" role="alert" [style.width.px]="size()" [style.height.px]="size()">
          {{ strings.qrTooLong }}
        </div>
      } @else {
        <svg
          #svgEl
          class="qr-svg"
          xmlns="http://www.w3.org/2000/svg"
          [attr.viewBox]="'0 0 ' + viewSize() + ' ' + viewSize()"
          [attr.width]="size()"
          [attr.height]="size()"
          shape-rendering="crispEdges"
          role="img"
          [attr.aria-label]="label() || strings.qrCode"
        >
          <rect width="100%" height="100%" class="qr-bg" />
          <path [attr.d]="encoded().path" class="qr-fg" />
        </svg>
      }
      @if (caption()) {
        <div class="qr-caption" dir="ltr">{{ caption() }}</div>
      }
    </div>
  `,
  styles: `
    :host {
      display: inline-block;
    }
    .qr-wrap {
      display: inline-flex;
      flex-direction: column;
      align-items: center;
      gap: var(--ui-space-2);
    }
    .qr-svg {
      display: block;
      max-width: 100%;
      height: auto;
      border-radius: var(--ui-radius-xs);
    }
    .qr-bg {
      fill: var(--ui-qr-light);
    }
    .qr-fg {
      fill: var(--ui-qr-dark);
    }
    .qr-caption {
      font-family: var(--ui-font-mono);
      font-size: var(--ui-font-size-sm);
      color: var(--ui-color-text);
      user-select: text;
      unicode-bidi: isolate;
      text-align: center;
      word-break: break-all;
    }
    .qr-error {
      box-sizing: border-box;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: var(--ui-space-3);
      text-align: center;
      font-family: var(--ui-font-default);
      font-size: var(--ui-font-size-sm);
      color: var(--ui-color-danger);
      background: var(--ui-color-surface-subtle);
      border: 1px solid var(--ui-color-border);
      border-radius: var(--ui-radius);
    }
  `,
})
export class UiQrCode {
  protected readonly strings = injectUiStrings();
  private readonly svgEl = viewChild<ElementRef<SVGSVGElement>>('svgEl');

  /** The text to encode, normally a verification URL. */
  readonly value = input.required<string>();
  /** Width and height in px. */
  readonly size = input(160);
  /** Error correction level. Use `'Q'` for codes that will be printed. */
  readonly level = input<UiQrErrorCorrection>('M');
  /** Quiet zone, in modules. Never below 4. */
  readonly margin = input(4);
  /** Accessible name, e.g. `"QR code for permit BCP-2026-0418"`. */
  readonly label = input<string | undefined>(undefined);
  /** Text under the code, normally the verification code for typing. */
  readonly caption = input<string | undefined>(undefined);

  protected readonly quietMargin = computed(() => Math.max(4, Math.floor(this.margin())));

  protected readonly encoded = computed<{ matrix: boolean[][] | null; path: string; error: Error | null }>(() => {
    try {
      const matrix = uiQrMatrix(this.value(), this.level());
      const m = this.quietMargin();
      const parts: string[] = [];
      for (let r = 0; r < matrix.length; r++) {
        const row = matrix[r];
        for (let c = 0; c < row.length; c++) {
          if (row[c]) parts.push(`M${c + m},${r + m}h1v1h-1z`);
        }
      }
      return { matrix, path: parts.join(''), error: null };
    } catch (err) {
      return { matrix: null, path: '', error: err instanceof Error ? err : new Error(String(err)) };
    }
  });

  protected readonly viewSize = computed(() => {
    const m = this.encoded().matrix;
    return m ? m.length + this.quietMargin() * 2 : 0;
  });

  constructor() {
    effect(() => {
      const err = this.encoded().error;
      if (err) console.error('ui-qr-code:', err.message);
    });
  }

  /** Serializes the rendered QR code to a `data:` URL (`'png'` or `'svg'`). */
  async toDataUrl(type: 'png' | 'svg' = 'png'): Promise<string> {
    const svgString = this.serializeSvg();
    if (type === 'svg') {
      return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgString)}`;
    }
    const canvas = await this.renderToCanvas(svgString);
    return canvas.toDataURL('image/png');
  }

  /** Serializes the rendered QR code to a `Blob` (`'png'` or `'svg'`). */
  async toBlob(type: 'png' | 'svg' = 'png'): Promise<Blob> {
    const svgString = this.serializeSvg();
    if (type === 'svg') {
      return new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
    }
    const canvas = await this.renderToCanvas(svgString);
    return new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (blob) resolve(blob);
        else reject(new Error('Failed to encode QR code as PNG blob'));
      }, 'image/png');
    });
  }

  private serializeSvg(): string {
    const { matrix, path, error } = this.encoded();
    if (error || !matrix) {
      throw error ?? new Error('QR code is not available');
    }
    const vs = this.viewSize();
    const px = this.size();
    const el = this.svgEl()?.nativeElement;
    const cs = el ? getComputedStyle(el) : null;
    const dark = cs?.getPropertyValue('--ui-qr-dark').trim() || '#000000';
    const light = cs?.getPropertyValue('--ui-qr-light').trim() || '#ffffff';
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${vs} ${vs}" width="${px}" height="${px}" shape-rendering="crispEdges"><rect width="100%" height="100%" fill="${light}"/><path d="${path}" fill="${dark}"/></svg>`;
  }

  private async renderToCanvas(svgString: string): Promise<HTMLCanvasElement> {
    const px = this.size();
    const canvas = document.createElement('canvas');
    canvas.width = px;
    canvas.height = px;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D context is not available');

    const img = new Image();
    const url = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgString)}`;
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error('Failed to load QR SVG for rasterization'));
      img.src = url;
    });
    ctx.drawImage(img, 0, 0, px, px);
    return canvas;
  }
}
