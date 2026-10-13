import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { UiAccordion, UiAccordionItem } from './accordion';

@Component({
  imports: [UiAccordion, UiAccordionItem],
  template: `
    <ui-accordion [multiple]="multiple">
      <ui-accordion-item title="One">First</ui-accordion-item>
      <ui-accordion-item title="Two">Second</ui-accordion-item>
    </ui-accordion>`,
})
class Host {
  multiple = false;
}

function setup(multiple = false) {
  const fixture = TestBed.createComponent(Host);
  fixture.componentInstance.multiple = multiple;
  fixture.detectChanges();
  const el = fixture.nativeElement as HTMLElement;
  const triggers = [...el.querySelectorAll<HTMLButtonElement>('.trigger')];
  const click = (i: number) => { triggers[i].click(); fixture.detectChanges(); };
  const expanded = () => triggers.map((t) => t.getAttribute('aria-expanded'));
  return { el, click, expanded };
}

describe('UiAccordion', () => {
  it('keeps one panel open unless multiple is set', () => {
    const single = setup();
    single.click(0);
    single.click(1);
    expect(single.expanded()).toEqual(['false', 'true']);

    const multi = setup(true);
    multi.click(0);
    multi.click(1);
    expect(multi.expanded()).toEqual(['true', 'true']);
  });

  it('makes a closed panel inert', () => {
    const { el, click } = setup();
    const panels = el.querySelectorAll('.panel');
    expect(panels[0].hasAttribute('inert')).toBe(true);
    click(0);
    expect(panels[0].hasAttribute('inert')).toBe(false);
  });

  it('uses title as the header text without leaving a native tooltip on the item', () => {
    const { el } = setup();
    const item = el.querySelector('ui-accordion-item')!;
    expect(item.querySelector('.title')?.textContent?.trim()).toBe('One');
    expect(item.hasAttribute('title')).toBe(false);
  });
});
