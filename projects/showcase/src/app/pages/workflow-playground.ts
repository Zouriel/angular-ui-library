import { Injectable, computed, signal } from '@angular/core';
import { UiWorkflowHttpApi, type UiWorkflowApi } from '@zouriel/ui/workflow';

/** A person of the demo scholarship office (the sample backend's users). */
export interface DemoUser {
  id: string;
  name: string;
  email: string;
  title: string;
  roles: string[];
}

export interface DemoApplication {
  id: number;
  title: string;
  status: string | null;
  priority: string;
  amount: number;
  applicant: string | null;
  applicantName: string | null;
  reviewer: string | null;
  reviewerName: string | null;
  deadline: string | null;
  paid: boolean;
  notes: string | null;
  programmeId: number | null;
  programme: string | null;
  documents: { id: number; name: string; verified: boolean }[];
}

export interface DemoMessage {
  channel: string;
  subject: string | null;
  body: string;
  link: string | null;
  to: string[];
  at: string;
}

/** Where the playground backend (the .NET sample in sandbox mode) lives. */
function backendBase(): string {
  const h = location.hostname;
  if (h === 'localhost' || h === '127.0.0.1' || h.endsWith('.ts.net') || /^100\./.test(h)) return `${location.protocol}//${h}:5190/api`;
  return `${location.origin}/uilib/workflow-api/api`;
}

const SESSION_KEY = 'zouriel-workflow-playground-session';
const USER_KEY = 'zouriel-workflow-playground-user';

