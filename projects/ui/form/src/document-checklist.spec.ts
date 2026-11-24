import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { provideUiStrings, uiStringsDv } from '@zouriel/ui';
import { UiDocumentChecklist, type UiDocumentItem, type UiDocumentUploadEvent } from './document-checklist';

@Component({
  imports: [UiDocumentChecklist],
  template: `
    <ui-document-checklist
      [items]="items()"
      [disabled]="disabled()"
      (upload)="uploads.push($event)"
      (remove)="removes.push($event)"
      (view)="views.push($event)" />
  `,
})
class Host {
  items = signal<UiDocumentItem[]>([
    {
      id: 'plans',
      title: 'Architectural plans',
      requirement: 'Required because this project has 2 floors · PDF · up to 5 MB',
      status: 'missing',
      accept: '.pdf,application/pdf',
      maxSizeMb: 5,
    },
    {
      id: 'id-card',
      title: 'National ID copy',
      status: 'attached',
      fileName: 'id-front.pdf',
      accept: '.pdf',
    },
    {
      id: 'land',
      title: 'Land registry extract',
      requirement: 'Verified from the land register',
      status: 'verified',
      source: 'registry',
    },
    {
      id: 'photo',
      title: 'Site photograph',
      status: 'rejected',
      reason: 'Image is blurry; please upload a clearer photo',
      accept: 'image/*',
      maxSizeMb: 2,
    },
    {
      id: 'draft-doc',
      title: 'Fire safety form',
      status: 'draft',
    },
  ]);
  disabled = signal(false);
  uploads: UiDocumentUploadEvent[] = [];
  removes: string[] = [];
  views: string[] = [];
}

function pickFile(input: HTMLInputElement, file: File): void {
  const list = { 0: file, length: 1, item: (i: number) => (i === 0 ? file : null), [Symbol.iterator]: function* () { yield file; } };
  Object.defineProperty(input, 'files', { value: list, configurable: true });
  input.dispatchEvent(new Event('change'));
}

describe('UiDocumentChecklist', () => {
  it('renders rows, soft badges, live summary count, and registry items without upload', () => {
    const f = TestBed.createComponent(Host);
    f.detectChanges();
    const el = f.nativeElement as HTMLElement;

    const summary = el.querySelector('.summary')!;
    expect(summary.getAttribute('aria-live')).toBe('polite');
    expect(summary.textContent?.trim()).toBe('2 of 5 attached');

    const rows = el.querySelectorAll('.row');
    expect(rows).toHaveLength(5);

    // Registry item has no file input and shows its requirement
    const landRow = el.querySelector('[data-doc-id="land"]')!;
    expect(landRow.querySelector('input[type="file"]')).toBeNull();
    expect(landRow.querySelector('.req')?.textContent?.trim()).toBe('Verified from the land register');
    expect(landRow.querySelector('ui-badge .ui-badge')?.getAttribute('data-appearance')).toBe('soft');
    expect(landRow.querySelector('ui-badge .ui-badge')?.getAttribute('data-tone')).toBe('success');

    // Rejected item shows its reason and has Choose file action
    const photoRow = el.querySelector('[data-doc-id="photo"]')!;
    expect(photoRow.querySelector('.reason')?.textContent?.trim()).toBe('Image is blurry; please upload a clearer photo');
    expect(photoRow.textContent).toContain('Choose file');
  });

  it('emits upload for valid file and refuses wrong type or oversized file without emitting', () => {
    const f = TestBed.createComponent(Host);
    f.detectChanges();
    const el = f.nativeElement as HTMLElement;
    const plansRow = el.querySelector('[data-doc-id="plans"]')!;
    const input = plansRow.querySelector<HTMLInputElement>('input[type="file"]')!;

    // Wrong type
    const badType = new File(['hello'], 'notes.txt', { type: 'text/plain' });
    pickFile(input, badType);
    f.detectChanges();
    expect(f.componentInstance.uploads).toHaveLength(0);
    expect(plansRow.querySelector('.error')?.textContent?.trim()).toBe('Wrong file type');

    // Too large (> 5 MB)
    const bigPdf = new File([new Uint8Array(6 * 1024 * 1024)], 'huge.pdf', { type: 'application/pdf' });
    pickFile(input, bigPdf);
    f.detectChanges();
    expect(f.componentInstance.uploads).toHaveLength(0);
    expect(plansRow.querySelector('.error')?.textContent?.trim()).toBe('File exceeds 5 MB');

    // Valid file clears error and emits upload
    const okPdf = new File(['%PDF-1.4'], 'plans.pdf', { type: 'application/pdf' });
    pickFile(input, okPdf);
    f.detectChanges();
    expect(plansRow.querySelector('.error')).toBeNull();
    expect(f.componentInstance.uploads).toHaveLength(1);
    expect(f.componentInstance.uploads[0].id).toBe('plans');
    expect(f.componentInstance.uploads[0].file.name).toBe('plans.pdf');
  });

  it('emits view and remove for attached documents and respects disabled', () => {
    const f = TestBed.createComponent(Host);
    f.detectChanges();
    const el = f.nativeElement as HTMLElement;
    const idRow = el.querySelector('[data-doc-id="id-card"]')!;
    const buttons = [...idRow.querySelectorAll<HTMLButtonElement>('ui-button button')];
    expect(buttons.map((b) => b.textContent?.trim())).toEqual(['View', 'Replace', '']);

    buttons[0].click();
    buttons[2].click();
    expect(f.componentInstance.views).toEqual(['id-card']);
    expect(f.componentInstance.removes).toEqual(['id-card']);

    f.componentInstance.disabled.set(true);
    f.detectChanges();
    expect([...el.querySelectorAll<HTMLButtonElement>('ui-button button')].every((b) => b.disabled)).toBe(true);
  });

  it('uses Dhivehi strings when provided', () => {
    TestBed.configureTestingModule({ providers: [provideUiStrings(uiStringsDv)] });
    const f = TestBed.createComponent(Host);
    f.detectChanges();
    const el = f.nativeElement as HTMLElement;
    expect(el.querySelector('.summary')?.textContent?.trim()).toBe('5 ގެ ތެރެއިން 2 އެޓޭޗްކޮށްފައި');
    expect(el.querySelector('[data-doc-id="plans"] ui-badge')?.textContent?.trim()).toBe(uiStringsDv.docMissing);
  });
});
