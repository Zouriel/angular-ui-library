import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { UiWfTask, UiWorkflowApi } from './api';
import { UiWorkflowTasksDrawer } from './tasks-drawer';

function task(id: string, overdue = false): UiWfTask {
  return {
    id, instanceId: 'i', kind: 'approval', title: `Task ${id}`, instructions: null, definitionKey: 'k', entity: null, entityId: null, entityTitle: null,
    status: 'open', assignees: ['u'], assigneeNames: ['U'], rule: null, outcomes: [], decisions: [], form: null, requireComment: null, allowDelegation: false,
    outcome: null, dueAt: new Date(Date.now() + 86_400_000).toISOString(), overdue, escalationLevel: 0, createdAt: new Date().toISOString(), completedAt: null, canDecide: true,
  } as unknown as UiWfTask;
}

function fakeApi(tasks: UiWfTask[], total = tasks.length) {
  let calls = 0;
  const api = {
    tasks: async (q: { take?: number }) => { calls++; return { items: tasks.slice(0, q.take ?? tasks.length), total }; },
  } as unknown as UiWorkflowApi;
  return { api, calls: () => calls };
}

async function render(tasks: UiWfTask[], inputs: Record<string, unknown> = {}, total = tasks.length) {
  const { api, calls } = fakeApi(tasks, total);
  const f = TestBed.createComponent(UiWorkflowTasksDrawer);
  f.componentRef.setInput('api', api);
  f.componentRef.setInput('refreshSeconds', 0);
  for (const [k, v] of Object.entries(inputs)) f.componentRef.setInput(k, v);
  document.body.appendChild(f.nativeElement);
  f.detectChanges();
  for (let i = 0; i < 4; i++) { await f.whenStable(); f.detectChanges(); }
  return { f, el: f.nativeElement as HTMLElement, calls };
}

describe('UiWorkflowTasksDrawer', () => {
  afterEach(() => {
    document.querySelectorAll('.cdk-overlay-container').forEach((c) => (c.innerHTML = ''));
    vi.restoreAllMocks();
  });

  it('shows how many tasks are open, and tells screen readers', async () => {
    const { el } = await render([task('a'), task('b')]);
    expect(el.querySelector('ui-badge')?.textContent?.trim()).toBe('2');
    expect(el.querySelector('ui-badge')?.getAttribute('ng-reflect-tone') ?? el.querySelector('.ui-badge')?.getAttribute('data-tone')).toBe('primary');
    expect(el.querySelector('.wf-sr')?.textContent).toBe(', 2 open');
  });

  it('turns red when a task is overdue', async () => {
    const { el } = await render([task('a', true), task('b')]);
    expect(el.querySelector('.ui-badge')?.getAttribute('data-tone')).toBe('danger');
    expect(el.querySelector('.wf-sr')?.textContent).toBe(', 2 open, 1 overdue');
  });

  it('has no badge when nothing is open', async () => {
    const { el } = await render([]);
    expect(el.querySelector('ui-badge')).toBeNull();
    expect(el.querySelector('.wf-sr')?.textContent).toBe(', none open');
  });

  it('opens from its button, and counts again when it opens', async () => {
    const { f, el, calls } = await render([task('a')]);
    const before = calls();
    el.querySelector<HTMLButtonElement>('ui-button button')!.click();
    for (let i = 0; i < 4; i++) { await f.whenStable(); f.detectChanges(); }
    expect(f.componentInstance.open()).toBe(true);
    expect(document.querySelector('ui-workflow-tasks')).not.toBeNull();
    expect(calls()).toBeGreaterThan(before);
  });

  it('can be opened from code without its button', async () => {
    const { f, el } = await render([task('a')], { showButton: false });
    expect(el.querySelector('ui-button')).toBeNull();
    f.componentInstance.open.set(true);
    for (let i = 0; i < 4; i++) { await f.whenStable(); f.detectChanges(); }
    expect(document.querySelector('ui-workflow-tasks')).not.toBeNull();
  });

  it('says "100+" overdue when more tasks are open than one count looks at', async () => {
    const many = Array.from({ length: 100 }, (_, i) => task(`t${i}`, true));
    const { el } = await render(many, {}, 250);
    expect(el.querySelector('.wf-sr')?.textContent).toBe(', 250 open, 100+ overdue');
    expect(el.querySelector('ui-badge')?.textContent?.trim()).toBe('99+');
  });

  it('uses the shared screen-reader class and adds no spacing of its own to the button', async () => {
    const { el } = await render([task('a')]);
    expect(el.querySelector('.sr-only')).toBeNull();
    const css = [...document.querySelectorAll('style')].map((x) => x.textContent ?? '').join('\n');
    expect(css).not.toMatch(/hugeicons-icon\[[^\]]*\]\s*\{\s*margin/);
    expect(css).not.toMatch(/\.count\[[^\]]*\]\s*\{\s*margin/);
  });

  it('pauses polling while the page is hidden and counts again when it is shown', async () => {
    let state: DocumentVisibilityState = 'visible';
    vi.spyOn(document, 'visibilityState', 'get').mockImplementation(() => state);
    const set = vi.spyOn(globalThis, 'setInterval');
    const clear = vi.spyOn(globalThis, 'clearInterval');
    // Only the drawer's own 60s timers (the test runner sets others).
    const polls = () => set.mock.calls.map((c, i) => [c[1], set.mock.results[i].value]).filter(([ms]) => ms === 60_000).map(([, id]) => id);
    const { f, calls } = await render([task('a')], { refreshSeconds: 60 });
    await f.whenStable(); f.detectChanges();
    expect(polls()).toHaveLength(1);
    const timer = polls()[0];
    state = 'hidden';
    document.dispatchEvent(new Event('visibilitychange'));
    await f.whenStable(); f.detectChanges();
    expect(clear).toHaveBeenCalledWith(timer);
    expect(polls()).toHaveLength(1); // no new timer while hidden
    const before = calls();
    state = 'visible';
    document.dispatchEvent(new Event('visibilitychange'));
    await f.whenStable(); f.detectChanges();
    expect(calls()).toBeGreaterThan(before);
    expect(polls()).toHaveLength(2);
  });

  it('stops polling and listening when destroyed', async () => {
    const set = vi.spyOn(globalThis, 'setInterval');
    const clear = vi.spyOn(globalThis, 'clearInterval');
    const off = vi.spyOn(document, 'removeEventListener');
    const { f } = await render([task('a')], { refreshSeconds: 60 });
    await f.whenStable(); f.detectChanges();
    const i = set.mock.calls.map((c) => c[1]).lastIndexOf(60_000);
    const timer = set.mock.results[i].value;
    f.destroy();
    expect(clear).toHaveBeenCalledWith(timer);
    expect(off).toHaveBeenCalledWith('visibilitychange', expect.any(Function));
  });
});
