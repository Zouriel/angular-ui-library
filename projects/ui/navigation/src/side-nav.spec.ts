import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { UiSideNav, UiSideNavGroup, UiSideNavItem } from './side-nav';

@Component({
  imports: [UiSideNav],
  template: `<ui-side-nav [groups]="groups" [(active)]="active" (navigate)="chosen.push($event)" />`,
})
class Host {
  active = 'one';
  chosen: UiSideNavItem[] = [];
  groups: UiSideNavGroup[] = [
    {
      label: 'Links',
      items: [
        { label: 'One', value: 'one', href: '/guide/one' },
        { label: 'Two', value: 'two', href: '/guide/two' },
        { label: 'Off', value: 'off', href: '/guide/off', disabled: true },
      ],
    },
    { label: 'Buttons', items: [{ label: 'Plain', value: 'plain' }] },
  ];
}

describe('UiSideNav links', () => {
  function setup() {
    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    return { fixture, host: fixture.componentInstance, el };
  }

  it('an item with an href renders as a real link a crawler can follow', () => {
    const { el } = setup();
    const links = [...el.querySelectorAll<HTMLAnchorElement>('a.item')];
    expect(links.map((a) => a.getAttribute('href'))).toEqual(['/guide/one', '/guide/two', null]);
    expect(links[0].getAttribute('aria-current')).toBe('page');
    expect(links[1].getAttribute('aria-current')).toBeNull();
  });

  it('a plain click emits navigate, updates active and prevents the browser navigation', () => {
    const { fixture, host, el } = setup();
    const two = el.querySelectorAll<HTMLAnchorElement>('a.item')[1];
    const click = new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 });
    two.dispatchEvent(click);
    fixture.detectChanges();
    expect(click.defaultPrevented).toBe(true);
    expect(host.chosen.map((i) => i.value)).toEqual(['two']);
    expect(host.active).toBe('two');
    expect(two.getAttribute('aria-current')).toBe('page');
  });

  it('a modified click is left to the browser (open in a new tab)', () => {
    const { host, el } = setup();
    const two = el.querySelectorAll<HTMLAnchorElement>('a.item')[1];
    // Read whether the component prevented it, then stop the test browser actually navigating.
    let preventedByNav: boolean | undefined;
    el.addEventListener('click', (e) => {
      preventedByNav = e.defaultPrevented;
      e.preventDefault();
    });
    const click = new MouseEvent('click', { bubbles: true, cancelable: true, button: 0, ctrlKey: true });
    two.dispatchEvent(click);
    expect(preventedByNav).toBe(false);
    expect(host.chosen).toEqual([]);
  });

  it('a disabled link has no href and emits nothing', () => {
    const { host, el } = setup();
    const off = el.querySelectorAll<HTMLAnchorElement>('a.item')[2];
    expect(off.getAttribute('aria-disabled')).toBe('true');
    off.click();
    expect(host.chosen).toEqual([]);
  });

  it('an item without an href is still a button', () => {
    const { host, el } = setup();
    const plain = el.querySelector<HTMLButtonElement>('button.item')!;
    expect(plain.type).toBe('button');
    expect(plain.textContent?.trim()).toBe('Plain');
    plain.click();
    expect(host.chosen.map((i) => i.value)).toEqual(['plain']);
  });
});
