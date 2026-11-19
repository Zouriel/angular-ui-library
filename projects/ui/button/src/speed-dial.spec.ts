import { ApplicationRef, Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Camera01Icon from '@hugeicons/core-free-icons/Camera01Icon';
import ImageUploadIcon from '@hugeicons/core-free-icons/ImageUploadIcon';
import type { IconSvgObject } from '@hugeicons/angular';
import { UiShutterLoader } from '@zouriel/ui/shutter-loader';
import { UiSpeedDial, type UiSpeedDialAction } from './speed-dial';
import type { UiFabPlacement, UiFabTone } from './fab';

const ACTIONS: UiSpeedDialAction[] = [
  { id: 'upload', label: 'Add photos & videos', icon: ImageUploadIcon as IconSvgObject },
  { id: 'camera', label: 'Open the camera', icon: Camera01Icon as IconSvgObject },
];

@Component({
  imports: [UiSpeedDial],
  template: `
    <ui-speed-dial
      label="Add media"
      closeLabel="Close add media options"
      actionsLabel="Add media options"
      [actions]="actions()"
      [(open)]="open"
      [tone]="tone()"
      [position]="position()"
      [disabled]="disabled()"
      [rotateIcon]="rotateIcon()"
      (action)="picked.push($event)"
    />
  `,
})
class DefaultHost {
  actions = signal<UiSpeedDialAction[]>(ACTIONS);
  open = signal(false);
  tone = signal<UiFabTone>('inverted');
  position = signal<UiFabPlacement | 'static'>('bottom-end');
  disabled = signal(false);
  rotateIcon = signal<boolean | null>(null);
  picked: string[] = [];
}

@Component({
  imports: [UiSpeedDial, UiShutterLoader],
  template: `
    <ui-speed-dial
      label="Add media"
      closeLabel="Close add media options"
      [actions]="actions"
      [(open)]="open"
      tone="inverted"
      (action)="picked.push($event)"
    >
      <ui-shutter-loader size="lg" [decorative]="true" (cycleEnd)="cycles.set(cycles() + 1)" />
    </ui-speed-dial>
  `,
})
class ShutterHost {
  readonly actions = ACTIONS;
  open = signal(false);
  cycles = signal(0);
  picked: string[] = [];
}

describe('ui-speed-dial', () => {
  it('toggles open/closed, updates [(open)], aria-expanded, aria-controls and inert on the real trigger button', () => {
    const f = TestBed.createComponent(DefaultHost);
    f.detectChanges();
    const el = f.nativeElement as HTMLElement;
    const trigger = el.querySelector('.sd-trigger button.ui-fab') as HTMLButtonElement;
    const group = el.querySelector('.sd-actions') as HTMLElement;

    expect(trigger.getAttribute('aria-label')).toBe('Add media');
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    expect(trigger.getAttribute('aria-controls')).toBe(group.id);
    expect(group.getAttribute('role')).toBe('group');
    expect(group.getAttribute('aria-label')).toBe('Add media options');
    expect(group.getAttribute('aria-hidden')).toBe('true');
    expect(group.hasAttribute('inert')).toBe(true);
    expect(el.querySelector('.sd-backdrop')).toBeNull();

    trigger.click();
    f.detectChanges();

    expect(f.componentInstance.open()).toBe(true);
    expect(trigger.getAttribute('aria-label')).toBe('Close add media options');
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
    expect(group.hasAttribute('aria-hidden')).toBe(false);
    expect(group.hasAttribute('inert')).toBe(false);
    expect(el.querySelector('.sd-backdrop')).not.toBeNull();

    // Closing via trigger toggles back to closed.
    trigger.click();
    f.detectChanges();
    expect(f.componentInstance.open()).toBe(false);
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    expect(group.hasAttribute('inert')).toBe(true);
  });

  it('rotates the default + trigger 45deg to x when open unless rotateIcon is false', () => {
    const f = TestBed.createComponent(DefaultHost);
    f.detectChanges();
    const el = f.nativeElement as HTMLElement;
    const iconWrap = el.querySelector('.sd-trigger-icon') as HTMLElement;
    expect(iconWrap.classList.contains('sd-rotate')).toBe(true);
    expect(iconWrap.classList.contains('sd-rotated')).toBe(false);

    f.componentInstance.open.set(true);
    f.detectChanges();
    expect(iconWrap.classList.contains('sd-rotated')).toBe(true);
    expect(getComputedStyle(iconWrap).transform).toContain('rotate(45deg)');

    f.componentInstance.rotateIcon.set(false);
    f.detectChanges();
    expect(iconWrap.classList.contains('sd-rotate')).toBe(false);
    expect(iconWrap.classList.contains('sd-rotated')).toBe(false);
  });

  it('stacks smaller round action FABs above the trigger with label pills to their start side', () => {
    const f = TestBed.createComponent(DefaultHost);
    f.componentInstance.open.set(true);
    f.detectChanges();
    const el = f.nativeElement as HTMLElement;
    const sd = el.querySelector('.sd') as HTMLElement;
    const group = el.querySelector('.sd-actions') as HTMLElement;
    const items = [...el.querySelectorAll('.sd-item')] as HTMLElement[];

    // column-reverse puts .sd-actions visually above .sd-trigger and items[1] above items[0].
    expect(getComputedStyle(sd).flexDirection).toBe('column-reverse');
    expect(getComputedStyle(group).flexDirection).toBe('column-reverse');
    expect(items).toHaveLength(2);

    // Each action has its label pill before the sm FAB slot (inline-start side).
    for (const [i, item] of items.entries()) {
      expect(item.firstElementChild!.classList.contains('sd-label')).toBe(true);
      expect(item.lastElementChild!.classList.contains('sd-slot')).toBe(true);
      expect(item.querySelector('.sd-label')!.textContent!.trim()).toBe(ACTIONS[i].label);
      const fabBtn = item.querySelector('button.ui-fab') as HTMLButtonElement;
      expect(fabBtn.getAttribute('data-size')).toBe('sm');
      expect(fabBtn.getAttribute('data-position')).toBe('static');
      expect(fabBtn.getAttribute('data-tone')).toBe('inverted');
    }
  });

  it('invokes (action) and closes when tapping either an action FAB or its label pill; ignores disabled actions', () => {
    const f = TestBed.createComponent(DefaultHost);
    f.componentInstance.actions.set([
      ACTIONS[0],
      { ...ACTIONS[1], disabled: true },
    ]);
    f.componentInstance.open.set(true);
    f.detectChanges();
    const el = f.nativeElement as HTMLElement;
    const labels = [...el.querySelectorAll('.sd-label')] as HTMLElement[];
    const buttons = [...el.querySelectorAll('.sd-action button.ui-fab')] as HTMLButtonElement[];

    // Disabled action pill and button do nothing.
    labels[1].click();
    buttons[1].click();
    f.detectChanges();
    expect(f.componentInstance.picked).toEqual([]);
    expect(f.componentInstance.open()).toBe(true);

    // Enabled action pill activates and closes.
    labels[0].click();
    f.detectChanges();
    expect(f.componentInstance.picked).toEqual(['upload']);
    expect(f.componentInstance.open()).toBe(false);

    // Enabled action FAB activates and closes.
    f.componentInstance.open.set(true);
    f.detectChanges();
    buttons[0].focus();
    expect(document.activeElement).toBe(buttons[0]);
    buttons[0].click();
    f.detectChanges();
    expect(f.componentInstance.picked).toEqual(['upload', 'upload']);
    expect(f.componentInstance.open()).toBe(false);
    expect(document.activeElement).toBe(el.querySelector('.sd-trigger button.ui-fab'));
  });

  it('dismisses on outside tap (backdrop click) and on Escape with focus restored to trigger', () => {
    const f = TestBed.createComponent(DefaultHost);
    f.detectChanges();
    const el = f.nativeElement as HTMLElement;
    const trigger = el.querySelector('.sd-trigger button.ui-fab') as HTMLButtonElement;

    // Outside tap dismisses.
    trigger.click();
    f.detectChanges();
    (el.querySelector('.sd-backdrop') as HTMLElement).click();
    f.detectChanges();
    expect(f.componentInstance.open()).toBe(false);

    // Escape dismisses and restores focus to trigger button.
    trigger.click();
    f.detectChanges();
    const firstActionBtn = el.querySelector('.sd-action button.ui-fab') as HTMLButtonElement;
    firstActionBtn.focus();
    expect(document.activeElement).toBe(firstActionBtn);

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', cancelable: true }));
    f.detectChanges();

    expect(f.componentInstance.open()).toBe(false);
    expect(document.activeElement).toBe(trigger);
  });

  it('sets staggered open delays and reversed close delays, and clears motion under .ui-no-anim', () => {
    const f = TestBed.createComponent(DefaultHost);
    f.detectChanges();
    const el = f.nativeElement as HTMLElement;
    const items = [...el.querySelectorAll('.sd-item')] as HTMLElement[];

    // Closed: top item (index 1) closes first (0ms), bottom item (index 0) closes second (30ms).
    expect(items[0].style.getPropertyValue('--_sd-delay')).toBe('30ms');
    expect(items[1].style.getPropertyValue('--_sd-delay')).toBe('0ms');

    // Open: bottom item (index 0) opens first (0ms), top item (index 1) opens second (45ms).
    f.componentInstance.open.set(true);
    f.detectChanges();
    expect(items[0].style.getPropertyValue('--_sd-delay')).toBe('0ms');
    expect(items[1].style.getPropertyValue('--_sd-delay')).toBe('45ms');

    // Reduced motion (.ui-no-anim) strips transition on items.
    document.documentElement.classList.add('ui-no-anim');
    try {
      expect(getComputedStyle(items[0]).transition).toBe('none');
    } finally {
      document.documentElement.classList.remove('ui-no-anim');
    }
  });

  describe('projected ui-shutter-loader', () => {
    let rafQueue: FrameRequestCallback[];
    const origRaf = globalThis.requestAnimationFrame;
    const origCaf = globalThis.cancelAnimationFrame;

    beforeEach(() => {
      rafQueue = [];
      globalThis.requestAnimationFrame = vi.fn((cb: FrameRequestCallback) => {
        rafQueue.push(cb);
        return rafQueue.length;
      }) as typeof requestAnimationFrame;
      globalThis.cancelAnimationFrame = vi.fn();
    });

    afterEach(() => {
      globalThis.requestAnimationFrame = origRaf;
      globalThis.cancelAnimationFrame = origCaf;
    });

    it('keeps a projected shutter still at rest, does not rotate it, and plays once on open and once on close', () => {
      const f = TestBed.createComponent(ShutterHost);
      rafQueue.length = 0;
      f.detectChanges();
      TestBed.inject(ApplicationRef).tick();
      const el = f.nativeElement as HTMLElement;
      const trigger = el.querySelector('.sd-trigger button.ui-fab') as HTMLButtonElement;
      const iconWrap = el.querySelector('.sd-trigger-icon') as HTMLElement;

      // Still at rest: no animation frame requested on mount, and no rotation class.
      expect(rafQueue).toHaveLength(0);
      expect(iconWrap.classList.contains('sd-rotate')).toBe(false);

      // Opening triggers one burst cycle.
      trigger.click();
      f.detectChanges();
      TestBed.inject(ApplicationRef).tick();
      expect(rafQueue.length).toBeGreaterThan(0);
      expect(iconWrap.classList.contains('sd-rotated')).toBe(false);

      // Step through one 2.1s cycle: cycleEnd fires once and loop stops.
      const step = (ts: number) => {
        const pending = rafQueue.splice(0);
        for (const cb of pending) cb(ts);
      };
      step(100);
      expect(rafQueue.length).toBeGreaterThan(0);
      step(2300);
      expect(f.componentInstance.cycles()).toBe(1);
      expect(rafQueue).toHaveLength(0);

      // Closing triggers a second burst cycle.
      trigger.click();
      f.detectChanges();
      TestBed.inject(ApplicationRef).tick();
      expect(rafQueue.length).toBeGreaterThan(0);
      step(3000);
      step(5200);
      expect(f.componentInstance.cycles()).toBe(2);
      expect(rafQueue).toHaveLength(0);
    });
  });
});
