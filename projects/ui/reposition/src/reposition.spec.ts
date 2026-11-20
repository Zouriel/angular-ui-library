import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { UiReposition, type UiRepositionPosition } from './reposition';

@Component({
  imports: [UiReposition],
  template: `<ui-reposition style="width:100px;height:100px" src="photo.jpg" [position]="position()" [active]="active()"
      (save)="saved.push($event)" (cancel)="onCancel()" />`,
})
class Host {
  position = signal<UiRepositionPosition>({ x: 40, y: 25 });
  active = signal(true);
  saved: UiRepositionPosition[] = [];
  cancelled = 0;
  onCancel() { this.cancelled += 1; }
}

function setup() {
  const fixture = TestBed.createComponent(Host);
  fixture.detectChanges();
  const editor = (fixture.nativeElement as HTMLElement).querySelector('ui-reposition') as HTMLElement;
  editor.getBoundingClientRect = () => ({ x: 20, y: 20, left: 20, top: 20, right: 120, bottom: 120, width: 100, height: 100, toJSON: () => ({}) });
  const image = editor.querySelector('.frame-image') as HTMLImageElement;
  Object.defineProperties(image, { naturalWidth: { value: 200 }, naturalHeight: { value: 100 } });
  image.dispatchEvent(new Event('load'));
  fixture.detectChanges();
  return { fixture, editor };
}

describe('UiReposition', () => {
  it('draws a scrim and in-place controls only while active, without a modal or overlay container', () => {
    const { fixture, editor } = setup();
    expect(editor.querySelector('.scrim')).not.toBeNull();
    expect(editor.querySelector('.bright')).not.toBeNull();
    expect(editor.textContent).toContain('Save');
    expect(document.querySelector('.cdk-overlay-container')).toBeNull();
    fixture.componentInstance.active.set(false);
    fixture.detectChanges();
    expect(editor.querySelector('.scrim')).toBeNull();
    expect(editor.textContent).not.toContain('Save');
  });

  it('drag clamps without gaps and locks the axis that does not overflow', () => {
    const { fixture, editor } = setup();
    const bright = editor.querySelector('.bright') as HTMLElement;
    bright.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 1, clientX: 50, clientY: 50 }));
    bright.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, pointerId: 1, clientX: 80, clientY: 80 }));
    fixture.detectChanges();
    expect(bright.getAttribute('aria-valuetext')).toBe('Photo position 10 percent horizontal, 50 percent vertical');
    bright.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, pointerId: 1, clientX: 800, clientY: 80 }));
    fixture.detectChanges();
    expect(bright.getAttribute('aria-valuetext')).toBe('Photo position 0 percent horizontal, 50 percent vertical');
  });

  it('arrows move only an overflowing axis, Enter saves, and Escape cancels/restores', () => {
    const { fixture, editor } = setup();
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }));
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown' }));
    fixture.detectChanges();
    expect((editor.querySelector('.bright') as HTMLElement).getAttribute('aria-valuetext')).toContain('41 percent horizontal, 25 percent vertical');
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    expect(fixture.componentInstance.saved).toEqual([{ x: 41, y: 25 }]);
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    fixture.detectChanges();
    expect(fixture.componentInstance.cancelled).toBe(1);
    expect((editor.querySelector('.bright') as HTMLElement).getAttribute('aria-valuetext')).toContain('40 percent horizontal, 25 percent vertical');
  });
});
