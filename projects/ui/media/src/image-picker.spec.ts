import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { UiImagePicker, type UiImagePickerItem } from './image-picker';

@Component({
  imports: [UiImagePicker],
  template: `<ui-image-picker [items]="items()" [busyId]="busy()" dragType="application/x-test" (pick)="picked.push($event.id)" />`,
})
class Host {
  items = signal<UiImagePickerItem[]>([
    { id: 'a', src: 'data:image/gif;base64,R0lGODlhAQABAAAAACw=', label: 'Apple', badge: 'Moves' },
    { id: 'b', src: 'data:image/gif;base64,R0lGODlhAQABAAAAACw=', label: 'Pear', disabled: true, hint: 'Too large' },
  ]);
  busy = signal<string | null>(null);
  picked: string[] = [];
}

describe('UiImagePicker', () => {
  function render() {
    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    const tiles = () => Array.from(fixture.nativeElement.querySelectorAll('button.tile')) as HTMLButtonElement[];
    return { fixture, tiles };
  }

  it('picks a tile and names it for screen readers', () => {
    const { fixture, tiles } = render();
    expect(tiles()[0].getAttribute('aria-label')).toBe('Apple');
    expect(tiles()[0].textContent).toContain('Moves');
    tiles()[0].click();
    expect(fixture.componentInstance.picked).toEqual(['a']);
  });

  it('keeps disabled tiles unpickable, with the reason as their title', () => {
    const { tiles } = render();
    expect(tiles()[1].disabled).toBe(true);
    expect(tiles()[1].title).toBe('Too large');
  });

  it('holds the other tiles while one is busy', () => {
    const { fixture, tiles } = render();
    fixture.componentInstance.items.update((i) => [...i, { id: 'c', src: '', label: 'Plum' }]);
    fixture.componentInstance.busy.set('a');
    fixture.detectChanges();
    expect(tiles()[0].getAttribute('aria-busy')).toBe('true');
    expect(tiles()[0].disabled).toBe(false);
    expect(tiles()[2].disabled).toBe(true);
  });

  it('falls back to the label when a thumbnail fails', () => {
    const { fixture } = render();
    const img = fixture.nativeElement.querySelector('img') as HTMLImageElement;
    img.dispatchEvent(new Event('error'));
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.fallback')?.textContent).toContain('Apple');
  });

  it('puts the id in the drag data under the drag type', () => {
    const { tiles } = render();
    const data = new Map<string, string>();
    const event = new Event('dragstart') as DragEvent;
    Object.defineProperty(event, 'dataTransfer', { value: { setData: (t: string, v: string) => data.set(t, v), effectAllowed: '' } });
    tiles()[0].dispatchEvent(event);
    expect(data.get('application/x-test')).toBe('a');
  });
});
