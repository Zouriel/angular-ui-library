import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { BlockScrollStrategy } from '@angular/cdk/overlay';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { UiCommandPalette, type UiCommand } from './command-palette';

@Component({
  imports: [UiCommandPalette],
  template: `
    <button id="opener" type="button" (click)="open.set(true)">Search</button>
    <ui-command-palette [(open)]="open" [commands]="commands" (run)="ran = $event.value" />
  `,
})
class Host {
  open = signal(false);
  ran = '';
  commands: UiCommand[] = [
    { label: 'New file', value: 'new', group: 'File' },
    { label: 'Settings', value: 'settings', keywords: 'preferences' },
  ];
}

const key = (k: string) => new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true });

describe('UiCommandPalette', () => {
  afterEach(() => vi.restoreAllMocks());

  async function setup() {
    const f = TestBed.createComponent(Host);
    document.body.appendChild(f.nativeElement);
    f.detectChanges();
    await f.whenStable();
    const el = f.nativeElement as HTMLElement;
    const opener = el.querySelector<HTMLButtonElement>('#opener')!;
    const settle = async () => {
      f.detectChanges();
      await f.whenStable();
      // Leave animations never finish in jsdom; give Angular's fallback a moment.
      await new Promise((r) => setTimeout(r, 50));
    };
    return { f, el, opener, settle };
  }

  it('filters on keywords and runs the highlighted command with Enter', async () => {
    const { f, opener, settle } = await setup();
    opener.click();
    await settle();
    const input = document.querySelector<HTMLInputElement>('.cp-input')!;
    input.value = 'prefer';
    input.dispatchEvent(new Event('input'));
    await settle();
    expect([...document.querySelectorAll('.cp-item .cl')].map((n) => n.textContent)).toEqual(['Settings']);
    input.dispatchEvent(key('Enter'));
    await settle();
    expect(f.componentInstance.ran).toBe('settings');
    expect(f.componentInstance.open()).toBe(false);
    f.nativeElement.remove();
  });

  it('gives focus back to what had it when Escape closes it', async () => {
    const { f, opener, settle } = await setup();
    opener.focus();
    opener.click();
    await settle();
    const input = document.querySelector<HTMLInputElement>('.cp-input')!;
    expect(document.activeElement).toBe(input);
    input.dispatchEvent(key('Escape'));
    await settle();
    expect(f.componentInstance.open()).toBe(false);
    expect(document.activeElement).toBe(opener);
    f.nativeElement.remove();
  });

  it('opens on its own layer at the end of <body> and blocks page scroll while open', async () => {
    const enable = vi.spyOn(BlockScrollStrategy.prototype, 'enable');
    const disable = vi.spyOn(BlockScrollStrategy.prototype, 'disable');
    const { f, el, opener, settle } = await setup();
    opener.click();
    await settle();
    const dialog = document.querySelector<HTMLElement>('[role="dialog"]')!;
    expect(el.contains(dialog)).toBe(false);
    expect(dialog.closest('.ui-layer')!.parentElement).toBe(document.body);
    expect(enable).toHaveBeenCalledTimes(1);
    expect(disable).not.toHaveBeenCalled();

    f.componentInstance.open.set(false);
    await settle();
    expect(disable).toHaveBeenCalledTimes(1);
    f.nativeElement.remove();
  });

  it('takes its layer down and gives scroll back when destroyed while open', async () => {
    const disable = vi.spyOn(BlockScrollStrategy.prototype, 'disable');
    const { f, opener, settle } = await setup();
    opener.click();
    await settle();
    expect(document.querySelector('.cp')).not.toBeNull();
    f.destroy();
    expect(document.querySelector('.cp')).toBeNull();
    expect(disable).toHaveBeenCalledTimes(1);
    f.nativeElement.remove();
  });
});
