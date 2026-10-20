import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { UiAvatar } from './avatar';

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
