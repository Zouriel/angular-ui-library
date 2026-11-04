import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { UI_MESSENGER_BRANDS, type UiMessengerApp } from './messenger-brand';
import { UiMessengerSwitch } from './messenger-switch';

/*
 * Behaviour here (touch swipes dispatched as real TouchEvents); the look, centring and a CDP touch
 * swipe in Chromium are in projects/showcase/audit/messenger.mjs.
 */

@Component({
  imports: [UiMessengerSwitch],
  template: `<ui-messenger-switch [apps]="apps()" [(value)]="value" [label]="label()" sublabel="Next: Aisha" [disabled]="disabled()"
    (pressed)="pressed.push($event)" />`,
})
class Host {
  apps = signal<UiMessengerApp[]>(['whatsapp', 'viber', 'telegram']);
  value = signal<UiMessengerApp>('whatsapp');
  label = signal<string | undefined>(undefined);
  disabled = signal(false);
  pressed: UiMessengerApp[] = [];
}

/** jsdom has no Touch: an Event carrying touch lists of plain objects (what the handlers read). */
function touchEvent(type: string, target: EventTarget, x: number, y: number): Event {
  const t = { identifier: 1, target, clientX: x, clientY: y };
  const e = new Event(type, { bubbles: true, cancelable: true });
  Object.defineProperty(e, 'touches', { value: type === 'touchend' || type === 'touchcancel' ? [] : [t] });
  Object.defineProperty(e, 'changedTouches', { value: [t] });
  return e;
}

function make() {
  const f = TestBed.createComponent(Host);
  f.detectChanges();
  const el = f.nativeElement as HTMLElement;
  const pill = () => el.querySelector('.pill') as HTMLButtonElement;
  const navs = () => [...el.querySelectorAll('.nav')] as HTMLButtonElement[];
  const dots = () => [...el.querySelectorAll('.dot')] as HTMLButtonElement[];
  const touch = (type: string, x: number, y: number) => {
    pill().dispatchEvent(touchEvent(type, pill(), x, y));
  };
  /** A finger from (x0, y) to (x1, y + dy) in steps, then lifted. */
  const swipe = (x0: number, x1: number, dy = 0) => {
    touch('touchstart', x0, 100);
    for (let i = 1; i <= 5; i++) touch('touchmove', x0 + ((x1 - x0) * i) / 5, 100 + (dy * i) / 5);
    touch('touchend', x1, 100 + dy);
    // A real browser follows a touch with a click; the switch must not count it as a tap.
    pill().click();
    f.detectChanges();
  };
  const key = (target: HTMLElement, k: string) => {
    target.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true }));
    f.detectChanges();
  };
  return { f, h: f.componentInstance, el, pill, navs, dots, swipe, key };
}

