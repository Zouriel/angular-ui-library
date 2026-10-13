import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { UiResult, type UiResultStatus } from './result';

@Component({
  imports: [UiResult],
  template: `<ui-result [status]="status" title="Page not found" />`,
})
class Host {
  status: UiResultStatus = '404';
}

describe('UiResult', () => {
  it('draws every status as an svg, never a text glyph', () => {
    const fixture = TestBed.createComponent(Host);
    for (const s of ['success', 'error', 'info', 'warning', '404', '500'] as UiResultStatus[]) {
      fixture.componentInstance.status = s;
      fixture.changeDetectorRef.markForCheck();
      fixture.detectChanges();
      const glyph = (fixture.nativeElement as HTMLElement).querySelector('.glyph')!;
      expect(glyph.querySelector('svg'), s).not.toBeNull();
      expect(glyph.textContent?.trim(), s).toBe('');
    }
  });

  it('shows title as the headline without leaving a native tooltip on the host', () => {
    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    const host = (fixture.nativeElement as HTMLElement).querySelector('ui-result')!;
    expect(host.querySelector('.title')?.textContent?.trim()).toBe('Page not found');
    expect(host.hasAttribute('title')).toBe(false);
  });
});
