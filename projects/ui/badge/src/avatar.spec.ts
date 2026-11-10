import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { UiAvatar, uiAvatarCropLayout } from './avatar';

describe('UiAvatar', () => {
  it('shows initials from the first and last name', () => {
    const fixture = TestBed.createComponent(UiAvatar);
    fixture.componentRef.setInput('name', 'Ada King Lovelace');
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).querySelector('.initials')?.textContent?.trim()).toBe('AL');
  });

  it('falls back to initials when the image fails, and tries again for a new src', () => {
    const fixture = TestBed.createComponent(UiAvatar);
    const el = fixture.nativeElement as HTMLElement;
    fixture.componentRef.setInput('name', 'Grace Hopper');
    fixture.componentRef.setInput('src', '/missing.png');
    fixture.detectChanges();
    el.querySelector('img')!.dispatchEvent(new Event('error'));
    fixture.detectChanges();
    expect(el.querySelector('img')).toBeNull();
    expect(el.querySelector('.initials')?.textContent?.trim()).toBe('GH');

    fixture.componentRef.setInput('src', '/other.png');
    fixture.detectChanges();
    expect(el.querySelector('img')?.getAttribute('src')).toBe('/other.png');
  });
});

describe('ui-avatar sizes', () => {
  it('takes xl, and a pixel dimension that scales the initials', () => {
    const f = TestBed.createComponent(UiAvatar);
    f.componentRef.setInput('name', 'Aminath Hassan');
    f.componentRef.setInput('size', 'xl');
    f.detectChanges();
    const a = (f.nativeElement as HTMLElement).querySelector('.ui-avatar') as HTMLElement;
    expect(a.getAttribute('data-size')).toBe('xl');
    expect(a.style.width).toBe('');
    f.componentRef.setInput('dimension', 96);
    f.detectChanges();
    expect([a.style.width, a.style.height, a.style.fontSize]).toEqual(['96px', '96px', '36px']);
    expect(a.textContent!.trim()).toBe('AH');
  });
});

describe('ui-avatar crop', () => {
  // A 300x200 image; the face box is off-centre and not square (90x40 px).
  const box = { x: 0.5, y: 0.1, w: 0.2, h: 0.2 };
  function load(f: ReturnType<typeof TestBed.createComponent<UiAvatar>>, w: number, h: number) {
    const img = (f.nativeElement as HTMLElement).querySelector('img')!;
    Object.defineProperty(img, 'naturalWidth', { value: w, configurable: true });
    Object.defineProperty(img, 'naturalHeight', { value: h, configurable: true });
    img.dispatchEvent(new Event('load'));
    f.detectChanges();
    return img;
  }

  it('maps a known box to the expected size and position', () => {
    const l = uiAvatarCropLayout(box, 0.25, 1.5)!;
    // padded box x 0.45-0.75, y 0.05-0.35 -> 0.3 x 0.3; 90 x 60 px, so the 90px side fills
    expect([l.width, l.height].map(Math.round)).toEqual([333, 222]);
    expect(Math.round(l.left)).toBe(-150);
    expect(l.top).toBe(0); // centre would be 5.6; kept inside the image edge
  });

  it('sets that as the image style once the image has loaded, and hides it until then', () => {
    const f = TestBed.createComponent(UiAvatar);
    f.componentRef.setInput('src', '/face.jpg');
    f.componentRef.setInput('crop', box);
    f.detectChanges();
    const img = (f.nativeElement as HTMLElement).querySelector('img')!;
    expect(img.style.visibility).toBe('hidden');
    load(f, 300, 200);
    expect(img.style.visibility).toBe('');
    expect([img.style.width, img.style.height, img.style.left, img.style.top].map((v) => parseFloat(v).toFixed(1)))
      .toEqual(['333.3', '222.2', '-150.0', '0.0']);
  });

  it('pads less or more with cropPadding, and leaves the box alone at 0', () => {
    const l = uiAvatarCropLayout({ x: 0.4, y: 0.4, w: 0.2, h: 0.2 }, 0, 1)!;
    expect([l.width, l.left, l.top].map((v) => Math.round(v))).toEqual([500, -200, -200]);
    expect(uiAvatarCropLayout({ x: 0.4, y: 0.4, w: 0.2, h: 0.2 }, 0.5, 1)!.width).toBeCloseTo(250);
  });

  it('keeps the box inside the image when padding would pass an edge', () => {
    const l = uiAvatarCropLayout({ x: 0, y: 0, w: 0.4, h: 0.4 }, 0.25, 1)!;
    // padded 0-0.5: fills 200%, and the image edge stays against the avatar's edge
    expect([l.width, l.left, l.top]).toEqual([200, 0, 0]);
  });

  it('renders as before without a crop, and for an empty box', () => {
    for (const crop of [null, { x: 0.1, y: 0.1, w: 0, h: 0.2 }]) {
      const f = TestBed.createComponent(UiAvatar);
      f.componentRef.setInput('src', '/face.jpg');
      f.componentRef.setInput('crop', crop);
      f.detectChanges();
      const img = load(f, 300, 200);
      expect(img.classList.contains('cropped')).toBe(false);
      expect([img.style.width, img.style.left, img.style.visibility]).toEqual(['', '', '']);
    }
  });

  it('still falls back to initials when a cropped image fails', () => {
    const f = TestBed.createComponent(UiAvatar);
    f.componentRef.setInput('name', 'Grace Hopper');
    f.componentRef.setInput('src', '/missing.png');
    f.componentRef.setInput('crop', box);
    f.detectChanges();
    (f.nativeElement as HTMLElement).querySelector('img')!.dispatchEvent(new Event('error'));
    f.detectChanges();
    expect((f.nativeElement as HTMLElement).querySelector('img')).toBeNull();
    expect((f.nativeElement as HTMLElement).querySelector('.initials')?.textContent?.trim()).toBe('GH');
  });
});
