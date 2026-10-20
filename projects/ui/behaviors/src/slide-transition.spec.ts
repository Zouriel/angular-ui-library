import { Component, signal, viewChild, runInInjectionContext, Injector } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { UiSlideTransition, uiSlideRouteTransition } from './slide-transition';

@Component({
  imports: [UiSlideTransition],
  template: `<section [uiSlideTransition]="from()" [style.direction]="dir()">{{ view() }}</section>`,
})
class Host {
  from = signal<'start' | 'end'>('start');
  dir = signal<'ltr' | 'rtl'>('ltr');
  view = signal('search');
  slide = viewChild.required(UiSlideTransition);
}

/** A fake document.startViewTransition that records what the page looked like when it was called. */
function fakeViewTransitions() {
  const seen: { name: string; mode: string | null; inside: string }[] = [];
  let finish!: () => void;
  (document as unknown as { startViewTransition: unknown }).startViewTransition = (cb: () => unknown) => {
    const el = document.querySelector('section')!;
    const before = { name: el.style.getPropertyValue('view-transition-name'), mode: document.documentElement.getAttribute('data-ui-slide') };
    const done = Promise.resolve(cb()).then(() => seen.push({ ...before, inside: el.textContent!.trim() }));
    const finished = new Promise<void>((r) => (finish = r));
    return { finished: done.then(() => finished), skipTransition() {} };
  };
  return { seen, finish: () => finish() };
}

function reducedMotion(on: boolean) {
  window.matchMedia = ((q: string) => ({ matches: on && q.includes('reduce'), media: q })) as unknown as typeof window.matchMedia;
}

describe('uiSlideTransition', () => {
  afterEach(() => {
    delete (document as unknown as { startViewTransition?: unknown }).startViewTransition;
    document.documentElement.removeAttribute('data-ui-slide');
    document.documentElement.classList.remove('ui-no-anim');
    reducedMotion(false);
  });

  function setup() {
    reducedMotion(false);
    const f = TestBed.createComponent(Host);
    document.body.appendChild(f.nativeElement);
    f.detectChanges();
    return f;
  }

  it('resolves start/end to a physical side by the text direction, back reverses, reduced motion fades', () => {
    const f = setup();
    const s = f.componentInstance.slide();
    expect(s.mode()).toBe('in-left');
    expect(s.mode({ from: 'end' })).toBe('in-right');
    expect(s.mode({ back: true })).toBe('out-left');
    f.componentInstance.dir.set('rtl');
    f.detectChanges();
    expect(s.mode()).toBe('in-right');
    expect(s.mode({ from: 'end' })).toBe('in-left');
    expect(s.mode({ back: true })).toBe('out-right');
    reducedMotion(true);
    expect(s.mode()).toBe('fade');
  });

  it('names the region and marks the slide before the old view is captured, renders the new view inside, then cleans up', async () => {
    const f = setup();
    const vt = fakeViewTransitions();
    const done = f.componentInstance.slide().run(() => f.componentInstance.view.set('nurses'));
    await new Promise((r) => setTimeout(r));
    expect(vt.seen).toEqual([{ name: 'ui-slide', mode: 'in-left', inside: 'nurses' }]);
    expect(document.documentElement.getAttribute('data-ui-slide')).toBe('in-left');
    vt.finish();
    await done;
    expect(document.documentElement.hasAttribute('data-ui-slide')).toBe(false);
    expect(document.querySelector('section')!.style.getPropertyValue('view-transition-name')).toBe('');
  });

  it('just changes the view when the library animations are off, or without the View Transitions API', async () => {
    const f = setup();
    document.documentElement.classList.add('ui-no-anim');
    const vt = fakeViewTransitions();
    await f.componentInstance.slide().run(() => f.componentInstance.view.set('a'));
    expect(vt.seen).toEqual([]);
    expect(document.querySelector('section')!.textContent!.trim()).toBe('a');
    document.documentElement.classList.remove('ui-no-anim');
    delete (document as unknown as { startViewTransition?: unknown }).startViewTransition;
    await f.componentInstance.slide().run(() => f.componentInstance.view.set('b'));
    expect(document.querySelector('section')!.textContent!.trim()).toBe('b');
  });
});

describe('uiSlideRouteTransition', () => {
  const snap = (data: Record<string, unknown>) => ({ data: {}, firstChild: { data, firstChild: null } });
  function run(from: Record<string, unknown>, to: Record<string, unknown>) {
    const skip = vi.fn();
    let finish!: () => void;
    const finished = new Promise<void>((r) => (finish = r));
    runInInjectionContext(TestBed.inject(Injector), () =>
      uiSlideRouteTransition({ transition: { finished, skipTransition: skip }, from: snap(from), to: snap(to) }),
    );
    return { skip, finish, mode: document.documentElement.getAttribute('data-ui-slide') };
  }

  it('slides into a route with data.uiSlide, back out of one, and skips other navigations', async () => {
    reducedMotion(false);
    let r = run({}, { uiSlide: 'start' });
    expect(r.skip).not.toHaveBeenCalled();
    expect(r.mode).toBe('in-left');
    expect(document.body.style.getPropertyValue('view-transition-name')).toBe('ui-slide');
    r.finish();
    await new Promise((res) => setTimeout(res));
    expect(document.documentElement.hasAttribute('data-ui-slide')).toBe(false);
    expect(document.body.style.getPropertyValue('view-transition-name')).toBe('');
    r = run({ uiSlide: 'start' }, {});
    expect(r.mode).toBe('out-left');
    r.finish();
    await new Promise((res) => setTimeout(res));
    r = run({}, {});
    expect(r.skip).toHaveBeenCalled();
    expect(r.mode).toBeNull();
  });
});
