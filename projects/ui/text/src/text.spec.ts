import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { UiText, type TextTag, type TextVariant } from './text';

@Component({
  imports: [UiText],
  template: `<ui-text [variant]="variant()" [as]="tag()">Hello</ui-text>`,
})
class Host {
  variant = signal<TextVariant>('body');
  tag = signal<TextTag | undefined>(undefined);
}

function render(variant: TextVariant, as?: TextTag) {
  const fixture = TestBed.createComponent(Host);
  fixture.componentInstance.variant.set(variant);
  fixture.componentInstance.tag.set(as);
  fixture.detectChanges();
  const el = (fixture.nativeElement as HTMLElement).querySelector('ui-text')!.firstElementChild as HTMLElement;
  return { fixture, el };
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
});
