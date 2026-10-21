import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { UI_PDFJS, UiPdfViewer, pdfFitScale } from './pdf-viewer';

/**
 * `fill`: each page fitted (contain, centred) into whatever the parent gives, 100% meaning fitted,
 * controls floating over the bottom. pdf.js is faked through UI_PDFJS (an A5 landscape page, 420x297
 * points) and the canvas context is stubbed, so the size the viewer asks pdf.js to draw at is what
 * these tests read back. jsdom does no layout, so the scroller's box is stubbed.
 */
const renders: number[] = [];
const fakePdfjs = {
  version: 'test',
  GlobalWorkerOptions: {},
  getDocument: () => ({
    promise: Promise.resolve({
      numPages: 2,
      destroy: () => undefined,
      getPage: async () => ({
        getViewport: ({ scale }: { scale: number }) => ({ width: 420 * scale, height: 297 * scale }),
        render: ({ viewport }: { viewport: { width: number } }) => (renders.push(viewport.width), { promise: Promise.resolve() }),
      }),
    }),
  }),
};

@Component({ imports: [UiPdfViewer], template: `<ui-pdf-viewer src="/slip.pdf" [fill]="fill()" />` })
class Host {
  fill = signal(true);
}

describe('ui-pdf-viewer fill', () => {
  let fixture: ComponentFixture<Host>;
  let root: HTMLElement;
  const q = <T extends Element = HTMLElement>(sel: string) => root.querySelector(sel) as T;
  const btn = (label: string) => q<HTMLButtonElement>(`button[aria-label="${label}"]`);
  const pct = () => q('.pct').textContent!.trim();
  const width = () => q<HTMLCanvasElement>('canvas').style.width;

  async function settle(): Promise<void> {
    for (let i = 0; i < 4; i++) {
      TestBed.tick();
      await new Promise((r) => setTimeout(r, 5));
    }
    fixture.detectChanges();
  }

  async function open(fill: boolean): Promise<void> {
    TestBed.configureTestingModule({ providers: [{ provide: UI_PDFJS, useValue: () => Promise.resolve(fakePdfjs) }] });
    fixture = TestBed.createComponent(Host);
    fixture.componentInstance.fill.set(fill);
    fixture.detectChanges();
    root = fixture.nativeElement;
    // A phone-sized area: 390 wide, 700 tall.
    const scroller = q('.scroller');
    Object.defineProperty(scroller, 'clientWidth', { configurable: true, value: 390 });
    Object.defineProperty(scroller, 'clientHeight', { configurable: true, value: 700 });
    await settle();
  }

  beforeEach(() => {
    renders.length = 0;
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({} as never);
  });
  afterEach(() => vi.restoreAllMocks());

  it('fits the page to the area at 100%: as wide as it is, since this page is landscape', async () => {
    await open(true);
    expect(pct()).toBe('100%');
    expect(width()).toBe('390px');
    expect(renders.at(-1)).toBeCloseTo(390, 5);
  });

  it('zooms from the fitted size and Fit puts it back', async () => {
    await open(true);
    btn('Zoom in').click();
    await settle();
    expect(pct()).toBe('120%');
    expect(parseFloat(width())).toBeCloseTo(468, 1);
    btn('Fit page').click();
    await settle();
    expect(pct()).toBe('100%');
    expect(width()).toBe('390px');
  });

  it('ctrl + wheel zooms; a plain wheel is left to scroll', async () => {
    await open(true);
    const scroller = q('.scroller');
    const plain = new WheelEvent('wheel', { deltaY: -100, bubbles: true, cancelable: true });
    scroller.dispatchEvent(plain);
    expect(plain.defaultPrevented).toBe(false);
    scroller.dispatchEvent(new WheelEvent('wheel', { deltaY: -100, ctrlKey: true, bubbles: true, cancelable: true }));
    await settle();
    expect(pct()).toBe('110%');
  });

  it('a two-finger pinch scales the page live and commits when the fingers lift', async () => {
    await open(true);
    const scroller = q('.scroller');
    const touches = (spread: number) => [
      { clientX: 100, clientY: 300, identifier: 1 },
      { clientX: 100 + spread, clientY: 300, identifier: 2 },
    ] as unknown as Touch[];
    const fire = (type: string, list: Touch[]) => {
      const e = new Event(type, { bubbles: true, cancelable: true });
      Object.defineProperty(e, 'touches', { value: list });
      scroller.dispatchEvent(e);
      return e;
    };
    fire('touchstart', touches(100));
    const move = fire('touchmove', touches(150));
    fixture.detectChanges();
    expect(move.defaultPrevented).toBe(true);
    expect(q<HTMLCanvasElement>('canvas').style.transform).toBe('scale(1.5)');
    fire('touchend', []);
    await settle();
    expect(pct()).toBe('150%');
    expect(q<HTMLCanvasElement>('canvas').style.transform).toBe('');
  });

  it('floats the controls at the bottom, labelled, with a Fit button', async () => {
    await open(true);
    const bar = q('.bar');
    expect(bar.classList).toContain('overlay');
    const css = getComputedStyle(bar);
    expect(css.position).toBe('absolute');
    expect(css.bottom).toContain('safe-area-inset-bottom');
    expect(bar.getAttribute('aria-label')).toBe('Page controls');
    expect(q('.pg').getAttribute('aria-label')).toBe('Page 1 of 2');
    expect(q('canvas').getAttribute('aria-label')).toBe('Page 1');
    for (const label of ['Previous page', 'Next page', 'Zoom out', 'Zoom in', 'Fit page']) expect(btn(label)).not.toBeNull();
    btn('Next page').click();
    await settle();
    expect(q('.pg').textContent!.trim()).toBe('2 / 2');
    expect(getComputedStyle(q('.pv')).borderRadius).toBe('0px');
  });

  it('without fill: the bar on top, no Fit, pdf.js scale 120% as before', async () => {
    await open(false);
    expect(q('.bar').classList).not.toContain('overlay');
    expect(btn('Fit page')).toBeNull();
    expect(pct()).toBe('120%');
    expect(parseFloat(width())).toBeCloseTo(504, 1);
  });
});

describe('pdfFitScale', () => {
  it('contains the page either way round; an unmeasured box gives 1', () => {
    expect(pdfFitScale({ width: 420, height: 297 }, { width: 390, height: 700 })).toBeCloseTo(390 / 420, 6);
    expect(pdfFitScale({ width: 595, height: 842 }, { width: 390, height: 500 })).toBeCloseTo(500 / 842, 6);
    expect(pdfFitScale({ width: 595, height: 842 }, { width: 0, height: 0 })).toBe(1);
  });
});
