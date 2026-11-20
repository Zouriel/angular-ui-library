import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { UiFileUpload } from './file-upload';

@Component({ imports: [UiFileUpload], template: `<ui-file-upload preview="a.png" [previewPosition]="pos()" />` })
class Host {
  pos = signal<{ x: number; y: number } | null>({ x: 15, y: 70 });
}

describe('ui-file-upload previewPosition', () => {
  it('sets the preview object-position and leaves it unset by default', () => {
    const f = TestBed.createComponent(Host);
    f.detectChanges();
    const img = (f.nativeElement as HTMLElement).querySelector('img.preview') as HTMLImageElement;
    expect(img.style.objectPosition).toBe('15% 70%');
    f.componentInstance.pos.set(null);
    f.detectChanges();
    expect(img.style.objectPosition).toBe('');
  });
});
