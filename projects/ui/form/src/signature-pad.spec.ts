import { Component, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { provideUiStrings, uiStringsDv } from '@zouriel/ui';
import {
  UI_SIGNATURE_MIN_INK_LENGTH,
  UiSignaturePad,
  type UiSignatureValue,
  uiSignatureInkLength,
  uiSignatureStrokeWidth,
  uiSignatureTrimBounds,
} from './signature-pad';

function makeCanvasStub() {
  const ctx = {
    strokeStyle: '',
    fillStyle: '',
    lineCap: 'butt',
    lineJoin: 'miter',
    lineWidth: 1,
    fillRect: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    quadraticCurveTo: vi.fn(),
    stroke: vi.fn(),
    arc: vi.fn(),
    fill: vi.fn(),
    drawImage: vi.fn(),
  } as unknown as CanvasRenderingContext2D;
  return ctx;
}

@Component({
  imports: [ReactiveFormsModule, UiSignaturePad],
  template: `
    <ui-signature-pad
      [mode]="mode()"
      [height]="height()"
      [penWidth]="penWidth()"
      [label]="label()"
      [description]="description()"
      [invalid]="invalid()"
      [formControl]="control"
    />
  `,
})
class Host {
  mode = signal<'signature' | 'thumbprint'>('signature');
  height = signal(180);
  penWidth = signal(2.5);
  label = signal<string | undefined>('Applicant signature');
  description = signal<string | undefined>('Sign inside the box');
  invalid = signal(false);
  control = new FormControl<UiSignatureValue | null>(null, Validators.required);
}

function pointer(type: string, x: number, y: number, extra: Partial<PointerEventInit> = {}): PointerEvent {
  const EventCtor = typeof PointerEvent !== 'undefined' ? PointerEvent : MouseEvent;
  return new EventCtor(type, {
    bubbles: true,
    clientX: x,
    clientY: y,
    button: 0,
    ...extra,
  }) as PointerEvent;
}

describe('ui-signature-pad helpers', () => {
  it('computes stroke width varying with pen pressure', () => {
    expect(uiSignatureStrokeWidth(2.5, 0.5, 'mouse')).toBe(2.5);
    expect(uiSignatureStrokeWidth(2.5, 1.0, 'pen')).toBeGreaterThan(2.5);
    expect(uiSignatureStrokeWidth(2.5, 0.1, 'pen')).toBeLessThan(2.5);
  });

  it('computes total Euclidean ink length', () => {
    const len = uiSignatureInkLength([
      [{ x: 0, y: 0, pressure: 0.5 }, { x: 3, y: 4, pressure: 0.5 }],
      [{ x: 10, y: 10, pressure: 0.5 }, { x: 10, y: 20, pressure: 0.5 }],
    ]);
    expect(len).toBe(15);
  });

  it('trims bounds to ink with padding and clamps to pad size', () => {
    expect(uiSignatureTrimBounds([], 300, 180)).toBeNull();
    const bounds = uiSignatureTrimBounds(
      [[{ x: 20, y: 30, pressure: 0.5 }, { x: 120, y: 80, pressure: 0.5 }]],
      300,
      180,
      10,
    );
    expect(bounds).toEqual({ x: 10, y: 20, width: 120, height: 70 });

    const clamped = uiSignatureTrimBounds(
      [[{ x: 2, y: 3, pressure: 0.5 }, { x: 298, y: 177, pressure: 0.5 }]],
      300,
      180,
      10,
    );
    expect(clamped).toEqual({ x: 0, y: 0, width: 300, height: 180 });
  });
});

describe('UiSignaturePad', () => {
  let origGetContext: typeof HTMLCanvasElement.prototype.getContext;
  let origToDataURL: typeof HTMLCanvasElement.prototype.toDataURL;
  let origToBlob: typeof HTMLCanvasElement.prototype.toBlob;

  beforeEach(() => {
    origGetContext = HTMLCanvasElement.prototype.getContext;
    origToDataURL = HTMLCanvasElement.prototype.toDataURL;
    origToBlob = HTMLCanvasElement.prototype.toBlob;

    HTMLCanvasElement.prototype.getContext = vi.fn(() => makeCanvasStub()) as unknown as typeof HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.toDataURL = vi.fn(() => 'data:image/png;base64,MOCKPNG');
    HTMLCanvasElement.prototype.toBlob = vi.fn((cb: BlobCallback) => cb(new Blob(['png'], { type: 'image/png' })));
  });

  afterEach(() => {
    HTMLCanvasElement.prototype.getContext = origGetContext;
    HTMLCanvasElement.prototype.toDataURL = origToDataURL;
    HTMLCanvasElement.prototype.toBlob = origToBlob;
  });

  function setup(fn?: (h: Host) => void) {
    const fixture = TestBed.createComponent(Host);
    fn?.(fixture.componentInstance);
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;
    const pad = fixture.debugElement.children[0].componentInstance as UiSignaturePad;
    const canvas = () => root.querySelector<HTMLCanvasElement>('canvas.pad')!;
    const buttons = () => [...root.querySelectorAll<HTMLButtonElement>('.actions button')];
    return { fixture, host: fixture.componentInstance, root, pad, canvas, buttons };
  }

  it('renders baseline, sign-here mark, and disabled Undo/Clear initially', () => {
    const { root, pad, canvas, buttons } = setup();
    expect(pad.isEmpty()).toBe(true);
    expect(root.querySelector('.sign-here')?.textContent?.trim()).toBe('Sign here');
    expect(canvas().getAttribute('aria-label')).toBe('Applicant signature');
    const descId = canvas().getAttribute('aria-describedby');
    expect(descId).toBeTruthy();
    expect(root.querySelector(`#${descId}`)?.textContent?.trim()).toBe('Sign inside the box');
    expect(buttons().every((b) => b.disabled)).toBe(true);
  });

  it('treats a stray dot under the minimum ink length as empty so required fails', () => {
    const { fixture, host, pad, canvas } = setup();
    const c = canvas();
    c.dispatchEvent(pointer('pointerdown', 20, 20, { pointerId: 1 }));
    c.dispatchEvent(pointer('pointermove', 25, 22, { pointerId: 1 }));
    c.dispatchEvent(pointer('pointerup', 25, 22, { pointerId: 1 }));
    fixture.detectChanges();

    expect(pad.isEmpty()).toBe(true);
    expect(host.control.value).toBeNull();
    expect(host.control.hasError('required')).toBe(true);
  });

  it('emits UiSignatureValue only after stroke ends and supports undo, clear, and toBlob', async () => {
    const { fixture, host, pad, canvas, buttons } = setup();
    const c = canvas();

    c.dispatchEvent(pointer('pointerdown', 10, 40, { pointerId: 1 }));
    c.dispatchEvent(pointer('pointermove', 60, 40, { pointerId: 1 }));
    fixture.detectChanges();
    // Not emitted mid-stroke
    expect(host.control.value).toBeNull();

    c.dispatchEvent(pointer('pointerup', 100, 40, { pointerId: 1 }));
    fixture.detectChanges();

    expect(pad.isEmpty()).toBe(false);
    expect(host.control.valid).toBe(true);
    const val = host.control.value!;
    expect(val.kind).toBe('signature');
    expect(val.dataUrl).toBe('data:image/png;base64,MOCKPNG');
    expect(val.strokes).toBe(1);
    expect(val.width).toBeGreaterThan(0);
    expect(val.height).toBeGreaterThan(0);
    expect(Date.parse(val.capturedAt)).not.toBeNaN();
    expect(buttons().every((b) => !b.disabled)).toBe(true);

    const blob = await pad.toBlob();
    expect(blob).toBeInstanceOf(Blob);

    // Second stroke then undo
    c.dispatchEvent(pointer('pointerdown', 20, 80, { pointerId: 2 }));
    c.dispatchEvent(pointer('pointermove', 80, 80, { pointerId: 2 }));
    c.dispatchEvent(pointer('pointerup', 80, 80, { pointerId: 2 }));
    fixture.detectChanges();
    expect(host.control.value?.strokes).toBe(2);

    pad.undo();
    fixture.detectChanges();
    expect(host.control.value?.strokes).toBe(1);

    pad.clear();
    fixture.detectChanges();
    expect(pad.isEmpty()).toBe(true);
    expect(host.control.value).toBeNull();
    expect(await pad.toBlob()).toBeNull();
  });

  it('respects FormControl.disable() and invalid styling', () => {
    const { fixture, host, root, buttons } = setup((h) => h.invalid.set(true));
    expect(root.querySelector('.root.invalid')).toBeTruthy();

    host.control.disable();
    fixture.detectChanges();
    expect(root.querySelector('.root.disabled')).toBeTruthy();
    expect(buttons().every((b) => b.disabled)).toBe(true);
  });

  it('supports thumbprint mode reusing ui-file-upload with capture="environment"', () => {
    const { root } = setup((h) => h.mode.set('thumbprint'));
    const upload = root.querySelector('ui-file-upload');
    expect(upload).toBeTruthy();
    const input = root.querySelector<HTMLInputElement>('ui-file-upload input.picker-native');
    expect(input?.getAttribute('capture')).toBe('environment');
    expect(input?.getAttribute('accept')).toBe('image/*');
  });

  it('uses Dhivehi strings when provided', () => {
    TestBed.configureTestingModule({ providers: [provideUiStrings(uiStringsDv)] });
    const { root } = setup();
    expect(root.querySelector('.sign-here')?.textContent?.trim()).toBe(uiStringsDv.signHere);
    const texts = [...root.querySelectorAll('.actions button')].map((b) => b.textContent?.trim());
    expect(texts).toContain(uiStringsDv.signatureUndo);
    expect(texts).toContain(uiStringsDv.signatureClear);
  });
});
