import { Component, computed, input, output } from '@angular/core';
import { injectUiStrings, uiFormatString } from '@zouriel/ui';
import { UiProgressBar } from '@zouriel/ui/progress';

export interface UiChecklistItem {
  id: string;
  label: string;
  description?: string;
  done: boolean;
}

let checklistSeq = 0;

/**
 * `ui-checklist` — a short "Getting started" list. The header shows the title, "2 of 5" and a
 * progress bar; each item is a row button with a round check that fills when it is done (done
 * rows go quiet). Items can be done in any order; the app sets `done` and the list follows. When
 * every item is done it shows its finished state (`allDoneText`) instead of the rows.
 */
@Component({
  selector: 'ui-checklist',
  imports: [UiProgressBar],
  template: `
    <section class="list" [attr.aria-labelledby]="headId">
      <div class="head">
        <div class="titles">
          <div class="heading" [id]="headId">{{ heading() }}</div>
          <span class="count">{{ countText() }}</span>
        </div>
        @if (dismissible()) {
          <button type="button" class="x" [attr.aria-label]="strings.dismiss" (click)="dismissed.emit()">
            <svg viewBox="0 0 24 24" width="1em" height="1em" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
          </button>
        }
      </div>
      <ui-progress-bar [value]="pct()" [tone]="allDone() ? 'success' : 'primary'" [label]="countText()" />
      @if (allDone()) {
        <div class="all" role="status">
          <span class="tick big" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="1em" height="1em"><path d="M6 12.5l4 4L18 8" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>
          </span>
          <span>{{ allDoneText() ?? strings.checklistAllDone }}</span>
        </div>
      } @else {
        <ul class="items">
          @for (item of items(); track item.id) {
            <li>
              <button type="button" class="item" [class.done]="item.done" (click)="itemClick.emit(item)">
                <span class="tick" aria-hidden="true">
                  @if (item.done) {
                    <svg viewBox="0 0 24 24" width="1em" height="1em"><path d="M6 12.5l4 4L18 8" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>
                  }
                </span>
                <span class="text">
                  <span class="label">{{ item.label }}<span class="sr">, {{ item.done ? strings.checklistItemDone : strings.checklistItemToDo }}</span></span>
                  @if (item.description) { <span class="desc">{{ item.description }}</span> }
                </span>
                @if (!item.done) {
                  <svg class="chev" viewBox="0 0 24 24" width="1em" height="1em" aria-hidden="true"><path d="M9 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
                }
              </button>
            </li>
          }
        </ul>
      }
    </section>
  `,
  styles: `
    :host { display: block; }
    .list {
      display: flex; flex-direction: column; gap: var(--ui-space-3); box-sizing: border-box;
      padding: var(--ui-space-4); border: 1px solid var(--ui-color-border); border-radius: var(--ui-radius-lg);
      background: var(--ui-color-surface); color: var(--ui-color-text); font-family: var(--ui-font-default); line-height: 1.4;
    }
    .head { display: flex; align-items: flex-start; gap: var(--ui-space-2); }
    .titles { flex: 1; min-width: 0; display: flex; align-items: baseline; flex-wrap: wrap; column-gap: var(--ui-space-3); row-gap: var(--ui-space-1); }
    .heading { font-size: var(--ui-font-size-md); font-weight: 600; }
    .count { font-size: var(--ui-font-size-sm); color: var(--ui-color-text-muted); font-variant-numeric: tabular-nums; }
    .x {
      position: relative; flex: none; display: inline-flex; align-items: center; justify-content: center;
      width: 28px; height: 28px; margin: calc(var(--ui-space-1) * -1) calc(var(--ui-space-1) * -1) 0 0; padding: 0;
      border: 0; border-radius: var(--ui-radius-pill); background: transparent; color: var(--ui-color-text-muted);
      cursor: pointer; font-size: calc(16px * var(--ui-font-scale)); line-height: 1;
    }
    .x:hover { background: var(--ui-color-surface-hover); color: var(--ui-color-text); }
    .x:focus-visible, .item:focus-visible { outline: none; box-shadow: var(--ui-focus-ring); }
    .items { list-style: none; margin: 0 calc(var(--ui-space-2) * -1); padding: 0; display: flex; flex-direction: column; }
    .item {
      width: 100%; display: flex; align-items: center; gap: var(--ui-space-3); box-sizing: border-box;
      min-height: var(--ui-size-touch); padding: var(--ui-space-2); margin: 0;
      border: 0; border-radius: var(--ui-radius); background: transparent; color: inherit;
      font: inherit; text-align: start; cursor: pointer;
    }
    .item:hover { background: var(--ui-color-surface-hover); }
    .tick {
      flex: none; display: inline-flex; align-items: center; justify-content: center;
      width: 22px; height: 22px; border-radius: var(--ui-radius-pill); box-sizing: border-box;
      border: 2px solid var(--ui-color-border-strong); color: var(--ui-color-primary-contrast);
      font-size: calc(14px * var(--ui-font-scale));
      transition: background var(--ui-motion-fast) var(--ui-ease-standard), border-color var(--ui-motion-fast) var(--ui-ease-standard);
    }
    .done .tick { background: var(--ui-color-primary); border-color: var(--ui-color-primary); }
    .text { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
    .label { font-size: var(--ui-font-size-md); font-weight: 500; }
    .desc { font-size: var(--ui-font-size-sm); color: var(--ui-color-text-muted); }
    .done .label { color: var(--ui-color-text-muted); font-weight: 400; text-decoration: line-through; text-decoration-thickness: 1px; }
    .chev { flex: none; color: var(--ui-color-text-muted); font-size: calc(16px * var(--ui-font-scale)); }
    /* Points toward the inline end: flipped under dir="rtl". */
    .chev { transform: scaleX(var(--ui-inline-sign, 1)); }
    .sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
    .all { display: flex; align-items: center; gap: var(--ui-space-3); font-size: var(--ui-font-size-md); font-weight: 500; }
    .tick.big { width: 32px; height: 32px; background: var(--ui-color-success); border-color: var(--ui-color-success); color: var(--ui-color-success-contrast); font-size: calc(18px * var(--ui-font-scale)); }
  `,
})
export class UiChecklist {
  protected readonly strings = injectUiStrings();
  protected readonly headId = `ui-checklist-${checklistSeq++}`;
  heading = input.required<string>();
  items = input<readonly UiChecklistItem[]>([]);
  /** Show the × (reported by `dismissed`). */
  dismissible = input(false);
  /** The finished state's words. Default: the built-in `checklistAllDone` (All set). */
  allDoneText = input<string | null>(null);
  /** A row was pressed (done or not): open the page where that step is done. */
  readonly itemClick = output<UiChecklistItem>();
  readonly dismissed = output<void>();

  protected readonly doneCount = computed(() => this.items().filter((i) => i.done).length);
  protected readonly allDone = computed(() => this.items().length > 0 && this.doneCount() === this.items().length);
  protected readonly pct = computed(() => (this.items().length ? (this.doneCount() / this.items().length) * 100 : 0));
  protected readonly countText = computed(() =>
    uiFormatString(this.strings.checklistCount, { done: this.doneCount(), total: this.items().length }),
  );
}
