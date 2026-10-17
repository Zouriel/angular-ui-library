import { Component, DestroyRef, computed, effect, inject, input, model, output, signal, untracked } from '@angular/core';
import { HugeiconsIconComponent } from '@hugeicons/angular';
import type { UiSize } from '@zouriel/ui';
import { UiBadge } from '@zouriel/ui/badge';
import { UiButton } from '@zouriel/ui/button';
import { UiDrawer } from '@zouriel/ui/dialog';
import type { UiWfTask } from './api';
import { WF_ICONS } from './icons';
import { WfTaskInbox } from './runtime';
import { WfWithApi } from './runtime-shared';
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
  imports: [HugeiconsIconComponent, UiBadge, UiButton, UiDrawer, WfTaskInbox],
  template: `
    @if (showButton()) {
      <ui-button class="trigger" [size]="size()" [variant]="variant()" (click)="open.set(true)">
        <hugeicons-icon aria-hidden="true" [icon]="icons.InboxIcon" [size]="size() === 'sm' ? 14 : 16" [strokeWidth]="1.8" />
        <span class="label">{{ label() }}</span>
        @if (count() > 0) {
          <ui-badge class="count" [tone]="overdue() ? 'danger' : 'primary'" aria-hidden="true">{{ count() > 99 ? '99+' : count() }}</ui-badge>
        }
        <!-- The badge is for eyes; this is what a screen reader says. -->
        <span class="wf-sr">{{ countText() }}</span>
      </ui-button>
    }
    <ui-drawer [(open)]="open" [side]="side()" [title]="label()">
      @if (open()) {
        <ui-wf-task-inbox class="inbox" [api]="client()" [scope]="scope()" [pageSize]="pageSize()" (decided)="onDecided($event)" />
      }
    </ui-drawer>
  `,
  // UiButton spaces the icon, label and badge itself (its own gap): no extra margins here.
  styles: [WF_SHARED_STYLES, `
    :host { display: inline-flex; }
    .inbox { display: block; }
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
  /** Open tasks for the signed-in person, and how many of them are overdue. */
  protected readonly count = signal(0);
  protected readonly overdue = signal(0);
  /** Whether more tasks are open than one count looks at, so the overdue number is "at least". */
  protected readonly capped = signal(false);
  /** The overdue number as shown: "100+" when only the first page was looked at. */
  protected readonly overdueText = computed(() => `${this.overdue()}${this.capped() ? '+' : ''}`);
  protected readonly countText = computed(() => {
    const n = this.count(), late = this.overdue();
    return n ? `, ${n} open${late ? `, ${this.overdueText()} overdue` : ''}` : ', none open';
  });
  /** Whether the page is visible: polling pauses while it is hidden (a background tab). */
  private readonly visible = signal(typeof document === 'undefined' || document.visibilityState !== 'hidden');
  private seq = 0;

  constructor() {
    super();
    // Count on start, whenever the API changes, and each time the drawer opens or closes.
    effect(() => {
      this.client();
      this.open();
      untracked(() => void this.refresh());
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
      const page = await api.tasks({ scope: this.scope(), status: ['open'], take: COUNT_TAKE });
      if (seq !== this.seq) return;
      this.count.set(page.total);
      this.overdue.set(page.items.filter((t) => t.overdue).length);
      this.capped.set(page.total > page.items.length);
    } catch {
      // Not signed in or offline: keep the last count rather than flashing zero.
    }
  }

  protected onDecided(t: UiWfTask): void {
    this.decided.emit(t);
    void this.refresh();
  }
}
