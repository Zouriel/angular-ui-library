import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { UiTextarea } from './textarea';

// jsdom has no ResizeObserver; autosize measures with one.
globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof ResizeObserver;

@Component({
  imports: [UiTextarea],
  template: `<ui-textarea [maxlength]="max()" />`,
})
class Host {
  max = signal<number | null>(2000);
}

describe('UiTextarea', () => {
  it('passes maxlength to the field, and drops it when unset', async () => {
    const f = TestBed.createComponent(Host);
    f.detectChanges();
    await f.whenStable();
    const field = (f.nativeElement as HTMLElement).querySelector('textarea')!;
    expect(field.getAttribute('maxlength')).toBe('2000');
    f.componentInstance.max.set(null);
    f.detectChanges();
    expect(field.hasAttribute('maxlength')).toBe(false);
  });
});
