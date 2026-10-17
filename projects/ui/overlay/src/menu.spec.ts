import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it } from 'vitest';
import { UiMenu, type UiMenuItem } from './menu';

@Component({
  imports: [UiMenu],
  template: `
    <ui-menu [items]="items" [(open)]="open" (select)="picked = $event.value">
      <button menu-trigger id="trigger" type="button">Menu</button>
    </ui-menu>
  `,
})
class Host {
  items: UiMenuItem[] = [{ label: 'Edit', value: 'edit' }, { label: 'Delete', value: 'del' }];
  open = signal(false);
  picked = '';
}

const key = (k: string) => new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true });

/** Closing from the keyboard must hand focus back to the trigger, not drop it on <body>. */
describe('UiMenu focus', () => {
  afterEach(() => document.querySelectorAll('.cdk-overlay-container').forEach((c) => (c.innerHTML = '')));

  async function setup() {
    const f = TestBed.createComponent(Host);
    document.body.appendChild(f.nativeElement);
    f.detectChanges();
    await f.whenStable();
    const trigger = (f.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('#trigger')!;
    const item = (i: number) => document.querySelectorAll<HTMLButtonElement>('.ui-menu .item')[i];
    const settle = async () => { f.detectChanges(); await f.whenStable(); };
    return { f, trigger, item, settle };
  }

  it('the trigger says it opens a menu and whether it is open', async () => {
    const { trigger, settle } = await setup();
    expect(trigger.getAttribute('aria-haspopup')).toBe('menu');
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    trigger.click();
    await settle();
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
  });

  it('Escape closes and focuses the trigger', async () => {
    const { f, trigger, item, settle } = await setup();
    trigger.click();
    await settle();
    item(0).focus();
    item(0).dispatchEvent(key('Escape'));
    await settle();
    expect(f.componentInstance.open()).toBe(false);
    expect(document.activeElement).toBe(trigger);
  });

  it('choosing an item emits it, closes and focuses the trigger', async () => {
    const { f, trigger, item, settle } = await setup();
    trigger.click();
    await settle();
    item(1).click();
    await settle();
    expect(f.componentInstance.picked).toBe('del');
    expect(f.componentInstance.open()).toBe(false);
    expect(document.activeElement).toBe(trigger);
  });
});
