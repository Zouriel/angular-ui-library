import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
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

@Component({
  imports: [UiFileUpload],
  template: `<ui-file-upload accept="image/*" [multiple]="true" [showFiles]="false" (filesSelected)="got = $event" />`,
})
class QuietHost { got: File[] = []; }

@Component({
  imports: [UiFileUpload],
  template: `<ui-file-upload accept="image/*" [capture]="capture()" [cameraAction]="cameraAction()" [cameraLabel]="cameraLabel()"
    [disabled]="disabled()" (filesSelected)="got = $event" />`,
})
class CameraHost {
  capture = signal<'user' | 'environment' | boolean | null>('environment');
  cameraAction = signal<'user' | 'environment' | null>('environment');
  cameraLabel = signal<string | undefined>(undefined);
  disabled = signal(false);
  got: File[] = [];
}

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

  it('lists the picked files under the box, unless showFiles is off (the app shows its own list)', () => {
    const fx = TestBed.createComponent(Host);
    fx.detectChanges();
    drop(fx.nativeElement, [file('a.png', 'image/png'), file('b.png', 'image/png')]);
    fx.detectChanges();
    expect((fx.nativeElement as HTMLElement).querySelectorAll('.files li').length).toBe(2);

    const quiet = TestBed.createComponent(QuietHost);
    quiet.detectChanges();
    drop(quiet.nativeElement, [file('a.png', 'image/png')]);
    quiet.detectChanges();
    expect(quiet.componentInstance.got.map((f) => f.name)).toEqual(['a.png']);
    expect((quiet.nativeElement as HTMLElement).querySelector('.files')).toBeNull();
  });

  it('ignores drops and disables the picker when disabled', () => {
    const fx = TestBed.createComponent(Host);
    fx.componentInstance.off = true;
    fx.detectChanges();
    drop(fx.nativeElement, [file('a.png', 'image/png')]);
    expect(fx.componentInstance.got).toEqual([]);
    expect((fx.nativeElement as HTMLElement).querySelector<HTMLInputElement>('input[type=file]')!.disabled).toBe(true);
  });

  it('binds capture on the normal picker input', () => {
    const fx = TestBed.createComponent(CameraHost);
    fx.detectChanges();
    const input = (fx.nativeElement as HTMLElement).querySelector<HTMLInputElement>('input.picker-native')!;
    expect(input.getAttribute('capture')).toBe('environment');
    fx.componentInstance.capture.set(true);
    fx.detectChanges();
    expect(input.getAttribute('capture')).toBe('');
    fx.componentInstance.capture.set(false);
    fx.detectChanges();
    expect(input.hasAttribute('capture')).toBe(false);
  });

  it('cameraAction opens an image camera input and emits its file through filesSelected', () => {
    const fx = TestBed.createComponent(CameraHost);
    fx.detectChanges();
    const root = fx.nativeElement as HTMLElement;
    const camera = root.querySelector<HTMLInputElement>('input.camera-native')!;
    expect(camera.accept).toBe('image/*');
    expect(camera.getAttribute('capture')).toBe('environment');
    const click = vi.spyOn(camera, 'click');
    (root.querySelector('ui-button.camera button') as HTMLButtonElement).click();
    expect(click).toHaveBeenCalledOnce();
    Object.defineProperty(camera, 'files', { value: [file('photo.jpg', 'image/jpeg')] });
    camera.dispatchEvent(new Event('change'));
    expect(fx.componentInstance.got.map((f) => f.name)).toEqual(['photo.jpg']);
    expect(root.querySelector('ui-button.camera')!.textContent).toContain('Take a photo');
  });

  it('camera action is disabled with the upload and cameraLabel replaces its words', () => {
    const fx = TestBed.createComponent(CameraHost);
    fx.componentInstance.disabled.set(true);
    fx.componentInstance.cameraLabel.set('Open camera');
    fx.detectChanges();
    const root = fx.nativeElement as HTMLElement;
    const camera = root.querySelector<HTMLInputElement>('input.camera-native')!;
    const button = root.querySelector<HTMLButtonElement>('ui-button.camera button')!;
    expect(camera.disabled).toBe(true);
    expect(button.disabled).toBe(true);
    expect(button.textContent).toContain('Open camera');
    Object.defineProperty(camera, 'files', { value: [file('ignored.jpg', 'image/jpeg')] });
    camera.dispatchEvent(new Event('change'));
    expect(fx.componentInstance.got).toEqual([]);
  });
});

@Component({
  imports: [UiFileUpload],
  template: `<ui-file-upload accept="image/*" [preview]="src" previewAlt="Your logo" previewFit="contain" previewAspect="1"
    [removable]="removable" (filesSelected)="got = $event" (remove)="removed = removed + 1" />`,
})
class PreviewHost { src: string | null = null; removable = true; got: File[] = []; removed = 0; }

describe('ui-file-upload with a picture in it', () => {
  it('is an ordinary dropzone until there is a picture', () => {
    const fx = TestBed.createComponent(PreviewHost);
    fx.detectChanges();
    const el = fx.nativeElement as HTMLElement;
    expect(el.querySelector('img.preview')).toBeNull();
    expect(el.querySelector('.hint')).not.toBeNull();
    expect(el.querySelector('.remove')).toBeNull();
  });

  it('shows the picture in the same box, clicking it still picks a replacement, and Remove sits under it', () => {
    const fx = TestBed.createComponent(PreviewHost);
    fx.componentInstance.src = '/logo.png';
    fx.detectChanges();
    const el = fx.nativeElement as HTMLElement;
    const dz = el.querySelector<HTMLElement>('.dz')!;
    const img = dz.querySelector<HTMLImageElement>('img.preview')!;
    expect(img.getAttribute('src')).toBe('/logo.png');
    expect(img.getAttribute('alt')).toBe('Your logo');
    expect(dz.classList).toContain('fit-contain');
    expect(dz.style.getPropertyValue('--upload-aspect')).toBe('1');
    expect(dz.querySelector('.hint')).toBeNull();
    expect(dz.querySelector('.replace')!.textContent).toContain('Click to change');
    // The picker input is still inside the box, so clicking the picture opens it.
    const input = dz.querySelector<HTMLInputElement>('input[type=file]')!;
    expect(input.getAttribute('aria-label')).toBe('Your logo. Click to change');
    Object.defineProperty(input, 'files', { value: [new File(['x'], 'b.png', { type: 'image/png' })] });
    input.dispatchEvent(new Event('change'));
    expect(fx.componentInstance.got.map((f) => f.name)).toEqual(['b.png']);
    // The new file's name isn't listed under a picture: the picture is the feedback.
    fx.detectChanges();
    expect(el.querySelector('.files')).toBeNull();
    const remove = el.querySelector<HTMLButtonElement>('button.remove')!;
    expect(dz.contains(remove)).toBe(false);
    expect(remove.textContent).toContain('Remove');
    remove.click();
    expect(fx.componentInstance.removed).toBe(1);
  });

  it('has no Remove button unless removable', () => {
    const fx = TestBed.createComponent(PreviewHost);
    fx.componentInstance.src = '/logo.png';
    fx.componentInstance.removable = false;
    fx.detectChanges();
    expect((fx.nativeElement as HTMLElement).querySelector('.remove')).toBeNull();
  });
});
