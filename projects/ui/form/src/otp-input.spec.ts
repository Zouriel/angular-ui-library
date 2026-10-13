import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { describe, expect, it } from 'vitest';
import { UiOtpInput } from './otp-input';

@Component({
  imports: [ReactiveFormsModule, UiOtpInput],
  template: `<ui-otp-input [formControl]="code" [length]="4" />`,
})
class Host {
  code = new FormControl('');
}

async function setup() {
  const f = TestBed.createComponent(Host);
  f.detectChanges();
  await f.whenStable();
  const cells = () => Array.from(f.nativeElement.querySelectorAll('ui-otp-input .cell')) as HTMLInputElement[];
  const type = async (i: number, v: string) => {
    cells()[i].value = v;
    cells()[i].dispatchEvent(new Event('input'));
    await f.whenStable();
  };
  return { f, cells, type };
}

describe('UiOtpInput value', () => {
  it('keeps each character in its position when a middle cell is empty', async () => {
    const { f, type } = await setup();
    for (const [i, d] of [[0, '1'], [1, '2'], [2, '3'], [3, '4']] as const) await type(i, d);
    expect(f.componentInstance.code.value).toBe('1234');
    expect(f.componentInstance.code.valid).toBe(true);

    await type(1, '');
    expect(f.componentInstance.code.value).toBe('1 34');
    expect(f.componentInstance.code.errors).toEqual({ otpIncomplete: { filled: 3, length: 4 } });
  });

  it('drops trailing empty cells and treats a partial code as incomplete', async () => {
    const { f, type } = await setup();
    await type(0, '7');
    expect(f.componentInstance.code.value).toBe('7');
    expect(f.componentInstance.code.hasError('otpIncomplete')).toBe(true);
    await type(0, '');
    expect(f.componentInstance.code.value).toBe('');
    // Empty is valid; required is the caller's choice.
    expect(f.componentInstance.code.valid).toBe(true);
  });

  it('round-trips a value with a hole through writeValue', async () => {
    const { f, cells } = await setup();
    f.componentInstance.code.setValue('1 34');
    await f.whenStable();
    expect(cells().map((c) => c.value)).toEqual(['1', '', '3', '4']);
    expect(f.componentInstance.code.hasError('otpIncomplete')).toBe(true);
  });
});
