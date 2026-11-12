import { InjectionToken, inject, signal, type Provider, type Signal } from '@angular/core';

/** How a tour, tip or offer ended. `turnedOff`: the person pressed "Turn off tips". */
export type UiTourOutcome = 'finished' | 'skipped' | 'turnedOff' | 'closed';

/** What a piece of guidance is, for pacing: `tip` (a one-off hint, counts toward the daily cap),
 *  `offer` (a card asking "want a tour?", at most one per session) or `tour` (neither cap). */
export type UiGuidanceKind = 'tip' | 'offer' | 'tour';

/**
 * Where seen ids and the tips switch live. The app decides: its server (so web and phone agree), the
 * device, or both. Every method may return a value or a promise of one.
 */
export interface UiGuidanceStore {
  /** Whether tips are on at all (the Settings switch). */
  tipsOn(): boolean | Promise<boolean>;
  /** Whether this id was already seen (shown and dismissed, finished, skipped or done). */
  seen(id: string): boolean | Promise<boolean>;
  /** Remembers these ids as seen, for good. */
  markSeen(ids: readonly string[]): void | Promise<void>;
  /** The Settings switch, and "Turn off tips" in a tip. */
  setTipsOn(on: boolean): void | Promise<void>;
  /** "Show tips again": nothing seen, tips on. */
  reset(): void | Promise<void>;
  /** Optional: how many one-off tips this device has shown on `day` (local `YYYY-MM-DD`). Without
   *  it the count is kept in memory, so a reload starts the day again. */
  readDayCount?(day: string): number | Promise<number>;
  /** Optional: stores that count. */
  writeDayCount?(day: string, count: number): void | Promise<void>;
}

export interface UiGuidanceOptions {
  /** At most this many new one-off tips (kind `tip`) a day. Default 3. */
  maxTipsPerDay?: number;
  /** The clock, for tests. */
  now?: () => Date;
}

export interface UiGuidanceCheck {
  /** The tip's action is already done: never show it, and `requestTip` marks it seen silently. */
  skipWhen?: boolean;
  /** Default `tip`. */
  kind?: UiGuidanceKind;
}

/** A store that keeps everything in memory: for tests, demos and signed-out visitors' first run. */
export class UiMemoryGuidanceStore implements UiGuidanceStore {
  readonly ids = new Set<string>();
  on = true;
  readonly days = new Map<string, number>();
  constructor(init?: { seen?: readonly string[]; tipsOn?: boolean }) {
    init?.seen?.forEach((id) => this.ids.add(id));
    if (init?.tipsOn === false) this.on = false;
  }
  tipsOn(): boolean { return this.on; }
  seen(id: string): boolean { return this.ids.has(id); }
  markSeen(ids: readonly string[]): void { ids.forEach((id) => this.ids.add(id)); }
  setTipsOn(on: boolean): void { this.on = on; }
  reset(): void { this.ids.clear(); this.on = true; }
  readDayCount(day: string): number { return this.days.get(day) ?? 0; }
  writeDayCount(day: string, count: number): void { this.days.set(day, count); }
}

/**
 * Pacing and memory for tips, tours and offers. Give it the app's store; ask it before showing
 * anything. The rules, the same on web and Flutter:
 *
 * - tips off → nothing shows; a seen id never shows again;
 * - `skipWhen` → not shown, and `requestTip` marks it seen silently;
 * - one thing on screen at a time: while one is showing, every other request is refused (no queue);
 * - at most one `offer` per session (the life of this controller);
 * - at most `maxTipsPerDay` (3) new `tip`s a day;
 * - whatever the outcome, the id is marked seen; `turnedOff` also turns tips off.
 */
export class UiGuidance {
  private readonly maxPerDay: number;
  private readonly now: () => Date;
  private readonly seenHere = new Set<string>();
  private offerShown = false;
  private readonly dayCounts = new Map<string, number>();
  private tipsOffHere = false;
  private readonly activeId = signal<string | null>(null);
  /** The id on screen (or being checked to go on screen), or null. */
  readonly active: Signal<string | null> = this.activeId.asReadonly();

  constructor(readonly store: UiGuidanceStore, options: UiGuidanceOptions = {}) {
    this.maxPerDay = options.maxTipsPerDay ?? 3;
    this.now = options.now ?? (() => new Date());
  }

