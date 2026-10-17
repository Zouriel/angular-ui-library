import { Component, DestroyRef, computed, effect, inject, input, model, output, signal, untracked } from '@angular/core';
import { HugeiconsIconComponent } from '@hugeicons/angular';
import type { UiSize } from '@zouriel/ui';
import { UiBadge } from '@zouriel/ui/badge';
import { UiButton } from '@zouriel/ui/button';
import { UiDrawer } from '@zouriel/ui/dialog';
import type { UiWfTask } from './api';
import { WF_ICONS } from './icons';
import { UiWorkflowTasks } from './runtime';
import { WfWithApi } from './runtime-shared';

/**
 * `ui-workflow-tasks-drawer` — a "My tasks" button with the number of open tasks (red when any is
 * overdue) that opens the task inbox in a drawer. Put it in an app's header; open it from code with
 * `[(open)]`.
 *
 * ```html
 * <ui-workflow-tasks-drawer />
 * <ui-workflow-tasks-drawer [(open)]="tasksOpen" label="Approvals" (decided)="reload()" />
 * ```
 */
@Component({
  selector: 'ui-workflow-tasks-drawer',
  imports: [HugeiconsIconComponent, UiBadge, UiButton, UiDrawer, UiWorkflowTasks],
  template: `
    @if (showButton()) {
      <ui-button class="trigger" [size]="size()" [variant]="variant()" (click)="open.set(true)">
        <hugeicons-icon aria-hidden="true" [icon]="icons.InboxIcon" [size]="size() === 'sm' ? 14 : 16" [strokeWidth]="1.8" />
        <span class="label">{{ label() }}</span>
        @if (count() > 0) {
          <ui-badge class="count" [tone]="overdue() ? 'danger' : 'primary'" aria-hidden="true">{{ count() > 99 ? '99+' : count() }}</ui-badge>
        }
        <!-- The badge is for eyes; this is what a screen reader says. -->
        <span class="sr-only">{{ countText() }}</span>
      </ui-button>
    }
    <ui-drawer [(open)]="open" [side]="side()" [title]="label()">
      @if (open()) {
        <ui-workflow-tasks class="inbox" [api]="client()" [pageSize]="pageSize()" (decided)="onDecided($event)" />
      }
    </ui-drawer>
  `,
  styles: `
    :host { display: inline-flex; }
    .trigger hugeicons-icon { margin-right: var(--ui-space-1); }
    .count { margin-left: var(--ui-space-2); }
    .inbox { display: block; }
    .sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
  `,
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
  /** After a task was decided in the drawer. */
  readonly decided = output<UiWfTask>();

  protected readonly icons = WF_ICONS;
  /** Open tasks for the signed-in person, and how many of them are overdue. */
  protected readonly count = signal(0);
  protected readonly overdue = signal(0);
  protected readonly countText = computed(() => {
    const n = this.count(), late = this.overdue();
    return n ? `, ${n} open${late ? `, ${late} overdue` : ''}` : ', none open';
  });
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
    effect(() => {
      const s = this.refreshSeconds();
      if (timer) clearInterval(timer);
      timer = s > 0 ? setInterval(() => void this.refresh(), s * 1000) : null;
    });
    destroy.onDestroy(() => { if (timer) clearInterval(timer); });
  }

  /** Reloads the count (also called after a decision). */
  async refresh(): Promise<void> {
    const api = this.client();
    if (!api) return;
    const seq = ++this.seq;
    try {
      const page = await api.tasks({ scope: 'mine', status: ['open'], take: 100 });
      if (seq !== this.seq) return;
      this.count.set(page.total);
      this.overdue.set(page.items.filter((t) => t.overdue).length);
    } catch {
      // Not signed in or offline: keep the last count rather than flashing zero.
    }
  }

  protected onDecided(t: UiWfTask): void {
    this.decided.emit(t);
    void this.refresh();
  }
}
