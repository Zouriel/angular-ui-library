import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it, vi } from 'vitest';
import { provideUiStrings, uiStringsDv } from '@zouriel/ui';
import { UiQrCode } from './qr-code';
import type { UiQrErrorCorrection } from './qr-matrix';

@Component({
  imports: [UiQrCode],
  template: `
    <ui-qr-code
      [value]="value()"
      [size]="size()"
      [level]="level()"
      [margin]="margin()"
      [label]="label()"
      [caption]="caption()"
    />
  `,
})
class Host {
  value = signal('https://addu.gov.mv/verify/BCP-2026-0418');
  size = signal(160);
  level = signal<UiQrErrorCorrection>('M');
  margin = signal(4);
  label = signal<string | undefined>(undefined);
  caption = signal<string | undefined>('BCP-2026-0418');
}

describe('ui-qr-code', () => {
  it('renders an inline SVG with role="img", default label, and LTR selectable caption', () => {
    const f = TestBed.createComponent(Host);
    f.detectChanges();
    const el = f.nativeElement as HTMLElement;
    const svg = el.querySelector('svg')!;
    expect(svg).toBeTruthy();
    expect(svg.getAttribute('role')).toBe('img');
    expect(svg.getAttribute('aria-label')).toBe('QR code');
    expect(svg.getAttribute('width')).toBe('160');
    expect(svg.getAttribute('height')).toBe('160');

    const cap = el.querySelector('.qr-caption')!;
    expect(cap.textContent?.trim()).toBe('BCP-2026-0418');
    expect(cap.getAttribute('dir')).toBe('ltr');
  });

  it('never allows quiet zone margin below 4 modules', () => {
    const f = TestBed.createComponent(Host);
    f.componentInstance.value.set('HELLO');
    f.componentInstance.margin.set(1);
    f.detectChanges();
    const svg = (f.nativeElement as HTMLElement).querySelector('svg')!;
    // Version 1 is 21x21; with minimum quiet zone 4 on each side, viewBox is 29x29
    expect(svg.getAttribute('viewBox')).toBe('0 0 29 29');
  });

  it('shows strings.qrTooLong and logs an error when value exceeds capacity, never drawing a truncated code', () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const f = TestBed.createComponent(Host);
    f.componentInstance.value.set('x'.repeat(3000));
    f.detectChanges();

    const el = f.nativeElement as HTMLElement;
    expect(el.querySelector('svg')).toBeNull();
    expect(el.querySelector('.qr-error')?.textContent?.trim()).toBe('Too much data for a QR code');
    expect(errSpy).toHaveBeenCalled();
    errSpy.mockRestore();
  });

  it('uses Dhivehi strings when provided', () => {
    TestBed.configureTestingModule({ providers: [provideUiStrings(uiStringsDv)] });
    const f = TestBed.createComponent(Host);
    f.detectChanges();
    const svg = (f.nativeElement as HTMLElement).querySelector('svg')!;
    expect(svg.getAttribute('aria-label')).toBe(uiStringsDv.qrCode);
  });

  it('exports SVG via toDataUrl("svg") and toBlob("svg")', async () => {
    const f = TestBed.createComponent(Host);
    f.detectChanges();
    const qr = f.debugElement.children[0].componentInstance as UiQrCode;

    const dataUrl = await qr.toDataUrl('svg');
    expect(dataUrl.startsWith('data:image/svg+xml;charset=utf-8,')).toBe(true);
    const decodedSvg = decodeURIComponent(dataUrl.split(',')[1]);
    expect(decodedSvg).toContain('<svg');
    expect(decodedSvg).toContain('<path');

    const blob = await qr.toBlob('svg');
    expect(blob.type).toContain('image/svg+xml');
    expect(blob.size).toBeGreaterThan(100);
  });
});
