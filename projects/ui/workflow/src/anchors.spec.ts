import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { provideUiStrings, UiTourAnchor, UiTourAnchors, uiStringsDv } from '@zouriel/ui';
import { UiTourService } from '@zouriel/ui/guidance';
import { UiWfApiError, UiWorkflowHttpApi, type UiWfRecord, type UiWfTask, type UiWorkflowApi } from './api';
import { UiWorkflowPanel, type UiWorkflowPanelLayout } from './panel';
import { wfErrorDetail, wfErrorText } from './runtime-shared';
import { UiWorkflowTasksDrawer } from './tasks-drawer';

/** 0.87.0: tour anchors on the workflow components' controls, and no raw error pages. */

const states = [
  { key: 'draft', label: 'Draft', category: 'initial', tone: null },
  { key: 'submitted', label: 'Submitted', category: 'active', tone: null },
  { key: 'done', label: 'Done', category: 'terminal', tone: 'success' },
];
const task: UiWfTask = {
  id: 't1', instanceId: 'i1', kind: 'approval', title: 'Approve the request', instructions: null, definitionKey: 'recruitment', entity: 'application', entityId: '1',
  entityTitle: 'HR-1', status: 'open', assignees: ['u1'], assigneeNames: ['Ali'], rule: null, outcomes: [{ key: 'approved', label: 'Approve' }, { key: 'rejected', label: 'Reject', tone: 'danger' }],
  decisions: [], form: null, requireComment: null, allowDelegation: false, outcome: null, dueAt: new Date(Date.now() + 86400000).toISOString(), overdue: false, escalationLevel: 0,
  createdAt: new Date().toISOString(), completedAt: null, canDecide: true,
};
function record(): UiWfRecord {
  return {
    entity: 'application', id: '1', title: 'A', lifecycle: 'review', lifecycleTitle: 'Review', state: 'draft', stateLabel: 'Draft', stateTone: null, status: 'active',
    stateEnteredAt: new Date().toISOString(), states, instances: [], tasks: [task], manual: [{ key: 'remind', label: 'Send a reminder', form: null }],
    transitions: [{ key: 'submit', label: 'Submit', to: 'submitted', toLabel: 'Submitted', tone: 'primary', confirm: null, form: null }],
    reset: { key: 'restart', label: 'Start over', to: 'draft', toLabel: 'Draft' },
  } as unknown as UiWfRecord;
}
const fakeApi = (): UiWorkflowApi => ({
  record: async () => record(), recordHistory: async () => [], me: async () => ({ can: {} }),
  tasks: async () => ({ items: [task], total: 1 }), instances: async () => ({ items: [], total: 0 }),
}) as unknown as UiWorkflowApi;

@Component({
  imports: [UiWorkflowPanel, UiWorkflowTasksDrawer],
  template: `
    <ui-workflow-panel entity="application" entityId="1" [layout]="layout()" [anchorPrefix]="prefix()" [api]="api" [(open)]="open" />
    <ui-workflow-tasks-drawer [api]="api" [anchorPrefix]="tasksPrefix()" [(open)]="tasksOpen" [refreshSeconds]="0" />
  `,
})
class Host {
  layout = signal<UiWorkflowPanelLayout>('vertical');
  prefix = signal<string | null>('wf');
  tasksPrefix = signal<string | null>('tasks');
  open = signal(false);
  tasksOpen = signal(false);
  api = fakeApi();
}

globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof ResizeObserver;
const realRect = HTMLElement.prototype.getBoundingClientRect;

async function render(layout: UiWorkflowPanelLayout, prefix: string | null = 'wf') {
  const fixture = TestBed.createComponent(Host);
  fixture.componentInstance.layout.set(layout);
  fixture.componentInstance.prefix.set(prefix);
  document.body.appendChild(fixture.nativeElement);
  const settle = async () => {
    for (let i = 0; i < 3; i++) {
      fixture.detectChanges();
      await new Promise((r) => setTimeout(r));
    }
    await fixture.whenStable();
    fixture.detectChanges();
  };
  await settle();
  return { fixture, settle, anchors: TestBed.inject(UiTourAnchors) };
}

