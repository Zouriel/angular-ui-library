import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { UiTaskProgress, UiTaskProgressDialog } from './task-progress';

@Component({
  imports: [UiTaskProgress],
  template: `<ui-task-progress title="Saving photos" [done]="done()" [total]="total()" [detail]="detail()" [cancelLabel]="label()"
    [(stopping)]="stopping" (cancel)="cancels = cancels + 1" />`,
})
class InlineHost {
  done = signal(12);
  total = signal(40);
  detail = signal<string | null>('IMG_0013.jpg');
  label = signal<string | undefined>(undefined);
  stopping = signal(false);
  cancels = 0;
}

@Component({
  imports: [UiTaskProgressDialog],
  template: `<ui-task-progress-dialog [(open)]="open" title="Saving photos" [done]="done()" [total]="40" [(stopping)]="stopping" (cancel)="cancels = cancels + 1" />`,
})
class DialogHost {
  open = signal(false);
  done = signal(1);
  stopping = signal(false);
  cancels = 0;
}

describe('ui-task-progress', () => {
  it('title, "12 of 40", the detail line and a bar on the 0-100 scale', async () => {
    const fx = TestBed.createComponent(InlineHost);
    fx.detectChanges();
    await fx.whenStable();
    const el = fx.nativeElement as HTMLElement;
    expect(el.querySelector('.title')!.textContent!.trim()).toBe('Saving photos');
    expect(el.querySelector('.count')!.textContent!.trim()).toBe('12 of 40');
    expect(el.querySelector('.detail')!.textContent!.trim()).toBe('IMG_0013.jpg');
    const bar = el.querySelector('[role="progressbar"]')!;
    expect(bar.getAttribute('aria-valuenow')).toBe('30');
    expect(bar.getAttribute('aria-label')).toBe('Saving photos');
    fx.componentInstance.done.set(40);
    fx.detectChanges();
    expect(el.querySelector('.count')!.textContent!.trim()).toBe('40 of 40');
    expect(bar.getAttribute('aria-valuenow')).toBe('100');
  });

  it('total 0: no count and a sweeping bar; a custom cancel label', async () => {
    const fx = TestBed.createComponent(InlineHost);
    fx.componentInstance.total.set(0);
    fx.componentInstance.label.set('Stop');
    fx.detectChanges();
    const el = fx.nativeElement as HTMLElement;
    expect(el.querySelector('.count')).toBeNull();
    expect(el.querySelector('[role="progressbar"]')!.getAttribute('aria-valuenow')).toBeNull();
    expect(el.querySelector('ui-button')!.textContent!.trim()).toBe('Stop');
  });

  it('Cancel emits once and turns into Stopping, busy and disabled', async () => {
    const fx = TestBed.createComponent(InlineHost);
    fx.detectChanges();
    const el = fx.nativeElement as HTMLElement;
    const btn = () => el.querySelector('ui-button button') as HTMLButtonElement;
    btn().click();
    fx.detectChanges();
    expect(fx.componentInstance.cancels).toBe(1);
    expect(fx.componentInstance.stopping()).toBe(true);
    expect(el.querySelector('ui-button')!.textContent!.trim()).toBe('Stopping…');
    expect(btn().disabled).toBe(true);
    expect(btn().getAttribute('aria-busy')).toBe('true');
    btn().click();
    expect(fx.componentInstance.cancels).toBe(1);
  });
});

describe('ui-task-progress-dialog', () => {
  async function open() {
    const fx = TestBed.createComponent(DialogHost);
    fx.detectChanges();
    fx.componentInstance.open.set(true);
    fx.detectChanges();
    await fx.whenStable();
    fx.detectChanges();
    return fx;
  }

  it('opens as a dialog named by its title that the backdrop does not close', async () => {
    const fx = await open();
    const dialog = document.querySelector('[role="dialog"]')!;
    expect(dialog.querySelector('ui-task-progress')).not.toBeNull();
    const id = dialog.getAttribute('aria-labelledby')!;
    expect(document.getElementById(id)!.textContent!.trim()).toBe('Saving photos');
    (document.querySelector('.backdrop') as HTMLElement).click();
    fx.detectChanges();
    expect(fx.componentInstance.open()).toBe(true);
    expect(fx.componentInstance.cancels).toBe(0);
    fx.destroy();
  });

  it('Escape cancels instead of closing; it closes when the job sets open to false', async () => {
    const fx = await open();
    document.querySelector('.panel')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    fx.detectChanges();
    expect(fx.componentInstance.cancels).toBe(1);
    expect(fx.componentInstance.stopping()).toBe(true);
    expect(fx.componentInstance.open()).toBe(true);
    expect(document.querySelector('[role="dialog"] ui-button')!.textContent!.trim()).toBe('Stopping…');
    // A second Escape while stopping does nothing more.
    document.querySelector('.panel')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(fx.componentInstance.cancels).toBe(1);
    fx.componentInstance.open.set(false);
    fx.detectChanges();
    await fx.whenStable();
    fx.detectChanges();
    expect(fx.componentInstance.open()).toBe(false);
    fx.destroy();
  });

  it('Cancel inside the dialog cancels; the dialog stays until closed', async () => {
    const fx = await open();
    (document.querySelector('[role="dialog"] ui-button button') as HTMLButtonElement).click();
    fx.detectChanges();
    expect(fx.componentInstance.cancels).toBe(1);
    expect(fx.componentInstance.open()).toBe(true);
    expect(document.querySelector('[role="dialog"] ui-task-progress')).not.toBeNull();
    fx.destroy();
  });
});
