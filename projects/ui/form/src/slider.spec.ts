import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { UiSlider } from './slider';

@Component({
  imports: [UiSlider],
  template: `<ui-slider [min]="min()" [max]="max()" [step]="step()" />`,
})
class Host {
  min = signal(0);
  max = signal(100);
  step = signal(1);
}

/** The value slot is as wide as the longest value, and at least 4 characters, so stacked tracks end together. */
describe('UiSlider value slot', () => {
  it.each([
    [0, 100, 1, '4ch'],
    [0, 1, 0.01, '4ch'],
    [-1000, 1000, 1, '5ch'],
    [0, 100, 0.25, '6ch'],
  ])('min %s, max %s, step %s: %s', (min, max, step, width) => {
    const f = TestBed.createComponent(Host);
    f.componentInstance.min.set(min);
    f.componentInstance.max.set(max);
    f.componentInstance.step.set(step);
    f.detectChanges();
    expect((f.nativeElement as HTMLElement).querySelector<HTMLElement>('.val')!.style.minWidth).toBe(width);
  });
});
