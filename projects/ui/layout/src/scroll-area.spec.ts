import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { UiScrollArea } from './scroll-area';

@Component({
  imports: [UiScrollArea],
  template: `<ui-scroll-area [axis]="axis()" maxHeight="100px"><p>content</p></ui-scroll-area>`,
})
class Host {
  readonly axis = signal<'y' | 'x' | 'both'>('y');
}

describe('UiScrollArea', () => {
  it('marks the scrolling axis so the other one is clipped', () => {
    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    const box = fixture.nativeElement.querySelector('.sa') as HTMLElement;
    expect(box.getAttribute('data-axis')).toBe('y');
    expect(box.style.maxHeight).toBe('100px');
    fixture.componentInstance.axis.set('x');
    fixture.detectChanges();
    expect(box.getAttribute('data-axis')).toBe('x');
  });
});
