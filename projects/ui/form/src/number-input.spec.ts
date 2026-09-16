import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormsModule } from '@angular/forms';
import { describe, expect, it } from 'vitest';
import { UiNumberInput } from './number-input';

@Component({
  imports: [FormsModule, UiNumberInput],
  template: `<ui-number-input [min]="4" [max]="400" [ngModel]="value()" (ngModelChange)="changes.push($event); value.set($event)" />
             <ui-number-input class="dec" [min]="0.2" [max]="5" [precision]="2" [ngModel]="dec()" (ngModelChange)="dec.set($event)" />`,
})
class Host {
  value = signal<number | null>(22);
  dec = signal<number | null>(1);
  changes: (number | null)[] = [];
}

/** Typing a number must end in that number — not in whatever each keystroke was clamped to. */
describe('UiNumberInput typing', () => {
  async function setup() {
    const fixture = TestBed.createComponent(Host);
    // ngModel writes its first value a tick after the first render; let that and the display settle.
    for (let i = 0; i < 3; i++) {
      fixture.detectChanges();
      await fixture.whenStable();
    }
    const inputs = fixture.nativeElement.querySelectorAll('input') as NodeListOf<HTMLInputElement>;
    const type = async (el: HTMLInputElement, text: string) => {
      el.focus();
      el.value = '';
      for (const ch of text) {
        el.value += ch;
        el.dispatchEvent(new Event('input', { bubbles: true }));
        fixture.detectChanges();
        await fixture.whenStable();
      }
    };
    const leave = async (el: HTMLInputElement) => {
      el.dispatchEvent(new Event('change', { bubbles: true }));
      el.blur();
      el.dispatchEvent(new Event('blur'));
      fixture.detectChanges();
      await fixture.whenStable();
    };
    return { fixture, inputs, type, leave };
  }

  it('types a value whose first digit is below the minimum', async () => {
    const { fixture, inputs, type, leave } = await setup();
    await type(inputs[0], '18');
    expect(inputs[0].value).toBe('18');
    await leave(inputs[0]);
    expect(fixture.componentInstance.value()).toBe(18);
    expect(inputs[0].value).toBe('18');
  });

  it('types a decimal below its minimum on the way', async () => {
    const { fixture, inputs, type, leave } = await setup();
    // The test DOM empties a number field holding "0." (browsers differ), so the last step is set whole.
    await type(inputs[1], '0');
    inputs[1].value = '0.8';
    inputs[1].dispatchEvent(new Event('input', { bubbles: true }));
    fixture.detectChanges();
    await leave(inputs[1]);
    expect(fixture.componentInstance.dec()).toBe(0.8);
  });

  it('clamps what is left out of range when the field is left', async () => {
    const { fixture, inputs, type, leave } = await setup();
    await type(inputs[0], '1000');
    await leave(inputs[0]);
    expect(fixture.componentInstance.value()).toBe(400);
    expect(inputs[0].value).toBe('400');
  });

  it('leaving an untouched field reports no change', async () => {
    const { fixture, inputs, leave } = await setup();
    inputs[0].focus();
    await leave(inputs[0]);
    expect(fixture.componentInstance.changes).toEqual([]);
  });
});
