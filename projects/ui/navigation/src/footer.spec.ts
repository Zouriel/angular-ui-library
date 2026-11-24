import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { UiFooter, type UiFooterColumn, type UiFooterContact } from './footer';

@Component({
  imports: [UiFooter],
  template: `
    <ui-footer
      [columns]="columns()"
      [contacts]="contacts()"
      contactsTitle="In an emergency"
      legal="© 2026 Addu City Council"
      label="Site footer"
      [size]="size()">
      <div footer-brand id="brand">Addu City</div>
      <div footer-aside id="aside">Subscribe</div>
      <div footer-legal id="legal-links">Privacy</div>
    </ui-footer>
  `,
})
class FooterHost {
  columns = signal<UiFooterColumn[]>([
    {
      title: 'Services',
      links: [
        { label: 'Permits', href: '/permits' },
        { label: 'Waste', href: '/waste' },
      ],
    },
    {
      title: 'Council',
      links: [{ label: 'About', href: 'https://example.com', external: true }],
    },
  ]);
  contacts = signal<UiFooterContact[]>([
    { label: 'Police', value: '119' },
    { label: 'Hotline', value: '+960 688 5000' },
  ]);
  size = signal<'sm' | 'md' | 'lg' | 'xl' | 'full'>('xl');
}

describe('UiFooter', () => {
  const originalMatchMedia = window.matchMedia;
  let narrow = false;

  beforeEach(() => {
    narrow = false;
    window.matchMedia = ((q: string) => ({
      matches: narrow,
      media: q,
      addEventListener() {},
      removeEventListener() {},
    })) as unknown as typeof window.matchMedia;
  });

  afterEach(() => {
    window.matchMedia = originalMatchMedia;
  });

  it('renders a contentinfo landmark with named nav columns, slots, and container size', () => {
    const f = TestBed.createComponent(FooterHost);
    f.detectChanges();
    const el = f.nativeElement as HTMLElement;

    const footer = el.querySelector('footer');
    expect(footer).not.toBeNull();
    expect(footer!.getAttribute('aria-label')).toBe('Site footer');

    expect(el.querySelector('#brand')?.textContent).toContain('Addu City');
    expect(el.querySelector('#aside')?.textContent).toContain('Subscribe');
    expect(el.querySelector('#legal-links')?.textContent).toContain('Privacy');
    expect(el.querySelector('.legal-text')?.textContent).toContain('© 2026 Addu City Council');

    const navs = Array.from(el.querySelectorAll('footer nav'));
    expect(navs.length).toBe(2);
    expect(navs[0].getAttribute('aria-label')).toBe('Services');
    expect(navs[1].getAttribute('aria-label')).toBe('Council');
    expect(navs[0].querySelectorAll('ul[role="list"] li a').length).toBe(2);

    const ext = navs[1].querySelector('a')!;
    expect(ext.getAttribute('target')).toBe('_blank');
    expect(ext.getAttribute('rel')).toBe('noopener noreferrer');

    const inner = el.querySelector('.inner')!;
    expect(inner.getAttribute('data-size')).toBe('xl');
    f.componentInstance.size.set('md');
    f.detectChanges();
    expect(inner.getAttribute('data-size')).toBe('md');
  });

  it('renders contacts as LTR tel: links', () => {
    const f = TestBed.createComponent(FooterHost);
    f.detectChanges();
    const el = f.nativeElement as HTMLElement;
    const links = Array.from(el.querySelectorAll('.contact-link')) as HTMLAnchorElement[];
    expect(links.length).toBe(2);
    expect(links[0].getAttribute('href')).toBe('tel:119');
    expect(links[0].getAttribute('dir')).toBe('ltr');
    expect(links[1].getAttribute('href')).toBe('tel:+9606885000');
    expect(links[1].getAttribute('dir')).toBe('ltr');
  });

  it('collapses columns into an accordion closed by default under 600px', () => {
    narrow = true;
    const f = TestBed.createComponent(FooterHost);
    f.detectChanges();
    const el = f.nativeElement as HTMLElement;

    const toggles = Array.from(el.querySelectorAll('button.col-toggle')) as HTMLButtonElement[];
    expect(toggles.length).toBe(2);
    expect(toggles[0].getAttribute('aria-expanded')).toBe('false');
    expect(toggles[1].getAttribute('aria-expanded')).toBe('false');

    const lists = Array.from(el.querySelectorAll('.columns ul')) as HTMLElement[];
    expect(lists[0].hasAttribute('hidden')).toBe(true);
    expect(lists[1].hasAttribute('hidden')).toBe(true);

    toggles[0].click();
    f.detectChanges();
    expect(toggles[0].getAttribute('aria-expanded')).toBe('true');
    expect(lists[0].hasAttribute('hidden')).toBe(false);
    expect(lists[1].hasAttribute('hidden')).toBe(true);
  });
});
