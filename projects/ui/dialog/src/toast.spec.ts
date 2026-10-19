import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { UiSnackbarService } from './snackbar';
import { UiToastHost, UiToastService, type UiToastPosition } from './toast';

/** Toasts must move from and back to the edge they sit against, not always from the right. */
describe('UiToastHost motion', () => {
  function render(position: UiToastPosition) {
    const f = TestBed.createComponent(UiToastHost);
    f.componentRef.setInput('position', position);
    f.detectChanges();
    const motion = (f.componentInstance as unknown as { motion: () => { enter: string; leave: string } }).motion();
    const host = (f.nativeElement as HTMLElement).querySelector<HTMLElement>('.host')!;
    return { f, motion, host };
  }

  it.each<[UiToastPosition, string, string]>([
    ['top-right', 'ui-slide-left-enter', 'ui-slide-left-leave'],
    ['bottom-right', 'ui-slide-left-enter', 'ui-slide-left-leave'],
    ['top-left', 'ui-slide-right-enter', 'ui-slide-right-leave'],
    ['bottom-left', 'ui-slide-right-enter', 'ui-slide-right-leave'],
    ['top-center', 'ui-slide-down-enter', 'ui-slide-down-leave'],
    ['bottom-center', 'ui-slide-up-enter', 'ui-slide-up-leave'],
  ])('%s enters with %s and leaves with %s', (position, enter, leave) => {
    const { motion, host } = render(position);
    expect(host.dataset['position']).toBe(position);
    expect(motion).toEqual({ enter, leave });
  });

  it('renders a queued toast in the host', async () => {
    const { f } = render('top-left');
    TestBed.inject(UiToastService).show({ message: 'Saved', duration: 0 });
    f.detectChanges();
    await f.whenStable();
    expect((f.nativeElement as HTMLElement).querySelector('.toast .msg')!.textContent).toBe('Saved');
  });
});

/** On a phone a bottom toast stack and the snackbar share the bottom edge; the stack moves up over the bar. */
describe('UiToastHost and the snackbar', () => {
  function render(position: UiToastPosition, box: { left: number; right: number }) {
    const f = TestBed.createComponent(UiToastHost);
    f.componentRef.setInput('position', position);
    f.detectChanges();
    const host = (f.nativeElement as HTMLElement).querySelector<HTMLElement>('.host')!;
    // jsdom has no layout: give the stack the box it would have.
    host.getBoundingClientRect = () => ({ ...box, top: 0, bottom: 0, width: box.right - box.left, height: 0, x: box.left, y: 0, toJSON: () => ({}) });
    return { f, host, snacks: TestBed.inject(UiSnackbarService) };
  }

  it('lifts a bottom stack the bar overlaps, by the bar\'s height from the bottom', () => {
    const { f, host, snacks } = render('bottom-right', { left: 0, right: 390 });
    expect(host.classList.contains('lifted')).toBe(false);
    snacks.area.set({ left: 16, right: 374, fromBottom: 58 });
    f.detectChanges();
    expect(host.classList.contains('lifted')).toBe(true);
    expect(host.style.getPropertyValue('--ui-toast-lift')).toBe('58px');
    snacks.area.set(null);
    f.detectChanges();
    expect(host.classList.contains('lifted')).toBe(false);
  });

  it('stays put when the bar is elsewhere on a wide screen, or the stack is at the top', () => {
    const wide = render('bottom-right', { left: 1060, right: 1440 });
    wide.snacks.area.set({ left: 520, right: 920, fromBottom: 58 });
    wide.f.detectChanges();
    expect(wide.host.classList.contains('lifted')).toBe(false);
    const top = render('top-right', { left: 0, right: 390 });
    top.snacks.area.set({ left: 16, right: 374, fromBottom: 58 });
    top.f.detectChanges();
    expect(top.host.classList.contains('lifted')).toBe(false);
  });
});
