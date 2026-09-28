import { Component, signal, viewChild } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { UiTransformBox, type UiBox, type UiTransformMode } from './transform-box';

function pointer(kind: string, id: number, x: number, y: number, type = 'touch'): Event {
  const e = new Event(kind, { bubbles: true, cancelable: true });
  Object.assign(e, { pointerId: id, pointerType: type, button: 0, clientX: x, clientY: y, shiftKey: false, altKey: false });
  return e;
}

@Component({
  imports: [UiTransformBox],
  template: `<ui-transform-box [box]="box()" (transformStart)="starts.push($event)" (transform)="moves.push($event)" (transformEnd)="ends.push($event)" [minSize]="10" />`,
})
class Host {
  readonly box = signal<UiBox>({ x: 100, y: 100, w: 80, h: 40, rotate: 15 });
  readonly tb = viewChild.required(UiTransformBox);
  starts: UiTransformMode[] = [];
  moves: UiBox[] = [];
  ends: UiBox[] = [];
}

describe('UiTransformBox pinch', () => {
  let fixture: ComponentFixture<Host>;
  let host: Host;
  const body = () => fixture.nativeElement.querySelector('.body') as HTMLElement;

  beforeEach(() => {
    fixture = TestBed.createComponent(Host);
    host = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('grows equally from every side about its centre, keeping proportions and rotation', () => {
    host.tb().startPinch({ pointerId: 1, clientX: 100, clientY: 200 }, { pointerId: 2, clientX: 200, clientY: 200 });
    window.dispatchEvent(pointer('pointermove', 2, 250, 200));
    window.dispatchEvent(pointer('pointermove', 1, 50, 200));
    window.dispatchEvent(pointer('pointerup', 2, 250, 200));
    expect(host.starts).toEqual(['resize']);
    const end = host.ends.at(-1)!;
    // Spread 100 → 200: twice the size, same centre (140, 120), same turn.
    expect(end.w).toBeCloseTo(160, 6);
    expect(end.h).toBeCloseTo(80, 6);
    expect(end.x + end.w / 2).toBeCloseTo(140, 6);
    expect(end.y + end.h / 2).toBeCloseTo(120, 6);
    expect(end.rotate).toBe(15);
    expect(host.ends).toHaveLength(1);
  });

  it('follows the point between the fingers', () => {
    host.tb().startPinch({ pointerId: 1, clientX: 100, clientY: 200 }, { pointerId: 2, clientX: 200, clientY: 200 });
    window.dispatchEvent(pointer('pointermove', 1, 130, 230));
    window.dispatchEvent(pointer('pointermove', 2, 230, 230));
    window.dispatchEvent(pointer('pointerup', 1, 130, 230));
    const end = host.ends.at(-1)!;
    expect(end.w).toBeCloseTo(80, 6);
    expect(end.x + end.w / 2).toBeCloseTo(170, 6);
    expect(end.y + end.h / 2).toBeCloseTo(150, 6);
  });

  it('never shrinks below the smallest size, on either side', () => {
    host.tb().startPinch({ pointerId: 1, clientX: 100, clientY: 200 }, { pointerId: 2, clientX: 200, clientY: 200 });
    window.dispatchEvent(pointer('pointermove', 2, 101, 200));
    window.dispatchEvent(pointer('pointerup', 2, 101, 200));
    const end = host.ends.at(-1)!;
    expect(end.h).toBeCloseTo(10, 6);
    expect(end.w).toBeCloseTo(20, 6);
  });

  it('a second finger while one drags the box turns the drag into a pinch', () => {
    body().dispatchEvent(pointer('pointerdown', 1, 140, 120));
    window.dispatchEvent(pointer('pointerdown', 2, 240, 120));
    window.dispatchEvent(pointer('pointermove', 2, 340, 120));
    window.dispatchEvent(pointer('pointerup', 1, 140, 120));
    window.dispatchEvent(pointer('pointerup', 2, 340, 120));
    expect(host.starts).toEqual(['move', 'resize']);
    expect(host.ends).toHaveLength(1);
    const end = host.ends[0];
    // The midpoint moved 50 right as the spread doubled.
    expect(end.w).toBeCloseTo(160, 6);
    expect(end.x + end.w / 2).toBeCloseTo(190, 6);
  });

  it('two fingers that land and lift without moving change nothing', () => {
    host.tb().startPinch({ pointerId: 1, clientX: 100, clientY: 200 }, { pointerId: 2, clientX: 200, clientY: 200 });
    window.dispatchEvent(pointer('pointerup', 1, 100, 200));
    expect(host.starts).toEqual([]);
    expect(host.ends).toEqual([]);
  });

  it('a mouse drag is never turned into a pinch', () => {
    body().dispatchEvent(pointer('pointerdown', 1, 140, 120, 'mouse'));
    window.dispatchEvent(pointer('pointerdown', 2, 240, 120));
    expect(host.tb().pinching).toBe(false);
    window.dispatchEvent(pointer('pointerup', 1, 140, 120, 'mouse'));
  });
});
