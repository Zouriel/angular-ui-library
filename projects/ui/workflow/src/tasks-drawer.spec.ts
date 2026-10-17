import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it } from 'vitest';
import type { UiWfTask, UiWorkflowApi } from './api';
import { UiWorkflowTasksDrawer } from './tasks-drawer';

function task(id: string, overdue = false): UiWfTask {
  return {
    id, instanceId: 'i', kind: 'approval', title: `Task ${id}`, instructions: null, definitionKey: 'k', entity: null, entityId: null, entityTitle: null,
    status: 'open', assignees: ['u'], assigneeNames: ['U'], rule: null, outcomes: [], decisions: [], form: null, requireComment: null, allowDelegation: false,
    outcome: null, dueAt: new Date(Date.now() + 86_400_000).toISOString(), overdue, escalationLevel: 0, createdAt: new Date().toISOString(), completedAt: null, canDecide: true,
  } as unknown as UiWfTask;
}

function fakeApi(tasks: UiWfTask[]) {
  let calls = 0;
  const api = {
    tasks: async () => { calls++; return { items: tasks, total: tasks.length }; },
  } as unknown as UiWorkflowApi;
  return { api, calls: () => calls };
}

async function render(tasks: UiWfTask[], inputs: Record<string, unknown> = {}) {
  const { api, calls } = fakeApi(tasks);
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
  afterEach(() => document.querySelectorAll('.cdk-overlay-container').forEach((c) => (c.innerHTML = '')));

  it('shows how many tasks are open, and tells screen readers', async () => {
    const { el } = await render([task('a'), task('b')]);
    expect(el.querySelector('ui-badge')?.textContent?.trim()).toBe('2');
    expect(el.querySelector('ui-badge')?.getAttribute('ng-reflect-tone') ?? el.querySelector('.ui-badge')?.getAttribute('data-tone')).toBe('primary');
    expect(el.querySelector('.sr-only')?.textContent).toBe(', 2 open');
  });

  it('turns red when a task is overdue', async () => {
    const { el } = await render([task('a', true), task('b')]);
    expect(el.querySelector('.ui-badge')?.getAttribute('data-tone')).toBe('danger');
    expect(el.querySelector('.sr-only')?.textContent).toBe(', 2 open, 1 overdue');
  });

  it('has no badge when nothing is open', async () => {
    const { el } = await render([]);
    expect(el.querySelector('ui-badge')).toBeNull();
    expect(el.querySelector('.sr-only')?.textContent).toBe(', none open');
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
});
