import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { UiDrawer, type UiDrawerSide } from './drawer';

/*
 * 0.41.3, from the owner's phone test of Dhirumi: "filling out fields in the bottom drawer is weird
 * cause the keyboard hides the drawer and doesnt push it up". A bottom ui-drawer is position: fixed at
 * bottom 0; with Chrome's default interactive-widget=resizes-visual (and on iOS Safari) the keyboard
 * shrinks only the visual viewport, so it covered the drawer. The keyboard simulated as in
 * bottom-sheet-keyboard.spec: a 390x844 phone, the visual viewport shrinking and panning.
 */

class FakeViewport extends EventTarget {
  width = 390;
  height = 844;
  offsetTop = 0;
  offsetLeft = 0;
  scale = 1;
}

let vv: FakeViewport;
const original = { innerHeight: window.innerHeight };
const vvDescriptor = Object.getOwnPropertyDescriptor(window, 'visualViewport');
const setInner = (h: number) => Object.defineProperty(window, 'innerHeight', { configurable: true, writable: true, value: h });

beforeEach(() => {
  vv = new FakeViewport();
  Object.defineProperty(window, 'visualViewport', { configurable: true, value: vv });
  setInner(844);
});
afterEach(() => {
  setInner(original.innerHeight);
  if (vvDescriptor) Object.defineProperty(window, 'visualViewport', vvDescriptor);
  else delete (window as unknown as { visualViewport?: unknown }).visualViewport;
  document.querySelectorAll('.ui-layer').forEach((l) => l.remove());
});

@Component({
  imports: [UiDrawer],
  template: `<ui-drawer [open]="true" [side]="side()" title="Why cancel?"><input id="reason" /><button drawer-footer>Cancel the job</button></ui-drawer>`,
})
class Host {
  side = signal<UiDrawerSide>('bottom');
}

async function render(side: UiDrawerSide = 'bottom') {
  const fixture = TestBed.createComponent(Host);
  fixture.componentInstance.side.set(side);
  fixture.detectChanges();
  await fixture.whenStable();
  const all = document.querySelectorAll('.ui-layer .panel');
  const panel = all[all.length - 1] as HTMLElement;
  return { fixture, panel };
}

function keyboard(height: number, pan = 0) {
  vv.height = 844 - height;
  vv.offsetTop = pan;
  vv.dispatchEvent(new Event('resize'));
  vv.dispatchEvent(new Event('scroll'));
}

describe('UiDrawer bottom on the on-screen keyboard', () => {
  it('rests on the keyboard (resizes-visual), sized to the visible part, and goes back down when it closes', async () => {
    const { fixture, panel } = await render();
    expect(panel.style.getPropertyValue('--ui-drawer-keyboard')).toBe('');
    keyboard(320);
    fixture.detectChanges();
    expect(panel.style.getPropertyValue('--ui-drawer-keyboard')).toBe('320px');
    expect(panel.style.getPropertyValue('--ui-drawer-room')).toBe('524px');
    expect(panel.classList.contains('on-keyboard')).toBe(true);
    // Chrome pans the visual viewport to the field: the edge is the visible bottom, not the keyboard height.
    keyboard(320, 100);
    fixture.detectChanges();
    expect(panel.style.getPropertyValue('--ui-drawer-keyboard')).toBe('220px');
    keyboard(0);
    fixture.detectChanges();
    expect(panel.style.getPropertyValue('--ui-drawer-keyboard')).toBe('');
    expect(panel.classList.contains('on-keyboard')).toBe(false);
  });

  it('the rule uses those properties: bottom, height from the visible part, no safe-area pad on the keyboard', async () => {
    await render();
    const css = [...document.querySelectorAll('style')].map((s) => s.textContent ?? '').join('\n');
    const rule = css.match(/\.panel\[data-side="?bottom"?\]\[[^\]]+\]\s*\{[^}]*\}/)?.[0] ?? '';
    expect(rule).toContain('bottom: var(--ui-drawer-keyboard, 0px)');
    expect(rule).toContain('height: min(320px, calc(var(--ui-drawer-room, 100dvh) * 0.8))');
    expect(css).toMatch(/\.panel\[data-side="?bottom"?\]\.on-keyboard\[[^\]]+\]\s*\{\s*padding-bottom:\s*0/);
  });

  it('browser chrome settling (under 120px) is not a keyboard; side drawers ignore it', async () => {
    const { fixture, panel } = await render();
    keyboard(80);
    fixture.detectChanges();
    expect(panel.style.getPropertyValue('--ui-drawer-keyboard')).toBe('');
    const right = await render('right');
    keyboard(320);
    right.fixture.detectChanges();
    expect(right.panel.style.getPropertyValue('--ui-drawer-keyboard')).toBe('');
  });
});