describe('workflow tour anchors (anchorPrefix)', () => {
  // jsdom lays nothing out: give every element a box, so an anchor that is rendered counts as on screen.
  beforeEach(() => {
    HTMLElement.prototype.getBoundingClientRect = function () { return new DOMRect(0, 0, 40, 20); };
  });
  afterEach(() => {
    HTMLElement.prototype.getBoundingClientRect = realRect;
    document.body.innerHTML = '';
  });

  it('panel: anchors its move, manual, reset and task buttons in the page layouts', async () => {
    for (const layout of ['vertical', 'horizontal', 'compact'] as const) {
      const { anchors } = await render(layout);
      expect(anchors.find('wf.move.submit')?.textContent?.trim(), layout).toBe('Submit');
      expect(anchors.find('wf.manual.remind')?.textContent?.trim(), layout).toBe('Send a reminder');
      expect(anchors.find('wf.reset')?.textContent?.trim(), layout).toBe('Start over');
      expect(anchors.find('wf.task-entry')?.textContent, layout).toContain('Approve the request');
      expect(anchors.find('wf.open'), layout).toBeNull();
      document.body.innerHTML = '';
    }
  }, 20000);

  it('panel without a prefix registers nothing', async () => {
    const { anchors } = await render('vertical', null);
    expect(anchors.find('wf.move.submit')).toBeNull();
    expect(anchors.find('null.move.submit')).toBeNull();
  });

  it('side drawer: the rail is "open"; a tour asking for a button inside opens the drawer (non-modal) first', async () => {
    const { fixture, anchors, settle } = await render('side-drawer');
    expect(anchors.find('wf.open')?.classList.contains('rail')).toBe(true);
    expect(anchors.find('wf.move.submit')).toBeNull();
    // The rail is already there, and dialogs can't be opened for the person.
    expect(anchors.reveal('wf.open')).toBe(false);
    expect(anchors.reveal('wf.task.approved')).toBe(false);
    expect(anchors.reveal('wf.move.submit')).toBe(true);
    await settle();
    expect(fixture.componentInstance.open()).toBe(true);
    expect(anchors.find('wf.move.submit')?.textContent?.trim()).toBe('Submit');
    // Non-modal: no backdrop over the page, no aria-modal, so the tour's bubble stays on top and usable.
    // (The drawer may move its layer to the body, so look in the whole document.)
    const panel = anchors.find('wf.move.submit')!.closest('[role="dialog"]') as HTMLElement;
    expect(panel).not.toBeNull();
    expect(panel.getAttribute('aria-modal')).toBeNull();
    expect(document.querySelector('.ui-layer .backdrop')).toBeNull();
    // Open already: nothing more to reveal.
    expect(anchors.reveal('wf.move.submit')).toBe(false);
  });

  it('the decide dialog anchors its outcome buttons by outcome key', async () => {
    const { anchors, settle } = await render('vertical');
    (anchors.find('wf.task-entry') as HTMLButtonElement).click();
    await settle();
    expect(anchors.find('wf.task.approved')?.textContent?.trim()).toBe('Approve');
    expect(anchors.find('wf.task.rejected')?.textContent?.trim()).toBe('Reject');
  });

  it('tasks drawer: its button is "open", and a tour asking for the list opens the drawer', async () => {
    const { fixture, anchors, settle } = await render('vertical');
    expect(anchors.find('tasks.open')?.textContent).toContain('My tasks');
    expect(anchors.find('tasks.task-entry')).toBeNull();
    expect(anchors.reveal('tasks.open')).toBe(false);
    expect(anchors.reveal('tasks.task-entry')).toBe(true);
    await settle();
    expect(fixture.componentInstance.tasksOpen()).toBe(true);
    expect(anchors.find('tasks.task-entry')?.textContent).toContain('Approve the request');
  });
});

@Component({
  imports: [UiTourAnchor],
  template: `@if (shown()) { <button id="late" uiTourAnchor="demo.late">Late</button> }<button id="here" uiTourAnchor="demo.here">Here</button>`,
})
class TourHost {
  shown = signal(false);
}

describe('UiTourService and revealers', () => {
  beforeEach(() => {
    HTMLElement.prototype.getBoundingClientRect = function () { return new DOMRect(10, 10, 40, 20); };
    HTMLElement.prototype.scrollIntoView = vi.fn();
  });
  afterEach(() => {
    TestBed.inject(UiTourService).stop();
    HTMLElement.prototype.getBoundingClientRect = realRect;
    document.querySelectorAll('.cdk-overlay-container').forEach((c) => (c.innerHTML = ''));
  });

  it('asks the revealer for a missing anchor, waits for it, and keeps the step', async () => {
    const fixture = TestBed.createComponent(TourHost);
    document.body.appendChild(fixture.nativeElement);
    fixture.detectChanges();
    const anchors = TestBed.inject(UiTourAnchors);
    const asked: string[] = [];
    const off = anchors.registerRevealer('demo.', (id) => {
      asked.push(id);
      fixture.componentInstance.shown.set(true);
      setTimeout(() => fixture.detectChanges());
      return true;
    });
    const tour = TestBed.inject(UiTourService);
    void tour.start({ id: 't', steps: [{ anchor: 'demo.late', text: 'Late one' }, { anchor: 'demo.here', text: 'Here one' }] });
    expect(asked).toEqual(['demo.late']);
    await new Promise((r) => setTimeout(r, 60));
    fixture.detectChanges();
    TestBed.tick();
    expect(tour.active()).toBe('t');
    expect(document.querySelector('ui-tour-panel .text')?.textContent?.trim()).toBe('Late one');
    expect(document.querySelector('ui-tour-panel .count')?.textContent?.trim()).toBe('1 of 2');
    off();
  });

  it('without a revealer a missing step is dropped at once, as before; a removed revealer is not asked', () => {
    const fixture = TestBed.createComponent(TourHost);
    document.body.appendChild(fixture.nativeElement);
    fixture.detectChanges();
    const anchors = TestBed.inject(UiTourAnchors);
    const reveal = vi.fn(() => true);
    anchors.registerRevealer('demo.', reveal)();
    const tour = TestBed.inject(UiTourService);
    void tour.start({ id: 't2', steps: [{ anchor: 'demo.late', text: 'Late one' }, { anchor: 'demo.here', text: 'Here one' }] });
    expect(reveal).not.toHaveBeenCalled();
    fixture.detectChanges();
    TestBed.tick();
    expect(tour.active()).toBe('t2');
    expect(document.querySelector('ui-tour-panel .text')?.textContent?.trim()).toBe('Here one');
    expect(document.querySelector('ui-tour-panel .count')?.textContent?.trim()).toBe('1 of 1');
  });
});

