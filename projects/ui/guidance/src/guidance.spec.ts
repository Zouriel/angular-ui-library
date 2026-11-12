import { describe, expect, it } from 'vitest';
import { UiGuidance, UiMemoryGuidanceStore, type UiGuidanceStore, type UiTourOutcome } from './guidance';

/** A store whose every answer is a promise, as a server-backed one would be. */
class AsyncStore implements UiGuidanceStore {
  readonly mem = new UiMemoryGuidanceStore();
  readonly calls: string[] = [];
  async tipsOn() { return this.mem.tipsOn(); }
  async seen(id: string) { return this.mem.seen(id); }
  async markSeen(ids: readonly string[]) { this.calls.push(`seen:${ids.join(',')}`); this.mem.markSeen(ids); }
  async setTipsOn(on: boolean) { this.calls.push(`tips:${on}`); this.mem.setTipsOn(on); }
  async reset() { this.calls.push('reset'); this.mem.reset(); }
}

const shown = (o: UiTourOutcome = 'closed') => () => Promise.resolve(o);

describe('UiGuidance', () => {
  it('shows an id once, marks it seen on any outcome, and never again', async () => {
    const store = new UiMemoryGuidanceStore();
    const g = new UiGuidance(store);
    let n = 0;
    expect(await g.requestTip('tip.a', () => { n++; return Promise.resolve('closed'); })).toBe('closed');
    expect(store.seen('tip.a')).toBe(true);
    expect(await g.requestTip('tip.a', shown())).toBeNull();
    expect(await g.canShow('tip.a')).toBe(false);
    expect(n).toBe(1);
  });

  it('refuses an id the store already has as seen', async () => {
    const g = new UiGuidance(new UiMemoryGuidanceStore({ seen: ['tour.welcome'] }));
    let ran = false;
    expect(await g.requestTip('tour.welcome', () => { ran = true; return Promise.resolve('finished'); }, { kind: 'tour' })).toBeNull();
    expect(ran).toBe(false);
  });

  it('shows nothing while tips are off', async () => {
    const g = new UiGuidance(new UiMemoryGuidanceStore({ tipsOn: false }));
    expect(await g.canShow('tip.a')).toBe(false);
    expect(await g.requestTip('tip.a', shown())).toBeNull();
  });

  it('skipWhen: not shown, marked seen silently by requestTip (canShow changes nothing)', async () => {
    const store = new UiMemoryGuidanceStore();
    const g = new UiGuidance(store);
    expect(await g.canShow('tip.feed.templates', { skipWhen: true })).toBe(false);
    expect(store.seen('tip.feed.templates')).toBe(false);
    let ran = false;
    expect(await g.requestTip('tip.feed.templates', () => { ran = true; return Promise.resolve('closed'); }, { skipWhen: true })).toBeNull();
    expect(ran).toBe(false);
    expect(store.seen('tip.feed.templates')).toBe(true);
  });

  it('refuses everything while one is on screen, including a request in the same tick', async () => {
    const g = new UiGuidance(new AsyncStore());
    let finish!: (o: UiTourOutcome) => void;
    const first = g.requestTip('tour.host', () => new Promise((r) => (finish = r)), { kind: 'tour' });
    // Same tick, before the first one's store reads resolve.
    expect(await g.requestTip('tip.b', shown())).toBeNull();
    await new Promise((r) => setTimeout(r));
    expect(g.active()).toBe('tour.host');
    expect(await g.canShow('tip.b')).toBe(false);
    expect(await g.requestTip('tip.b', shown())).toBeNull();
    finish('finished');
    expect(await first).toBe('finished');
    expect(g.active()).toBeNull();
    expect(await g.requestTip('tip.b', shown())).toBe('closed');
  });

  it('allows one offer per session (per controller)', async () => {
    const g = new UiGuidance(new UiMemoryGuidanceStore());
    expect(await g.requestTip('offer.welcome', shown(), { kind: 'offer' })).toBe('closed');
    expect(await g.canShow('offer.host', { kind: 'offer' })).toBe(false);
    expect(await g.requestTip('offer.host', shown(), { kind: 'offer' })).toBeNull();
    // Tours and tips are not offers.
    expect(await g.requestTip('tour.welcome', shown('finished'), { kind: 'tour' })).toBe('finished');
    expect(await g.requestTip('tip.a', shown())).toBe('closed');
    // A new session can offer again.
    const next = new UiGuidance(g.store);
    expect(await next.requestTip('offer.host', shown(), { kind: 'offer' })).toBe('closed');
  });

  it('allows at most 3 new tips a day (configurable), counted in the store when it can, and again tomorrow', async () => {
    let now = new Date(2026, 10, 13, 9, 0);
    const store = new UiMemoryGuidanceStore();
    const g = new UiGuidance(store, { now: () => now });
    for (const id of ['tip.1', 'tip.2', 'tip.3']) expect(await g.requestTip(id, shown())).toBe('closed');
    expect(await g.requestTip('tip.4', shown())).toBeNull();
    expect(store.readDayCount('2026-11-13')).toBe(3);
    // Tours don't count toward it and aren't stopped by it.
    expect(await g.requestTip('tour.x', shown('finished'), { kind: 'tour' })).toBe('finished');
    // A second controller on the same device (a reload) reads the day's count from the store.
    expect(await new UiGuidance(store, { now: () => now }).requestTip('tip.4', shown())).toBeNull();
    now = new Date(2026, 10, 14, 0, 1);
    expect(await g.requestTip('tip.4', shown())).toBe('closed');

    const two = new UiGuidance(new UiMemoryGuidanceStore(), { maxTipsPerDay: 1 });
    expect(await two.requestTip('a', shown())).toBe('closed');
    expect(await two.requestTip('b', shown())).toBeNull();
  });

  it('keeps the day count in memory when the store has none', async () => {
    const g = new UiGuidance(new AsyncStore(), { maxTipsPerDay: 2 });
    expect(await g.requestTip('a', shown())).toBe('closed');
    expect(await g.requestTip('b', shown())).toBe('closed');
    expect(await g.requestTip('c', shown())).toBeNull();
  });

  it('turnedOff turns tips off in the store; reset brings everything back', async () => {
    const store = new AsyncStore();
    const g = new UiGuidance(store);
    expect(await g.requestTip('tour.welcome', shown('turnedOff'), { kind: 'tour' })).toBe('turnedOff');
    expect(store.calls).toEqual(['seen:tour.welcome', 'tips:false']);
    expect(await g.tipsOn()).toBe(false);
    expect(await g.requestTip('tip.a', shown())).toBeNull();
    await g.reset();
    expect(await g.tipsOn()).toBe(true);
    expect(await g.requestTip('tour.welcome', shown('finished'), { kind: 'tour' })).toBe('finished');
  });

  it('marks seen and frees the screen when show() fails', async () => {
    const store = new UiMemoryGuidanceStore();
    const g = new UiGuidance(store);
    expect(await g.requestTip('tip.a', () => Promise.reject(new Error('gone')))).toBe('closed');
    expect(store.seen('tip.a')).toBe(true);
    expect(g.active()).toBeNull();
  });

  it('markSeen writes only new ids', async () => {
    const store = new AsyncStore();
    const g = new UiGuidance(store);
    await g.markSeen(['guide.checklist', 'offer.host']);
    await g.markSeen(['guide.checklist']);
    expect(store.calls).toEqual(['seen:guide.checklist,offer.host']);
    expect(await g.isSeen('offer.host')).toBe(true);
  });
});
