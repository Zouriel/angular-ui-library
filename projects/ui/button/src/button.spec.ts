import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { describe, expect, it } from 'vitest';
import { UiToggleButton } from './toggle-button';
import { UiSplitButton } from './split-button';
import { UiFab } from './fab';
import { UiDropdownButton } from './dropdown-button';
import { UiSegmented } from './segmented';

@Component({
  imports: [ReactiveFormsModule, UiToggleButton, UiSplitButton, UiFab, UiDropdownButton, UiSegmented],
  template: `
    <form (submit)="$event.preventDefault(); submits = submits + 1">
      <ui-toggle-button [(pressed)]="bold">Bold</ui-toggle-button>
      <ui-split-button>Save</ui-split-button>
      <ui-fab label="New">+</ui-fab>
      <ui-dropdown-button [items]="[]">Actions</ui-dropdown-button>
    </form>
    <ui-segmented [options]="options" [formControl]="mode" />
  `,
})
class Host {
  bold = signal(false);
  submits = 0;
  options = [{ value: 'a', label: 'A' }, { value: 'b', label: 'B' }];
  mode = new FormControl<string | null>('a');
}

describe('button components inside a form', () => {
  it('never submit the form they sit in', () => {
    const f = TestBed.createComponent(Host);
    f.detectChanges();
    const buttons = Array.from(f.nativeElement.querySelectorAll('form button')) as HTMLButtonElement[];
    expect(buttons.length).toBe(5);
    for (const b of buttons) expect(b.type).toBe('button');
    for (const b of buttons) b.click();
    expect(f.componentInstance.submits).toBe(0);
    expect(f.componentInstance.bold()).toBe(true);
  });
});

describe('UiSegmented as a form control', () => {
  it('follows the control value, disabled state and touched state', async () => {
    const f = TestBed.createComponent(Host);
    f.detectChanges();
    const opts = () => Array.from(f.nativeElement.querySelectorAll('ui-segmented [role=radio]')) as HTMLButtonElement[];
    expect(opts()[0].getAttribute('aria-checked')).toBe('true');

    opts()[1].click();
    expect(f.componentInstance.mode.value).toBe('b');
    opts()[1].dispatchEvent(new FocusEvent('blur'));
    expect(f.componentInstance.mode.touched).toBe(true);

    f.componentInstance.mode.disable();
    await f.whenStable();
    expect(opts().every((o) => o.disabled)).toBe(true);
    f.componentInstance.mode.enable();
    await f.whenStable();
    expect(opts().some((o) => o.disabled)).toBe(false);
  });
});
