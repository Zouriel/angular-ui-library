import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { UiInput } from './input';
import { UiTextarea } from './textarea';
import { uiResolvedDir, uiTextDirection } from './text-dir';

// jsdom has no ResizeObserver or layout; slots are measured with getBoundingClientRect.
globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof ResizeObserver;

@Component({
  imports: [UiTextarea, UiInput],
  template: `
    <ui-textarea [dir]="dir()" [autosize]="true" [rows]="1" [invalid]="invalid()">
      <span textarea-leading class="clip">+</span>
      <button textarea-trailing type="button" class="send">Send</button>
    </ui-textarea>
    <ui-input [dir]="dir()">
      <span input-leading class="icon">@</span>
    </ui-input>
    <ui-textarea class="plain" />
  `,
})
class Host {
  dir = signal<'ltr' | 'rtl' | 'auto' | null>(null);
  invalid = signal(false);
}

async function setup(width = 30) {
  const rect = vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
    const w = this.classList.contains('slot') && this.childElementCount ? width : 0;
    return { width: w, height: 0, top: 0, left: 0, right: w, bottom: 0, x: 0, y: 0, toJSON() {} } as DOMRect;
  });
  const f = TestBed.createComponent(Host);
  document.body.appendChild(f.nativeElement);
  f.detectChanges();
  await f.whenStable();
  f.detectChanges();
  const el = f.nativeElement as HTMLElement;
  const ta = el.querySelector('ui-textarea:not(.plain)')!;
  return { f, el, ta, textarea: ta.querySelector('textarea')!, rect };
}

describe('text field slots', () => {
  afterEach(() => vi.restoreAllMocks());

  it('draws projected content inside the frame, at the inline start and end', async () => {
    const { ta } = await setup();
    expect(ta.querySelector('.frame .slot.lead .clip')).not.toBeNull();
    expect(ta.querySelector('.frame .slot.trail .send')).not.toBeNull();
    // The textarea sits between the two slots, so focus order is lead, text, trail.
    const order = [...ta.querySelectorAll('.slot, textarea')].map((n) => (n.tagName === 'TEXTAREA' ? 'text' : n.classList.contains('lead') ? 'lead' : 'trail'));
    expect(order).toEqual(['lead', 'text', 'trail']);
  });

  it('keeps the text clear of the slots, and leaves fields without slots as they were', async () => {
    const { el, textarea } = await setup(30);
    expect(textarea.style.paddingInlineStart).toContain('30px');
    expect(textarea.style.paddingInlineEnd).toContain('30px');
    const plain = el.querySelector('ui-textarea.plain textarea') as HTMLTextAreaElement;
    expect(plain.style.paddingInlineStart).toBe('');
    expect(plain.style.paddingInlineEnd).toBe('');
    const input = el.querySelector('ui-input input') as HTMLInputElement;
    expect(input.style.paddingInlineStart).toContain('30px');
    expect(input.style.paddingInlineEnd).toBe('');
  });

  it('focuses the field on a press on empty slot space, not on a button in it', async () => {
    const { ta, textarea } = await setup();
    const down = (target: Element) => {
      const e = new PointerEvent('pointerdown', { bubbles: true, cancelable: true });
      target.dispatchEvent(e);
      return e;
    };
    const plainPress = down(ta.querySelector('.clip')!);
    expect(plainPress.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(textarea);
    textarea.blur();
    const buttonPress = down(ta.querySelector('.send')!);
    expect(buttonPress.defaultPrevented).toBe(false);
    expect(document.activeElement).not.toBe(textarea);
  });

  it('passes dir to the native field and lays the slots out in the resolved direction', async () => {
    const { f, ta, textarea, el } = await setup();
    const frame = ta.querySelector('.frame')!;
    expect(textarea.hasAttribute('dir')).toBe(false);
    expect(frame.hasAttribute('dir')).toBe(false);
    f.componentInstance.dir.set('rtl');
    f.detectChanges();
    expect(textarea.getAttribute('dir')).toBe('rtl');
    expect(frame.getAttribute('dir')).toBe('rtl');
    expect(el.querySelector('ui-input input')!.getAttribute('dir')).toBe('rtl');
    f.componentInstance.dir.set('auto');
    f.detectChanges();
    expect(textarea.getAttribute('dir')).toBe('auto');
    expect(frame.hasAttribute('dir')).toBe(false);
    textarea.value = 'ދިވެހި';
    textarea.dispatchEvent(new Event('input'));
    f.detectChanges();
    expect(frame.getAttribute('dir')).toBe('rtl');
    textarea.value = 'hello ދިވެހި';
    textarea.dispatchEvent(new Event('input'));
    f.detectChanges();
    expect(frame.getAttribute('dir')).toBe('ltr');
  });

  it('keeps the invalid state on the field that carries the border', async () => {
    const { f, textarea } = await setup();
    f.componentInstance.invalid.set(true);
    f.detectChanges();
    expect(textarea.getAttribute('aria-invalid')).toBe('true');
  });
});

describe('uiTextDirection', () => {
  it('follows the first strong character, as dir="auto" does', () => {
    expect(uiTextDirection('ދިވެހި')).toBe('rtl'); // Thaana
    expect(uiTextDirection('مرحبا')).toBe('rtl');
    expect(uiTextDirection('שלום')).toBe('rtl');
    expect(uiTextDirection('12 ދ')).toBe('rtl');
    expect(uiTextDirection('Hi ދ')).toBe('ltr');
    expect(uiTextDirection('123 !?')).toBeNull();
    expect(uiTextDirection('')).toBeNull();
    expect(uiResolvedDir(null, 'ދ')).toBeNull();
    expect(uiResolvedDir('ltr', 'ދ')).toBe('ltr');
  });
});

describe('field font hook', () => {
  // Flutter 0.33.0 lost an app font on the placeholder; here the placeholder inherits the field's
  // font, and --ui-field-font (set on the host) is the way to give both an app font.
  it('ui-input and ui-textarea take their font from --ui-field-font, defaulting to the theme font', () => {
    for (const file of ['input.ts', 'textarea.ts']) {
      const src = readFileSync(join(process.cwd(), 'projects/ui/form/src', file), 'utf8');
      expect(src, file).toContain('font-family: var(--ui-field-font, var(--ui-font-default));');
      expect(src, file).not.toMatch(/::placeholder\s*\{[^}]*font-family/);
    }
  });
});
