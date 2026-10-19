import { Overlay } from '@angular/cdk/overlay';
import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { UiTooltip } from './tooltip';

/** Stands in for ui-button: a component host that only wraps the control it draws. */
@Component({ selector: 'test-wrapped', template: `<button type="button" class="drawn">Save</button>` })
class Wrapped {}

@Component({
  imports: [UiTooltip, Wrapped],
  template: `
    <test-wrapped id="wrapped" uiTooltip="Saved to cloud" />
    <button id="plain" type="button" uiTooltip="Plain">Plain</button>
  `,
})
class Host {}

describe('uiTooltip anchoring', () => {
  afterEach(() => document.querySelectorAll('.cdk-overlay-container').forEach((c) => (c.innerHTML = '')));

  function setup() {
    const f = TestBed.createComponent(Host);
    document.body.appendChild(f.nativeElement);
    f.detectChanges();
    const position = TestBed.inject(Overlay).position();
    const spy = vi.spyOn(Object.getPrototypeOf(position), 'flexibleConnectedTo');
    return { f, spy };
  }

  it('points at the control a wrapper component draws, not the (possibly stretched) host', () => {
    const { f, spy } = setup();
    const host = (f.nativeElement as HTMLElement).querySelector<HTMLElement>('#wrapped')!;
    host.dispatchEvent(new MouseEvent('mouseenter'));
    f.detectChanges();
    expect(spy).toHaveBeenCalledWith(host.querySelector('button.drawn'));
    expect(document.querySelector('.ui-tooltip')?.textContent).toBe('Saved to cloud');
    spy.mockRestore();
  });

  it('points at a plain element itself', () => {
    const { f, spy } = setup();
    const plain = (f.nativeElement as HTMLElement).querySelector<HTMLElement>('#plain')!;
    plain.dispatchEvent(new MouseEvent('mouseenter'));
    f.detectChanges();
    expect(spy).toHaveBeenCalledWith(plain);
    spy.mockRestore();
  });
});