  /** Whether `id` may show now, without showing it or changing anything. */
  async canShow(id: string, check: UiGuidanceCheck = {}): Promise<boolean> {
    if (this.activeId() !== null) return false;
    return (await this.refusal(id, check)) === null;
  }

  /**
   * Shows `id` through `show` if the rules allow, and returns its outcome, or null when it was
   * refused. `show` puts the thing on screen and resolves when it ends (a tour's `start`, a hint
   * that resolves when closed, an offer card that resolves on its buttons).
   */
  async requestTip(id: string, show: () => Promise<UiTourOutcome>, check: UiGuidanceCheck = {}): Promise<UiTourOutcome | null> {
    // Claimed before the first await, so two requests in the same tick can't both pass.
    if (this.activeId() !== null) return null;
    this.activeId.set(id);
    try {
      const why = await this.refusal(id, check);
      if (why === 'skip') await this.markSeen([id]);
      if (why !== null) return null;
      const kind = check.kind ?? 'tip';
      if (kind === 'offer') this.offerShown = true;
      if (kind === 'tip') await this.countTip();
      let outcome: UiTourOutcome;
      try {
        outcome = await show();
      } catch {
        outcome = 'closed';
      }
      await this.markSeen([id]);
      if (outcome === 'turnedOff') await this.setTipsOn(false);
      return outcome;
    } finally {
      this.activeId.set(null);
    }
  }

  /** Marks ids seen (an offer's action done elsewhere, a checklist closed). */
  async markSeen(ids: readonly string[]): Promise<void> {
    const fresh = ids.filter((id) => !this.seenHere.has(id));
    fresh.forEach((id) => this.seenHere.add(id));
    if (fresh.length) await this.store.markSeen(fresh);
  }

  /** Whether `id` is seen (the store, or marked during this session). */
  async isSeen(id: string): Promise<boolean> {
    return this.seenHere.has(id) || (await this.store.seen(id));
  }

  /** Whether tips are on. */
  async tipsOn(): Promise<boolean> {
    return !this.tipsOffHere && (await this.store.tipsOn());
  }

  async setTipsOn(on: boolean): Promise<void> {
    this.tipsOffHere = !on;
    await this.store.setTipsOn(on);
  }

  /** "Show tips again": clears what this session remembers too (the session's offer, the day's count stays). */
  async reset(): Promise<void> {
    this.seenHere.clear();
    this.tipsOffHere = false;
    this.offerShown = false;
    await this.store.reset();
  }

  private async refusal(id: string, check: UiGuidanceCheck): Promise<'off' | 'seen' | 'skip' | 'offer' | 'day' | null> {
    if (!(await this.tipsOn())) return 'off';
    if (await this.isSeen(id)) return 'seen';
    if (check.skipWhen) return 'skip';
    const kind = check.kind ?? 'tip';
    if (kind === 'offer' && this.offerShown) return 'offer';
    if (kind === 'tip' && (await this.readDay()) >= this.maxPerDay) return 'day';
    return null;
  }

  private day(): string {
    const d = this.now();
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }

  private async readDay(): Promise<number> {
    const day = this.day();
    const stored = this.store.readDayCount ? await this.store.readDayCount(day) : 0;
    return Math.max(stored, this.dayCounts.get(day) ?? 0);
  }

  private async countTip(): Promise<void> {
    const day = this.day();
    const n = (await this.readDay()) + 1;
    this.dayCounts.set(day, n);
    await this.store.writeDayCount?.(day, n);
  }
}

/** The app's guidance controller, for `uiHintOnce` and the app's own code. */
export const UI_GUIDANCE = new InjectionToken<UiGuidance>('UI_GUIDANCE');

/**
 * Gives the app one {@link UiGuidance}. `store` runs in an injection context, so it can inject the
 * app's HTTP client: `provideUiGuidance(() => new MyServerGuidanceStore(inject(HttpClient)))`.
 */
export function provideUiGuidance(store: () => UiGuidanceStore, options?: UiGuidanceOptions): Provider {
  return { provide: UI_GUIDANCE, useFactory: () => new UiGuidance(store(), options) };
}

/** The app's guidance controller, or null when none is provided. */
export function injectUiGuidance(): UiGuidance | null {
  return inject(UI_GUIDANCE, { optional: true });
}
