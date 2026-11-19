import { Component, signal } from '@angular/core';
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

@Component({
  imports: [UiTabs, UiTab],
  template: `
    <ui-tabs label="Portfolio">
      <ui-tab label="Page">page</ui-tab>
      <ui-tab label="Enquiries" [badge]="unread" [badgeLabel]="unread ? unread + ' new' : undefined">enquiries</ui-tab>
      <ui-tab label="Inbox" [icon]="icon" [iconOnly]="true" [badge]="2">inbox</ui-tab>
    </ui-tabs>
  `,
})
class BadgeHost {
  icon = ICON;
  unread: number | null = 3;
}

describe('UiTab badge (0.79.0)', () => {
  function render(unread: number | null) {
    const fixture = TestBed.createComponent(BadgeHost);
    fixture.componentInstance.unread = unread;
    fixture.detectChanges();
    return [...(fixture.nativeElement as HTMLElement).querySelectorAll<HTMLButtonElement>('[role="tab"]')];
  }

  it('shows the count after the label; screen readers hear badgeLabel instead of the bare number', () => {
    const [page, enquiries] = render(3);
    expect(page.querySelector('.tab__badge')).toBeNull();
    const badge = enquiries.querySelector('.tab__badge')!;
    expect(badge.textContent?.trim()).toBe('3');
    expect(badge.getAttribute('aria-hidden')).toBe('true');
    expect(enquiries.querySelector('.tab__sr')?.textContent?.trim()).toBe('3 new');
    expect(enquiries.textContent).toContain('Enquiries');
  });

  it('shows nothing for 0 or null', () => {
    expect(render(0)[1].querySelector('.tab__badge')).toBeNull();
    expect(render(null)[1].querySelector('.tab__badge')).toBeNull();
  });

  it('an icon-only tab puts the count into its name', () => {
    const inbox = render(3)[2];
    expect(inbox.querySelector('.tab__badge')?.textContent?.trim()).toBe('2');
    expect(inbox.getAttribute('aria-label')).toBe('Inbox, 2');
  });
});

@Component({
  imports: [UiTabs, UiTab],
  template: `
    <ui-tabs [align]="align()" label="Albums">
      <ui-tab label="Ceremony" />
      <ui-tab label="Reception" />
      <ui-tab label="Portraits" />
    </ui-tabs>
  `,
})
class StripOnlyHost {
  readonly align = signal<'start' | 'center'>('center');
}

describe('UiTabs align & strip-only mode', () => {
  const css = () => ((UiTabs as unknown as { ɵcmp: { styles: string[] } }).ɵcmp.styles ?? []).join('\n');

  it('adds .center class when align="center" with logical auto-margin centering rules', () => {
    const fixture = TestBed.createComponent(StripOnlyHost);
    fixture.detectChanges();
    const tablist = (fixture.nativeElement as HTMLElement).querySelector('.tablist') as HTMLElement;
    expect(tablist.classList.contains('center')).toBe(true);
    expect(css()).toMatch(/\.tablist\.center[^{]*\.tab[^{]*:first-child[^{]*\{[^}]*margin-inline-start:\s*auto/);
    expect(css()).toMatch(/\.tablist\.center[^{]*\.tab[^{]*:last-child[^{]*\{[^}]*margin-inline-end:\s*auto/);

    fixture.componentInstance.align.set('start');
    fixture.detectChanges();
    expect(tablist.classList.contains('center')).toBe(false);
  });

  it('collapses panel margin and hides empty tabpanels in strip-only mode, while keeping panels when present', () => {
    const stripFixture = TestBed.createComponent(StripOnlyHost);
    stripFixture.detectChanges();
    stripFixture.detectChanges();
    const stripEl = stripFixture.nativeElement as HTMLElement;
    const stripTablist = stripEl.querySelector('.tablist') as HTMLElement;
    expect(stripTablist.classList.contains('strip-only')).toBe(true);
    expect(css()).toMatch(/\.tablist\.strip-only[^{]*\{[^}]*margin-bottom:\s*0/);
    const stripPanels = [...stripEl.querySelectorAll<HTMLElement>('[role="tabpanel"]')];
    expect(stripPanels.every((p) => p.hidden)).toBe(true);
    const stripTab = stripEl.querySelector<HTMLButtonElement>('[role="tab"]')!;
    expect(stripTab.getAttribute('aria-controls')).toBeNull();

    const fullFixture = TestBed.createComponent(Host);
    fullFixture.detectChanges();
    const fullEl = fullFixture.nativeElement as HTMLElement;
    expect(fullEl.querySelector('.tablist')!.classList.contains('strip-only')).toBe(false);
    expect(fullEl.querySelector<HTMLButtonElement>('[role="tab"]')!.getAttribute('aria-controls')).not.toBeNull();
  });
});