describe('workflow errors from something that is not the engine', () => {
  const laravel404 = JSON.stringify({ message: 'The route api/workflows/records/application/1 could not be found.' });
  const html404 = '<!doctype html><html><head><style>body{}</style></head><body><h1>404 Not Found</h1><p>nginx</p></body></html>';
  function http(status: number, body: string, contentType = 'application/json'): UiWorkflowApi {
    return new UiWorkflowHttpApi({ baseUrl: '/api/workflows', fetch: async () => new Response(body, { status, headers: { 'Content-Type': contentType } }) });
  }
  async function caught(p: Promise<unknown>): Promise<UiWfApiError> {
    try { await p; } catch (e) { return e as UiWfApiError; }
    throw new Error('no error');
  }

  it('a missing route (Laravel 404 JSON) or an HTML error page becomes "unreachable", with the technical detail kept apart', async () => {
    const a = await caught(http(404, laravel404).record('application', '1'));
    expect(a.code).toBe('unreachable');
    expect(a.status).toBe(404);
    expect(wfErrorText(a, 'x')).toBe("Workflows aren't available right now. Try again later.");
    expect(wfErrorDetail(a)).toBe('GET /records/application/1: HTTP 404 - The route api/workflows/records/application/1 could not be found.');
    const b = await caught(http(502, html404, 'text/html').record('application', '1'));
    expect(b.code).toBe('unreachable');
    expect(wfErrorDetail(b)).toBe('GET /records/application/1: HTTP 502 - 404 Not Found nginx');
    const c = await caught(new UiWorkflowHttpApi({ baseUrl: '/w', fetch: async () => { throw new TypeError('Failed to fetch'); } }).tasks({}));
    expect(c.code).toBe('unreachable');
    expect(c.status).toBe(0);
    expect(wfErrorDetail(c)).toContain('Failed to fetch');
  });

  it('the engine’s own refusals (a code) and 401/403 keep their messages', async () => {
    const own = await caught(http(404, JSON.stringify({ code: 'notFound', message: 'No such record.' })).record('application', '1'));
    expect(own.code).toBe('notFound');
    expect(wfErrorText(own, 'x')).toBe('No such record.');
    expect(wfErrorDetail(own)).toBeNull();
    const forbidden = await caught(http(403, '').record('application', '1'));
    expect(forbidden.code).toBe('http403');
    expect(wfErrorText(forbidden, 'x')).toBe('You are not allowed to do that.');
  });

  @Component({
    imports: [UiWorkflowPanel],
    template: `<ui-workflow-panel entity="application" entityId="1" [api]="api" />`,
  })
  class ErrorHost {
    api = http(404, laravel404);
  }

  async function renderError() {
    const fixture = TestBed.createComponent(ErrorHost);
    for (let i = 0; i < 4; i++) {
      fixture.detectChanges();
      await new Promise((r) => setTimeout(r));
    }
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('the panel says so plainly; the raw text is only inside a closed "Technical details"', async () => {
    const el = await renderError();
    const note = el.querySelector('ui-wf-error') as HTMLElement;
    expect(note.querySelector('[role="alert"] > span')?.textContent).toBe("Workflows aren't available right now. Try again later.");
    const details = note.querySelector('details') as HTMLDetailsElement;
    expect(details.open).toBe(false);
    expect(details.querySelector('summary')?.textContent?.trim()).toBe('Technical details');
    expect(details.querySelector('code')?.textContent).toContain('could not be found');
    // Nothing raw outside the disclosure.
    const outside = [...note.querySelectorAll('[role="alert"] > span')].map((s) => s.textContent).join(' ');
    expect(outside).not.toContain('could not be found');
  });

  it('in Dhivehi with the Dhivehi strings', async () => {
    TestBed.configureTestingModule({ providers: [provideUiStrings(uiStringsDv)] });
    const el = await renderError();
    expect(el.querySelector('ui-wf-error [role="alert"] > span')?.textContent).toBe(uiStringsDv.workflowUnavailable);
    expect(el.querySelector('ui-wf-error summary')?.textContent?.trim()).toBe(uiStringsDv.technicalDetails);
  });
});
