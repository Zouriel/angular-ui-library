import { Component, input } from '@angular/core';

/**
 * `ui-chat-bubble` — one message in a conversation. The person's own (`mine`) sit at the inline end
 * in the primary colour; the other side's at the inline start on the raised surface. Both follow the
 * text direction (in RTL, mine sit on the left). `meta` is a small line under the text: the time,
 * a read status. The corner nearest the speaker is tucked in, so a run of bubbles reads as one side.
 *
 *   <ui-chat-bubble [mine]="true" meta="09:41 · Read">On my way</ui-chat-bubble>
 *
 * Put bubbles in a column (flex, gap) and they align themselves. Text wraps at 80% of the column.
 */
@Component({
  selector: 'ui-chat-bubble',
  host: { '[class.mine]': 'mine()', role: 'group', '[attr.aria-label]': 'ariaLabel() || null' },
  template: `
    <div class="bubble">
      <div class="text"><ng-content /></div>
      @if (meta()) { <div class="meta">{{ meta() }}</div> }
    </div>
  `,
  styles: `
    :host { display: flex; justify-content: flex-start; }
    :host(.mine) { justify-content: flex-end; }
    .bubble {
      max-width: 80%; box-sizing: border-box; padding: var(--ui-space-2) var(--ui-space-3);
      border-radius: var(--ui-radius-lg); border-end-start-radius: var(--ui-radius-xs);
      background: var(--ui-color-surface-raised); color: var(--ui-color-text);
      border: 1px solid var(--ui-color-border);
      font-family: var(--ui-font-default); font-size: var(--ui-font-size-md); line-height: 1.45;
      overflow-wrap: anywhere; white-space: pre-line;
    }
    :host(.mine) .bubble {
      background: var(--ui-color-primary); color: var(--ui-color-primary-contrast); border-color: transparent;
      border-end-start-radius: var(--ui-radius-lg); border-end-end-radius: var(--ui-radius-xs);
    }
    .meta { margin-top: 2px; font-size: 12px; color: var(--ui-color-text-muted); text-align: end; font-variant-numeric: tabular-nums; white-space: normal; }
    :host(.mine) .meta { color: color-mix(in srgb, var(--ui-color-primary-contrast) 80%, transparent); }
  `,
})
export class UiChatBubble {
  /** The person's own message: inline end, primary colour. */
  mine = input(false);
  /** A small line under the text: the time, a read status. */
  meta = input<string | undefined>(undefined);
  /** Names the message for screen readers ("You, 09:41"), when the text alone doesn't say who sent it. */
  ariaLabel = input<string | undefined>(undefined);
}
