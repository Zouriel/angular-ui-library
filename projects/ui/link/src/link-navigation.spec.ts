import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it } from 'vitest';
import { provideUiLinkNavigator, provideUiStrings, uiIsInternalHref, uiStringsDv, type UiLinkNavigator } from '@zouriel/ui';
import { UiButton, UiIconButton } from '@zouriel/ui/button';
import { UiBreadcrumbs } from '@zouriel/ui/navigation';
import { UiLink } from './link';
import { UiSkipLink } from './skip-link';

/** 0.87.0: library links through the app's navigator, the current page, link buttons and the skip link. */

const page = signal('/media');
const navigated: string[] = [];
const navigator: UiLinkNavigator = { navigate: (href) => navigated.push(href), isCurrent: (href) => href === page() };

@Component({
  imports: [UiLink, UiButton, UiIconButton, UiBreadcrumbs],
  template: `
    <ui-link id="media" href="/media">Media</ui-link>
    <ui-link id="hr" href="/hr">HR</ui-link>
    <ui-link id="own" href="/hr" [current]="true">Own</ui-link>
    <ui-link id="ext" href="https://example.com/" [external]="true">Elsewhere</ui-link>
    <ui-button id="go" href="/media/new" variant="ghost">New request</ui-button>
    <ui-button id="nav" href="/media" variant="ghost">Media</ui-button>
    <ui-button id="off" href="/media/new" [disabled]="true">Off</ui-button>
    <ui-button id="blank" href="/media/new" target="_blank">New tab</ui-button>
    <ui-button id="plain">Plain</ui-button>
    <ui-icon-button id="icon" label="Settings" href="/settings">S</ui-icon-button>
    <ui-breadcrumbs [items]="[{ label: 'Media', href: '/media' }, { label: 'MR-1' }]" />
  `,
})
class Host {}

/** A component's own CSS, as compiled: scoping attributes dropped, whitespace collapsed, attribute quotes gone. */
const cssOf = (c: unknown) => ((c as { ɵcmp: { styles: string[] } }).ɵcmp.styles ?? []).join('\n').replace(/\[_ngcontent-%COMP%\]/g, '').replace(/\s+/g, ' ');

function click(el: Element, init: MouseEventInit = {}): MouseEvent {
  const e = new MouseEvent('click', { bubbles: true, cancelable: true, button: 0, ...init });
  el.dispatchEvent(e);
  return e;
}

function render(withNavigator = true) {
  TestBed.configureTestingModule({ providers: withNavigator ? [provideUiLinkNavigator(() => navigator)] : [] });
  const fixture = TestBed.createComponent(Host);
  fixture.detectChanges();
  const el = fixture.nativeElement as HTMLElement;
  return { fixture, el, a: (id: string) => el.querySelector(`#${id} a`) as HTMLAnchorElement };
}

afterEach(() => {
  navigated.length = 0;
  page.set('/media');
});

describe('uiIsInternalHref', () => {
  it('app paths and same-origin URLs stay in the app; fragments, other schemes and origins do not', () => {
    const origin = 'https://addu.example';
    expect(uiIsInternalHref('/media/12', origin)).toBe(true);
    expect(uiIsInternalHref('media/12', origin)).toBe(true);
    expect(uiIsInternalHref('https://addu.example/admin/x', origin)).toBe(true);
    expect(uiIsInternalHref('https://other.example/x', origin)).toBe(false);
    expect(uiIsInternalHref('//other.example/x', origin)).toBe(false);
    expect(uiIsInternalHref('mailto:a@b.mv', origin)).toBe(false);
    expect(uiIsInternalHref('#main', origin)).toBe(false);
    expect(uiIsInternalHref('', origin)).toBe(false);
  });
});

describe('ui-link through the navigator', () => {
  it('hands a plain click on an internal href to the navigator and stops the page load', () => {
    const { a } = render();
    const e = click(a('hr'));
    expect(navigated).toEqual(['/hr']);
    expect(e.defaultPrevented).toBe(true);
  });

  it('leaves modified clicks, external links and other buttons to the browser', () => {
    const { a } = render();
    for (const init of [{ ctrlKey: true }, { metaKey: true }, { shiftKey: true }, { altKey: true }, { button: 1 }]) {
      expect(click(a('hr'), init).defaultPrevented).toBe(false);
    }
    expect(click(a('ext')).defaultPrevented).toBe(false);
    expect(navigated).toEqual([]);
  });

  it('without a navigator a link is a plain link', () => {
    const { a } = render(false);
    expect(click(a('hr')).defaultPrevented).toBe(false);
    expect(a('hr').getAttribute('aria-current')).toBeNull();
  });

  it('marks the open page (aria-current) from the navigator, live, and from its own current input', () => {
    const { fixture, a } = render();
    expect(a('media').getAttribute('aria-current')).toBe('page');
    expect(a('hr').getAttribute('aria-current')).toBeNull();
    expect(a('own').getAttribute('aria-current')).toBe('page');
    page.set('/hr');
    fixture.detectChanges();
    expect(a('media').getAttribute('aria-current')).toBeNull();
    expect(a('hr').getAttribute('aria-current')).toBe('page');
  });

  it('has a current look that is more than colour, and holds its hidden text inside itself', () => {
    const styles = cssOf(UiLink);
    expect(styles).toMatch(/\.ui-link\[aria-current=page\] \{[^}]*font-weight: 600[^}]*text-decoration-color: currentColor/);
    // The visually hidden "(opens in a new tab)" is absolute: the link must be its containing block.
    expect(styles).toMatch(/\.ui-link \{[^}]*position: relative/);
  });
});

