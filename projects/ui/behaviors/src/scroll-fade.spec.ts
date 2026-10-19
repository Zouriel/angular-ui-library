import { Component, viewChild } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { UiScrollFade } from './scroll-fade';

/**
 * jsdom has no layout: the strip is 200px wide and its content `wide` px, set by hand. It also drops
 * mask-image from inline styles, so the edges are read from `more`, which the mask is built from.
 */
@Component({
  imports: [UiScrollFade],
  template: `<div id="strip" uiScrollFade style="overflow-x: auto"><span>content</span></div>`,
})
class Host {
  readonly fade = viewChild.required(UiScrollFade);
}

function setup(wide: number) {
  const fixture = TestBed.createComponent(Host);
  fixture.detectChanges();
  const strip = fixture.nativeElement.querySelector('#strip') as HTMLElement;
  let left = 0;
  Object.defineProperty(strip, 'clientWidth', { get: () => 200 });
  Object.defineProperty(strip, 'scrollWidth', { get: () => wide });
  Object.defineProperty(strip, 'scrollLeft', { get: () => left, set: (v: number) => { left = v; } });
  const scrollTo = (v: number) => { left = v; strip.dispatchEvent(new Event('scroll')); fixture.detectChanges(); };
  fixture.componentInstance.fade().update();
  fixture.detectChanges();
  const more = () => fixture.componentInstance.fade().more();
  return { more, scrollTo };
}

describe('UiScrollFade', () => {
  it('fades nothing while the content fits', () => {
    expect(setup(200).more()).toEqual({ start: false, end: false });
  });

  it('fades the end, both edges in the middle, and the start at the end', () => {
    const { more, scrollTo } = setup(600);
    expect(more()).toEqual({ start: false, end: true });
    scrollTo(200);
    expect(more()).toEqual({ start: true, end: true });
    scrollTo(400);
    expect(more()).toEqual({ start: true, end: false });
  });

  it('with axis y, reads the vertical scroll', () => {
    TestBed.overrideTemplate(Host, `<div id="strip" uiScrollFade uiScrollFadeAxis="y" style="overflow-y: auto"><span>content</span></div>`);
    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    const col = fixture.nativeElement.querySelector('#strip') as HTMLElement;
    let top = 0;
    Object.defineProperty(col, 'clientHeight', { get: () => 100 });
    Object.defineProperty(col, 'scrollHeight', { get: () => 400 });
    Object.defineProperty(col, 'scrollTop', { get: () => top, set: (v: number) => { top = v; } });
    const fade = fixture.componentInstance.fade();
    fade.update();
    expect(fade.more()).toEqual({ start: false, end: true });
    top = 300;
    fade.update();
    expect(fade.more()).toEqual({ start: true, end: false });
  });
});
