import { Component, DestroyRef, computed, effect, inject, input, model, output, signal, untracked } from '@angular/core';
import { HugeiconsIconComponent } from '@hugeicons/angular';
import type { UiSize } from '@zouriel/ui';
import { UiBadge } from '@zouriel/ui/badge';
import { UiButton } from '@zouriel/ui/button';
import { UiDrawer } from '@zouriel/ui/dialog';
import type { UiWfInstance, UiWfTask } from './api';
import { WF_ICONS } from './icons';
import { WfRunView, WfTaskInbox } from './runtime';
import { WfWithApi, wfReadableError, wfStoppedLabel } from './runtime-shared';
import { WF_SHARED_STYLES } from './styles';

/** How many open tasks one count asks for; overdue ones beyond this aren't seen. */
const COUNT_TAKE = 100;

/**
 * `ui-workflow-tasks-drawer` — where people work through their approvals and tasks: a "My tasks"
 * button with the number of open tasks (red when any is overdue) that opens them in a drawer, open
 * or finished, each opening its decision. Put it in an app's header; open it from code with
 * `[(open)]`; with `scope="all"` admins see everyone's.
 *
 * ```html
 * <ui-workflow-tasks-drawer />
 * <ui-workflow-tasks-drawer [(open)]="tasksOpen" label="Approvals" (decided)="reload()" />
 * <ui-workflow-tasks-drawer scope="all" label="All tasks" />
 * ```
 */
@Component({
  selector: 'ui-workflow-tasks-drawer',
  imports: [HugeiconsIconComponent, UiBadge, UiButton, UiDrawer, WfRunView, WfTaskInbox],
  template: `
    @if (showButton()) {
      <ui-button class="trigger" [size]="size()" [variant]="variant()" (click)="open.set(true)">
        <hugeicons-icon aria-hidden="true" [icon]="icons.InboxIcon" [size]="size() === 'sm' ? 14 : 16" [strokeWidth]="1.8" />
        <span class="label">{{ label() }}</span>
        @if (total() > 0) {
          <ui-badge class="count" [tone]="overdue() || stopped().length ? 'danger' : 'primary'" aria-hidden="true">{{ total() > 99 ? '99+' : total() }}</ui-badge>
        }
        <!-- The badge is for eyes; this is what a screen reader says. -->
        <span class="wf-sr">{{ countText() }}</span>
      </ui-button>
    }
    <ui-drawer [(open)]="open" [side]="side()" [title]="label()">
      @if (open()) {
        @if (openRun(); as run) {
          <!-- One stopped workflow, with try again, skip and cancel (a record's lifecycle: try again and skip). -->
          <div class="detail">
            <ui-button size="sm" variant="ghost" (click)="openRun.set(null)">‹ Back to the list</ui-button>
            <ui-wf-run-view [instanceId]="run.id" [api]="client()" (changed)="onRunChanged()" />
          </div>
        } @else {
          @if (stopped().length) {
            <section class="stopped" aria-label="Stopped workflows">
              <h3>Stopped workflows</h3>
              <p class="wf-hint">They need someone to try again or skip what stopped them.</p>
              <ul>
                @for (run of stopped(); track run.id) {
                  <li><button type="button" class="stop" (click)="openRun.set(run)">
                    <span class="st">{{ stoppedLabel(run) }}</span>
                    <span class="se">{{ readable(run.error) || 'Stopped' }}</span>
                  </button></li>
                }
              </ul>
            </section>
          }
          <ui-wf-task-inbox class="inbox" [api]="client()" [scope]="scope()" [pageSize]="pageSize()" (decided)="onDecided($event)" />
        }
      }
    </ui-drawer>
  `,
  // UiButton spaces the icon, label and badge itself (its own gap): no extra margins here.
  styles: [WF_SHARED_STYLES, `
    :host { display: inline-flex; }
    .inbox { display: block; }
    .detail { display: flex; flex-direction: column; align-items: stretch; gap: var(--ui-space-3); }
    .detail > ui-button { align-self: flex-start; }
    .stopped { display: flex; flex-direction: column; gap: var(--ui-space-2); margin-bottom: var(--ui-space-4); }
    .stopped h3 { margin: 0; font-size: 11px; font-weight: 650; letter-spacing: 0.04em; text-transform: uppercase; color: var(--ui-color-danger); }
    .stopped .wf-hint { margin: 0; }
    .stopped ul { margin: 0; padding: 0; list-style: none; display: flex; flex-direction: column; gap: var(--ui-space-2); }
    .stop { display: flex; flex-direction: column; gap: 2px; width: 100%; padding: var(--ui-space-2) var(--ui-space-3); text-align: left; font: inherit; cursor: pointer;
      color: var(--ui-color-text); background: var(--ui-color-surface); border: 1px solid color-mix(in srgb, var(--ui-color-danger) 45%, var(--ui-color-border)); border-radius: var(--ui-radius); }
    .stop:hover { background: var(--ui-color-surface-hover); }
    .stop:focus-visible { outline: none; box-shadow: var(--ui-focus-ring); }
    .st { font-weight: 600; }
    .se { font-size: 12px; color: var(--ui-color-danger); overflow-wrap: anywhere; }
  `],
})
export class UiWorkflowTasksDrawer extends WfWithApi {
  /** Whether the drawer is open. Two-way, so it can be opened from code (a link, a shortcut). */
  readonly open = model(false);
  /** The button's (and drawer's) title. */
  readonly label = input('My tasks');
  readonly side = input<'left' | 'right'>('right');
  readonly size = input<UiSize>('sm');
  readonly variant = input<'outline' | 'ghost' | 'primary'>('outline');
  /** Show the built-in button. Off when the app opens the drawer from its own control. */
  readonly showButton = input(true);
  /** How often to refresh the count, in seconds (0: only on open, close and decisions). */
  readonly refreshSeconds = input(60);
  readonly pageSize = input(25);
  /**
   * Whose tasks: the signed-in person's (`mine`), or everyone's (`all`, for admins who oversee the
   * work; give it a label such as "All tasks"). The count follows it.
   */
  readonly scope = input<'mine' | 'all'>('mine');
  /** After a task was decided in the drawer. */
  readonly decided = output<UiWfTask>();

