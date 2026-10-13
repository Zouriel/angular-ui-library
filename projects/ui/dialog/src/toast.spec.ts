import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
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
