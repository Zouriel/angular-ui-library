import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { UiText, type TextTag, type TextVariant, type UiTextAlign, type UiTextTone } from './text';

@Component({
  imports: [UiText],
  template: `<ui-text [variant]="variant()" [as]="tag()" [truncate]="truncate()" [align]="align()" [tone]="tone()">Hello</ui-text>`,
})
class Host {
  variant = signal<TextVariant>('body');
  tag = signal<TextTag | undefined>(undefined);
  truncate = signal(false);
  align = signal<UiTextAlign | null>(null);
  tone = signal<UiTextTone>('default');
}

const css = () => ((UiText as unknown as { ɵcmp: { styles: string[] } }).ɵcmp.styles ?? []).join('\n');

function render(variant: TextVariant, as?: TextTag, opts?: { truncate?: boolean; align?: UiTextAlign | null; tone?: UiTextTone }) {
  const fixture = TestBed.createComponent(Host);
  fixture.componentInstance.variant.set(variant);
  fixture.componentInstance.tag.set(as);
  if (opts?.truncate !== undefined) fixture.componentInstance.truncate.set(opts.truncate);
  if (opts?.align !== undefined) fixture.componentInstance.align.set(opts.align);
  if (opts?.tone !== undefined) fixture.componentInstance.tone.set(opts.tone);
  fixture.detectChanges();
  const hostEl = (fixture.nativeElement as HTMLElement).querySelector('ui-text') as HTMLElement;
  const el = hostEl.firstElementChild as HTMLElement;
  return { fixture, hostEl, el };
}

describe('UiText', () => {
  it('renders the semantic tag for each variant and projects the content', () => {
    const expected: [TextVariant, string][] = [
      ['h1', 'H1'], ['h2', 'H2'], ['h3', 'H3'], ['h4', 'H4'], ['h5', 'H5'], ['h6', 'H6'],
      ['body', 'P'], ['caption', 'SMALL'], ['label', 'SPAN'], ['code', 'CODE'], ['quote', 'BLOCKQUOTE'],
    ];
    for (const [variant, tag] of expected) {
      const { el } = render(variant);
      expect(el.tagName, variant).toBe(tag);
      expect(el.textContent?.trim(), variant).toBe('Hello');
      expect(el.classList.contains('v-' + variant), variant).toBe(true);
    }
  });

  it('as overrides the tag but keeps the variant style', () => {
    const { el } = render('h1', 'p');
    expect(el.tagName).toBe('P');
    expect(el.classList.contains('v-h1')).toBe(true);
    expect(el.textContent?.trim()).toBe('Hello');

    const heading = render('h4', 'h2').el;
    expect(heading.tagName).toBe('H2');
    expect(heading.classList.contains('v-h4')).toBe(true);

    expect(render('caption', 'div').el.tagName).toBe('DIV');
  });

  it('follows a change of as at runtime', () => {
    const { fixture } = render('h2');
    const tag = () => ((fixture.nativeElement as HTMLElement).querySelector('ui-text')!.firstElementChild as HTMLElement).tagName;
    expect(tag()).toBe('H2');
    fixture.componentInstance.tag.set('div');
    fixture.detectChanges();
    expect(tag()).toBe('DIV');
    fixture.componentInstance.tag.set(undefined);
    fixture.detectChanges();
    expect(tag()).toBe('H2');
  });

  it('applies truncate class and ellipsis styling when truncate is true', () => {
    const plain = render('label');
    expect(plain.el.classList.contains('truncate')).toBe(false);
    expect(plain.hostEl.classList.contains('is-truncated')).toBe(false);

    const clipped = render('label', undefined, { truncate: true });
    expect(clipped.el.classList.contains('truncate')).toBe(true);
    expect(clipped.hostEl.classList.contains('is-truncated')).toBe(true);
    expect(css()).toMatch(/\.t\.truncate[^{]*\{[^}]*text-overflow:\s*ellipsis/);
    expect(css()).toMatch(/\.t\.truncate[^{]*\{[^}]*white-space:\s*nowrap/);
  });

  it('applies logical text-align when align is set and omits it when null', () => {
    expect(render('body').hostEl.style.textAlign).toBe('');
    expect(render('body', undefined, { align: 'center' }).hostEl.style.textAlign).toBe('center');
    expect(render('caption', undefined, { align: 'end' }).hostEl.style.textAlign).toBe('end');
  });

  it('sets data-tone for muted and on-media tones and styles them from tokens', () => {
    expect(render('body').el.getAttribute('data-tone')).toBeNull();
    expect(render('body', undefined, { tone: 'muted' }).el.getAttribute('data-tone')).toBe('muted');
    expect(render('h2', undefined, { tone: 'on-media' }).el.getAttribute('data-tone')).toBe('on-media');
    expect(css()).toMatch(/\.t\[data-tone=["']?muted["']?\][^{]*\{[^}]*var\(--ui-color-text-muted\)/);
    expect(css()).toMatch(/\.t\[data-tone=["']?on-media["']?\][^{]*\{[^}]*var\(--ui-media-on-scrim\)/);
  });

  it('supports display-xl, display, title, subtitle and stat variants with their tokens', () => {
    const expected: [TextVariant, string, string][] = [
      ['display-xl', 'H1', '--ui-font-size-display-xl'],
      ['display', 'H1', '--ui-font-size-display-lg'],
      ['title', 'H2', '--ui-font-size-title'],
      ['subtitle', 'P', '--ui-font-size-subtitle'],
      ['stat', 'P', '--ui-font-size-stat'],
    ];
    for (const [variant, tag, token] of expected) {
      const { el } = render(variant);
      expect(el.tagName, variant).toBe(tag);
      expect(el.classList.contains('v-' + variant), variant).toBe(true);
      expect(css()).toContain(`var(${token})`);
    }
    expect(css()).toContain('var(--ui-font-weight-heading');
    expect(css()).toContain('var(--ui-line-height-heading');
    expect(css()).toContain('var(--ui-line-height-body');
  });
});
