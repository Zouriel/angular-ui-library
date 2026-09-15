import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import type { IconSvgObject } from '@hugeicons/angular';
import { UiTab, UiTabs } from './tabs';

const ICON: IconSvgObject = [['path', { d: 'M0 0h24v24H0z', key: 'k' }]] as unknown as IconSvgObject;

@Component({
  imports: [UiTabs, UiTab],
  template: `
    <ui-tabs label="Events">
      <ui-tab label="Home" [icon]="icon" [iconOnly]="true">home panel</ui-tab>
      <ui-tab label="Received" [icon]="icon">received panel</ui-tab>
      <ui-tab label="Hosting">hosting panel</ui-tab>
    </ui-tabs>
  `,
})
class Host {
  icon = ICON;
}

describe('UiTabs icons', () => {
  function tabs() {
    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    return [...(fixture.nativeElement as HTMLElement).querySelectorAll<HTMLButtonElement>('[role="tab"]')];
  }

  it('an icon-only tab draws the icon, hides the text and keeps the label as its name and tooltip', () => {
    const [home] = tabs();
    expect(home.querySelector('hugeicons-icon')).not.toBeNull();
    expect(home.querySelector('.tab__label')).toBeNull();
    expect(home.getAttribute('aria-label')).toBe('Home');
    expect(home.getAttribute('title')).toBe('Home');
  });

  it('a tab with an icon and no iconOnly shows both, named by its text', () => {
    const [, received] = tabs();
    expect(received.querySelector('hugeicons-icon')).not.toBeNull();
    expect(received.querySelector('.tab__label')?.textContent?.trim()).toBe('Received');
    expect(received.getAttribute('aria-label')).toBeNull();
  });

  it('a plain tab is unchanged', () => {
    const [, , hosting] = tabs();
    expect(hosting.querySelector('hugeicons-icon')).toBeNull();
    expect(hosting.textContent?.trim()).toBe('Hosting');
  });
});
