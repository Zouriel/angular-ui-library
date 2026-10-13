import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { UiSidebarLayout } from './sidebar-layout';

@Component({
  imports: [UiSidebarLayout],
  template: `<ui-sidebar-layout [mainLandmark]="landmark()"><nav sidebar>nav</nav><p>page</p></ui-sidebar-layout>`,
})
class Host {
  readonly landmark = signal(true);
}

describe('UiSidebarLayout', () => {
  const original = window.matchMedia;
  beforeEach(() => {
    window.matchMedia = ((q: string) => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {} })) as unknown as typeof window.matchMedia;
  });
  afterEach(() => { window.matchMedia = original; });

  it('makes the content region the main landmark unless told not to', () => {
    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    const content = fixture.nativeElement.querySelector('.content') as HTMLElement;
    expect(content.getAttribute('role')).toBe('main');
    expect(fixture.nativeElement.querySelector('main')).toBeNull();
    fixture.componentInstance.landmark.set(false);
    fixture.detectChanges();
    expect(content.hasAttribute('role')).toBe(false);
    expect(content.textContent).toContain('page');
  });
});
