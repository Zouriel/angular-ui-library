import { Component, input } from '@angular/core';
import { HugeiconsIconComponent } from '@hugeicons/angular';
import type { IconSvgObject } from '@hugeicons/angular';
import type { UiStatus } from '@zouriel/ui';

export interface UiTimelineItem {
  title: string;
  description?: string;
  meta?: string;
  tone?: UiStatus;
  /**
   * Replaces the dot with a tone-coloured marker holding this icon: a HugeIcons icon (drawn in
   * currentColor), or a short string such as a letter or a step number.
   */
  icon?: string | IconSvgObject;
}

/** `ui-timeline` — vertical sequence of events with connector line. */
@Component({
  selector: 'ui-timeline',
  imports: [HugeiconsIconComponent],
  template: `
    <ol class="ui-timeline">
      @for (item of items(); track $index) {
        <li class="event">
          <span class="mark" aria-hidden="true">
            @if (item.icon) {
              <span class="badge" [attr.data-tone]="item.tone || 'primary'">
                @if (isSvg(item.icon)) { <hugeicons-icon [icon]="item.icon" [size]="12" [strokeWidth]="2" /> } @else { {{ item.icon }} }
              </span>
            } @else {
              <span class="dot" [attr.data-tone]="item.tone || 'primary'"></span>
            }
          </span>
          <div class="body">
            <div class="row">
              <span class="title">{{ item.title }}</span>
              @if (item.meta) { <span class="meta">{{ item.meta }}</span> }
            </div>
            @if (item.description) { <div class="desc">{{ item.description }}</div> }
          </div>
        </li>
      }
    </ol>
  `,
  styles: `
    :host { display: block; }
    .ui-timeline { margin: 0; padding: 0; list-style: none; font-family: var(--ui-font-default); line-height: 1.35; }
    .event { position: relative; display: flex; gap: var(--ui-space-3); padding-bottom: var(--ui-space-4); }
    .event:last-child { padding-bottom: 0; }
    /* The connector runs down the centre of the marker column, which is as wide as the widest marker in the list. */
    .event::before { content: ''; position: absolute; left: calc(var(--ui-tl-mark) / 2); top: var(--ui-space-4); bottom: 0; width: 1px; background: var(--ui-color-border); }
    .event:last-child::before { display: none; }
    .ui-timeline { --ui-tl-mark: 11px; }
    .ui-timeline:has(.badge) { --ui-tl-mark: 20px; }
    .mark { flex: none; width: var(--ui-tl-mark); display: flex; justify-content: center; z-index: 1; }
    .dot { width: 11px; height: 11px; border-radius: 50%; flex: none; margin-top: 4px; background: var(--ui-color-primary); box-shadow: 0 0 0 2px var(--ui-timeline-ring, var(--ui-color-surface)); }
    .badge { box-sizing: border-box; width: 20px; height: 20px; border-radius: 50%; flex: none; display: inline-flex; align-items: center; justify-content: center;
      font-size: 11px; font-weight: 600; line-height: 1;
      background: var(--ui-color-primary); color: var(--ui-color-primary-contrast); box-shadow: 0 0 0 2px var(--ui-timeline-ring, var(--ui-color-surface)); }
    .dot[data-tone="success"], .badge[data-tone="success"] { background: var(--ui-color-success); }
    .dot[data-tone="warning"], .badge[data-tone="warning"] { background: var(--ui-color-warning); }
    .dot[data-tone="danger"], .badge[data-tone="danger"] { background: var(--ui-color-danger); }
    .dot[data-tone="neutral"], .badge[data-tone="neutral"] { background: var(--ui-color-secondary); }
    .badge[data-tone="success"] { color: var(--ui-color-success-contrast); }
    .badge[data-tone="warning"] { color: var(--ui-color-warning-contrast); }
    .badge[data-tone="danger"] { color: var(--ui-color-danger-contrast); }
    .badge[data-tone="neutral"] { color: var(--ui-color-secondary-contrast); }
    .body { min-width: 0; }
    .row { display: flex; flex-wrap: wrap; align-items: baseline; column-gap: var(--ui-space-2); }
    .title { font-size: var(--ui-font-size-md); color: var(--ui-color-text); font-weight: 500; min-width: 0; overflow-wrap: anywhere; }
    .meta { font-size: 12px; color: var(--ui-color-text-muted); font-variant-numeric: tabular-nums; }
    .desc { font-size: var(--ui-font-size-sm); color: var(--ui-color-text-muted); margin-top: 2px; }
  `,
})
export class UiTimeline {
  items = input<UiTimelineItem[]>([]);

  /** A HugeIcons icon is an array of [tag, attributes] pairs; a text icon is a string. */
  protected isSvg(icon: string | IconSvgObject | undefined): icon is IconSvgObject {
    return Array.isArray(icon);
  }
}
