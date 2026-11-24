import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { UI_QR_DECODER, UiQrScanner, type UiQrScanError, type UiQrScanResult } from './qr-scanner';

@Component({
  imports: [UiQrScanner],
  template: `
    @if (mounted()) {
      <ui-qr-scanner
        [(active)]="active"
        [pauseAfterScan]="pauseAfterScan()"
        [manualEntry]="manualEntry()"
        [manualPattern]="manualPattern()"
        (scanned)="results.push($event)"
        (error)="errors.push($event)"
      />
    }
  `,
})
class Host {
  mounted = signal(true);
  active = signal(false);
  pauseAfterScan = signal(true);
  manualEntry = signal(true);
  manualPattern = signal<string | RegExp | undefined>(undefined);
  results: UiQrScanResult[] = [];
  errors: UiQrScanError[] = [];
}

function mockStream(torch = false) {
  const track = {
    stop: vi.fn(),
    getCapabilities: () => ({ torch }),
    applyConstraints: vi.fn().mockResolvedValue(undefined),
  };
  return {
    track,
    stream: {
      getTracks: () => [track],
      getVideoTracks: () => [track],
    } as unknown as MediaStream,
  };
}

describe('ui-qr-scanner', () => {
  const origMedia = navigator.mediaDevices;
  const origBD = (globalThis as { BarcodeDetector?: unknown }).BarcodeDetector;

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    Object.defineProperty(navigator, 'mediaDevices', { value: origMedia, configurable: true });
    (globalThis as { BarcodeDetector?: unknown }).BarcodeDetector = origBD;
  });

  it('starts idle without opening camera, and validates manual entry with manualPattern', () => {
    const getUserMedia = vi.fn();
    Object.defineProperty(navigator, 'mediaDevices', { value: { getUserMedia }, configurable: true });

    const f = TestBed.createComponent(Host);
    f.componentInstance.manualPattern.set(/^BCP-\d{4}-\d{4}$/);
    f.detectChanges();

    expect(getUserMedia).not.toHaveBeenCalled();
    const el = f.nativeElement as HTMLElement;
    // Idle shows only the Start camera button, not the same words again above it.
    expect(el.querySelector('.status-msg')).toBeNull();
    expect(el.querySelectorAll('.action-btn.primary').length).toBe(1);
    const input = el.querySelector('.manual-input') as HTMLInputElement;
    const form = el.querySelector('form')!;

    input.value = 'invalid';
    input.dispatchEvent(new Event('input'));
    form.dispatchEvent(new Event('submit'));
    f.detectChanges();
    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect(f.componentInstance.results).toEqual([]);

    input.value = 'BCP-2026-0418';
    input.dispatchEvent(new Event('input'));
    form.dispatchEvent(new Event('submit'));
    f.detectChanges();
    expect(input.hasAttribute('aria-invalid')).toBe(false);
    expect(f.componentInstance.results).toEqual([{ value: 'BCP-2026-0418', source: 'manual' }]);
  });

  it('emits unsupported when getUserMedia is missing and keeps manual entry usable', () => {
    Object.defineProperty(navigator, 'mediaDevices', { value: undefined, configurable: true });
    const f = TestBed.createComponent(Host);
    f.detectChanges();

    const startBtn = (f.nativeElement as HTMLElement).querySelector('.action-btn') as HTMLButtonElement;
    startBtn.click();
    f.detectChanges();

    const scanner = f.debugElement.children[0].componentInstance as UiQrScanner;
    expect(scanner.state()).toBe('unsupported');
    expect(f.componentInstance.errors).toEqual([{ reason: 'unsupported' }]);
    expect((f.nativeElement as HTMLElement).querySelector('.manual-input')).toBeTruthy();
  });

  it('emits denied on NotAllowedError', async () => {
    const err = Object.assign(new Error('denied'), { name: 'NotAllowedError' });
    Object.defineProperty(navigator, 'mediaDevices', {
      value: { getUserMedia: vi.fn().mockRejectedValue(err) },
      configurable: true,
    });

    const f = TestBed.createComponent(Host);
    f.detectChanges();
    ((f.nativeElement as HTMLElement).querySelector('.action-btn') as HTMLButtonElement).click();
    await vi.runAllTimersAsync();
    f.detectChanges();

    const scanner = f.debugElement.children[0].componentInstance as UiQrScanner;
    expect(scanner.state()).toBe('denied');
    expect(f.componentInstance.errors).toEqual([{ reason: 'denied' }]);
  });

  it('uses BarcodeDetector when present, suppresses duplicates within 2s, and pauses after scan', async () => {
    const { stream, track } = mockStream(true);
    Object.defineProperty(navigator, 'mediaDevices', {
      value: { getUserMedia: vi.fn().mockResolvedValue(stream) },
      configurable: true,
    });
    const detect = vi.fn().mockResolvedValue([{ rawValue: 'PERMIT-1' }]);
    (globalThis as { BarcodeDetector?: unknown }).BarcodeDetector = class {
      detect = detect;
    };

    const f = TestBed.createComponent(Host);
    f.componentInstance.pauseAfterScan.set(false);
    f.detectChanges();

    const video = (f.nativeElement as HTMLElement).querySelector('video')!;
    Object.defineProperty(video, 'readyState', { value: 2, configurable: true });
    Object.defineProperty(video, 'videoWidth', { value: 320, configurable: true });
    Object.defineProperty(video, 'videoHeight', { value: 240, configurable: true });

    ((f.nativeElement as HTMLElement).querySelector('.action-btn') as HTMLButtonElement).click();
    await vi.advanceTimersByTimeAsync(150);
    f.detectChanges();

    expect(f.componentInstance.results).toEqual([{ value: 'PERMIT-1', source: 'camera' }]);

    // Within 2 seconds, same value must NOT emit again
    await vi.advanceTimersByTimeAsync(500);
    expect(f.componentInstance.results.length).toBe(1);

    // After 2 seconds, same value emits again
    await vi.advanceTimersByTimeAsync(1600);
    expect(f.componentInstance.results.length).toBe(2);

    // Torch toggle works
    const scanner = f.debugElement.children[0].componentInstance as UiQrScanner;
    await scanner.toggleTorch();
    expect(track.applyConstraints).toHaveBeenCalledWith({ advanced: [{ torch: true }] });

    // Destroying component stops tracks
    f.componentInstance.mounted.set(false);
    f.detectChanges();
    expect(track.stop).toHaveBeenCalled();
  });

  it('falls back to UI_QR_DECODER when BarcodeDetector is absent and stops on hidden tab', async () => {
    (globalThis as { BarcodeDetector?: unknown }).BarcodeDetector = undefined;
    const { stream, track } = mockStream(false);
    Object.defineProperty(navigator, 'mediaDevices', {
      value: { getUserMedia: vi.fn().mockResolvedValue(stream) },
      configurable: true,
    });

    const mockDecode = vi.fn().mockReturnValue({ data: 'DECODED-BY-JSQR' });
    TestBed.configureTestingModule({
      providers: [{ provide: UI_QR_DECODER, useValue: () => Promise.resolve({ default: mockDecode }) }],
    });

    // Mock canvas 2d context in jsdom
    const origGetContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = vi.fn().mockReturnValue({
      drawImage: vi.fn(),
      getImageData: vi.fn().mockReturnValue({ data: new Uint8ClampedArray(4), width: 1, height: 1 }),
    }) as unknown as typeof origGetContext;

    try {
      const f = TestBed.createComponent(Host);
      f.detectChanges();

      const video = (f.nativeElement as HTMLElement).querySelector('video')!;
      Object.defineProperty(video, 'readyState', { value: 2, configurable: true });
      Object.defineProperty(video, 'videoWidth', { value: 320, configurable: true });
      Object.defineProperty(video, 'videoHeight', { value: 240, configurable: true });

      ((f.nativeElement as HTMLElement).querySelector('.action-btn') as HTMLButtonElement).click();
      await vi.advanceTimersByTimeAsync(150);
      f.detectChanges();

      expect(mockDecode).toHaveBeenCalled();
      expect(f.componentInstance.results).toEqual([{ value: 'DECODED-BY-JSQR', source: 'camera' }]);

      const scanner = f.debugElement.children[0].componentInstance as UiQrScanner;
      expect(scanner.state()).toBe('paused');

      // Resume and then hide tab -> must stop camera
      scanner.resume();
      expect(scanner.state()).toBe('scanning');

      Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
      document.dispatchEvent(new Event('visibilitychange'));
      expect(scanner.state()).toBe('idle');
      expect(track.stop).toHaveBeenCalled();
    } finally {
      HTMLCanvasElement.prototype.getContext = origGetContext;
      Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
    }
  });
});
