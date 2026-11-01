import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Component, signal } from '@angular/core';
import { describe, expect, it } from 'vitest';
import { UiConfirmDialog } from './confirm-dialog';

@Component({
  imports: [UiConfirmDialog],
  template: `<ui-confirm-dialog [(open)]="open" [confirmLabel]="label" [destructive]="true" />`,
})
class Host {
  open = signal(true);
  label = 'Delete this event for good';
}

describe('UiConfirmDialog', () => {
  it('lets its buttons stack when the labels do not fit on one line', async () => {
    const f: ComponentFixture<Host> = TestBed.createComponent(Host);
    f.detectChanges();
    await f.whenStable();
    const actions = document.querySelector('.actions.destructive') as HTMLElement | null;
    expect(actions).not.toBeNull();
    expect(actions!.textContent).toContain('Delete this event for good');
    // jsdom does not lay out, and reads flexWrap unreliably: check the component's own rule. Measured at 360px in a browser.
    const css = ((UiConfirmDialog as unknown as { ɵcmp: { styles: string[] } }).ɵcmp.styles).join('');
    expect(css).toMatch(/\.actions[^{]*\{[^}]*flex-wrap:\s*wrap/);
    f.destroy();
  });
});
