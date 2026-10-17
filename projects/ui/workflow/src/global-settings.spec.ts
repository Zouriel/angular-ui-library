import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { UiWfApiError, type UiWorkflowApi } from './api';
import { UiWorkflowGlobalSettings, wfSettingsProblemField } from './global-settings';
import type { UiWorkflowSettings } from './schema';

type Conn = NonNullable<NonNullable<UiWorkflowSettings['webhooks']>['connections']>[number];
interface Inside {
  s(): UiWorkflowSettings;
  addConnection(): void;
  patchConnection(i: number, p: Record<string, unknown>): void;
  removeConnection(i: number): void;
  isSaved(key: string): boolean;
  dirty(): boolean;
  status(): string;
  error(): string;
}

const erp: Conn = { key: 'erp', label: 'ERP', baseUrl: 'https://erp.example.com', auth: 'none' };

async function render(settings: UiWorkflowSettings, save?: (s: UiWorkflowSettings, rev: number) => Promise<{ revision: number }>) {
  const saved: [UiWorkflowSettings, number][] = [];
  const f = TestBed.createComponent(UiWorkflowGlobalSettings);
  f.componentRef.setInput('api', {
    settings: async () => ({ settings, revision: 7 }),
    schema: async () => ({ registry: { entities: [] }, steps: [] }),
    triggers: async () => [],
    saveSettings: save ?? (async (s: UiWorkflowSettings, rev: number) => { saved.push([s, rev]); return { revision: rev + 1 }; }),
  } as unknown as UiWorkflowApi);
  f.detectChanges();
  for (let i = 0; i < 3; i++) { await new Promise((r) => setTimeout(r)); f.detectChanges(); await f.whenStable(); }
  return { f, c: f.componentInstance as unknown as Inside, saved };
}
const keys = (c: Inside) => (c.s().webhooks?.connections ?? []).map((x) => x.key);

describe('UiWorkflowGlobalSettings connections', () => {
  it('renaming a saved connection keeps its key, so webhook steps using it keep working', async () => {
    const { c } = await render({ version: 1, webhooks: { connections: [erp] } });
    expect(c.isSaved('erp')).toBe(true);
    c.patchConnection(0, { label: 'Finance ERP' });
    expect(c.s().webhooks?.connections?.[0]).toMatchObject({ key: 'erp', label: 'Finance ERP' });
  });

  it('a new connection is keyed after its name, and two with the same name get different keys', async () => {
    const { c } = await render({ version: 1 });
    c.addConnection();
    c.addConnection();
    c.patchConnection(0, { label: 'Bank API' });
    c.patchConnection(1, { label: 'Bank API' });
    expect(keys(c)).toEqual(['bankApi', 'bankApi2']);
  });

  it('adding after a delete never reuses a key on the page or a saved one', async () => {
    const { c } = await render({ version: 1, webhooks: { connections: [{ ...erp, key: 'connection2', label: 'Connection 2' }] } });
    c.addConnection(); // Connection 3
    c.removeConnection(0); // the saved one, whose key steps may still use
    c.addConnection();
    expect(new Set(keys(c)).size).toBe(keys(c).length);
    expect(keys(c)).not.toContain('connection2');
  });

  it('shows the key read-only, and says a saved one stays', async () => {
    const { f, c } = await render({ version: 1, webhooks: { connections: [erp] } });
    (f.componentInstance as unknown as { section: { set(v: string): void } }).section.set('webhooks');
    c.addConnection();
    f.detectChanges();
    const shown = [...(f.nativeElement as HTMLElement).querySelectorAll('.conn .key')].map((k) => k.textContent?.replace(/\s+/g, ' ').trim());
    expect(shown[0]).toContain('Key erp');
    expect(shown[0]).toContain('stays when the name changes');
    expect(shown[1]).toContain('Key connection2');
    expect(shown[1]).not.toContain('stays');
  });
});

