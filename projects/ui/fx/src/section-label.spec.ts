import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { UiSectionLabel, type UiSectionLabelVariant } from './section-label';

@Component({
  imports: [UiSectionLabel],
  template: `<div [attr.data-theme]="theme()">
    <ui-section-label index="01" label="Work" [variant]="variant()" />
  </div>`,
})
class Host {
  theme = signal('dark');
  variant = signal<UiSectionLabelVariant>('auto');
}

describe('UiSectionLabel', () => {
  it('draws the eyebrow outside Dark Orange and the bracket marker on it, or the one asked for', () => {
    const fixture = TestBed.createComponent(Host);
    document.body.appendChild(fixture.nativeElement);
    fixture.detectChanges();
    const br = () => getComputedStyle(fixture.nativeElement.querySelector('.br')).display;
    const bar = () => getComputedStyle(fixture.nativeElement.querySelector('.bar')).display;
    expect(br()).toBe('none');
    expect(bar()).not.toBe('none');
    fixture.componentInstance.theme.set('darkOrange');
    fixture.detectChanges();
    expect(br()).toBe('inline');
    expect(bar()).toBe('none');
    fixture.componentInstance.variant.set('eyebrow');
    fixture.detectChanges();
    expect(br()).toBe('none');
    fixture.componentInstance.theme.set('dark');
    fixture.componentInstance.variant.set('bracket');
    fixture.detectChanges();
    expect(br()).toBe('inline');
    fixture.nativeElement.remove();
  });
});
