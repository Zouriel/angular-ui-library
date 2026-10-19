import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { describe, expect, it } from 'vitest';
import { UiChipInput } from './chip-input';

@Component({
  imports: [ReactiveFormsModule, UiChipInput],
  template: `<ui-chip-input [formControl]="tags" />`,
})
class Host {
  tags = new FormControl<string[]>(['angular', 'forms']);
}

describe('UiChipInput disabled', () => {
  it('keeps the chips but drops their remove buttons, since nothing can be removed', async () => {
    const f = TestBed.createComponent(Host);
    f.detectChanges();
    await f.whenStable();
    const root = f.nativeElement as HTMLElement;
    expect(root.querySelectorAll('.chip .x').length).toBe(2);
    f.componentInstance.tags.disable();
    await f.whenStable();
    expect(root.querySelectorAll('.chip').length).toBe(2);
    expect(root.querySelectorAll('.chip .x').length).toBe(0);
    expect((root.querySelector('input') as HTMLInputElement).disabled).toBe(true);
  });
});
