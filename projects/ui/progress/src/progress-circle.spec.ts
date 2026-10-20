import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { UiProgressCircle } from './progress-circle';

@Component({
  imports: [UiProgressCircle],
  template: `
    <ui-progress-circle id="v" [value]="v()" [showValue]="true" label="Upload" />
    <ui-progress-circle id="c" [value]="40" [size]="96" label="Time left"><span class="secs">12</span></ui-progress-circle>
    <ui-progress-circle id="i" />
  `,
})
class Host {
  v = signal<number | null>(42.4);
}

describe('ui-progress-circle', () => {
  it('is a named progressbar with its value, shows the percentage, or projected content in the middle', () => {
    const f = TestBed.createComponent(Host);
    f.detectChanges();
    const el = f.nativeElement as HTMLElement;
    const v = el.querySelector('#v [role=progressbar]')!;
    expect([v.getAttribute('aria-label'), v.getAttribute('aria-valuenow'), v.getAttribute('aria-valuemax')]).toEqual(['Upload', '42', '100']);
    expect(el.querySelector('#v .pct')!.textContent).toBe('42%');
    expect(el.querySelector('#c .centre .secs')!.textContent).toBe('12');
    expect(el.querySelector('#c .pct')).toBeNull();
    const i = el.querySelector('#i [role=progressbar]')!;
    expect(i.hasAttribute('aria-valuenow')).toBe(false);
    expect(i.classList.contains('spin')).toBe(true);
    f.componentInstance.v.set(150);
    f.detectChanges();
    expect(v.getAttribute('aria-valuenow')).toBe('100');
  });
});
