import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { UiFab, type UiFabPlacement, type UiFabTone } from './fab';

/* 0.44.0: ui-fab placements, the danger (SOS) tone, text and aboveOverlays. */

@Component({
  imports: [UiFab],
  template: `<ui-fab label="SOS, call for help" [position]="position()" [tone]="tone()" [text]="text()" [aboveOverlays]="above()" [topOffset]="offset()" [bottomOffset]="bottomOffset()"><span class="icon">!</span></ui-fab>`,
})
class Host {
  position = signal<UiFabPlacement>('bottom-right');
  tone = signal<UiFabTone>('primary');
  text = signal<string | null>(null);
  above = signal(false);
  offset = signal(0);
  bottomOffset = signal(0);
}

function setup() {
  const f = TestBed.createComponent(Host);
  f.detectChanges();
  const btn = () => (f.nativeElement as HTMLElement).querySelector('button.ui-fab') as HTMLButtonElement;
  return { f, h: f.componentInstance, btn, tick: () => f.detectChanges() };
}

describe('ui-fab (0.44.0)', () => {
  it('top placements sit below the status bar and notch: the edge gap plus the top safe area', () => {
    const { h, btn, tick } = setup();
    for (const p of ['top-center', 'top-end', 'top-start', 'top-right', 'top-left'] as const) {
      h.position.set(p);
      tick();
      expect(btn().getAttribute('data-position')).toBe(p);
      const s = getComputedStyle(btn());
      expect(s.top).toContain('safe-area-inset-top');
      expect(s.top).toContain('--ui-fab-edge');
      expect(s.bottom === '' || s.bottom === 'auto').toBe(true);
    }
    h.position.set('bottom-center');
    tick();
    expect(getComputedStyle(btn()).bottom).toContain('safe-area-inset-bottom');
  });

  it('centred placements are centred with auto margins; end and start are logical sides', () => {
    const { h, btn, tick } = setup();
    h.position.set('top-center');
    tick();
    let s = getComputedStyle(btn());
    expect(s.left).toBe('0px');
    expect(s.right).toBe('0px');
    expect(s.getPropertyValue('margin-inline')).toBe('auto');
    h.position.set('top-end');
    tick();
    s = getComputedStyle(btn());
    expect(s.getPropertyValue('inset-inline-end')).toContain('--ui-fab-edge');
    expect(s.left === '' || s.left === 'auto').toBe(true);
  });

  it('the danger tone is the high-visibility style: danger fill, a ring and a halo', () => {
    const { h, btn, tick } = setup();
    expect(btn().getAttribute('data-tone')).toBe('primary');
    expect(getComputedStyle(btn()).getPropertyValue('background')).toBe('var(--ui-color-primary)');
    h.tone.set('danger');
    tick();
    expect(btn().getAttribute('data-tone')).toBe('danger');
    const s = getComputedStyle(btn());
    expect(s.getPropertyValue('background')).toBe('var(--ui-color-danger)');
    expect(s.color).toContain('--ui-color-danger-contrast');
    expect(s.boxShadow).toContain('0 0 0 3px var(--ui-color-surface-raised)');
    expect(s.boxShadow).toContain('0 0 0 9px color-mix(in srgb, var(--ui-color-danger) 30%, transparent)');
  });

  it('aboveOverlays stacks it over sheets and drawers (the overlay layer + 1); off it stays docked', () => {
    const { h, btn, tick } = setup();
    expect(getComputedStyle(btn()).zIndex).toBe('var(--ui-z-docked)');
    h.above.set(true);
    tick();
    expect(btn().hasAttribute('data-above')).toBe(true);
    expect(getComputedStyle(btn()).zIndex).toBe('calc(var(--ui-z-overlay) + 1)');
  });

  it('text makes a pill with the word after the icon; the label stays the accessible name', () => {
    const { h, btn, tick } = setup();
    expect(btn().querySelector('.ui-fab-text')).toBeNull();
    expect(btn().hasAttribute('data-extended')).toBe(false);
    h.text.set('SOS');
    tick();
    expect(btn().querySelector('.ui-fab-text')!.textContent!.trim()).toBe('SOS');
    expect(btn().lastElementChild!.classList.contains('ui-fab-text')).toBe(true);
    expect(btn().hasAttribute('data-extended')).toBe(true);
    expect(getComputedStyle(btn()).width).toBe('auto');
    expect(btn().getAttribute('aria-label')).toBe('SOS, call for help');
  });

  it('topOffset puts a top fab that much further down: under the app bar, below the gap and the safe area', () => {
    const { h, btn, tick } = setup();
    h.position.set('top-center');
    h.offset.set(56);
    tick();
    expect(btn().style.getPropertyValue('--ui-fab-top-offset')).toBe('56px');
    const top = getComputedStyle(btn()).top;
    expect(top).toContain('safe-area-inset-top');
    expect(top).toContain('var(--ui-fab-top-offset, 0px)');
  });

  it('bottomOffset (0.47.1) lifts a bottom fab above a sheet\'s peek, smoothly; top placements ignore it', () => {
    const { h, btn, tick } = setup();
    h.position.set('bottom-end');
    h.bottomOffset.set(120);
    tick();
    expect(btn().style.getPropertyValue('--ui-fab-bottom-offset')).toBe('120px');
    const s = getComputedStyle(btn());
    expect(s.bottom).toContain('safe-area-inset-bottom');
    expect(s.bottom).toContain('var(--ui-fab-bottom-offset, 0px)');
    expect(s.transition).toContain('bottom var(--ui-motion-base)');
    h.position.set('top-end');
    tick();
    expect(getComputedStyle(btn()).top).not.toContain('bottom-offset');
  });
});
