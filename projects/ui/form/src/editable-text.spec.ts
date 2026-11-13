import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { describe, expect, it } from 'vitest';
import { UiEditableText } from './editable-text';

/** The component's own CSS, the encapsulation attribute taken out: jsdom doesn't lay out, so the rule is the proof. */
const css = () =>
  ((UiEditableText as unknown as { ɵcmp: { styles: string[] } }).ɵcmp.styles ?? [])
    .join('\n')
    .replace(/\[_ngcontent-%COMP%\]/g, '')
    .replace(/\[_nghost-%COMP%\]/g, '')
    .replace(/\s+/g, ' ');

@Component({
  imports: [ReactiveFormsModule, UiEditableText],
  template: `<ui-editable-text [formControl]="name" [flush]="flush" />`,
})
class Host {
  name = new FormControl('Aisha and Bilal');
  flush = false;
}

function render(flush: boolean) {
  const f = TestBed.createComponent(Host);
  f.componentInstance.flush = flush;
  f.detectChanges();
  return (f.nativeElement as HTMLElement).querySelector('ui-editable-text') as HTMLElement;
}

describe('UiEditableText flush (0.82.0)', () => {
  it('marks the host only when asked', () => {
    expect(render(false).classList.contains('flush')).toBe(false);
    expect(render(true).classList.contains('flush')).toBe(true);
  });

  it('pulls the box out by its padding and border, so its text starts on the line of what is above it', () => {
    // UI audit 2026-11-13: an event's name sat 9px right of its heading because of the box's own padding.
    const rule = css().match(/\.flush \.view, \.flush \.edit \{([^}]*)\}/)?.[1] ?? '';
    expect(rule).toContain('margin-inline-start: calc(-1 * (var(--ui-space-2) + 1px))');
    // The padding itself stays: the hover outline and the field keep their room around the text.
    expect(css()).toMatch(/\.view \{[^}]*padding: 2px var\(--ui-space-2\)/);
  });
});
