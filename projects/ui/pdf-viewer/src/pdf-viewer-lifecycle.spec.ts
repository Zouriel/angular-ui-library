import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it, vi } from 'vitest';

/* pdf.js loads lazily: a viewer destroyed (or given a new src) while it loads must not touch its
   view afterwards, and the document that arrives late is released. pdf.js is mocked behind a gate. */
let release!: () => void;
const gate = new Promise<void>((r) => (release = r));
const destroyedDocs: string[] = [];
const opened: string[] = [];
const rendered = vi.fn();
const fakePdfjs = {
  version: 'test',
  GlobalWorkerOptions: {},
  getDocument: (url: string) => (opened.push(url), {
    promise: Promise.resolve({
      numPages: 3,
      destroy: () => destroyedDocs.push(url),
      getPage: async () => {
        rendered(url);
        return { getViewport: () => ({ width: 10, height: 10 }), render: () => ({ promise: Promise.resolve() }) };
      },
    }),
  }),
};

import { UI_PDFJS, UiPdfViewer } from './pdf-viewer';

@Component({ imports: [UiPdfViewer], template: `@if (show()) { <ui-pdf-viewer [src]="src()" /> }` })
class Host {
  show = signal(true);
  src = signal('/a.pdf');
}

describe('ui-pdf-viewer lifecycle', () => {
  it('destroyed while pdf.js loads: no error, the document is never opened or drawn', async () => {
    TestBed.configureTestingModule({ providers: [{ provide: UI_PDFJS, useValue: () => gate.then(() => fakePdfjs) }] });
    const f = TestBed.createComponent(Host);
    f.detectChanges();
    TestBed.tick(); // effects: the load starts and waits for pdf.js
    f.componentInstance.show.set(false);
    f.detectChanges();
    TestBed.tick();
    release();
    await gate;
    await new Promise((r) => setTimeout(r, 20));
    expect(opened).toEqual([]);
    expect(rendered).not.toHaveBeenCalled();
  });

  it('a new src while the first one loads: only the newest is opened and drawn', async () => {
    TestBed.configureTestingModule({ providers: [{ provide: UI_PDFJS, useValue: () => Promise.resolve(fakePdfjs) }] });
    const f = TestBed.createComponent(Host);
    f.detectChanges();
    TestBed.tick(); // loads /a.pdf
    f.componentInstance.src.set('/b.pdf');
    TestBed.tick(); // loads /b.pdf before /a.pdf has finished
    await new Promise((r) => setTimeout(r, 20));
    TestBed.tick();
    expect(opened).toEqual(['/b.pdf']);
    expect(rendered.mock.calls.map((c) => c[0])).toEqual(['/b.pdf']);
    f.destroy();
    expect(destroyedDocs).toEqual(['/b.pdf']);
  });
});
