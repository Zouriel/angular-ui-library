import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { UiFloatingPanel } from './floating-panel';

/* 0.44.0: insetEnd keeps room at the inline end (a top-end fab beside the card). */

globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof ResizeObserver;

@Component({
  imports: [UiFloatingPanel],
  template: `<div style="position: relative; height: 400px"><ui-floating-panel placement="top" [insetEnd]="inset()">Card</ui-floating-panel></div>`,
})
class Host {
  inset = signal(72);
}

describe('ui-floating-panel insetEnd (0.44.0)', () => {
  it('adds insetEnd to the gutter at the inline end only; 0 leaves the gutters as they were', () => {
    const f = TestBed.createComponent(Host);
    f.detectChanges();
    const el = (f.nativeElement as HTMLElement).querySelector('ui-floating-panel') as HTMLElement;
    expect(el.style.getPropertyValue('--ui-floating-panel-inset-end')).toBe('72px');
    const s = getComputedStyle(el);
    expect(s.getPropertyValue('inset-inline-end')).toContain('var(--ui-floating-panel-inset-end, 0px)');
    expect(s.left).not.toContain('inset-end');
    f.componentInstance.inset.set(0);
    f.detectChanges();
    expect(el.style.getPropertyValue('--ui-floating-panel-inset-end')).toBe('');
  });
});
