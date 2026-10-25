import { Component, computed, inject, input } from '@angular/core';
import { UI_CONFIG, type UiChatBubbleSide } from '@zouriel/ui';

/**
 * `ui-chat-bubble` — one message in a conversation. The person's own (`mine`) sit at the inline end
 * in the primary colour; the other side's at the inline start on the raised surface. Both follow the
 * text direction (in RTL, mine sit on the left). `meta` is a small line under the text: the time,
 * a read status. The corner nearest the speaker is tucked in, so a run of bubbles reads as one side.
 *
 *   <ui-chat-bubble [mine]="true" meta="09:41 · Read">On my way</ui-chat-bubble>
 *
 * `mineSide="right"` (0.46.3) keeps yours on the physical right and theirs on the left in LTR and RTL
 * alike, with the tucked corners and the meta line following (as in LTR); the text then takes its own
 * direction (`dir="auto"`: Thaana right to left, Latin left to right). `provideUiConfig({ chatMineSide:
 * 'right' })` sets it app-wide. The default, `'end'`, is unchanged.
 *
 * Put bubbles in a column (flex, gap) and they align themselves. Each takes the full row whatever the
 * parent's alignment, so text wraps at 80% of the column, between words; a word too long for that
 * (a URL) breaks only where it would overflow.
 */
@Component({
  selector: 'ui-chat-bubble',
  host: { '[class.mine]': 'mine()', '[class.side-right]': "side() === 'right'", role: 'group', '[attr.aria-label]': 'ariaLabel() || null' },
  template: `
    <div class="bubble">
      <div class="text" [attr.dir]="side() === 'right' ? 'auto' : null"><ng-content /></div>
      @if (meta()) { <div class="meta">{{ meta() }}</div> }
    </div>
  `,
  styles: `
    /* The host always takes the whole row, whatever the parent's alignment (flex, grid or a row), so
       the 80% below never resolves against a host shrunk to its own text. */
    :host {
      display: flex; justify-content: flex-start; box-sizing: border-box;
      align-self: stretch; justify-self: stretch; width: 100%; min-width: 0;
    }
    :host(.mine) { justify-content: flex-end; }
    .bubble {
      max-width: 80%; box-sizing: border-box; padding: var(--ui-space-2) var(--ui-space-3);
      border-radius: var(--ui-radius-lg);
      background: var(--ui-color-surface-raised); color: var(--ui-color-text);
      border: 1px solid var(--ui-color-border);
      font-family: var(--ui-font-default); font-size: var(--ui-font-size-md); line-height: 1.45;
      overflow-wrap: break-word; white-space: pre-line;
    }
    :host(.mine) .bubble {
      background: var(--ui-color-primary); color: var(--ui-color-primary-contrast); border-color: transparent;
    }
    /* The tucked corner. mineSide="end" (the default): the bottom corner at the speaker's inline side.
       mineSide="right": physical sides whatever the direction, laid out as in LTR. The two sets never
       apply together, so a logical corner can't fight a physical one. Auto margins win over
       justify-content, so the row's own alignment doesn't matter. */
    :host(:not(.side-right)) .bubble { border-end-start-radius: var(--ui-radius-xs); }
    :host(.mine:not(.side-right)) .bubble { border-end-start-radius: var(--ui-radius-lg); border-end-end-radius: var(--ui-radius-xs); }
    :host(.side-right) .bubble {
      margin-left: 0; margin-right: auto;
      border-bottom-left-radius: var(--ui-radius-xs); border-bottom-right-radius: var(--ui-radius-lg);
    }
    :host(.side-right.mine) .bubble {
      margin-left: auto; margin-right: 0;
      border-bottom-left-radius: var(--ui-radius-lg); border-bottom-right-radius: var(--ui-radius-xs);
    }
    .meta { margin-top: 2px; font-size: 12px; color: var(--ui-color-text-muted); text-align: end; font-variant-numeric: tabular-nums; white-space: normal; }
    :host(.side-right) .meta { text-align: right; }
    :host(.mine) .meta { color: color-mix(in srgb, var(--ui-color-primary-contrast) 80%, transparent); }
  `,
})
export class UiChatBubble {
  /** The person's own message: inline end (or right, see `mineSide`), primary colour. */
  mine = input(false);
  /**
   * Where your own messages sit (0.46.3): `'end'` the inline end (left in RTL), `'right'` always the
   * right, with theirs on the left. Unset follows `UiConfig.chatMineSide` (default `'end'`).
   */
  mineSide = input<UiChatBubbleSide | undefined>(undefined);
  /** A small line under the text: the time, a read status. */
  meta = input<string | undefined>(undefined);
  /** Names the message for screen readers ("You, 09:41"), when the text alone doesn't say who sent it. */
  ariaLabel = input<string | undefined>(undefined);

  private readonly config = inject(UI_CONFIG);
  /** The side policy in force: this bubble's `mineSide`, else the app's `chatMineSide`. */
  protected readonly side = computed<UiChatBubbleSide>(() => this.mineSide() ?? this.config.chatMineSide ?? 'end');
}
