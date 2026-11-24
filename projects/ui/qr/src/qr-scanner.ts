import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  InjectionToken,
  computed,
  effect,
  inject,
  input,
  model,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { injectUiStrings } from '@zouriel/ui';

export type UiQrScannerState = 'idle' | 'requesting' | 'scanning' | 'paused' | 'denied' | 'unsupported';

export interface UiQrScanResult {
  value: string;
  source: 'camera' | 'manual';
}

export interface UiQrScanError {
  reason: 'denied' | 'no-camera' | 'unsupported' | 'failed';
}

export type UiQrDecoderFn = (data: Uint8ClampedArray, width: number, height: number) => { data: string } | null;

/**
 * How `ui-qr-scanner` loads a fallback QR decoder when the browser has no `BarcodeDetector`:
 * `() => import('jsqr')` by default. Provide another loader in tests or to swap decoders.
 */
export const UI_QR_DECODER = new InjectionToken<() => Promise<unknown>>('UI_QR_DECODER', {
  providedIn: 'root',
  factory: () => () => import('jsqr'),
});

interface BarcodeDetectorLike {
  detect(source: ImageBitmapSource): Promise<Array<{ rawValue?: string }>>;
}

/**
 * `ui-qr-scanner` — camera QR scanner with a rounded square guide, torch toggle (when supported),
 * polite live announcements, 2-second duplicate suppression, and an always-available manual entry field.
 */
