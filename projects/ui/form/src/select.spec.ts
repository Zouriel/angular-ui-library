import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormsModule } from '@angular/forms';
import { uiFontStack } from '@zouriel/ui';
import { UiSelect, type UiSelectOption } from './select';

@Component({
  imports: [UiSelect, FormsModule],
  template: `<ui-select [options]="options" [fontPreview]="preview()" [(ngModel)]="font" />`,
})
class Host {
  preview = signal(true);
  font = 'Georgia';
  options: UiSelectOption[] = [
    { label: 'Georgia', value: 'Georgia' },
    { label: 'Open Sans', value: 'Open Sans' },
    { label: 'Mono', value: 'mono', fontFamily: 'ui-monospace, monospace' },
  ];
}

describe('uiFontStack', () => {
  it('quotes a bare family and keeps stacks and generic names as they are', () => {
    expect(uiFontStack('Open Sans')).toBe('"Open Sans", system-ui, sans-serif');
    expect(uiFontStack('Inter, sans-serif')).toBe('Inter, sans-serif');
    expect(uiFontStack('monospace')).toBe('monospace');
    expect(uiFontStack('')).toBeNull();
  });
});

describe('ui-select font preview', () => {
  it('draws each option and the closed field in its own font', async () => {
    const fx = TestBed.createComponent(Host);
    fx.detectChanges();
    await fx.whenStable();
    fx.detectChanges();
    const el = fx.nativeElement as HTMLElement;
    const opts = [...el.querySelectorAll('option')];
    expect(opts[1].style.fontFamily).toContain('Open Sans');
    expect(opts[2].style.fontFamily).toContain('ui-monospace');
    expect(el.querySelector<HTMLSelectElement>('select')!.style.fontFamily).toContain('Georgia');
    expect(el.querySelector('select')!.classList.contains('font-preview')).toBe(true);
  });

  it('leaves fonts alone without fontPreview, except options that name one', async () => {
    const fx = TestBed.createComponent(Host);
    fx.componentInstance.preview.set(false);
    fx.detectChanges();
    await fx.whenStable();
    fx.detectChanges();
    const opts = [...(fx.nativeElement as HTMLElement).querySelectorAll('option')];
    expect(opts[0].style.fontFamily).toBe('');
    expect(opts[2].style.fontFamily).toContain('ui-monospace');
  });
});
