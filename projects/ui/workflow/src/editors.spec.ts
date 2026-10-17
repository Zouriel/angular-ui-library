import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import type { UiWfUser, UiWorkflowApi } from './api';
import { WfAssigneesEditor } from './editors';

/** Lets a test hold an API call open and finish it later. */
function deferred<T>() {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

describe('WfAssigneesEditor people search', () => {
  async function render(searchUsers: (q: string) => Promise<UiWfUser[]>) {
    const f = TestBed.createComponent(WfAssigneesEditor);
    f.componentRef.setInput('api', { searchUsers, user: async () => null } as unknown as UiWorkflowApi);
    f.detectChanges();
    const cmp = f.componentInstance as unknown as { search(q: string): void; results(): UiWfUser[] };
    const settle = async () => { for (let i = 0; i < 3; i++) { await new Promise((r) => setTimeout(r)); f.detectChanges(); } };
    return { cmp, settle };
  }

  it('an older search failing after a newer one answered keeps the newer results', async () => {
    const older = deferred<UiWfUser[]>();
    const newer = deferred<UiWfUser[]>();
    const { cmp, settle } = await render((q) => (q === 'sa' ? older.promise : newer.promise));
    cmp.search('sa');
    cmp.search('sam');
    newer.resolve([{ id: 'sam', name: 'Sam' } as UiWfUser]);
    await settle();
    older.reject(new Error('offline'));
    await settle();
    expect(cmp.results().map((u) => u.id)).toEqual(['sam']);
  });

  it('the newest search failing clears the results', async () => {
    let fail = false;
    const { cmp, settle } = await render(async () => { if (fail) throw new Error('offline'); return [{ id: 'sam', name: 'Sam' } as UiWfUser]; });
    cmp.search('sam');
    await settle();
    expect(cmp.results()).toHaveLength(1);
    fail = true;
    cmp.search('samu');
    await settle();
    expect(cmp.results()).toEqual([]);
  });
});
