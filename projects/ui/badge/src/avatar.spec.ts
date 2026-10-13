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