describe('UiWorkflowGlobalSettings save', () => {
  it('saves with the revision it loaded, then the new revision; a new connection\'s key is fixed from then on', async () => {
    const { c, saved } = await render({ version: 1 });
    c.addConnection();
    c.patchConnection(0, { label: 'Bank' });
    await (c as unknown as { save(): Promise<void> }).save();
    expect(saved[0][1]).toBe(7);
    expect(c.dirty()).toBe(false);
    expect(c.status()).toBe('Saved.');
    c.patchConnection(0, { label: 'Bank of Maldives' });
    expect(keys(c)).toEqual(['bank']);
    await (c as unknown as { save(): Promise<void> }).save();
    expect(saved[1][1]).toBe(8);
  });

  it('keeps the edits and says why when saving fails', async () => {
    const { c } = await render({ version: 1 }, async () => { throw new UiWfApiError(409, 'revisionConflict', 'Someone else saved the settings.'); });
    c.addConnection();
    await (c as unknown as { save(): Promise<void> }).save();
    expect(c.error()).toBe('Someone else saved the settings.');
    expect(c.dirty()).toBe(true);
  });
});

describe('UiWorkflowGlobalSettings fields the engine removed', () => {
  it('has no "tasks are due" default; the reminder is counted from when the task opens', async () => {
    const { f } = await render({ version: 1 });
    (f.componentInstance as unknown as { section: { set(v: string): void } }).section.set('defaults');
    f.detectChanges();
    const text = (f.nativeElement as HTMLElement).textContent ?? '';
    expect(text).not.toContain('Tasks are due within');
    expect(text).toContain('Remind people of an open task after');
  });

  it('does not send back taskDue, escalationDefault or a channel sender kept from older settings', async () => {
    const old = { version: 1, defaults: { taskDue: 'P3D', forEachMax: 50 }, people: { delegation: true, escalationDefault: [{ role: 'head' }] },
      channels: { email: { enabled: true, sender: 'noreply@x', footer: 'Bye' } } } as unknown as UiWorkflowSettings;
    const { c, saved } = await render(old);
    c.addConnection();
    await (c as unknown as { save(): Promise<void> }).save();
    const sent = saved[0][0] as unknown as Record<string, Record<string, unknown>>;
    expect(sent['defaults']).toEqual({ forEachMax: 50 });
    expect(sent['people']).toEqual({ delegation: true });
    expect(sent['channels']).toEqual({ email: { enabled: true, footer: 'Bye' } });
  });
});

