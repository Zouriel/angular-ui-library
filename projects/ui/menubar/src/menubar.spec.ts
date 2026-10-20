import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it } from 'vitest';
import { UiMenubar, type UiMenubarMenu } from './menubar';

@Component({
  imports: [UiMenubar],
  template: `<ui-menubar [menus]="menus" />`,
})
class Host {
  menus: UiMenubarMenu[] = [
    { label: 'File', items: [{ label: 'New', value: 'new' }, { label: 'Open', value: 'open' }] },
    { label: 'Edit', items: [{ label: 'Undo', value: 'undo' }] },
  ];
}

const escape = () => new KeyboardEvent('keydown', { key: 'Escape', keyCode: 27, bubbles: true, cancelable: true });

describe('UiMenubar', () => {
  afterEach(() => document.querySelectorAll('.cdk-overlay-container').forEach((c) => (c.innerHTML = '')));

  async function setup() {
    const f = TestBed.createComponent(Host);
    document.body.appendChild(f.nativeElement);
    f.detectChanges();
    await f.whenStable();
    const tops = [...(f.nativeElement as HTMLElement).querySelectorAll<HTMLButtonElement>('.top')];
    const panels = () => document.querySelectorAll('[data-menubar-panel]').length;
    const settle = async () => { f.detectChanges(); await f.whenStable(); };
    return { f, tops, panels, settle };
  }

  it('Escape inside a menu closes it and returns focus to its top item', async () => {
    const { tops, panels, settle } = await setup();
    tops[0].click();
    await settle();
    expect(panels()).toBe(1);
    expect(tops[0].getAttribute('aria-expanded')).toBe('true');
    document.querySelector<HTMLElement>('[data-menubar-panel] .mi')!.dispatchEvent(escape());
    await settle();
    expect(panels()).toBe(0);
    expect(tops[0].getAttribute('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(tops[0]);
  });

  // Regression: the overlay closed itself on Escape while the menubar still thought the menu was
  // open, so the top item stayed highlighted and the next click only "closed" it.
  it('stays in step when the overlay closes itself, so the next click opens again', async () => {
    const { tops, panels, settle } = await setup();
    tops[1].click();
    await settle();
    expect(panels()).toBe(1);
    document.body.dispatchEvent(escape());
    await settle();
    expect(panels()).toBe(0);
    expect(tops[1].classList.contains('open')).toBe(false);
    tops[1].click();
    await settle();
    expect(panels()).toBe(1);
  });
});
