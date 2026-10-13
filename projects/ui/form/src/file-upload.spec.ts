import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { UiFileUpload, fileMatchesAccept } from './file-upload';

const file = (name: string, type: string) => new File(['x'], name, { type });

describe('fileMatchesAccept', () => {
  it('reads extensions, exact types and wildcards like the file dialog', () => {
    expect(fileMatchesAccept(file('a.PDF', 'application/pdf'), '.pdf')).toBe(true);
    expect(fileMatchesAccept(file('a.png', 'image/png'), 'image/*')).toBe(true);
    expect(fileMatchesAccept(file('a.png', 'image/png'), 'image/jpeg, .gif')).toBe(false);
    expect(fileMatchesAccept(file('a.txt', 'text/plain'), undefined)).toBe(true);
  });
});

@Component({
  imports: [UiFileUpload],
  template: `<ui-file-upload accept="image/*" [multiple]="true" [disabled]="off" (filesSelected)="got = $event" (rejected)="bad = $event" />`,
})
class Host { off = false; got: File[] = []; bad: File[] = []; }

describe('ui-file-upload', () => {
  function drop(el: HTMLElement, files: File[]) {
    const ev = new Event('drop', { bubbles: true, cancelable: true }) as Event & { dataTransfer: unknown };
    Object.defineProperty(ev, 'dataTransfer', { value: { files } });
    el.querySelector('.dz')!.dispatchEvent(ev);
  }

  it('keeps dropped files that match accept and reports the rest', () => {
    const fx = TestBed.createComponent(Host);
    fx.detectChanges();
    drop(fx.nativeElement, [file('a.png', 'image/png'), file('b.exe', 'application/octet-stream')]);
    expect(fx.componentInstance.got.map((f) => f.name)).toEqual(['a.png']);
    expect(fx.componentInstance.bad.map((f) => f.name)).toEqual(['b.exe']);
  });

  it('ignores drops and disables the picker when disabled', () => {
    const fx = TestBed.createComponent(Host);
    fx.componentInstance.off = true;
    fx.detectChanges();
    drop(fx.nativeElement, [file('a.png', 'image/png')]);
    expect(fx.componentInstance.got).toEqual([]);
    expect((fx.nativeElement as HTMLElement).querySelector<HTMLInputElement>('input[type=file]')!.disabled).toBe(true);
  });
});
