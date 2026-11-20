import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { UiCarousel, type UiCarouselSlide } from './carousel';
import { UiPosterGrid, type UiPoster } from './poster-grid';

@Component({ imports: [UiPosterGrid], template: `<ui-poster-grid [posters]="posters()" />` })
class GridHost {
  posters = signal<UiPoster[]>([
    { src: 'a.png', label: 'A', position: { x: 20, y: 80 } },
    { src: 'b.png', label: 'B' },
  ]);
}

@Component({ imports: [UiCarousel], template: `<ui-carousel [slides]="slides()" />` })
class CarouselHost {
  slides = signal<UiCarouselSlide[]>([
    { image: 'a.png', position: { x: 10, y: 30 } },
    { image: 'b.png' },
  ]);
}

describe('photo position on posters and carousel slides', () => {
  it('poster grid: a poster position is the img object-position, default stays centre', () => {
    const f = TestBed.createComponent(GridHost);
    f.detectChanges();
    const imgs = (f.nativeElement as HTMLElement).querySelectorAll('img');
    expect(imgs[0].style.objectPosition).toBe('20% 80%');
    expect(imgs[1].style.objectPosition).toBe('50% 50%');
  });

  it('carousel: a slide position is the img object-position, none leaves the style unset', () => {
    const f = TestBed.createComponent(CarouselHost);
    f.detectChanges();
    const imgs = (f.nativeElement as HTMLElement).querySelectorAll('.slide img');
    expect((imgs[0] as HTMLImageElement).style.objectPosition).toBe('10% 30%');
    expect((imgs[1] as HTMLImageElement).style.objectPosition).toBe('');
  });
});
