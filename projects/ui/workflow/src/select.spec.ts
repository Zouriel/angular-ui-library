import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { WfSelect, type WfOption } from './select';

@Component({
  imports: [WfSelect],
  template: `<ui-wf-select [options]="options" [value]="value()" [reset]="reset()" placeholder="Add…" label="Pick" (valueChange)="picked.push($event); !reset() && value.set($event)" />`,
})
class Host {
  readonly options: WfOption[] = [{ value: 'a', label: 'Apple' }, { value: 'b', label: 'Banana' }];
  readonly value = signal<string | null>(null);
  readonly reset = signal(false);
  readonly picked: string[] = [];
}

function setup(value: string | null, reset = false) {
  const f = TestBed.createComponent(Host);
  f.componentInstance.value.set(value);
  f.componentInstance.reset.set(reset);
  f.detectChanges();
  const select = () => (f.nativeElement as HTMLElement).querySelector('select') as HTMLSelectElement;
  return { f, select };
}

describe('ui-wf-select', () => {
  it('is a small ui-select showing the value given, at once', () => {
    const { f, select } = setup('b');
    expect((f.nativeElement as HTMLElement).querySelector('ui-select .wrap')?.getAttribute('data-size')).toBe('sm');
    expect(select().options[select().selectedIndex].value).toBe('b');
    expect(select().getAttribute('aria-label')).toBe('Pick');
  });

  it('reports a choice', () => {
    const { f, select } = setup(null);
    select().value = 'a';
    select().dispatchEvent(new Event('change'));
    f.detectChanges();
    expect(f.componentInstance.picked).toEqual(['a']);
    expect(select().options[select().selectedIndex].value).toBe('a');
  });

  it('shows a stored value that is not offered as it is, not choosable, rather than another option', () => {
    const { select } = setup('zz');
    const opt = select().options[select().selectedIndex];
    expect(opt.value).toBe('zz');
    expect(opt.textContent?.trim()).toBe('zz (not available here)');
    expect(opt.disabled).toBe(true);
  });

  it('as a picker, reports each pick and shows the placeholder again', () => {
    const { f, select } = setup(null, true);
    select().value = 'b';
    select().dispatchEvent(new Event('change'));
    f.detectChanges();
    expect(f.componentInstance.picked).toEqual(['b']);
    expect(select().options[select().selectedIndex].textContent?.trim()).toBe('Add…');
    select().value = 'b';
    select().dispatchEvent(new Event('change'));
    f.detectChanges();
    expect(f.componentInstance.picked).toEqual(['b', 'b']);
  });
});
