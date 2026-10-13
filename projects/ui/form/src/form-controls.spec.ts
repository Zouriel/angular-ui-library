import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { describe, expect, it } from 'vitest';
import { UiRating } from './rating';
import { UiColorPicker } from './color-picker';

@Component({
  imports: [ReactiveFormsModule, UiRating, UiColorPicker],
  template: `
    <ui-rating [formControl]="stars" />
    <ui-color-picker [formControl]="color" />
  `,
})
class Host {
  stars = new FormControl(3);
  color = new FormControl('#3d5afe');
}

async function setup() {
  const f = TestBed.createComponent(Host);
  f.detectChanges();
  await f.whenStable();
  return f;
}

describe('UiRating', () => {
  it('has one tab stop and moves the rating with arrow keys', async () => {
    const f = await setup();
    const stars = Array.from(f.nativeElement.querySelectorAll('ui-rating .star')) as HTMLButtonElement[];
    expect(stars.map((s) => s.tabIndex)).toEqual([-1, -1, 0, -1, -1]);
    stars[2].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }));
    expect(f.componentInstance.stars.value).toBe(4);
    stars[3].dispatchEvent(new KeyboardEvent('keydown', { key: 'Home' }));
    expect(f.componentInstance.stars.value).toBe(1);
  });
});

describe('UiColorPicker hex field', () => {
  it('passes on only whole colours and restores the text on blur', async () => {
    const f = await setup();
    const hex = f.nativeElement.querySelector('ui-color-picker .hex') as HTMLInputElement;
    const type = (v: string) => { hex.value = v; hex.dispatchEvent(new Event('input')); };
    type('#3d');
    expect(f.componentInstance.color.value).toBe('#3d5afe');
    type('F0A');
    expect(f.componentInstance.color.value).toBe('#ff00aa');
    type('#12');
    hex.dispatchEvent(new FocusEvent('blur'));
    expect(hex.value).toBe('#ff00aa');
    expect(f.componentInstance.color.touched).toBe(true);
  });
});
