import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { UiEmptyState } from './empty-state';
import { UiStarterCard } from './starter-card';

@Component({
  imports: [UiEmptyState, UiStarterCard],
  template: `
    <ui-empty-state id="old" heading="No results" description="Try another word">
      <span empty-icon>?</span>
      <button empty-actions type="button">Clear</button>
    </ui-empty-state>
    <ui-empty-state id="new" heading="Your feed is quiet" description="Events show up here.">
      <svg empty-art viewBox="0 0 320 200"><rect width="320" height="200" /></svg>
      <ui-starter-card empty-starters heading="Start an event" description="Pick a design" (pressed)="log.push('start')">
        <span starter-icon>+</span>
      </ui-starter-card>
      <ui-starter-card empty-starters heading="See an example" href="/demo" />
    </ui-empty-state>
  `,
})
class Host {
  log: string[] = [];
}

describe('ui-empty-state art and starters', () => {
  it('keeps the old slots working and hides the new ones when unused', () => {
    const f = TestBed.createComponent(Host);
    f.detectChanges();
    const old = (f.nativeElement as HTMLElement).querySelector('#old')!;
    expect(old.querySelector('.icon')!.textContent).toBe('?');
    expect(old.querySelector('.actions button')!.textContent).toBe('Clear');
    expect(old.querySelector('.art')!.childElementCount).toBe(0);
    expect(old.querySelector('.starters')!.childElementCount).toBe(0);
  });

  it('puts the art above the heading and the starters after the text, as buttons or links', () => {
    const f = TestBed.createComponent(Host);
    f.detectChanges();
    const el = (f.nativeElement as HTMLElement).querySelector('#new')!;
    const order = [...el.querySelector('.ui-empty')!.children].filter((c) => c.childElementCount || c.textContent!.trim()).map((c) => c.className);
    expect(order).toEqual(['art', 'title', 'desc', 'starters']);
    expect(el.querySelector('.art svg')).not.toBeNull();
    const cards = [...el.querySelectorAll('ui-starter-card')];
    expect(cards).toHaveLength(2);
    const button = cards[0].querySelector('button.card') as HTMLButtonElement;
    expect(button.textContent).toContain('Start an event');
    expect(button.querySelector('.icon')!.getAttribute('aria-hidden')).toBe('true');
    button.click();
    expect(f.componentInstance.log).toEqual(['start']);
    const link = cards[1].querySelector('a.card')!;
    expect(link.getAttribute('href')).toBe('/demo');
    expect(cards[1].querySelector('.desc')).toBeNull();
  });

  it('sizes the art to at most 320 x 200 and lays starters in a grid of at least 200px columns', () => {
    const css = ((UiEmptyState as unknown as { ɵcmp: { styles: string[] } }).ɵcmp.styles).join('\n');
    expect(css).toMatch(/\.art\[[^\]]+\]\s*\{[^}]*width:\s*min\(100%,\s*320px\)/);
    expect(css).toMatch(/max-height:\s*200px/);
    expect(css).toMatch(/grid-template-columns:\s*repeat\(auto-fit,\s*minmax\(min\(100%,\s*200px\),\s*1fr\)\)/);
    expect(css).toMatch(/max-width:\s*720px/);
  });
});
