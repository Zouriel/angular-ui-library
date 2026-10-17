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
  const scopes: (string | undefined)[] = [];
  const api = {
    tasks: async (q: { take?: number; scope?: string }) => { calls++; scopes.push(q.scope); return { items: tasks.slice(0, q.take ?? tasks.length), total }; },
  } as unknown as UiWorkflowApi;
  return { api, calls: () => calls, scopes };
}

async function render(tasks: UiWfTask[], inputs: Record<string, unknown> = {}, total = tasks.length) {
  const { api, calls, scopes } = fakeApi(tasks, total);
  const f = TestBed.createComponent(UiWorkflowTasksDrawer);
  f.componentRef.setInput('api', api);
  f.componentRef.setInput('refreshSeconds', 0);
  for (const [k, v] of Object.entries(inputs)) f.componentRef.setInput(k, v);
  document.body.appendChild(f.nativeElement);
  f.detectChanges();
  for (let i = 0; i < 4; i++) { await f.whenStable(); f.detectChanges(); }
  return { f, el: f.nativeElement as HTMLElement, calls, scopes };
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
    expect(document.querySelector('ui-wf-task-inbox')).not.toBeNull();
    expect(calls()).toBeGreaterThan(before);
  });

  it('with scope "all" counts and lists everyone\'s tasks (an admin\'s drawer)', async () => {
    const { f, scopes } = await render([task('a')], { scope: 'all', label: 'All tasks' });
    f.componentInstance.open.set(true);
    for (let i = 0; i < 4; i++) { await f.whenStable(); f.detectChanges(); }
    expect(scopes.length).toBeGreaterThan(1);
    expect(new Set(scopes)).toEqual(new Set(['all']));
    expect(document.body.textContent).toContain('All tasks');
  });

  it('counts again when the scope changes', async () => {
    const { f, scopes } = await render([task('a')]);
    f.componentRef.setInput('scope', 'all');
    for (let i = 0; i < 3; i++) { await f.whenStable(); f.detectChanges(); }
    expect(scopes.at(-1)).toBe('all');
  });

  it('can be opened from code without its button', async () => {
    const { f, el } = await render([task('a')], { showButton: false });
    expect(el.querySelector('ui-button')).toBeNull();
    f.componentInstance.open.set(true);
    for (let i = 0; i < 4; i++) { await f.whenStable(); f.detectChanges(); }
    expect(document.querySelector('ui-wf-task-inbox')).not.toBeNull();
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

  describe('stopped workflows', () => {
    const stuck = { id: 's1', title: 'Pay approved scholarships', entityTitle: 'Bursary – Ali', status: 'incident', error: 'Bank API: 503', kind: 'automation' };
    async function renderAs(intervene: boolean) {
      const f = TestBed.createComponent(UiWorkflowTasksDrawer);
      const asked: unknown[] = [];
      f.componentRef.setInput('api', {
        tasks: async () => ({ items: [task('a')], total: 1 }),
        me: async () => ({ can: { intervene } }),
        instances: async (q: unknown) => { asked.push(q); return { items: [stuck], total: 1 }; },
        instance: async () => ({ ...stuck, steps: [], tokens: [], startedAt: new Date().toISOString() }),
        instanceDefinition: async () => ({ specVersion: 1, id: 'd', key: 'k', kind: 'automation', title: 'W', steps: [] }),
      } as unknown as UiWorkflowApi);
      f.componentRef.setInput('refreshSeconds', 0);
      document.body.appendChild(f.nativeElement);
      f.detectChanges();
      for (let i = 0; i < 5; i++) { await new Promise((r) => setTimeout(r)); await f.whenStable(); f.detectChanges(); }
      return { f, el: f.nativeElement as HTMLElement, asked };
    }

    it('for people who may intervene: counted in the badge (red) and listed above the tasks, each opening its run', async () => {
      const { f, el, asked } = await renderAs(true);
      expect(asked).toEqual([{ status: ['incident'], take: 100 }]);
      expect(el.querySelector('ui-badge')?.textContent?.trim()).toBe('2');
      // Red: a stopped workflow needs attention even when no task is overdue.
      expect(el.querySelector('ui-badge .ui-badge')?.getAttribute('data-tone')).toBe('danger');
      expect(el.querySelector('.wf-sr')?.textContent).toContain('1 stopped workflow');
      f.componentInstance.open.set(true);
      for (let i = 0; i < 4; i++) { await new Promise((r) => setTimeout(r)); await f.whenStable(); f.detectChanges(); }
      expect(document.body.textContent).toContain('Stopped workflows');
      (document.querySelector('.stop') as HTMLButtonElement).click();
      for (let i = 0; i < 4; i++) { await new Promise((r) => setTimeout(r)); await f.whenStable(); f.detectChanges(); }
      expect(document.querySelector('ui-wf-run-view')).not.toBeNull();
      expect(document.querySelector('ui-wf-task-inbox')).toBeNull();
    });

    it('a closed drawer opens on the list again, not on the run that was open', async () => {
      const { f } = await renderAs(true);
      f.componentInstance.open.set(true);
      for (let i = 0; i < 4; i++) { await new Promise((r) => setTimeout(r)); await f.whenStable(); f.detectChanges(); }
      (document.querySelector('.stop') as HTMLButtonElement).click();
      for (let i = 0; i < 3; i++) { await new Promise((r) => setTimeout(r)); await f.whenStable(); f.detectChanges(); }
      expect(document.querySelector('ui-wf-run-view')).not.toBeNull();
      f.componentInstance.open.set(false);
      for (let i = 0; i < 3; i++) { await new Promise((r) => setTimeout(r)); await f.whenStable(); f.detectChanges(); }
      f.componentInstance.open.set(true);
      for (let i = 0; i < 3; i++) { await new Promise((r) => setTimeout(r)); await f.whenStable(); f.detectChanges(); }
      expect(document.querySelector('ui-wf-run-view')).toBeNull();
      expect(document.querySelector('ui-wf-task-inbox')).not.toBeNull();
    });

    it('asks again whether this person may intervene after a failed answer', async () => {
      let fail = true;
      const asked: unknown[] = [];
      const f = TestBed.createComponent(UiWorkflowTasksDrawer);
      f.componentRef.setInput('api', {
        tasks: async () => ({ items: [], total: 0 }),
        me: async () => { if (fail) throw new Error('offline'); return { can: { intervene: true } }; },
        instances: async (q: unknown) => { asked.push(q); return { items: [stuck], total: 1 }; },
      } as unknown as UiWorkflowApi);
      f.componentRef.setInput('refreshSeconds', 0);
      f.detectChanges();
      for (let i = 0; i < 3; i++) { await new Promise((r) => setTimeout(r)); await f.whenStable(); f.detectChanges(); }
      expect(asked).toEqual([]);
      fail = false;
      await f.componentInstance.refresh();
      expect(asked).toHaveLength(1);
    });

    it('lists record instances and lifecycle child runs too, named "<lifecycle> · <record>", a record opening with Try again and Skip', async () => {
      const error = 'A timer (auto:tx) failed 10 times and was stopped: InvalidOperationException: The database refused writing application.status.';
      const rec = { id: 'ri1', title: 'Expiry', kind: 'record', entity: 'application', entityId: 'a1', entityTitle: 'Grant a1', status: 'incident', error, state: 'draft', stateLabel: 'Draft' };
      const child = { id: 'cr1', title: 'Review', kind: 'run', parentId: 'x', entity: 'application', entityId: 'a2', entityTitle: null, status: 'incident', error: 'A timer (reminder) failed 10 times and was stopped: mail down' };
      const f = TestBed.createComponent(UiWorkflowTasksDrawer);
      f.componentRef.setInput('api', {
        tasks: async () => ({ items: [], total: 0 }),
        me: async () => ({ can: { intervene: true } }),
        instances: async () => ({ items: [rec, child], total: 2 }),
        instance: async () => ({ ...rec, steps: [], tokens: [], startedAt: new Date().toISOString() }),
        instanceDefinition: async () => ({ specVersion: 1, id: 'd', key: 'expiry', kind: 'lifecycle', title: 'Expiry', lifecycle: { field: 'status', states: [], transitions: [] } }),
      } as unknown as UiWorkflowApi);
      f.componentRef.setInput('refreshSeconds', 0);
      document.body.appendChild(f.nativeElement);
      f.detectChanges();
      for (let i = 0; i < 5; i++) { await new Promise((r) => setTimeout(r)); await f.whenStable(); f.detectChanges(); }
      f.componentInstance.open.set(true);
      for (let i = 0; i < 4; i++) { await new Promise((r) => setTimeout(r)); await f.whenStable(); f.detectChanges(); }
      const items = [...document.querySelectorAll('.stop')] as HTMLButtonElement[];
      expect(items.map((b) => b.querySelector('.st')?.textContent?.trim())).toEqual(['Expiry · Grant a1', 'Review · a2']);
      expect(items[0].querySelector('.se')?.textContent?.trim()).toBe('An automatic move failed 10 times and was stopped: The database refused writing application.status.');
      items[0].click();
      for (let i = 0; i < 5; i++) { await new Promise((r) => setTimeout(r)); await f.whenStable(); f.detectChanges(); }
      const view = document.querySelector('ui-wf-run-view')!;
      expect([...view.querySelectorAll('ui-button')].map((b) => b.textContent?.trim())).toEqual(['Try again', 'Skip']);
      expect(view.querySelector('.steps')).toBeNull();
    });

    it('not for people who may not: nothing asked, nothing counted', async () => {
      const { el, asked } = await renderAs(false);
      expect(asked).toEqual([]);
      expect(el.querySelector('ui-badge')?.textContent?.trim()).toBe('1');
      expect(el.querySelector('ui-badge .ui-badge')?.getAttribute('data-tone')).toBe('primary');
    });
  });
});
