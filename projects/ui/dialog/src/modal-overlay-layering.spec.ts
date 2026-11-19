import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { InteractivityChecker } from '@angular/cdk/a11y';
import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormsModule } from '@angular/forms';
import { UiComboboxOption, UiMultiSelect } from '@zouriel/ui/combobox';
import { UiPhoneInput } from '@zouriel/ui/form';
import { UiMenu, type UiMenuItem } from '@zouriel/ui/overlay';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { UiModal } from './modal';

const TOKENS_CSS = readFileSync(join(process.cwd(), 'projects/ui/styles/tokens.css'), 'utf8');
const CDK_CSS = readFileSync(join(process.cwd(), 'node_modules/@angular/cdk/overlay-prebuilt.css'), 'utf8');

@Component({
  imports: [FormsModule, UiModal, UiPhoneInput, UiMultiSelect, UiMenu],
  template: `
    <ui-modal [(open)]="open" title="Guest details">
      <ui-phone-input [(ngModel)]="phone" defaultCountry="GB" />
      <ui-multi-select [options]="roles" [(ngModel)]="selectedRoles" label="Roles" />
      <ui-menu [items]="menuItems" (select)="picked.set($event.value)">
        <button type="button" menu-trigger id="menu-trigger">Actions</button>
      </ui-menu>
    </ui-modal>
  `,
})
class ModalOverlayHost {
  open = signal(false);
  phone: string | null = null;
  selectedRoles: string[] = [];
  picked = signal<string | null>(null);
  roles: UiComboboxOption[] = [
    { label: 'VIP', value: 'vip' },
    { label: 'Family', value: 'family' },
    { label: 'Host', value: 'host' },
  ];
  menuItems: UiMenuItem[] = [
    { label: 'Edit', value: 'edit' },
    { label: 'Remove', value: 'remove', danger: true },
  ];
}

function resolveZ(raw: string, root: CSSStyleDeclaration): number {
  const m = /^var\((--[\w-]+)\)$/.exec(raw.trim());
  const val = m ? root.getPropertyValue(m[1]).trim() : raw.trim();
  return Number.parseInt(val, 10);
}

