import { Component, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { UiButton, UiSegmented, type UiSegmentedOption } from '@zouriel/ui/button';
import { UiFormField, UiInput } from '@zouriel/ui/form';
import { UiQrCode, UiQrScanner, type UiQrErrorCorrection, type UiQrScanResult } from '@zouriel/ui/qr';
import { UiText } from '@zouriel/ui/text';
import { DocDemo, DocPage, DocSection, type ApiRow } from '../docs/docs-ui';

const CODE_SNIPPET = `import { UiQrCode } from '@zouriel/ui/qr';

<ui-qr-code
  value="https://addu.gov.mv/verify/BCP-2026-0418"
  level="Q"
  caption="BCP-2026-0418"
/>`;

const SCANNER_SNIPPET = `import { UiQrScanner } from '@zouriel/ui/qr';

<ui-qr-scanner
  [(active)]="scanning"
  manualPattern="^BCP-\\d{4}-\\d{4}$"
  (scanned)="onScanned($event)"
  (error)="onError($event)"
/>`;

const SCAN_SHAPES = `interface UiQrScanResult {
  value: string;
  source: 'camera' | 'manual';
}

interface UiQrScanError {
  reason: 'denied' | 'no-camera' | 'unsupported' | 'failed';
}`;

@Component({
  imports: [FormsModule, DocPage, DocSection, DocDemo, UiQrCode, UiQrScanner, UiFormField, UiInput, UiSegmented, UiButton, UiText],
  template: `
    <doc-page
      name="QR"
      entry="@zouriel/ui/qr"
      lead="Pure-TypeScript QR code generation (ui-qr-code, uiQrMatrix) and camera + manual QR scanning (ui-qr-scanner)."
    >
      <doc-section
        name="QR code"
        selector="ui-qr-code"
        [api]="codeApi"
        summary="Renders an inline SVG QR code from a UTF-8 string using the built-in dependency-free encoder uiQrMatrix(value, level). Always drawn dark-on-white (--ui-qr-dark on --ui-qr-light) regardless of theme so every scanner reads it reliably."
      >
        <doc-demo [code]="CODE_SNIPPET">
          <div class="qr-demo">
            <div class="qr-controls">
              <ui-form-field label="Value">
                <ui-input [(ngModel)]="value" />
              </ui-form-field>
              <div class="level-row">
                <ui-text variant="caption">Error correction</ui-text>
                <ui-segmented [options]="levels" [(value)]="level" />
              </div>
              <div class="dl-row">
                <ui-button variant="secondary" size="sm" (click)="download('svg')">Download SVG</ui-button>
                <ui-button variant="secondary" size="sm" (click)="download('png')">Download PNG</ui-button>
              </div>
            </div>
            <div class="qr-preview">
              <ui-qr-code
                #qr
                [value]="value()"
                [level]="level()"
                caption="BCP-2026-0418"
                label="QR code for permit BCP-2026-0418"
              />
            </div>
          </div>
        </doc-demo>
      </doc-section>

      <doc-section
        name="QR scanner"
        selector="ui-qr-scanner"
        [api]="scannerApi"
        [outputs]="scannerOut"
        [shapes]="SCAN_SHAPES"
        summary="Reads QR codes via the camera (BarcodeDetector when available, otherwise lazily importing jsqr via UI_QR_DECODER) with an always-available manual entry field. Suppresses duplicate reads within 2 seconds and stops automatically when hidden or destroyed."
      >
        <doc-demo [code]="SCANNER_SNIPPET">
          <div class="scan-demo">
            <ui-qr-scanner (scanned)="lastScan.set($event)" (error)="lastError.set($event.reason)" />
            @if (lastScan()) {
              <ui-text variant="caption">Last scanned ({{ lastScan()!.source }}): {{ lastScan()!.value }}</ui-text>
            }
            @if (lastError()) {
              <ui-text variant="caption">Camera status: {{ lastError() }}</ui-text>
            }
          </div>
        </doc-demo>
      </doc-section>
    </doc-page>
  `,
  styles: `
    .qr-demo {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      gap: var(--ui-space-4);
      align-items: start;
      width: 100%;
    }
    .qr-controls {
      display: flex;
      flex-direction: column;
      gap: var(--ui-space-3);
    }
    .level-row {
      display: flex;
      flex-direction: column;
      gap: var(--ui-space-1);
    }
    .dl-row {
      display: flex;
      flex-wrap: wrap;
      gap: var(--ui-space-2);
    }
    .qr-preview {
      display: flex;
      justify-content: center;
      padding: var(--ui-space-3);
      background: var(--ui-color-surface-subtle);
      border-radius: var(--ui-radius);
    }
    .scan-demo {
      width: min(100%, 420px);
      display: flex;
      flex-direction: column;
      gap: var(--ui-space-2);
    }
    @media (max-width: 640px) {
      .qr-demo {
        grid-template-columns: 1fr;
      }
    }
  `,
})
export class QrPage {
  private readonly qr = viewChild<UiQrCode>('qr');

  protected readonly CODE_SNIPPET = CODE_SNIPPET;
  protected readonly SCANNER_SNIPPET = SCANNER_SNIPPET;
  protected readonly SCAN_SHAPES = SCAN_SHAPES;

  protected readonly value = signal('https://addu.gov.mv/verify/BCP-2026-0418');
  protected readonly level = signal<UiQrErrorCorrection>('M');
  protected readonly levels: UiSegmentedOption[] = [
    { value: 'L', label: 'L (7%)' },
    { value: 'M', label: 'M (15%)' },
    { value: 'Q', label: 'Q (25%)' },
    { value: 'H', label: 'H (30%)' },
  ];

  protected readonly lastScan = signal<UiQrScanResult | null>(null);
  protected readonly lastError = signal<string | null>(null);

  protected async download(type: 'svg' | 'png'): Promise<void> {
    const comp = this.qr();
    if (!comp) return;
    const url = await comp.toDataUrl(type);
    const a = document.createElement('a');
    a.href = url;
    a.download = `qr-code.${type}`;
    a.click();
  }

  protected readonly codeApi: ApiRow[] = [
    { name: 'value', type: 'string (required)', default: '—', desc: 'Text to encode as UTF-8 bytes.' },
    { name: 'size', type: 'number', default: '160', desc: 'Width and height in px.' },
    { name: 'level', type: "'L' | 'M' | 'Q' | 'H'", default: "'M'", desc: 'Error correction level. Use Q for printed codes.' },
    { name: 'margin', type: 'number', default: '4', desc: 'Quiet zone in modules (never below 4).' },
    { name: 'label', type: 'string', default: 'strings.qrCode', desc: 'Accessible name on the SVG.' },
    { name: 'caption', type: 'string', default: '—', desc: 'Selectable monospace LTR text shown under the code.' },
    { name: 'toDataUrl(type?)', type: "('png' | 'svg') => Promise<string>", default: "'png'", desc: 'Serializes the QR code as a data URL.' },
    { name: 'toBlob(type?)', type: "('png' | 'svg') => Promise<Blob>", default: "'png'", desc: 'Serializes the QR code as a Blob.' },
  ];

  protected readonly scannerApi: ApiRow[] = [
    { name: 'active', type: 'model<boolean>', default: 'false', desc: 'Camera on or off. Starts only after a user action.' },
    { name: 'facing', type: "'environment' | 'user'", default: "'environment'", desc: 'Preferred camera facing mode.' },
    { name: 'pauseAfterScan', type: 'boolean', default: 'true', desc: 'Pause reading after a result until resume() is called.' },
    { name: 'manualEntry', type: 'boolean', default: 'true', desc: 'Show the "type the code instead" field.' },
    { name: 'manualPattern', type: 'string | RegExp', default: '—', desc: 'Validation pattern for manually entered codes.' },
    { name: 'fill', type: 'boolean', default: 'false', desc: 'Expand to fill the parent container.' },
    { name: 'resume() / stop() / toggleTorch()', type: 'methods', default: '—', desc: 'Control scanning and flashlight where supported.' },
  ];

  protected readonly scannerOut: ApiRow[] = [
    { name: 'scanned', type: 'UiQrScanResult', default: '—', desc: 'Emitted when a code is read by camera or submitted manually.' },
    { name: 'error', type: 'UiQrScanError', default: '—', desc: 'Emitted when the camera cannot be used.' },
  ];
}
