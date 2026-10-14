import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { UiSnackbarHost, UiSnackbarService } from './snackbar';

describe('UiSnackbarService + ui-snackbar-host', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  function render() {
    const f = TestBed.createComponent(UiSnackbarHost);
    f.detectChanges();
    const el = f.nativeElement as HTMLElement;
    return { f, el, svc: TestBed.inject(UiSnackbarService) };
  }

  it('shows one notice at a time: a new one replaces the current one', () => {
    const { f, el, svc } = render();
    svc.show('Deleted “Title”');
    svc.show('Deleted “Photo”');
    f.detectChanges();
    const bars = el.querySelectorAll('ui-snackbar');
    expect(bars.length).toBe(1);
    expect(bars[0].textContent).toContain('Deleted “Photo”');
  });

  it('runs the action once and dismisses', () => {
    const { f, el, svc } = render();
    const run = vi.fn();
    svc.show({ message: 'Deleted “Title”', action: { label: 'Undo', run } });
    f.detectChanges();
    const btn = el.querySelector<HTMLButtonElement>('ui-snackbar .act')!;
    expect(btn.textContent!.trim()).toBe('Undo');
    btn.click();
    f.detectChanges();
    expect(run).toHaveBeenCalledTimes(1);
    expect(svc.current()).toBeNull();
  });

  it('leaves after 4s, or 10s when it has an action', () => {
    const { svc } = render();
    svc.show('Saved');
    vi.advanceTimersByTime(3999);
    expect(svc.current()).not.toBeNull();
    vi.advanceTimersByTime(1);
    expect(svc.current()).toBeNull();
    svc.show({ message: 'Deleted', action: { label: 'Undo', run: () => {} } });
    vi.advanceTimersByTime(9999);
    expect(svc.current()).not.toBeNull();
    vi.advanceTimersByTime(1);
    expect(svc.current()).toBeNull();
  });

  it('holds while paused and resumes with the time left', () => {
    const { svc } = render();
    svc.show('Saved');
    vi.advanceTimersByTime(3000);
    svc.pause();
    vi.advanceTimersByTime(60000);
    expect(svc.current()).not.toBeNull();
    svc.resume();
    vi.advanceTimersByTime(999);
    expect(svc.current()).not.toBeNull();
    vi.advanceTimersByTime(1);
    expect(svc.current()).toBeNull();
  });

  it('dismiss(id) only removes that notice', () => {
    const { svc } = render();
    const first = svc.show('One');
    svc.show('Two');
    svc.dismiss(first);
    expect(svc.current()?.message).toBe('Two');
  });

  it('announces title and message in an always-present live region', () => {
    const { f, el, svc } = render();
    const live = el.querySelector('[role="status"]')!;
    expect(live.getAttribute('aria-live')).toBe('polite');
    svc.show({ title: 'Stopped at a keyframe', message: 'Move it to trim further.' });
    f.detectChanges();
    expect(live.textContent).toBe('Stopped at a keyframe. Move it to trim further.');
  });

  it('lifts above a bottom bar by offset', () => {
    const { f, el } = render();
    f.componentRef.setInput('offset', 76);
    f.detectChanges();
    expect(el.querySelector<HTMLElement>('.host')!.style.getPropertyValue('--ui-snackbar-offset')).toBe('76px');
  });
});