/** Reads a remembered value; private windows may refuse storage, which just means nothing is remembered. */
export function readStored(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

/** Remembers (or with null forgets) a value for the next visit, when the browser allows it. */
export function writeStored(key: string, value: string | null): void {
  try {
    if (value) localStorage.setItem(key, value);
    else localStorage.removeItem(key);
  } catch {
    // Storage refused: the value then lasts until the page is reloaded.
  }
}

/**
 * The connection to the playground backend. Every visitor gets a private sandbox (its own
 * database, workflows and clock), picked by a session id the server issues and this browser keeps;
 * the "signed in" person is switched with `user`.
 */
@Injectable({ providedIn: 'root' })
export class WorkflowPlayground {
  readonly base = backendBase();
  private session: string | null = readStored(SESSION_KEY);
  private issuing: Promise<string> | null = null;
  /** Who the studio acts as. Only the studio changes it (`setUser`); other pages use `apiAs`. */
  readonly user = signal(readStored(USER_KEY) ?? 'hana');
  readonly online = signal<boolean | null>(null);
  readonly users = signal<DemoUser[]>([]);
  /** Bumped after anything changes data, so views reload. */
  readonly tick = signal(0);
  /** How far the sandbox clock is ahead of this browser's, in ms (moved by `advance`, cleared by `reset`). */
  readonly clockOffset = signal(0);
  /** The sandbox's current time (epoch ms): what the workflow views count "due in" and "ago" from. */
  readonly now = (): number => Date.now() + this.clockOffset();

  readonly api: UiWorkflowApi = new UiWorkflowHttpApi({ baseUrl: `${this.base}/workflows`, fetch: (url, init) => this.request(url, init) });
  readonly currentUser = computed(() => this.users().find((u) => u.id === this.user()) ?? null);
  private readonly fixed = new Map<string, UiWorkflowApi>();

  constructor() {
    void this.connect();
  }

  /** Switches who the studio acts as, and remembers it for the next visit. */
  setUser(id: string): void {
    this.user.set(id);
    writeStored(USER_KEY, id);
  }

  /**
   * An API that always acts as one person, whoever the studio is acting as. Pages other than the
   * studio use this so they never change the studio's person.
   */
  apiAs(user: string): UiWorkflowApi {
    let api = this.fixed.get(user);
    if (!api) {
      api = new UiWorkflowHttpApi({ baseUrl: `${this.base}/workflows`, fetch: (url, init) => this.request(url, init, user) });
      this.fixed.set(user, api);
    }
    return api;
  }

  async connect(): Promise<void> {
    try {
      this.users.set(await this.get<DemoUser[]>('/demo/users'));
      this.online.set(true);
      await this.syncClock().catch(() => undefined);
    } catch {
      this.online.set(false);
    }
  }

  /** Reads the sandbox clock and returns its time. */
  async syncClock(): Promise<Date> {
    const clock = await this.get<{ now: string }>('/demo/clock');
    return this.followClock(clock.now);
  }

  private followClock(now: string): Date {
    const d = new Date(now);
    if (!isNaN(+d)) this.clockOffset.set(d.getTime() - Date.now());
    return d;
  }

  changed(): void {
    this.tick.update((n) => n + 1);
  }

  /**
   * Fetches with the sandbox session and the chosen person. Gets a session first when there is none,
   * and once more when the server no longer knows the one kept (it restarted, or the id expired).
   */
  async request(url: string, init: RequestInit = {}, asUser?: string): Promise<Response> {
    const send = async (session: string) => {
      const headers = new Headers(init.headers);
      headers.set('X-Playground-Session', session);
      headers.set('X-Demo-User', asUser ?? this.user());
      return fetch(url, { ...init, headers });
    };
    // A kept session the server no longer knows (it restarted) is answered with 400 noSession once
    // and a new one is issued. The browser itself logs that 400 in the console; a page cannot hide it.
    const res = await send(this.session ?? (await this.issue()));
    if (res.status !== 400 || (await this.code(res)) !== 'noSession') return res;
    this.session = null;
    return send(await this.issue());
  }

  private issue(): Promise<string> {
    this.issuing ??= (async () => {
      try {
        const res = await fetch(`${this.base}/playground/session`, { method: 'POST' });
        if (!res.ok) throw new Error(await this.message(res));
        const { session } = (await res.json()) as { session: string };
        this.session = session;
        writeStored(SESSION_KEY, session);
        return session;
      } finally {
        this.issuing = null;
      }
    })();
    return this.issuing;
  }

  private async code(res: Response): Promise<string | undefined> {
    try {
      return ((await res.clone().json()) as { code?: string }).code;
    } catch {
      return undefined;
    }
  }

  async get<T>(path: string): Promise<T> {
    const res = await this.request(this.base + path);
    if (!res.ok) throw new Error(await this.message(res));
    return res.json() as Promise<T>;
  }

  async send<T>(method: string, path: string, body?: unknown): Promise<T> {
    const res = await this.request(this.base + path, {
      method,
      headers: body !== undefined ? { 'Content-Type': 'application/json' } : {},
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (!res.ok) throw new Error(await this.message(res));
    // Some endpoints (settle, reset) answer 200 with no body: read the text, parse only if there is one.
    const text = res.status === 204 ? '' : await res.text();
    this.changed();
    return (text ? JSON.parse(text) : undefined) as T;
  }

  private async message(res: Response): Promise<string> {
    try {
      const j = (await res.json()) as { message?: string };
      return j.message ?? `The server answered ${res.status}.`;
    } catch {
      return `The server answered ${res.status}.`;
    }
  }

  /** Moves the sandbox's clock forward (to see waits, deadlines and reminders happen). */
  async advance(duration: string): Promise<{ now: string }> {
    const r = await this.send<{ now: string }>('POST', '/playground/advance', { duration });
    if (r?.now) this.followClock(r.now);
    return r;
  }

  /** Lets background work (outbox, timers) run now, then refreshes views. */
  async settle(): Promise<void> {
    await this.send('POST', '/playground/settle');
  }

  /** Throws the sandbox away and starts a fresh one (its clock back at real time). */
  async reset(): Promise<void> {
    await this.send('POST', '/playground/reset');
    this.clockOffset.set(0);
    await this.syncClock().catch(() => undefined);
  }
}
