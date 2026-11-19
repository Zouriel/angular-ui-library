import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { UiListItem } from './list';

@Component({
  imports: [UiListItem],
  template: `
    <ui-list-item [title]="title()" [hint]="hint()">
      @if (projected()) { <span class="custom-body">{{ projected() }}</span> }
      @if (slotHint()) { <span item-hint>{{ slotHint() }}</span> }
    </ui-list-item>
  `,
})
class RowHost {
  title = signal<string | null>(null);
  hint = signal<string | null>(null);
  projected = signal<string | null>(null);
  slotHint = signal<string | null>(null);
}

/**
 * Row heights (2026-11-13 UI audit): the trailing slot was a block, so a chevron in it sat on a text line box
 * and its descender space made those rows 4px taller than rows with only a leading icon or none (38 / 35 / 34px
 * in one settings list). Both slots are flex boxes now. The measured heights are checked in a real browser
 * (jsdom has no layout); this pins the rule that makes them equal.
 */
describe('UiListItem slots', () => {
  const css = (UiListItem as unknown as { ɵcmp: { styles: string[] } }).ɵcmp.styles.join('').replace(/\s+/g, ' ');
  const rule = (sel: string) => css.match(new RegExp(`(?:^|\\} )\\.${sel}\\[[^\\]]*\\] \\{([^}]*)\\}`))?.[1] ?? '';

  it('lays the trailing slot out as a flex box, like the leading one', () => {
    expect(rule('trail')).toMatch(/display: inline-flex/);
    expect(rule('trail')).toMatch(/align-items: center/);
    expect(rule('lead')).toMatch(/display: inline-flex/);
  });

  it('still hides an empty slot', () => {
    expect(css).toMatch(/\.lead\[[^\]]*\]:empty, \.trail\[[^\]]*\]:empty \{ display: none; \}/);
  });

  it('renders structured title and muted ellipsized hint', () => {
    const fixture = TestBed.createComponent(RowHost);
    fixture.componentInstance.title.set('Feed photos');
    fixture.componentInstance.hint.set('3 of 6 selected');
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('.title')?.textContent?.trim()).toBe('Feed photos');
    expect(el.querySelector('.hint')?.textContent?.trim()).toBe('3 of 6 selected');
    expect(rule('title')).toMatch(/font-weight: 500/);
    expect(rule('hint')).toMatch(/text-overflow: ellipsis/);
    expect(rule('hint')).toMatch(/var\(--ui-color-text-muted\)/);
  });

  it('projects [item-hint] slot and preserves default content without title/hint', () => {
    const fixture = TestBed.createComponent(RowHost);
    fixture.componentInstance.projected.set('Plain body');
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('.title')).toBeNull();
    expect(el.querySelector('.custom-body')?.textContent?.trim()).toBe('Plain body');

    fixture.componentInstance.slotHint.set('Custom hint node');
    fixture.detectChanges();
    const hints = [...el.querySelectorAll('.hint')].map((n) => n.textContent?.trim()).filter(Boolean);
    expect(hints).toEqual(['Custom hint node']);
  });
});
