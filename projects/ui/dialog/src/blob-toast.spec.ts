import { Component, TemplateRef, viewChild } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { uiBlobToastHasBody } from './blob-toast';
import { UiToastHost, UiToastService } from './toast';

/*
 * 0.88.0: the blob toast, a pill that grows a card as one shape, with update() to change a showing
 * toast and promise() to follow a promise from a loading pill to a success or error card.
 */

describe('UiToastService: blob, update, promise (0.88.0)', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('blob() queues a blob toast with the title in the pill; show() still defaults to a card', () => {
    const s = TestBed.inject(UiToastService);
    const id = s.blob('Changes Saved', { tone: 'success', message: 'Saved to the database.' });
    s.show({ message: 'Plain' });
    const [blob, card] = s.toasts();
    expect(blob).toMatchObject({ id, variant: 'blob', title: 'Changes Saved', message: 'Saved to the database.', tone: 'success', loading: false, duration: 4000 });
    expect(card).toMatchObject({ variant: 'card', loading: false, message: 'Plain' });
    expect(s.blob('Link Copied')).toBeGreaterThan(id);
    expect(s.toasts()[2].message).toBe('');
  });

  it('a loading toast stays until it is updated; then the countdown starts', () => {
    const s = TestBed.inject(UiToastService);
    const id = s.blob('Uploading', { loading: true });
    expect(s.toasts()[0].duration).toBe(0);
    vi.advanceTimersByTime(60_000);
    expect(s.toasts().length).toBe(1);
    s.update(id, { loading: false, tone: 'success', title: 'File Uploaded', message: 'report.pdf is in your files.' });
    expect(s.toasts()[0]).toMatchObject({ id, loading: false, tone: 'success', title: 'File Uploaded', duration: 4000, variant: 'blob' });
    vi.advanceTimersByTime(3999);
    expect(s.toasts().length).toBe(1);
    vi.advanceTimersByTime(1);
    expect(s.toasts().length).toBe(0);
  });

  it('update() restarts the countdown, keeps what it is not given, and clears with undefined', () => {
    const s = TestBed.inject(UiToastService);
    const run = vi.fn();
    const id = s.blob('Draft', { message: 'Body', action: { label: 'Open', run }, duration: 1000 });
    const before = s.toasts()[0];
    vi.advanceTimersByTime(900);
    s.update(id, { title: 'Sent', action: undefined });
    const after = s.toasts()[0];
    expect(after).not.toBe(before);
    expect(after).toMatchObject({ title: 'Sent', message: 'Body', duration: 1000, tone: 'info' });
    expect(after.action).toBeUndefined();
    vi.advanceTimersByTime(900);
    expect(s.toasts().length).toBe(1);
    vi.advanceTimersByTime(100);
    expect(s.toasts().length).toBe(0);
    // Unknown ids are ignored.
    expect(() => s.update(999, { title: 'x' })).not.toThrow();
  });

  it('promise(): a loading pill that becomes the success toast, and returns the same promise', async () => {
    const s = TestBed.inject(UiToastService);
    let resolve!: (v: string) => void;
    const p = new Promise<string>((r) => (resolve = r));
    const returned = s.promise(p, {
      loading: 'Booking Flight',
      success: (code) => ({ title: 'Booking Confirmed', message: `Flight ${code}` }),
      error: 'Something Went Wrong',
    });
    expect(returned).toBe(p);
    expect(s.toasts()[0]).toMatchObject({ variant: 'blob', loading: true, title: 'Booking Flight', duration: 0 });
    resolve('Q2 204');
    await p;
    await Promise.resolve();
    expect(s.toasts()[0]).toMatchObject({ loading: false, tone: 'success', title: 'Booking Confirmed', message: 'Flight Q2 204', duration: 4000 });
  });

  it('promise(): a rejection becomes the error toast and is not left unhandled by the toast', async () => {
    const s = TestBed.inject(UiToastService);
    const p = Promise.reject(new Error('offline'));
    const seen = s.promise(p, { loading: { title: 'Saving', message: 'One moment' }, success: 'Saved', error: (e) => ({ title: 'Something Went Wrong', message: (e as Error).message }) });
    await seen.catch(() => {});
    await Promise.resolve();
    expect(s.toasts()[0]).toMatchObject({ loading: false, tone: 'danger', title: 'Something Went Wrong', message: 'offline' });
  });
});

@Component({
  imports: [UiToastHost],
  template: `<ui-toast-host [position]="position" /><ng-template #extra let-t><span class="extra">For {{ t.title }}</span></ng-template>`,
})
class Harness {
  position: 'top-center' | 'bottom-end' | 'top-left' = 'top-center';
  extra = viewChild.required<TemplateRef<unknown>>('extra');
}

