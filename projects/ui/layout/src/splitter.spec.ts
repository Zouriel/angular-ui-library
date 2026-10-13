import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { UiSplitter } from './splitter';

@Component({
  imports: [UiSplitter],
  template: `<ui-splitter #s [orientation]="orientation()"><div split-a>A</div><div split-b>B</div></ui-splitter>`,
})
class Host {
  readonly orientation = signal<'horizontal' | 'vertical'>('horizontal');
}

describe('UiSplitter', () => {
  function setup() {
    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    const gutter = fixture.nativeElement.querySelector('.gutter') as HTMLElement;
    return { fixture, gutter };
  }

  it('describes the divider line, not the pane layout, in aria-orientation', () => {
    const { fixture, gutter } = setup();
    // Side-by-side panes are split by a vertical line.
    expect(gutter.getAttribute('aria-orientation')).toBe('vertical');
    fixture.componentInstance.orientation.set('vertical');
    fixture.detectChanges();
    expect(gutter.getAttribute('aria-orientation')).toBe('horizontal');
  });

  it('moves the divider 2% per arrow key, within 10–90%', () => {
    const { fixture, gutter } = setup();
    gutter.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    fixture.detectChanges();
    expect(gutter.getAttribute('aria-valuenow')).toBe('52');
    for (let i = 0; i < 40; i++) gutter.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
    fixture.detectChanges();
    expect(gutter.getAttribute('aria-valuenow')).toBe('10');
  });
});