  protected readonly icons = WF_ICONS;
  protected readonly readable = wfReadableError;
  protected readonly stoppedLabel = wfStoppedLabel;
  /** Open tasks for the signed-in person, and how many of them are overdue. */
  protected readonly count = signal(0);
  protected readonly overdue = signal(0);
  /** Whether more tasks are open than one count looks at, so the overdue number is "at least". */
  protected readonly capped = signal(false);
  /** The overdue number as shown: "100+" when only the first page was looked at. */
  protected readonly overdueText = computed(() => `${this.overdue()}${this.capped() ? '+' : ''}`);
  /**
   * Workflows that stopped and need someone to try again, skip or cancel: every instance in `incident`
   * (automations, lifecycle child runs, and record instances whose timer was parked), listed (and
   * counted) only for people the engine lets intervene, since only they can act on them.
   */
  protected readonly stopped = signal<UiWfInstance[]>([]);
  /** The stopped workflow opened in the drawer, if any. */
  protected readonly openRun = signal<UiWfInstance | null>(null);
  /** Whether the engine lets this person intervene, asked once per API (asked again after a failed answer). */
  private interveneFor: { api: unknown; may: Promise<boolean> } | null = null;
  /** What the badge counts: open tasks and stopped workflows. */
  protected readonly total = computed(() => this.count() + this.stopped().length);
  protected readonly countText = computed(() => {
    const n = this.count(), late = this.overdue(), st = this.stopped().length;
    const tasks = n ? `, ${n} open${late ? `, ${this.overdueText()} overdue` : ''}` : ', none open';
    return `${tasks}${st ? `, ${st} stopped workflow${st === 1 ? '' : 's'}` : ''}`;
  });
  /** Whether the page is visible: polling pauses while it is hidden (a background tab). */
  private readonly visible = signal(typeof document === 'undefined' || document.visibilityState !== 'hidden');
  private seq = 0;

  constructor() {
    super();
    // Count on start, whenever the API or the scope changes, and each time the drawer opens or closes.
    effect(() => {
      this.client();
      this.scope();
      const open = this.open();
      untracked(() => {
        // Closing goes back to the list: the next opening starts there, not on an old run.
        if (!open) this.openRun.set(null);
        void this.refresh();
      });
    });
    const destroy = inject(DestroyRef);
    let timer: ReturnType<typeof setInterval> | null = null;
    const stop = () => { if (timer) clearInterval(timer); timer = null; };
    effect(() => {
      const s = this.refreshSeconds();
      const visible = this.visible();
      stop();
      if (s > 0 && visible) timer = setInterval(() => void this.refresh(), s * 1000);
    });
    if (typeof document !== 'undefined') {
      const onVisibility = () => {
        const visible = document.visibilityState !== 'hidden';
        if (visible === this.visible()) return;
        this.visible.set(visible);
        // Back in view: the count may be stale, so refresh now rather than at the next tick.
        if (visible) void this.refresh();
      };
      document.addEventListener('visibilitychange', onVisibility);
      destroy.onDestroy(() => document.removeEventListener('visibilitychange', onVisibility));
    }
    destroy.onDestroy(stop);
  }

  /** Reloads the count (also called after a decision). */
  async refresh(): Promise<void> {
    const api = this.client();
    if (!api) return;
    const seq = ++this.seq;
    try {
      if (this.interveneFor?.api !== api) {
        const asked: { api: unknown; may: Promise<boolean> } = {
          api,
          // A failed answer is not cached: the next refresh asks again.
          may: Promise.resolve(api.me?.()).then((me) => !!me?.can?.intervene, () => {
            if (this.interveneFor === asked) this.interveneFor = null;
            return false;
          }),
        };
        this.interveneFor = asked;
      }
      const [page, may] = await Promise.all([api.tasks({ scope: this.scope(), status: ['open'], take: COUNT_TAKE }), this.interveneFor.may]);
      const stopped = may ? (await api.instances({ status: ['incident'], take: COUNT_TAKE }).catch(() => null))?.items ?? [] : [];
      if (seq !== this.seq) return;
      this.count.set(page.total);
      this.overdue.set(page.items.filter((t) => t.overdue).length);
      this.capped.set(page.total > page.items.length);
      this.stopped.set(stopped);
    } catch {
      // Not signed in or offline: keep the last count rather than flashing zero.
    }
  }

  /** After trying again, skipping or cancelling: the run may no longer be stopped, so count again. */
  protected onRunChanged(): void {
    void this.refresh();
  }

  protected onDecided(t: UiWfTask): void {
    this.decided.emit(t);
    void this.refresh();
  }
}
