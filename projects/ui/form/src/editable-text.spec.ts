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

@Component({
  imports: [ReactiveFormsModule, UiEditableText],
  template: `<ui-editable-text [formControl]="name" [variant]="variant" [block]="block" [onMedia]="onMedia" />`,
})
class VariantHost {
  name = new FormControl('Eid party');
  variant: 'body' | 'h2' = 'body';
  block = false;
  onMedia = false;
}

describe('UiEditableText variant, block, onMedia (0.89.0)', () => {
  function mk(patch: Partial<VariantHost>) {
    const f = TestBed.createComponent(VariantHost);
    Object.assign(f.componentInstance, patch);
    f.detectChanges();
    return (f.nativeElement as HTMLElement).querySelector('ui-editable-text') as HTMLElement;
  }

  it('variant is exposed on the host and drives the heading look of text and field', () => {
    expect(mk({}).getAttribute('data-variant')).toBe('body');
    const el = mk({ variant: 'h2' });
    expect(el.getAttribute('data-variant')).toBe('h2');
    expect(css()).toMatch(/\[data-variant=["']?h2["']?\]\s*\{[^}]*--ee-size:\s*var\(--ui-font-size-h2\);\s*--ee-weight:\s*700/);
    expect(css()).toMatch(/\.view\s*\{[^}]*font-size:\s*var\(--ee-size,/);
    expect(css()).toMatch(/\.edit\s*\{[^}]*font-size:\s*var\(--ee-size,/);
  });

  it('block fills the row', () => {
    expect(mk({}).classList.contains('block')).toBe(false);
    expect(mk({ block: true }).classList.contains('block')).toBe(true);
    expect(css()).toMatch(/\.block\s*\{\s*display:\s*block;\s*width:\s*100%/);
    expect(css()).toMatch(/\.block\s+\.view,\s*\.block\s+\.edit\s*\{\s*width:\s*100%/);
  });

  it('onMedia sets light ink, a translucent hover and a light pencil; the field stays opaque', () => {
    expect(mk({}).classList.contains('on-media')).toBe(false);
    expect(mk({ onMedia: true }).classList.contains('on-media')).toBe(true);
    expect(css()).toMatch(/\.on-media\s+\.view[^{]*\{\s*color:\s*var\(--ui-media-on-scrim\)/);
    expect(css()).toMatch(/\.on-media\s+\.view:hover:not\(:disabled\)[^{]*\{\s*background:\s*color-mix\(in srgb,\s*var\(--ui-media-scrim\)/);
    expect(css()).toMatch(/\.on-media\s+\.pencil[^{]*\{\s*color:\s*var\(--ui-media-on-scrim\)/);
    expect(css()).toMatch(/\.edit\s*\{[^}]*background:\s*var\(--ui-color-surface\)/);
    expect(css()).toContain('[data-on-media]');
  });
});