describe('ui-blob-toast in the host (0.88.0)', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  function render(position: Harness['position'] = 'top-center') {
    const f = TestBed.createComponent(Harness);
    f.componentInstance.position = position;
    f.detectChanges();
    const el = f.nativeElement as HTMLElement;
    return { f, el, s: TestBed.inject(UiToastService), q: <T extends Element = HTMLElement>(sel: string) => el.querySelector<T>(sel) };
  }
  const flush = (f: { detectChanges(): void }, ms = 0) => { vi.advanceTimersByTime(ms); f.detectChanges(); };

  it('draws the title in the pill and the message and action in the card, coloured by tone', () => {
    const { f, s, q, el } = render();
    const run = vi.fn();
    s.blob('New Update Available', { message: 'Version 2.4 is ready.', action: { label: 'Share Now', run }, duration: 0 });
    flush(f);
    expect(q('ui-blob-toast .blob')!.dataset['tone']).toBe('info');
    expect(q('.blob')!.getAttribute('role')).toBe('status');
    expect(q('.pill .title')!.textContent).toBe('New Update Available');
    expect(q('.pill .badge svg')).not.toBeNull();
    expect(q('.body .msg')!.textContent).toBe('Version 2.4 is ready.');
    expect(q('.shape path')).not.toBeNull();
    // The card toast's markup is not used for it.
    expect(el.querySelector('.toast')).toBeNull();
    q('.act')!.click();
    flush(f);
    expect(run).toHaveBeenCalledTimes(1);
    expect(s.toasts().length).toBe(0);
  });

  it('the card can be reached only once it is open', () => {
    const { f, s, q } = render();
    s.blob('Changes Saved', { tone: 'success', message: 'Saved.', duration: 0 });
    flush(f);
    expect(q('.body')!.hasAttribute('inert')).toBe(true);
    flush(f, 400);
    expect(q('.body')!.hasAttribute('inert')).toBe(false);
  });

  it('with only a title it stays a pill: no message, and the card stays closed', () => {
    const { f, s, q } = render();
    s.blob('Link Copied', { tone: 'success', duration: 0 });
    flush(f, 1000);
    expect(q('.pill .title')!.textContent).toBe('Link Copied');
    expect(q('.msg')).toBeNull();
    expect(q('.body')!.hasAttribute('inert')).toBe(true);
    expect(uiBlobToastHasBody({ title: 'Link Copied', message: '' })).toBe(false);
    expect(uiBlobToastHasBody({ title: 'T', message: 'M' })).toBe(true);
    expect(uiBlobToastHasBody({ title: 'T', message: '', action: { label: 'Go', run: () => {} } })).toBe(true);
    // A message with no title is the pill's text, not a card.
    expect(uiBlobToastHasBody({ message: 'Saved' })).toBe(false);
  });

  it('warning and danger are alerts; clicking the pill dismisses', () => {
    const { f, s, q } = render();
    s.blob('Something Went Wrong', { tone: 'danger', message: 'Try again.', duration: 0 });
    flush(f);
    expect(q('.blob')!.dataset['tone']).toBe('danger');
    expect(q('.blob')!.getAttribute('role')).toBe('alert');
    // Once open, a click on the pill dismisses (on a closed one it opens the card).
    flush(f, 1000);
    expect(q('.pill')!.getAttribute('title')).toBeTruthy();
    q('.pill')!.click();
    flush(f);
    expect(s.toasts().length).toBe(0);
  });

  it('loading: a spinner and the muted tone, then update() swaps the title and colour at the pill', () => {
    const { f, s, q } = render();
    const id = s.blob('Booking Flight', { loading: true });
    flush(f, 600);
    expect(q('.blob')!.dataset['tone']).toBe('loading');
    expect(q('.pill .spin')).not.toBeNull();
    expect(q('.pill .badge svg')).toBeNull();
    s.update(id, { loading: false, tone: 'success', title: 'Booking Confirmed', message: 'Flight Q2 204', duration: 0 });
    flush(f);
    expect(q('.pill .title')!.textContent).toBe('Booking Confirmed');
    expect(q('.blob')!.dataset['tone']).toBe('success');
    expect(q('.pill .spin')).toBeNull();
    expect(q('.msg')!.textContent).toBe('Flight Q2 204');
    // Still closed while the pill shows the new state, then it opens.
    expect(q('.body')!.hasAttribute('inert')).toBe(true);
    flush(f, 400);
    expect(q('.body')!.hasAttribute('inert')).toBe(false);
  });

  it('update() on an open toast closes it to the pill before the new title shows', () => {
    const { f, s, q } = render();
    const id = s.blob('Changes Saved', { tone: 'success', message: 'Saved.', duration: 0 });
    flush(f, 2000);
    expect(q('.body')!.hasAttribute('inert')).toBe(false);
    s.update(id, { tone: 'danger', title: 'Something Went Wrong', message: 'Not saved.' });
    flush(f);
    expect(q('.pill .title')!.textContent).toBe('Changes Saved');
    expect(q('.body')!.hasAttribute('inert')).toBe(true);
    flush(f, 3000);
    expect(q('.pill .title')!.textContent).toBe('Something Went Wrong');
    expect(q('.blob')!.dataset['tone']).toBe('danger');
    expect(q('.body')!.hasAttribute('inert')).toBe(false);
  });

  it('auto: a lone blob toast opens by itself; with more than one they stay pills until hovered', () => {
    const { f, s, el } = render();
    const a = s.blob('Changes Saved', { tone: 'success', message: 'Saved.', duration: 0 });
    flush(f, 1000);
    const bodies = () => Array.from(el.querySelectorAll<HTMLElement>('.body'));
    const open = () => bodies().map((b) => !b.hasAttribute('inert'));
    expect(open()).toEqual([true]);
    // A second one arrives: the first closes and the new one never opens by itself.
    const b = s.blob('File Uploaded', { message: 'report.pdf', duration: 0 });
    flush(f, 2000);
    expect(open()).toEqual([false, false]);
    // A card toast does not count.
    s.show({ message: 'Plain', duration: 0 });
    flush(f, 500);
    expect(open()).toEqual([false, false]);
    const blobs = Array.from(el.querySelectorAll<HTMLElement>('.blob'));
    blobs[1].dispatchEvent(new Event('mouseenter'));
    flush(f, 500);
    expect(open()).toEqual([false, true]);
    expect(blobs[1].classList.contains('live')).toBe(true);
    blobs[1].dispatchEvent(new Event('mouseleave'));
    flush(f, 500);
    expect(open()).toEqual([false, false]);
    // Keyboard focus opens it too.
    blobs[0].dispatchEvent(new Event('focusin'));
    flush(f, 500);
    expect(open()).toEqual([true, false]);
    blobs[0].dispatchEvent(new Event('focusout'));
    flush(f, 500);
    // Back to one: it opens again.
    s.dismiss(b);
    flush(f, 1000);
    expect(open()).toEqual([true]);
    s.dismiss(a);
  });

  it('a closed pill opens on a click (a tap on touch) and dismisses on the next', () => {
    const { f, s, el, q } = render();
    s.blob('One', { message: 'First.', duration: 0 });
    s.blob('Two', { message: 'Second.', duration: 0 });
    flush(f, 1000);
    const pill = el.querySelectorAll<HTMLElement>('.pill')[0];
    expect(pill.getAttribute('aria-expanded')).toBe('false');
    expect(pill.hasAttribute('title')).toBe(false);
    pill.click();
    flush(f, 500);
    expect(s.toasts().length).toBe(2);
    expect(q('.body')!.hasAttribute('inert')).toBe(false);
    expect(pill.getAttribute('aria-expanded')).toBe('true');
    pill.click();
    flush(f, 500);
    expect(s.toasts().map((t) => t.title)).toEqual(['Two']);
  });

  it('blobExpand: always opens every one; hover never opens one by itself', () => {
    for (const [mode, expected] of [['always', [true, true]], ['hover', [false]]] as const) {
      const f = TestBed.createComponent(UiToastHost);
      f.componentRef.setInput('blobExpand', mode);
      f.detectChanges();
      const s = TestBed.inject(UiToastService);
      for (let i = 0; i < expected.length; i++) s.blob(`T${i}`, { message: 'Body', duration: 0 });
      flush(f, 1000);
      const open = Array.from((f.nativeElement as HTMLElement).querySelectorAll('.body')).map((b) => !b.hasAttribute('inert'));
      expect(open).toEqual(expected);
      for (const t of s.toasts()) s.dismiss(t.id);
      TestBed.resetTestingModule();
    }
  });

  it('custom content is drawn in the card with the toast as its context', () => {
    const { f, s, q } = render();
    s.blob('Booking Confirmed', { tone: 'success', content: f.componentInstance.extra(), duration: 0 });
    flush(f);
    expect(q('.body .custom .extra')!.textContent).toBe('For Booking Confirmed');
  });

  it('keeps to the host side: pill in the middle for a centred stack, on the side for a corner', () => {
    for (const [position, side] of [['top-center', 'center'], ['bottom-end', 'right'], ['top-left', 'left']] as const) {
      const { f, s, q } = render(position);
      s.blob('Saved', { duration: 0 });
      flush(f);
      expect(q('.blob')!.dataset['side']).toBe(side);
      s.dismiss(s.toasts()[0].id);
      TestBed.resetTestingModule();
    }
  });

  it('a card toast that is loading shows a spinner for its icon', () => {
    const { f, s, q } = render();
    s.show({ message: 'Working', loading: true });
    flush(f);
    expect(q('.toast .icon .spin')).not.toBeNull();
    expect(q('.toast .icon svg')).toBeNull();
    expect(s.toasts()[0].duration).toBe(0);
  });
});
