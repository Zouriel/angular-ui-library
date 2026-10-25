import { Component, signal, type Type } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormControl, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { describe, expect, it } from 'vitest';
import { UiInput } from './input';
import { UiPasswordInput } from './password-input';
import { UiSearchInput } from './search-input';
import { UiTextarea } from './textarea';
import { uiNativeDir } from './text-dir';

// jsdom has no ResizeObserver; the fields measure their slots with one.
globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof ResizeObserver;

// 0.46.1: a model write always reaches the native control when the two differ. The [value] binding
// compared against the last value it had written, so '' set straight after typing (a chat composer
// clearing on send, before change detection ran) matched it and the typed text stayed in the box.

@Component({
  imports: [ReactiveFormsModule, UiInput, UiTextarea, UiSearchInput, UiPasswordInput],
  template: `
    <ui-textarea [formControl]="ctl" />
    <ui-input [formControl]="ctl2" />
    <ui-search-input [formControl]="ctl3" />
    <ui-password-input [formControl]="ctl4" />
  `,
})
class ReactiveHost {
  ctl = new FormControl('');
  ctl2 = new FormControl('');
  ctl3 = new FormControl('');
  ctl4 = new FormControl('');
}

@Component({
  imports: [FormsModule, UiTextarea],
  template: `<ui-textarea [ngModel]="text()" (ngModelChange)="text.set($event)" />`,
})
class ModelHost {
  text = signal('');
}

async function make<T>(cmp: Type<T>) {
  const f = TestBed.createComponent(cmp);
  document.body.appendChild(f.nativeElement);
  f.detectChanges();
  await f.whenStable();
  f.detectChanges();
  return f;
}

/** Types [text] into [el] as a person would: the native value changes, then an input event. */
function type(el: HTMLInputElement | HTMLTextAreaElement, text: string): void {
  el.value = text;
  el.dispatchEvent(new Event('input'));
}

describe('text fields clear when the model is set right after typing', () => {
  const cases = [
    ['ui-textarea', 'ctl', 'ui-textarea textarea'],
    ['ui-input', 'ctl2', 'ui-input input'],
    ['ui-search-input', 'ctl3', 'ui-search-input input'],
    ['ui-password-input', 'ctl4', 'ui-password-input input'],
  ] as const;
  for (const [name, ctl, sel] of cases) {
    it(`${name}: type "hello", set '' at once -> the native value is ''`, async () => {
      const f = await make(ReactiveHost);
      const el = (f.nativeElement as HTMLElement).querySelector<HTMLInputElement>(sel)!;
      type(el, 'hello');
      expect(f.componentInstance[ctl].value).toBe('hello');
      f.componentInstance[ctl].setValue('');
      expect(el.value).toBe('');
      f.detectChanges();
      await f.whenStable();
      expect(el.value).toBe('');
      // And it keeps working: type again, clear again, with change detection in between this time.
      type(el, 'again');
      f.detectChanges();
      f.componentInstance[ctl].setValue('');
      f.detectChanges();
      expect(el.value).toBe('');
      f.componentInstance[ctl].setValue('set from code');
      f.detectChanges();
      expect(el.value).toBe('set from code');
    });
  }

  it('ui-textarea with ngModel: send clears the box', async () => {
    const f = await make(ModelHost);
    const el = (f.nativeElement as HTMLElement).querySelector('textarea')!;
    type(el, 'hello');
    expect(f.componentInstance.text()).toBe('hello');
    // The app's change detection runs after the input event (NgModel only calls writeValue when its
    // input changed since the last check), then send clears the model.
    f.detectChanges();
    await f.whenStable();
    f.componentInstance.text.set('');
    f.detectChanges();
    await f.whenStable();
    f.detectChanges();
    expect(el.value).toBe('');
  });
});

@Component({
  imports: [UiInput, UiTextarea],
  template: `
    <div dir="rtl">
      <ui-textarea dir="auto" placeholder="ސިޓީ ލިޔުއްވާ…" />
      <ui-input [dir]="dir()" placeholder="ނަން" />
    </div>
  `,
})
class DirHost {
  dir = signal<'ltr' | 'rtl' | 'auto' | null>('auto');
}

describe('empty dir="auto" fields inherit the page direction (0.46.1)', () => {
  it('uiNativeDir: auto only with text; explicit directions and null unchanged', () => {
    expect(uiNativeDir('auto', '')).toBe(null);
    expect(uiNativeDir('auto', 'a')).toBe('auto');
    expect(uiNativeDir('rtl', '')).toBe('rtl');
    expect(uiNativeDir('ltr', '')).toBe('ltr');
    expect(uiNativeDir(null, 'x')).toBe(null);
  });

  it('the native control has no dir while empty, auto once typed in, none again when cleared', async () => {
    const f = await make(DirHost);
    const root = f.nativeElement as HTMLElement;
    for (const sel of ['ui-textarea textarea', 'ui-input input']) {
      const el = root.querySelector<HTMLInputElement>(sel)!;
      expect(el.hasAttribute('dir'), sel).toBe(false);
      type(el, 'hello');
      f.detectChanges();
      expect(el.getAttribute('dir'), sel).toBe('auto');
      type(el, '');
      f.detectChanges();
      expect(el.hasAttribute('dir'), sel).toBe(false);
    }
    // A static dir="auto" stays off the wrapper too, or the wrapper would resolve the empty field to LTR.
    expect(root.querySelector('ui-textarea')!.hasAttribute('dir')).toBe(false);
    f.componentInstance.dir.set('ltr');
    f.detectChanges();
    expect(root.querySelector('ui-input input')!.getAttribute('dir')).toBe('ltr');
  });
});
