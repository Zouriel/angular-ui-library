import { DestroyRef } from '@angular/core';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { uiWatchTheme } from './theme-watch';

/* 0.40.2: one watcher for every component that reads theme tokens (feature-card colours, Google button, map). */

class FakeDestroy implements Partial<DestroyRef> {
  fns: Array<() => void> = [];
  onDestroy(fn: () => void) {
    this.fns.push(fn);
    return () => undefined;
  }
  destroy() {
    this.fns.forEach((f) => f());
  }
}

const tick = () => new Promise((r) => setTimeout(r, 0));

let listeners: Array<() => void> = [];
let wrap: HTMLElement;
let el: HTMLElement;

beforeEach(() => {
  listeners = [];
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: (q: string) => ({
      media: q,
      matches: true,
      addEventListener: (_: string, fn: () => void) => listeners.push(fn),
      removeEventListener: (_: string, fn: () => void) => (listeners = listeners.filter((f) => f !== fn)),
    }),
  });
  wrap = document.createElement('section');
  el = document.createElement('div');
  wrap.append(el);
  document.body.append(wrap);
});

afterEach(() => {
  delete (window as { matchMedia?: unknown }).matchMedia;
  wrap.remove();
  document.documentElement.removeAttribute('data-theme');
  document.documentElement.className = '';
  document.head.querySelectorAll('[data-test-sheet]').forEach((n) => n.remove());
});

function watch() {
  const d = new FakeDestroy();
  let n = 0;
  const stop = uiWatchTheme(el, d as unknown as DestroyRef, () => n++);
  return { d, stop, count: () => n };
}

describe('uiWatchTheme', () => {
  it('checks at once, then on each thing that can change the tokens', async () => {
    const w = watch();
    expect(w.count()).toBe(1);
    const steps: Array<[string, () => void]> = [
      ['data-theme on <html>', () => document.documentElement.setAttribute('data-theme', 'maldives')],
      ['data-theme on an ancestor (a scoped provider)', () => wrap.setAttribute('data-theme', 'maldives-dark')],
      ['a class on <html>', () => document.documentElement.classList.add('dark')],
      ['a class on <body>', () => document.body.classList.add('light')],
      ['inline tokens on an ancestor', () => wrap.style.setProperty('--ui-color-surface', '#fff')],
      ['a <style> added to <head>', () => { const s = document.createElement('style'); s.setAttribute('data-test-sheet', ''); document.head.append(s); }],
      ['a <link> swapping media (critical-CSS loader)', () => { const l = document.createElement('link'); l.setAttribute('data-test-sheet', ''); l.media = 'print'; document.head.append(l); }],
      ['a stylesheet finishing loading', () => document.head.querySelector('link[data-test-sheet]')!.dispatchEvent(new Event('load'))],
      ['the device preference', () => listeners.forEach((f) => f())],
    ];
    for (const [what, act] of steps) {
      const before = w.count();
      act();
      await tick();
      expect(w.count(), what).toBe(before + 1);
    }
    w.stop();
  });

  it('coalesces a burst of changes into one check', async () => {
    const w = watch();
    document.documentElement.setAttribute('data-theme', 'maldives');
    document.documentElement.classList.add('x');
    listeners.forEach((f) => f());
    await tick();
    expect(w.count()).toBe(2);
    w.stop();
  });

  it('ignores unrelated changes (a class on a sibling, a load that is not a stylesheet link)', async () => {
    const w = watch();
    const sib = document.createElement('p');
    document.body.append(sib);
    sib.classList.add('busy');
    const img = document.createElement('img');
    document.body.append(img);
    img.dispatchEvent(new Event('load'));
    await tick();
    expect(w.count()).toBe(1);
    sib.remove();
    img.remove();
    w.stop();
  });

  it('stops on destroy: no more checks, listeners removed', async () => {
    const w = watch();
    expect(listeners.length).toBe(1);
    w.d.destroy();
    document.documentElement.setAttribute('data-theme', 'maldives');
    listeners.forEach((f) => f());
    await tick();
    expect(w.count()).toBe(1);
    expect(listeners.length).toBe(0);
  });
});
