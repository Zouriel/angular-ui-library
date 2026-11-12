import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { provideUiConfig } from '@zouriel/ui';
import { UiAvatarTag, uiAvatarTagLetter } from './avatar-tag';

function make(inputs: Record<string, unknown> = {}) {
  const fixture = TestBed.createComponent(UiAvatarTag);
  for (const [k, v] of Object.entries(inputs)) fixture.componentRef.setInput(k, v);
  fixture.detectChanges();
  const el = fixture.nativeElement as HTMLElement;
  return { fixture, el, tag: el.querySelector('.tag') as HTMLElement };
}

/** The component's own stylesheet; jsdom doesn't lay out, so layout rules are checked as written. */
const css = ((UiAvatarTag as unknown as { ɵcmp: { styles: string[] } }).ɵcmp.styles ?? []).join('\n').replace(/\s+/g, ' ');
/** The declarations of the rule whose selector (after Angular's scoping is removed) is exactly `sel`. */
function rule(sel: string): string {
  const plain = css.replace(/\[_nghost-[^\]]*\]/g, ':host').replace(/\[_ngcontent-[^\]]*\]/g, '');
  const want = sel.replace(/"/g, '');
  const m = [...plain.matchAll(/([^{}]+)\{([^}]*)\}/g)].find((r) => r[1].trim() === want);
  return m?.[2] ?? '';
}

describe('uiAvatarTagLetter', () => {
  it('takes the first letter, upper case, and ? for no name', () => {
    expect(uiAvatarTagLetter('coco Palm')).toBe('C');
    expect(uiAvatarTagLetter('  étoile')).toBe('É');
    expect(uiAvatarTagLetter('')).toBe('?');
    expect(uiAvatarTagLetter(null)).toBe('?');
  });
});

describe('UiAvatarTag', () => {
  it('shows the picture, decorative, beside the name', () => {
    const { el } = make({ name: 'Coco Palm', src: '/coco.jpg' });
    const img = el.querySelector('img')!;
    expect(img.getAttribute('src')).toBe('/coco.jpg');
    expect(img.getAttribute('alt')).toBe('');
    expect(el.querySelector('.letter')).toBeNull();
    expect(el.querySelector('.name')!.textContent!.trim()).toBe('Coco Palm');
  });

  it('shows the first letter without a picture', () => {
    const { el } = make({ name: 'Bandos Hall' });
    expect(el.querySelector('img')).toBeNull();
    expect(el.querySelector('.letter')!.textContent!.trim()).toBe('B');
  });

  it('falls back to the letter when the picture fails, and tries again for a new src', () => {
    const { fixture, el } = make({ name: 'Coco Palm', src: '/missing.jpg' });
    el.querySelector('img')!.dispatchEvent(new Event('error'));
    fixture.detectChanges();
    expect(el.querySelector('img')).toBeNull();
    expect(el.querySelector('.letter')!.textContent!.trim()).toBe('C');
    fixture.componentRef.setInput('src', '/other.jpg');
    fixture.detectChanges();
    expect(el.querySelector('img')!.getAttribute('src')).toBe('/other.jpg');
  });

  it('is read out as the prefix and the name, with the inside hidden', () => {
    const { fixture, el, tag } = make({ name: 'Coco Palm' });
    expect(el.getAttribute('role')).toBe('img');
    expect(el.getAttribute('aria-label')).toBe('Coco Palm');
    expect(tag.getAttribute('aria-hidden')).toBe('true');
    fixture.componentRef.setInput('prefix', 'At');
    fixture.detectChanges();
    expect(el.getAttribute('aria-label')).toBe('At Coco Palm');
  });

  it('defaults to the overlay variant at sm, and takes plain and xs', () => {
    const { fixture, tag } = make({ name: 'Coco Palm' });
    expect([tag.dataset['variant'], tag.dataset['size']]).toEqual(['overlay', 'sm']);
    fixture.componentRef.setInput('variant', 'plain');
    fixture.componentRef.setInput('size', 'xs');
    fixture.detectChanges();
    expect([tag.dataset['variant'], tag.dataset['size']]).toEqual(['plain', 'xs']);
  });

  it('follows the glass config, and its own glass input over it', () => {
    expect(make({ name: 'A' }).tag.classList.contains('glass')).toBe(false);
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [provideUiConfig({ glass: true })] });
    const { fixture, tag } = make({ name: 'A' });
    expect(tag.classList.contains('glass')).toBe(true);
    fixture.componentRef.setInput('glass', false);
    fixture.detectChanges();
    expect(tag.classList.contains('glass')).toBe(false);
  });

  it('paints the overlay as the media scrim with on-scrim text, blurred only with glass', () => {
    const overlay = rule('.tag[data-variant="overlay"]');
    expect(overlay).toContain('background: color-mix(in srgb, var(--ui-media-scrim) 62%, transparent)');
    expect(overlay).toContain('color: var(--ui-media-on-scrim)');
    expect(overlay).not.toContain('backdrop-filter');
    expect(rule('.tag[data-variant="overlay"].glass')).toContain('backdrop-filter: blur(var(--ui-glass-blur))');
    expect(rule('.tag[data-variant="plain"]')).toContain('background: var(--ui-color-surface-raised)');
  });

  it('ellipsises a long name inside its container instead of growing', () => {
    expect(rule(':host')).toContain('max-width: 100%');
    expect(rule(':host')).toContain('min-width: 0');
    expect(rule('.tag')).toContain('max-width: 100%');
    const name = rule('.name');
    for (const d of ['min-width: 0', 'overflow: hidden', 'text-overflow: ellipsis', 'white-space: nowrap']) expect(name).toContain(d);
    expect(rule('.pic')).toContain('flex: none');
  });
});