describe('UiWorkflowGlobalSettings refused saves (invalidSettings)', () => {
  // The .NET engine's wording (GlobalSettings.Problems), sent as the error's details.
  const problems = [
    "Unknown time zone 'Mars/Olympus'.",
    'Working hours must end after they start.',
    "'P1X' is not a duration.",
    "Connection 'erp' needs an http(s) address.",
    'Something new the page does not know.',
  ];
  const refuse = async () => { throw new UiWfApiError(400, 'invalidSettings', problems.join(' '), problems); };
  const bad: UiWorkflowSettings = { version: 1, timeZone: 'Mars/Olympus', calendar: { hours: ['17:00', '09:00'] }, defaults: { reminders: ['P1X'] },
    webhooks: { connections: [{ key: 'x', label: 'X', baseUrl: 'https://x.example.com' }, { ...erp, baseUrl: 'ftp://erp' }] } };
  const show = (f: { componentInstance: unknown; detectChanges(): void }, section: string) => {
    (f.componentInstance as { section: { set(v: string): void } }).section.set(section);
    f.detectChanges();
  };
  const errors = (el: HTMLElement) => [...el.querySelectorAll('.body .wf-error')].map((e) => e.textContent?.trim());

  it('places each problem next to its field, marks the sections, and says the rest in the footer', async () => {
    const { f, c } = await render(bad, refuse);
    await (c as unknown as { save(): Promise<void> }).save();
    f.detectChanges();
    const el = f.nativeElement as HTMLElement;
    expect(c.error()).toBe('4 settings need fixing before saving (marked in the sections). Something new the page does not know.');
    expect(el.querySelector('.foot .wf-error')?.textContent).toContain('Something new the page does not know.');
    const marked = [...el.querySelectorAll('.nav button')].filter((b) => b.querySelector('.bad')).map((b) => b.textContent?.trim());
    expect(marked).toEqual(['Time & calendar', 'Defaults', 'Webhooks']);
    show(f, 'time');
    expect(errors(el)).toEqual(["Unknown time zone 'Mars/Olympus'.", 'Working hours must end after they start.']);
    show(f, 'defaults');
    expect(errors(el)).toEqual(["'P1X' is not a duration."]);
    show(f, 'webhooks');
    const cards = [...el.querySelectorAll('.conn')];
    expect(cards[0].querySelector('.wf-error')).toBeNull();
    expect(cards[1].querySelector('.wf-error')?.textContent?.trim()).toBe("Connection 'erp' needs an http(s) address.");
  });

  it('a problem stops showing once its field is changed', async () => {
    const { f, c } = await render(bad, refuse);
    await (c as unknown as { save(): Promise<void> }).save();
    show(f, 'time');
    expect(errors(f.nativeElement)).toContain('Working hours must end after they start.');
    (c as unknown as { patch(p: object): void }).patch({ calendar: { hours: ['09:00', '17:00'] } });
    f.detectChanges();
    expect(errors(f.nativeElement)).not.toContain('Working hours must end after they start.');
  });

  it('other refusals still show the engine\'s message alone', async () => {
    const { c } = await render({ version: 1 }, async () => { throw new UiWfApiError(409, 'staleSettings', 'Someone else changed the settings. Reload and try again.'); });
    c.addConnection();
    await (c as unknown as { save(): Promise<void> }).save();
    expect(c.error()).toBe('Someone else changed the settings. Reload and try again.');
  });
});

describe('wfSettingsProblemField', () => {
  const st: UiWorkflowSettings = { version: 1, defaults: { reminders: ['P1D', 'bad'], retry: { max: 3, initial: 'soon' } }, webhooks: { connections: [erp] } };
  it.each([
    ["Unknown time zone 'X'.", 'timeZone'],
    ["'funday' is not a day; use mon, tue, wed, thu, fri, sat or sun.", 'days'],
    ['A working day is listed twice.', 'days'],
    ['Working hours are a start and an end time.', 'hours'],
    ['Working hours must be times like 09:00 and 17:00 (HH:mm).', 'hours'],
    ["'2026-02-30' is not a date (YYYY-MM-DD).", 'holidays'],
    ['Retries can be 0 to 10.', 'retry'],
    ["'slow' is not a way to space retries (fixed or exponential).", 'retry'],
    ["'soon' is not a duration.", 'retry'],
    ["'bad' is not a duration.", 'reminders'],
    ["'x' is not a concurrency mode (perRecordSerial, parallel or skipIfRunning).", 'concurrency'],
    ['The loop protection limit (maxChainDepth) must be 1 to 20.', 'maxChainDepth'],
    ["The most items a 'for each' covers (forEachMax) must be 1 to 500.", 'forEachMax'],
    ["'https://a.example.com/x' is not an origin like https://api.example.com (scheme and host only).", 'origins'],
    ["Connection key 'erp' must start with a lower-case letter and use letters, digits and _.", 'conn:0'],
    ["Two connections are called 'erp'.", 'conn:0'],
    ["Connection 'erp' uses a secret but names none.", 'conn:0'],
    ["Connection 'gone' needs an http(s) address.", 'connections'],
    ["Audit entries of 'step' must be kept at least 1 day.", 'retention'],
    ["'nodot' is not a masked field like entity.field or input.key.", 'masked'],
    ['A paused entry names no record type.', 'paused'],
    ['Anything else.', 'general'],
  ])('%s → %s', (message, field) => {
    expect(wfSettingsProblemField(message, st)).toBe(field);
  });
});