@Component({
  selector: 'ui-qr-scanner',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="scanner" [class.fill]="fill()">
      <div class="stage">
        <video #videoEl class="video" playsinline muted autoplay [class.hidden]="state() !== 'scanning' && state() !== 'paused'"></video>
        <canvas #canvasEl class="hidden-canvas" aria-hidden="true"></canvas>

        @if (state() === 'scanning' || state() === 'paused') {
          <div class="guide" aria-hidden="true">
            <div class="frame" [class.paused]="state() === 'paused'"></div>
          </div>
        }

        @if (state() !== 'scanning') {
          <div class="overlay">
            @if (statusMessage()) {
              <p class="status-msg" [class.err]="state() === 'denied' || state() === 'unsupported' || errorReason() === 'no-camera' || errorReason() === 'failed'">
                {{ statusMessage() }}
              </p>
            }
            @if (state() === 'idle' || state() === 'denied') {
              <button type="button" class="action-btn primary" (click)="startFromUser()">
                {{ strings.scanStart }}
              </button>
            } @else if (state() === 'paused') {
              <button type="button" class="action-btn primary" (click)="resume()">
                {{ strings.scanStart }}
              </button>
            }
          </div>
        }

        @if (state() === 'scanning' || state() === 'paused') {
          <div class="controls" role="group" [attr.aria-label]="strings.qrCode">
            @if (torchSupported()) {
              <button
                type="button"
                class="ctrl-btn"
                [attr.aria-pressed]="torchOn()"
                [attr.aria-label]="strings.scanTorch"
                (click)="toggleTorch()"
              >
                <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
                  <path d="M9 2h6l-1 7h4l-7 13 1-9H8l1-11z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" />
                </svg>
              </button>
            }
            <button type="button" class="ctrl-btn stop" [attr.aria-label]="strings.scanStop" (click)="stop()">
              <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
                <rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor" />
              </svg>
            </button>
          </div>
        }
      </div>

      <div class="sr-only" aria-live="polite" aria-atomic="true">{{ announcement() }}</div>

      @if (manualEntry()) {
        <form class="manual" (submit)="onManualSubmit($event)" novalidate>
          <label class="manual-label" [attr.for]="inputId">{{ strings.scanTypeInstead }}</label>
          <div class="manual-row">
            <input
              [id]="inputId"
              type="text"
              class="manual-input"
              dir="ltr"
              [value]="manualValue()"
              [attr.aria-invalid]="manualInvalid() ? 'true' : null"
              (input)="onManualInput($event)"
            />
            <button type="submit" class="manual-submit">{{ strings.confirm }}</button>
          </div>
        </form>
      }
    </div>
  `,
  styles: `
    :host {
      display: block;
    }
    .scanner {
      display: flex;
      flex-direction: column;
      gap: var(--ui-space-3);
      font-family: var(--ui-font-default);
    }
    .scanner.fill {
      height: 100%;
    }
    .stage {
      position: relative;
      width: 100%;
      aspect-ratio: 4 / 3;
      min-height: 220px;
      background: var(--ui-media-bg);
      border-radius: var(--ui-radius);
      overflow: hidden;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .scanner.fill .stage {
      flex: 1 1 auto;
      aspect-ratio: auto;
    }
    .video {
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
    }
    .video.hidden,
    .hidden-canvas {
      display: none;
    }
    .guide {
      position: absolute;
      inset: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      pointer-events: none;
      padding: var(--ui-space-6);
    }
    .frame {
      width: min(68%, 220px);
      aspect-ratio: 1;
      border: 2px solid var(--ui-media-on-scrim);
      border-radius: var(--ui-radius-lg);
      box-shadow: 0 0 0 9999px color-mix(in srgb, var(--ui-media-scrim) 45%, transparent);
    }
    .frame.paused {
      opacity: 0.55;
    }
    .overlay {
      position: absolute;
      inset: 0;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: var(--ui-space-3);
      padding: var(--ui-space-4);
      text-align: center;
      background: color-mix(in srgb, var(--ui-media-scrim) 72%, transparent);
      color: var(--ui-media-on-scrim);
    }
    .status-msg {
      margin: 0;
      font-size: var(--ui-font-size-sm);
      line-height: 1.4;
      max-width: 34ch;
    }
    .status-msg.err {
      color: var(--ui-media-danger);
    }
    .action-btn {
      min-height: var(--ui-size-touch);
      padding-inline: var(--ui-space-4);
      border: none;
      border-radius: var(--ui-radius-pill);
      background: var(--ui-color-primary);
      color: var(--ui-color-primary-contrast);
      font: inherit;
      font-weight: 600;
      cursor: pointer;
    }
    .action-btn:focus-visible {
      outline: none;
      box-shadow: var(--ui-focus-ring);
    }
    .controls {
      position: absolute;
      inset-block-end: var(--ui-space-3);
      inset-inline-end: var(--ui-space-3);
      display: flex;
      gap: var(--ui-space-2);
    }
    .ctrl-btn {
      box-sizing: border-box;
      width: var(--ui-size-touch);
      height: var(--ui-size-touch);
      border: none;
      border-radius: var(--ui-radius-pill);
      background: color-mix(in srgb, var(--ui-media-scrim) 70%, transparent);
      color: var(--ui-media-on-scrim);
      display: inline-flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
    }
    .ctrl-btn[aria-pressed='true'] {
      background: var(--ui-color-primary);
      color: var(--ui-color-primary-contrast);
    }
    .ctrl-btn:focus-visible {
      outline: none;
      box-shadow: var(--ui-focus-ring);
    }
    .manual {
      display: flex;
      flex-direction: column;
      gap: var(--ui-space-1);
    }
    .manual-label {
      font-size: var(--ui-font-size-sm);
      color: var(--ui-color-text-muted);
    }
    .manual-row {
      display: flex;
      gap: var(--ui-space-2);
      align-items: stretch;
    }
    .manual-input {
      flex: 1 1 auto;
      min-width: 0;
      min-height: var(--ui-size-touch);
      padding-inline: var(--ui-space-3);
      border: var(--ui-control-border-width) solid var(--ui-control-border);
      border-radius: var(--ui-field-radius);
      background: var(--ui-color-surface);
      color: var(--ui-color-text);
      font-family: var(--ui-font-mono);
      font-size: var(--ui-font-size-sm);
    }
    .manual-input[aria-invalid='true'] {
      border-color: var(--ui-color-danger);
    }
    .manual-input:focus-visible {
      outline: none;
      box-shadow: var(--ui-focus-ring);
    }
    .manual-submit {
      min-height: var(--ui-size-touch);
      padding-inline: var(--ui-space-4);
      border: none;
      border-radius: var(--ui-button-radius);
      background: var(--ui-color-secondary);
      color: var(--ui-color-secondary-contrast);
      font: inherit;
      font-weight: 500;
      cursor: pointer;
    }
    .manual-submit:focus-visible {
      outline: none;
      box-shadow: var(--ui-focus-ring);
    }
    .sr-only {
      position: absolute;
      width: 1px;
      height: 1px;
      overflow: hidden;
      clip: rect(0 0 0 0);
      white-space: nowrap;
    }
  `,
})
export class UiQrScanner {
  private static nextId = 0;

  protected readonly strings = injectUiStrings();
  private readonly loadDecoder = inject(UI_QR_DECODER);
  private readonly destroyRef = inject(DestroyRef);

  private readonly videoEl = viewChild<ElementRef<HTMLVideoElement>>('videoEl');
  private readonly canvasEl = viewChild<ElementRef<HTMLCanvasElement>>('canvasEl');

  /** Camera on or off. Starts only after a user action. */
  readonly active = model(false);
  /** Which camera to request. */
  readonly facing = input<'environment' | 'user'>('environment');
  /** Stop reading after a result until `resume()` is called. */
  readonly pauseAfterScan = input(true);
  /** Show the "type the code" field. */
  readonly manualEntry = input(true);
  /** Optional format pattern for validating manually typed codes. */
  readonly manualPattern = input<string | RegExp | undefined>(undefined);
  /** Take all the space the parent gives. */
  readonly fill = input(false);

  /** Emitted when a QR code is read by camera or submitted manually. */
  readonly scanned = output<UiQrScanResult>();
  /** Emitted when the camera cannot be used. */
  readonly error = output<UiQrScanError>();

  readonly state = signal<UiQrScannerState>('idle');
  protected readonly errorReason = signal<UiQrScanError['reason'] | null>(null);
  protected readonly torchSupported = signal(false);
  protected readonly torchOn = signal(false);
  protected readonly announcement = signal('');
  protected readonly manualValue = signal('');
  protected readonly manualInvalid = signal(false);
  protected readonly inputId = `ui-qr-manual-${++UiQrScanner.nextId}`;

  protected readonly statusMessage = computed(() => {
    const s = this.strings;
    const reason = this.errorReason();
    if (reason === 'no-camera') return s.scanNoCamera;
    if (reason === 'unsupported') return s.scanUnsupported;
    if (reason === 'denied') return s.scanDenied;
    switch (this.state()) {
      case 'requesting':
        return s.loading;
      case 'scanning':
        return s.scanScanning;
      case 'paused':
        return s.scanRead;
      case 'denied':
        return s.scanDenied;
      case 'unsupported':
        return s.scanUnsupported;
      default:
        // Idle: the Start camera button says it; repeating it above the button reads twice.
        return '';
    }
  });

  private stream: MediaStream | null = null;
  private scanTimer: ReturnType<typeof setTimeout> | null = null;
  private detector: BarcodeDetectorLike | null = null;
  private decoderFn: UiQrDecoderFn | null = null;
  private lastValue: string | null = null;
  private lastEmitAt = 0;
  private userActivated = false;

  constructor() {
    effect(() => {
      const isActive = this.active();
      if (isActive && this.userActivated && this.state() === 'idle') {
        void this.startCamera();
      } else if (!isActive && (this.state() === 'scanning' || this.state() === 'paused' || this.state() === 'requesting')) {
        this.teardownStream();
        this.state.set('idle');
      }
    });

    const onVisibility = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
        this.stop();
      }
    };
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', onVisibility);
    }

    this.destroyRef.onDestroy(() => {
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', onVisibility);
      }
      this.teardownStream();
    });
  }

  /** Starts the camera from a user gesture. */
  startFromUser(): void {
    this.userActivated = true;
    this.active.set(true);
    void this.startCamera();
  }

  /** Resumes scanning after `pauseAfterScan` paused it. */
  resume(): void {
    if (this.stream && this.state() === 'paused') {
      this.state.set('scanning');
      this.announcement.set(this.strings.scanScanning);
      this.scheduleNextFrame();
      return;
    }
    this.startFromUser();
  }

  /** Stops the camera and returns to idle. */
  stop(): void {
    this.teardownStream();
    this.active.set(false);
    this.state.set('idle');
  }

  /** Toggles the camera flashlight/torch when supported by the video track. */
  async toggleTorch(): Promise<void> {
    const track = this.stream?.getVideoTracks?.()[0];
    if (!track || !this.torchSupported()) return;
    const next = !this.torchOn();
    try {
      await track.applyConstraints({ advanced: [{ torch: next } as MediaTrackConstraintSet] });
      this.torchOn.set(next);
    } catch {
      // Ignore unsupported runtime constraint errors
    }
  }

  protected onManualInput(ev: Event): void {
    this.manualValue.set((ev.target as HTMLInputElement).value);
    if (this.manualInvalid()) this.manualInvalid.set(false);
  }

  protected onManualSubmit(ev: Event): void {
    ev.preventDefault();
    const raw = this.manualValue().trim();
    if (!raw) {
      this.manualInvalid.set(true);
      return;
    }
    const pattern = this.manualPattern();
    if (pattern !== undefined) {
      const re = typeof pattern === 'string' ? new RegExp(pattern) : pattern;
      if (!re.test(raw)) {
        this.manualInvalid.set(true);
        return;
      }
    }
    this.manualInvalid.set(false);
    this.announcement.set(this.strings.scanRead);
    this.scanned.emit({ value: raw, source: 'manual' });
  }

  private async startCamera(): Promise<void> {
    if (this.state() === 'requesting' || this.state() === 'scanning') return;
    this.errorReason.set(null);

    const getUserMedia = globalThis.navigator?.mediaDevices?.getUserMedia?.bind(globalThis.navigator.mediaDevices);
    if (!getUserMedia) {
      this.state.set('unsupported');
      this.errorReason.set('unsupported');
      this.active.set(false);
      this.announcement.set(this.strings.scanUnsupported);
      this.error.emit({ reason: 'unsupported' });
      return;
    }

    this.state.set('requesting');
    try {
      const stream = await getUserMedia({ video: { facingMode: this.facing() }, audio: false });
      if (!this.active()) {
        for (const t of stream.getTracks()) t.stop();
        this.state.set('idle');
        return;
      }
      this.stream = stream;
      const track = stream.getVideoTracks?.()[0];
      const caps = (track?.getCapabilities?.() ?? {}) as { torch?: boolean };
      this.torchSupported.set(Boolean(caps.torch));
      this.torchOn.set(false);

      const video = this.videoEl()?.nativeElement;
      if (video) {
        video.srcObject = stream;
        await Promise.resolve(video.play?.()).catch(() => {});
      }

      await this.prepareDetector();
      this.state.set('scanning');
      this.announcement.set(this.strings.scanScanning);
      this.scheduleNextFrame();
    } catch (err) {
      const name = err instanceof Error ? err.name : '';
      let reason: UiQrScanError['reason'] = 'failed';
      let nextState: UiQrScannerState = 'idle';
      if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
        reason = 'denied';
        nextState = 'denied';
      } else if (name === 'NotFoundError' || name === 'DevicesNotFoundError' || name === 'OverconstrainedError') {
        reason = 'no-camera';
      }
      this.errorReason.set(reason);
      this.state.set(nextState);
      this.active.set(false);
      this.announcement.set(this.statusMessage());
      this.error.emit({ reason });
    }
  }

  private async prepareDetector(): Promise<void> {
    if (this.detector || this.decoderFn) return;
    const BD = (globalThis as { BarcodeDetector?: new (opts: { formats: string[] }) => BarcodeDetectorLike }).BarcodeDetector;
    if (typeof BD === 'function') {
      this.detector = new BD({ formats: ['qr_code'] });
      return;
    }
    const mod = await this.loadDecoder();
    const fn = typeof mod === 'function' ? mod : (mod as { default?: UiQrDecoderFn }).default;
    if (typeof fn === 'function') {
      this.decoderFn = fn as UiQrDecoderFn;
    }
  }

  private scheduleNextFrame(): void {
    if (this.scanTimer !== null) clearTimeout(this.scanTimer);
    if (this.state() !== 'scanning') return;
    this.scanTimer = setTimeout(() => {
      void this.scanFrame();
    }, 120);
  }

  private async scanFrame(): Promise<void> {
    if (this.state() !== 'scanning') return;
    const video = this.videoEl()?.nativeElement;
    if (!video || (video.readyState !== undefined && video.readyState < 2 && !video.videoWidth)) {
      this.scheduleNextFrame();
      return;
    }

    try {
      let raw: string | null = null;
      if (this.detector) {
        const results = await this.detector.detect(video);
        raw = results[0]?.rawValue ?? null;
      } else if (this.decoderFn) {
        const w = video.videoWidth || 320;
        const h = video.videoHeight || 240;
        const canvas = this.canvasEl()?.nativeElement;
        if (canvas && w > 0 && h > 0) {
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext('2d', { willReadFrequently: true });
          if (ctx) {
            ctx.drawImage(video, 0, 0, w, h);
            const imgData = ctx.getImageData(0, 0, w, h);
            raw = this.decoderFn(imgData.data, w, h)?.data ?? null;
          }
        }
      }

      if (raw) {
        this.handleDecoded(raw);
      }
    } catch {
      // Ignore transient frame decode errors
    }

    if (this.state() === 'scanning') {
      this.scheduleNextFrame();
    }
  }

  private handleDecoded(value: string): void {
    const now = Date.now();
    if (value === this.lastValue && now - this.lastEmitAt < 2000) {
      return;
    }
    this.lastValue = value;
    this.lastEmitAt = now;
    this.announcement.set(this.strings.scanRead);
    this.scanned.emit({ value, source: 'camera' });
    if (this.pauseAfterScan()) {
      this.state.set('paused');
    }
  }

  private teardownStream(): void {
    if (this.scanTimer !== null) {
      clearTimeout(this.scanTimer);
      this.scanTimer = null;
    }
    if (this.stream) {
      for (const track of this.stream.getTracks()) track.stop();
      this.stream = null;
    }
    const video = this.videoEl()?.nativeElement;
    if (video) video.srcObject = null;
    this.torchSupported.set(false);
    this.torchOn.set(false);
  }
}