describe('ui-button / ui-icon-button with href', () => {
  it('renders a link with the button look, followed through the navigator', () => {
    const { el, a } = render();
    const link = a('go');
    expect(link.classList.contains('ui-btn')).toBe(true);
    expect(link.getAttribute('href')).toBe('/media/new');
    expect(el.querySelector('#go button')).toBeNull();
    expect(click(link).defaultPrevented).toBe(true);
    expect(navigated).toEqual(['/media/new']);
    // Without href it is still a real button.
    expect(el.querySelector('#plain button')).not.toBeNull();
    expect(el.querySelector('#plain a')).toBeNull();
  });

  it('a disabled link button has no href, says it is off and goes nowhere', () => {
    const { a } = render();
    const off = a('off');
    expect(off.hasAttribute('href')).toBe(false);
    expect(off.getAttribute('aria-disabled')).toBe('true');
    expect(click(off).defaultPrevented).toBe(true);
    expect(navigated).toEqual([]);
  });

  it('target _blank opens in the browser with a safe rel', () => {
    const { a } = render();
    const blank = a('blank');
    expect(blank.getAttribute('rel')).toBe('noopener noreferrer');
    expect(click(blank).defaultPrevented).toBe(false);
    expect(navigated).toEqual([]);
  });

  it('marks the current page and an icon button can be a link too', () => {
    const { a } = render();
    expect(a('nav').getAttribute('aria-current')).toBe('page');
    expect(a('go').getAttribute('aria-current')).toBeNull();
    const icon = a('icon');
    expect(icon.getAttribute('aria-label')).toBe('Settings');
    click(icon);
    expect(navigated).toEqual(['/settings']);
  });

  it('a breadcrumb with an href goes through the navigator', () => {
    const { el } = render();
    const crumb = el.querySelector('ui-breadcrumbs a') as HTMLAnchorElement;
    expect(click(crumb).defaultPrevented).toBe(true);
    expect(navigated).toEqual(['/media']);
  });
});

@Component({
  imports: [UiSkipLink],
  template: `<ui-skip-link /><ui-skip-link id="other" target="content" label="Skip the menu" /><nav><a href="#">x</a></nav><main id="main">Main</main><div id="content">C</div>`,
})
class SkipHost {}

describe('ui-skip-link', () => {
  it('says "Skip to content", points at #main and moves focus there without a page load', () => {
    const fixture = TestBed.createComponent(SkipHost);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    document.body.appendChild(el);
    const link = el.querySelector('ui-skip-link a') as HTMLAnchorElement;
    expect(link.textContent?.trim()).toBe('Skip to content');
    expect(link.getAttribute('href')).toBe('#main');
    const main = el.querySelector('#main') as HTMLElement;
    const e = click(link);
    expect(e.defaultPrevented).toBe(true);
    expect(main.getAttribute('tabindex')).toBe('-1');
    expect(document.activeElement).toBe(main);
    const other = el.querySelector('#other a') as HTMLAnchorElement;
    expect(other.textContent?.trim()).toBe('Skip the menu');
    click(other);
    expect(document.activeElement).toBe(el.querySelector('#content'));
    el.remove();
  });

  it('is hidden until it has focus (still in the tab order), and speaks Dhivehi with the Dhivehi strings', () => {
    const styles = cssOf(UiSkipLink);
    expect(styles).toMatch(/\.ui-skip-link:not\(:focus\) \{[^}]*clip-path: inset\(50%\)/);
    expect(styles).not.toMatch(/display:\s*none|visibility:\s*hidden/);
    TestBed.configureTestingModule({ providers: [provideUiStrings(uiStringsDv)] });
    const fixture = TestBed.createComponent(SkipHost);
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).querySelector('ui-skip-link a')?.textContent?.trim()).toBe(uiStringsDv.skipToContent);
  });
});
