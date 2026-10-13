import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it } from 'vitest';
import { UiPopover } from './popover';

@Component({
  imports: [UiPopover],
  template: `
    <ui-popover [(open)]="open" [label]="label()">
      <button popover-trigger id="trigger" type="button">Filters</button>
      <p>Panel body</p>
    </ui-popover>
  `,
})
class Host {
  open = signal(false);
  label = signal('');
}

/** The panel is a dialog, so it needs an accessible name. */
describe('UiPopover name', () => {
  afterEach(() => document.querySelectorAll('.cdk-overlay-container').forEach((c) => (c.innerHTML = '')));

  async function setup() {
    const f = TestBed.createComponent(Host);
    document.body.appendChild(f.nativeElement);
    f.detectChanges();
    await f.whenStable();
    const trigger = (f.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('#trigger')!;
    const panel = () => document.querySelector<HTMLElement>('.ui-popover')!;
    const settle = async () => { f.detectChanges(); await f.whenStable(); };
    return { f, trigger, panel, settle };
  }

  it('is labelled by the trigger when no label is given', async () => {
    const { f, trigger, panel, settle } = await setup();
    trigger.click();
    await settle();
    expect(panel().getAttribute('role')).toBe('dialog');
    expect(panel().hasAttribute('aria-label')).toBe(false);
    const id = panel().getAttribute('aria-labelledby')!;
    expect(id).toBeTruthy();
    const named = document.getElementById(id)!;
    expect(named.contains(trigger)).toBe(true);
    expect(named.textContent!.trim()).toBe('Filters');
    f.nativeElement.remove();
  });

  it('uses label as aria-label and drops aria-labelledby when one is given', async () => {
    const { f, trigger, panel, settle } = await setup();
    f.componentInstance.label.set('Filter results');
    trigger.click();
    await settle();
    expect(panel().getAttribute('aria-label')).toBe('Filter results');
    expect(panel().hasAttribute('aria-labelledby')).toBe(false);
    f.nativeElement.remove();
  });
});
