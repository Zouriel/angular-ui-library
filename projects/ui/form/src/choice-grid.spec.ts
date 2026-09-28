import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { UiChoiceGrid, type UiChoice } from './choice-grid';
import { UiAnchorPicker, type UiAnchor } from './anchor-picker';

@Component({
  imports: [UiChoiceGrid, UiAnchorPicker],
  template: `
    <ui-choice-grid [options]="options" [(value)]="value" (picked)="picks.push($event.value)">
      <ng-template #tile let-item let-selected="selected"><i class="pic">{{ item.value }}{{ selected ? '*' : '' }}</i></ng-template>
    </ui-choice-grid>
    <ui-anchor-picker [(value)]="anchor" />
  `,
})
class Host {
  options: UiChoice[] = [
    { value: 'fade', label: 'Fade', group: 'Basic' },
    { value: 'rise', label: 'Rise', group: 'Basic' },
    { value: 'drop', label: 'Drop', group: 'Bounce', disabled: true },
    { value: 'bounce', label: 'Bounce', group: 'Bounce', description: 'Playful' },
  ];
  value = signal<string | null>('rise');
  anchor = signal<UiAnchor | null>({ x: 0.5, y: 0.5 });
  picks: string[] = [];
}

describe('UiChoiceGrid', () => {
  function render() {
    const f = TestBed.createComponent(Host);
    f.detectChanges();
    const tiles = () => Array.from(f.nativeElement.querySelectorAll('ui-choice-grid [role=radio]')) as HTMLButtonElement[];
    return { f, tiles };
  }

  it('groups tiles under headings and draws the projected tile', () => {
    const { f, tiles } = render();
    const headings = Array.from(f.nativeElement.querySelectorAll('.heading')).map((h) => (h as HTMLElement).textContent);
    expect(headings).toEqual(['Basic', 'Bounce']);
    expect(tiles()[1].querySelector('.pic')?.textContent).toBe('rise*');
    expect(tiles()[3].textContent).toContain('Playful');
  });

  it('has one tab stop, on the chosen tile', () => {
    const { tiles } = render();
    expect(tiles().map((t) => t.tabIndex)).toEqual([-1, 0, -1, -1]);
    expect(tiles()[1].getAttribute('aria-checked')).toBe('true');
  });

  it('chooses on click, and reports every pick', () => {
    const { f, tiles } = render();
    tiles()[0].click();
    tiles()[0].click();
    expect(f.componentInstance.value()).toBe('fade');
    expect(f.componentInstance.picks).toEqual(['fade', 'fade']);
  });

  it('skips disabled tiles with the arrow keys', () => {
    const { f, tiles } = render();
    tiles()[1].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }));
    f.detectChanges();
    expect(f.componentInstance.value()).toBe('bounce');
  });
});

describe('UiAnchorPicker', () => {
  it('names each dot and moves the point with arrow keys', () => {
    const f = TestBed.createComponent(Host);
    f.detectChanges();
    const dots = Array.from(f.nativeElement.querySelectorAll('ui-anchor-picker [role=radio]')) as HTMLButtonElement[];
    expect(dots.length).toBe(9);
    expect(dots[4].getAttribute('aria-checked')).toBe('true');
    expect(dots[1].getAttribute('aria-label')).toBe('Top');
    dots[4].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp' }));
    expect(f.componentInstance.anchor()).toEqual({ x: 0.5, y: 0 });
    dots[6].click();
    expect(f.componentInstance.anchor()).toEqual({ x: 0, y: 1 });
  });
});