describe('CDK connected overlays inside UiModal', () => {
  const injected: HTMLStyleElement[] = [];

  function loadStyles(order: 'cdk-first' | 'tokens-first'): void {
    const first = document.createElement('style');
    const second = document.createElement('style');
    first.textContent = order === 'cdk-first' ? CDK_CSS : TOKENS_CSS;
    second.textContent = order === 'cdk-first' ? TOKENS_CSS : CDK_CSS;
    document.head.append(first, second);
    injected.push(first, second);
  }

  beforeEach(() => {
    TestBed.configureTestingModule({});
    TestBed.overrideProvider(InteractivityChecker, {
      useValue: {
        isDisabled: (el: HTMLElement) => el.hasAttribute('disabled'),
        isVisible: () => true,
        isTabbable: (el: HTMLElement) => el.tabIndex >= 0 && !el.hasAttribute('disabled'),
        isFocusable: (el: HTMLElement) => el.tabIndex >= -1 && (el.hasAttribute('tabindex') || /^(BUTTON|INPUT|A|SELECT|TEXTAREA)$/.test(el.tagName)),
      },
    });
  });

  afterEach(() => {
    for (const s of injected.splice(0)) s.remove();
    document.querySelectorAll('.cdk-overlay-container').forEach((c) => c.remove());
    document.body.style.overflow = '';
  });

  for (const order of ['cdk-first', 'tokens-first'] as const) {
    it(`stacks .cdk-overlay-container above UiModal even when it predates the modal (${order})`, async () => {
      loadStyles(order);
      // Pre-create .cdk-overlay-container before the modal opens, so DOM order puts UiModal's
      // .ui-layer after it in <body> — the exact condition that hid dropdowns behind modals.
      const preExisting = document.createElement('div');
      preExisting.className = 'cdk-overlay-container';
      document.body.appendChild(preExisting);

      const f = TestBed.createComponent(ModalOverlayHost);
      document.body.appendChild(f.nativeElement);
      f.componentInstance.open.set(true);
      f.detectChanges();
      await f.whenStable();

      const layer = document.body.querySelector(':scope > .ui-layer') as HTMLElement;
      expect(layer).not.toBeNull();
      // Verify DOM order really has .cdk-overlay-container before .ui-layer.
      expect(preExisting.compareDocumentPosition(layer) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

      const root = getComputedStyle(document.documentElement);
      const containerZ = resolveZ(getComputedStyle(preExisting).zIndex, root);
      const backdropZ = resolveZ(getComputedStyle(layer.querySelector('.backdrop')!).zIndex, root);
      const panelWrapZ = resolveZ(getComputedStyle(layer.querySelector('.panel-wrap')!).zIndex, root);
      const windowZ = Number.parseInt(root.getPropertyValue('--ui-z-window').trim(), 10);
      const toastZ = Number.parseInt(root.getPropertyValue('--ui-z-toast').trim(), 10);

      expect(containerZ).toBe(1150);
      expect(containerZ).toBeGreaterThan(backdropZ);
      expect(containerZ).toBeGreaterThan(panelWrapZ);
      expect(containerZ).toBeGreaterThan(windowZ);
      expect(containerZ).toBeLessThan(toastZ);

      f.destroy();
    });
  }

  it('UiPhoneInput inside UiModal focuses its search box and closes on Escape without closing the modal', async () => {
    loadStyles('cdk-first');
    const f = TestBed.createComponent(ModalOverlayHost);
    document.body.appendChild(f.nativeElement);
    f.componentInstance.open.set(true);
    f.detectChanges();
    await f.whenStable();
    await new Promise((r) => setTimeout(r));

    const trigger = document.querySelector<HTMLButtonElement>('ui-phone-input button.cty')!;
    trigger.click();
    f.detectChanges();
    await f.whenStable();
    await new Promise((r) => setTimeout(r));

    const search = document.querySelector<HTMLInputElement>('.cdk-overlay-container input.search')!;
    expect(search).not.toBeNull();
    expect(document.activeElement).toBe(search);

    search.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    f.detectChanges();
    await f.whenStable();

    expect(document.querySelector('.cdk-overlay-container input.search')).toBeNull();
    expect(f.componentInstance.open()).toBe(true);
    expect(document.activeElement).toBe(trigger);

    f.destroy();
  });

  it('UiMultiSelect inside UiModal closes its listbox on first Escape and the modal on second Escape', async () => {
    loadStyles('cdk-first');
    const f = TestBed.createComponent(ModalOverlayHost);
    document.body.appendChild(f.nativeElement);
    f.componentInstance.open.set(true);
    f.detectChanges();
    await f.whenStable();
    await new Promise((r) => setTimeout(r));

    const entry = document.querySelector<HTMLInputElement>('ui-multi-select input.entry')!;
    entry.focus();
    entry.dispatchEvent(new FocusEvent('focus'));
    f.detectChanges();
    await f.whenStable();

    expect(document.querySelector('.cdk-overlay-container [role="listbox"]')).not.toBeNull();

    // First Escape closes only the listbox; the modal stays open.
    entry.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    f.detectChanges();
    await f.whenStable();

    expect(document.querySelector('.cdk-overlay-container [role="listbox"]')).toBeNull();
    expect(f.componentInstance.open()).toBe(true);

    // Second Escape (now that the listbox is closed) closes the modal.
    entry.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    f.detectChanges();
    await f.whenStable();

    expect(f.componentInstance.open()).toBe(false);

    f.destroy();
  });

  it('UiMenu inside UiModal focuses its first item and closes on Escape without closing the modal', async () => {
    loadStyles('cdk-first');
    const f = TestBed.createComponent(ModalOverlayHost);
    document.body.appendChild(f.nativeElement);
    f.componentInstance.open.set(true);
    f.detectChanges();
    await f.whenStable();
    await new Promise((r) => setTimeout(r));

    const trigger = document.getElementById('menu-trigger') as HTMLButtonElement;
    trigger.click();
    f.detectChanges();
    await f.whenStable();
    await new Promise((r) => setTimeout(r));

    const firstItem = document.querySelector<HTMLButtonElement>('.cdk-overlay-container [role="menuitem"]')!;
    expect(firstItem).not.toBeNull();
    expect(document.activeElement).toBe(firstItem);

    firstItem.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    f.detectChanges();
    await f.whenStable();

    expect(document.querySelector('.cdk-overlay-container [role="menu"]')).toBeNull();
    expect(f.componentInstance.open()).toBe(true);
    expect(document.activeElement).toBe(trigger);

    f.destroy();
  });
});
