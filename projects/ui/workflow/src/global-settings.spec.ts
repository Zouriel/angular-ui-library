import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { UiWfApiError, type UiWorkflowApi } from './api';
import { UiWorkflowGlobalSettings } from './global-settings';
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
