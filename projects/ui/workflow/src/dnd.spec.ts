import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createStep, createWorkflow } from './definition';
import { WfDnd, wfDropIndex } from './dnd';
import type { UiWfStep } from './schema';
import { WfBuilderStore } from './store';

/** Where a dragged step lands among a list's cards (top to bottom). */
describe('wfDropIndex', () => {
  // Three cards, 56 tall with 32px between them (room for the + slot).
  const cards = [{ top: 0, bottom: 56 }, { top: 88, bottom: 144 }, { top: 176, bottom: 232 }];

  it('the top half of a card is before it, the bottom half after it', () => {
    expect(wfDropIndex(cards, 100)).toBe(1);
    expect(wfDropIndex(cards, 130)).toBe(2);
  });

  it('gaps and both ends', () => {
    expect(wfDropIndex(cards, -20)).toBe(0);
    expect(wfDropIndex(cards, 70)).toBe(1);
    expect(wfDropIndex(cards, 500)).toBe(3);
  });

  it('an empty list takes the drop at 0', () => {
    expect(wfDropIndex([], 40)).toBe(0);
  });
});

/**
 * Hit-testing goes by what is visible under the pointer (`elementFromPoint`), never by a list's box:
 * a list scrolled out of the canvas still has a box (above or below the scroller, under the toolbar,
 * say), but the browser reports what is drawn there instead, so nothing can be dropped into it.
 */
describe('WfDnd drops only into lists in view', () => {
  afterEach(() => { document.body.innerHTML = ''; vi.restoreAllMocks(); });

  function pointer(type: string, x: number, y: number): Event {
    const e = new Event(type, { bubbles: true });
    Object.defineProperties(e, { button: { value: 0 }, clientX: { value: x }, clientY: { value: y }, pointerId: { value: 1 }, pointerType: { value: 'mouse' } });
    return e;
  }

  function setup() {
    TestBed.configureTestingModule({ providers: [WfBuilderStore, WfDnd] });
    const store = TestBed.inject(WfBuilderStore);
    store.load({ ...createWorkflow('automation', 'W', 'application'), steps: [{ ...createStep('notify'), id: 's1' } as UiWfStep] });
    const dnd = TestBed.inject(WfDnd);
    // The builder: a toolbar above the scrolling canvas, whose list has been scrolled up under the toolbar.
    const root = document.createElement('div');
    root.innerHTML = `<div class="toolbar">Toolbar</div><div data-wf-scroll><div data-wf-list="root"><div data-wf-item="s1">Step</div></div></div>`;
    document.body.appendChild(root);
    const list = root.querySelector<HTMLElement>('[data-wf-list]')!;
    const item = root.querySelector<HTMLElement>('[data-wf-item]')!;
    const scroller = root.querySelector<HTMLElement>('[data-wf-scroll]')!;
    const box = (top: number, bottom: number) => ({ top, bottom, left: 0, right: 400, width: 400, height: bottom - top, x: 0, y: top, toJSON: () => ({}) }) as DOMRect;
    // The list's box (and its step's) lies at y -200..-100: above the scroller (y 100..600), under the toolbar.
    vi.spyOn(list, 'getBoundingClientRect').mockReturnValue(box(-200, -100));
    vi.spyOn(item, 'getBoundingClientRect').mockReturnValue(box(-190, -130));
    vi.spyOn(scroller, 'getBoundingClientRect').mockReturnValue(box(100, 600));
    dnd.attach(root);
    return { store, dnd, root, item };
  }

  function dragTo(dnd: WfDnd, hit: Element | null, y: number) {
    (document as unknown as { elementFromPoint: (x: number, y: number) => Element | null }).elementFromPoint = () => hit;
    dnd.begin({ kind: 'new', type: 'notify', label: 'Notify', icon: [] as never }, pointer('pointerdown', 20, y) as PointerEvent, { immediate: true });
    window.dispatchEvent(pointer('pointermove', 20, y));
  }

  it('over the toolbar where a scrolled-away list\'s box lies: no target, and letting go adds nothing', () => {
    const { store, dnd, root } = setup();
    dragTo(dnd, root.querySelector('.toolbar'), -150);
    expect(dnd.drop()?.target).toBeNull();
    window.dispatchEvent(pointer('pointerup', 20, -150));
    expect(store.def().steps).toHaveLength(1);
  });

  it('outside the builder altogether: no target', () => {
    const { dnd } = setup();
    const outside = document.createElement('div');
    document.body.appendChild(outside);
    dragTo(dnd, outside, -150);
    expect(dnd.drop()).toEqual({ target: null, valid: false, line: null });
    window.dispatchEvent(pointer('pointerup', 20, -150));
  });

  it('over a list in view: it takes the drop', () => {
    const { store, dnd, item } = setup();
    dragTo(dnd, item, -120);
    expect(dnd.drop()?.target).toEqual({ listId: 'root', index: 1 });
    window.dispatchEvent(pointer('pointerup', 20, -120));
    expect(store.def().steps).toHaveLength(2);
  });
});
