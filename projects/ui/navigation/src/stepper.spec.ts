import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { UiStepBody, UiStepper } from './stepper';

@Component({
  imports: [UiStepper, UiStepBody],
  template: `
    <ui-stepper [steps]="steps" [active]="1" [orientation]="orientation()" [variant]="variant()" tone="success" label="Progress">
      <ng-template uiStepBody let-step let-i="index" let-state="state"><span class="b">{{ i }}:{{ step.label }}:{{ state }}</span></ng-template>
    </ui-stepper>
  `,
})
class Host {
  steps = [{ label: 'One' }, { label: 'Two' }, { label: 'Three' }];
  orientation = signal<'horizontal' | 'vertical'>('vertical');
  variant = signal<'default' | 'dots'>('default');
}

function render(orientation: 'horizontal' | 'vertical', variant: 'default' | 'dots') {
  const fixture = TestBed.createComponent(Host);
  fixture.componentInstance.orientation.set(orientation);
  fixture.componentInstance.variant.set(variant);
  fixture.detectChanges();
  return fixture.nativeElement as HTMLElement;
}

describe('UiStepper', () => {
  it('vertical: each step shows its body with its index and state', () => {
    const el = render('vertical', 'default');
    expect([...el.querySelectorAll('.b')].map((b) => b.textContent)).toEqual(['0:One:done', '1:Two:active', '2:Three:todo']);
    expect(el.querySelector('ui-stepper')!.getAttribute('data-tone')).toBe('success');
    expect(el.querySelector('ol')!.getAttribute('aria-label')).toBe('Progress');
  });

  it('horizontal steps have no bodies', () => {
    expect(render('horizontal', 'default').querySelectorAll('.b').length).toBe(0);
  });

  it('dots: no numbers or bodies, labels kept for screen readers and as tooltips', () => {
    const el = render('vertical', 'dots');
    const steps = [...el.querySelectorAll('li.step')];
    expect(el.querySelectorAll('.b').length).toBe(0);
    expect(steps.map((s) => s.querySelector('.marker')!.textContent!.trim())).toEqual(['', '', '']);
    expect(steps.map((s) => s.getAttribute('title'))).toEqual(['One', 'Two', 'Three']);
    expect(steps[0].textContent).toContain('done');
    expect(steps[1].textContent).toContain('current');
    expect(steps[2].textContent).toContain('not reached');
  });
});