describe('ui-messenger-switch', () => {
  it('shows the chosen app: its fill, logo, default words and sub-line, and names the pill with both', () => {
    const { pill, el } = make();
    expect(pill().dataset['app']).toBe('whatsapp');
    expect(pill().style.getPropertyValue('--m-top')).toBe(UI_MESSENGER_BRANDS.whatsapp.fill[0]);
    expect(pill().style.getPropertyValue('--m-ink')).toBe(UI_MESSENGER_BRANDS.whatsapp.ink);
    expect(pill().querySelector('.label')!.textContent!.trim()).toBe('Send next on WhatsApp');
    expect(pill().querySelector('.sub')!.textContent!.trim()).toBe('Next: Aisha');
    expect(pill().querySelector('ui-messenger-logo svg.logo')).not.toBeNull();
    expect(pill().getAttribute('aria-label')).toBe('Send next on WhatsApp, Next: Aisha');
    const hint = el.querySelector(`#${pill().getAttribute('aria-describedby')}`)!;
    expect(hint.textContent!.trim()).toBe('Swipe or use the arrow keys to change channel');
  });

  it('swipes: finger left = next, finger right = previous, wrapping round, and a swipe is not a tap', () => {
    const { h, swipe, pill } = make();
    swipe(200, 120);
    expect(h.value()).toBe('viber');
    expect(pill().querySelector('.label')!.textContent!.trim()).toBe('Send next on Viber');
    expect(pill().querySelector('.content')!.classList).toContain('from-next');
    swipe(200, 120);
    expect(h.value()).toBe('telegram');
    swipe(200, 120);
    expect(h.value()).toBe('whatsapp');
    swipe(120, 200);
    expect(h.value()).toBe('telegram');
    expect(pill().querySelector('.content')!.classList).toContain('from-prev');
    expect(h.pressed).toEqual([]);
  });

  it('ignores short and mostly vertical moves (they are taps or scrolls)', () => {
    const { h, swipe } = make();
    swipe(200, 170);
    expect(h.value()).toBe('whatsapp');
    swipe(200, 140, 90);
    expect(h.value()).toBe('whatsapp');
  });

  it('steps with the chevrons and the arrow keys, wrapping, and Home/End', () => {
    const { h, navs, key, pill, f } = make();
    navs()[1].click();
    f.detectChanges();
    expect(h.value()).toBe('viber');
    navs()[0].click();
    navs()[0].click();
    f.detectChanges();
    expect(h.value()).toBe('telegram');
    key(pill(), 'ArrowRight');
    expect(h.value()).toBe('whatsapp');
    key(pill(), 'ArrowLeft');
    expect(h.value()).toBe('telegram');
    key(pill(), 'Home');
    expect(h.value()).toBe('whatsapp');
    key(pill(), 'End');
    expect(h.value()).toBe('telegram');
    expect(navs().map((b) => b.getAttribute('aria-label'))).toEqual(['Previous channel', 'Next channel']);
  });

  it('shows the choice in the dots (a radio group) and picks one on tap', () => {
    const { h, dots, f, el } = make();
    expect(el.querySelector('.dots')!.getAttribute('role')).toBe('radiogroup');
    expect(dots().map((d) => d.getAttribute('aria-label'))).toEqual(['WhatsApp', 'Viber', 'Telegram']);
    expect(dots().map((d) => d.getAttribute('aria-checked'))).toEqual(['true', 'false', 'false']);
    dots()[2].click();
    f.detectChanges();
    expect(h.value()).toBe('telegram');
    expect(dots().map((d) => d.getAttribute('aria-checked'))).toEqual(['false', 'false', 'true']);
    expect(dots().map((d) => d.tabIndex)).toEqual([-1, -1, 0]);
  });

  it('a tap emits pressed with the current app; disabled turns off the pill but not the switching', () => {
    const { h, pill, f, navs } = make();
    pill().click();
    navs()[1].click();
    f.detectChanges();
    pill().click();
    expect(h.pressed).toEqual(['whatsapp', 'viber']);
    h.disabled.set(true);
    f.detectChanges();
    pill().click();
    expect(h.pressed).toEqual(['whatsapp', 'viber']);
    expect(pill().getAttribute('aria-disabled')).toBe('true');
    navs()[1].click();
    f.detectChanges();
    expect(h.value()).toBe('telegram');
  });

  it('uses the given words and only the given apps', () => {
    const { h, f, dots, navs, pill } = make();
    h.label.set('Send to Aisha');
    h.apps.set(['whatsapp']);
    f.detectChanges();
    expect(pill().querySelector('.label')!.textContent!.trim()).toBe('Send to Aisha');
    expect(dots().length).toBe(1);
    expect(navs().every((n) => n.disabled)).toBe(true);
  });

  it('is centred and at most 360px wide; the pill at least 52px tall, the chevrons 44px', () => {
    const css = ((UiMessengerSwitch as unknown as { ɵcmp: { styles: string[] } }).ɵcmp.styles ?? []).join('\n').replace(/\s+/g, ' ');
    expect(css).toMatch(/max-width: 360px; margin-inline: auto/);
    expect(css).toMatch(/min-height: 52px/);
    expect(css).toMatch(/width: var\(--ui-size-touch\); height: var\(--ui-size-touch\)/);
    expect(css).toMatch(/touch-action: pan-y/);
    expect(css).toMatch(/prefers-reduced-motion: reduce/);
  });
});
