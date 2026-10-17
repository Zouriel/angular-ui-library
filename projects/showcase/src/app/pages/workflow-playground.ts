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

function storedSession(): string | null {
  try {
    return localStorage.getItem(SESSION_KEY);
  } catch {
    return null;
  }
}

function storeSession(id: string | null): void {
  try {
    if (id) localStorage.setItem(SESSION_KEY, id);
    else localStorage.removeItem(SESSION_KEY);
  } catch {
    // Private windows may refuse storage; the session then lasts until the page is reloaded.
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
  private session: string | null = storedSession();
  private issuing: Promise<string> | null = null;
  readonly user = signal('hana');
  readonly online = signal<boolean | null>(null);
  readonly users = signal<DemoUser[]>([]);
  /** Bumped after anything changes data, so views reload. */
  readonly tick = signal(0);

  readonly api: UiWorkflowApi = new UiWorkflowHttpApi({ baseUrl: `${this.base}/workflows`, fetch: (url, init) => this.request(url, init) });
  readonly currentUser = computed(() => this.users().find((u) => u.id === this.user()) ?? null);

  constructor() {
    void this.connect();
  }

  async connect(): Promise<void> {
    try {
      this.users.set(await this.get<DemoUser[]>('/demo/users'));
      this.online.set(true);
    } catch {
      this.online.set(false);
    }
  }

  changed(): void {
    this.tick.update((n) => n + 1);
  }

  /**
   * Fetches with the sandbox session and the chosen person. Gets a session first when there is none,
   * and once more when the server no longer knows the one kept (it restarted, or the id expired).
   */
  async request(url: string, init: RequestInit = {}): Promise<Response> {
    const send = async (session: string) => {
      const headers = new Headers(init.headers);
      headers.set('X-Playground-Session', session);
      headers.set('X-Demo-User', this.user());
      return fetch(url, { ...init, headers });
    };
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
        storeSession(session);
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
    this.changed();
    return res.status === 204 ? (undefined as T) : (res.json() as Promise<T>);
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
  advance(duration: string): Promise<{ now: string }> {
    return this.send('POST', '/playground/advance', { duration });
  }

  /** Lets background work (outbox, timers) run now, then refreshes views. */
  async settle(): Promise<void> {
    await this.send('POST', '/playground/settle');
  }

  async reset(): Promise<void> {
    await this.send('POST', '/playground/reset');
  }
}
