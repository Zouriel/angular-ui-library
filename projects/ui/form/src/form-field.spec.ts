import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { describe, expect, it } from 'vitest';
import { UiFormField } from './form-field';
import { UiChipInput } from './chip-input';
import { UiInput } from './input';

@Component({
  imports: [ReactiveFormsModule, UiFormField, UiChipInput, UiInput],
  template: `
    <ui-form-field class="tags" label="Tags"><ui-chip-input [formControl]="tags" /></ui-form-field>
    <ui-form-field class="name" label="Name"><ui-input [formControl]="name" /></ui-form-field>
    <ui-form-field class="custom" label="Custom">
      <input aria-label="Other" />
      <input data-ui-field-control id="mine" />
    </ui-form-field>
  `,
})
class Host {
  tags = new FormControl<string[]>(['angular', 'forms']);
  name = new FormControl('');
}

describe('UiFormField label association', () => {
  it('names the text field, not the first chip remove button', async () => {
    const f = TestBed.createComponent(Host);
    f.detectChanges();
    await f.whenStable();
    const root = f.nativeElement as HTMLElement;

    const tagsLabel = root.querySelector('.tags label') as HTMLLabelElement;
    const entry = root.querySelector('.tags ui-chip-input input') as HTMLInputElement;
    expect(root.querySelector('.tags ui-chip-input button')).not.toBeNull();
    expect(entry.id).toBeTruthy();
    expect(tagsLabel.htmlFor).toBe(entry.id);
    expect(tagsLabel.control).toBe(entry);

    const nameLabel = root.querySelector('.name label') as HTMLLabelElement;
    expect(nameLabel.control).toBe(root.querySelector('.name input'));

    // An element marked data-ui-field-control wins, and keeps its own id.
    const customLabel = root.querySelector('.custom label') as HTMLLabelElement;
    expect(customLabel.htmlFor).toBe('mine');
    expect(customLabel.control).toBe(root.querySelector('#mine'));
  });
});
