import { booleanAttribute, Component, computed, input, output } from '@angular/core';
import { HugeiconsIconComponent } from '@hugeicons/angular';
import UnfoldMoreIcon from '@hugeicons/core-free-icons/UnfoldMoreIcon';
import type { UiStatus } from '@zouriel/ui';
import { UiAvatar, UiBadge } from '@zouriel/ui/badge';
import { UiTooltip } from '@zouriel/ui/overlay';
import type { UiRepositionPosition } from '@zouriel/ui/reposition';

let hintSeq = 0;

/**
 * `ui-sidebar-account` — the signed-in person at the bottom of a sidebar (`[sidebar-footer]` of
 * `ui-sidebar-layout`): avatar, name, a subtitle (job title · section), an optional badge
 * ("Read-only") and hint ("Switch test account"), and an unfold chevron saying it opens something.
 *
 * It is one real `<button>`: Tab focuses it, Enter and Space press it, and its accessible name is
 * the name, subtitle and badge (the hint is its description). Listen to `(activate)` to open a
 * drawer or switcher, or put it in a menu as the trigger, where `ui-menu` gives the button
 * `aria-haspopup` / `aria-expanded` and focus comes back to it:
 *
 *   <ui-menu sidebar-footer block [items]="accountItems" (select)="onAccount($event)">
 *     <ui-sidebar-account menu-trigger [name]="user.name" [subtitle]="user.role" />
 *   </ui-menu>
 *
 * `collapsed` shows only the avatar, with the name and subtitle in a tooltip, for a sidebar narrowed
 * to an icon rail. `ui-sidebar-layout` has no rail mode of its own, so the app sets it.
 */
@Component({
  selector: 'ui-sidebar-account',
  imports: [HugeiconsIconComponent, UiAvatar, UiBadge, UiTooltip],
  host: { '[class.ui-collapsed]': 'collapsed()' },
  template: `
    <span class="wrap" [uiTooltip]="collapsed() ? label() : ''" uiTooltipPosition="right">
      <button
        type="button"
        class="acct"
        [disabled]="disabled()"
        [attr.aria-label]="label()"
        [attr.aria-describedby]="hint() && !collapsed() ? hintId : null"
        (click)="activate.emit()"
      >
        <ui-avatar
          class="avatar"
          [src]="src() || undefined"
          [name]="name()"
          [position]="position()"
          alt=""
          aria-hidden="true"
        />
        @if (!collapsed()) {
          <span class="text" aria-hidden="true">
            <span class="top">
              <span class="name">{{ name() }}</span>
              @if (badge()) {
                <ui-badge class="badge" [tone]="badgeTone()">{{ badge() }}</ui-badge>
              }
            </span>
            @if (subtitle()) {
              <span class="line sub">{{ subtitle() }}</span>
            }
            @if (hint()) {
              <span class="line hint" [id]="hintId">{{ hint() }}</span>
            }
          </span>
          @if (showChevron()) {
            <hugeicons-icon
              class="chev"
              aria-hidden="true"
              [icon]="unfoldIcon"
              [size]="16"
              [strokeWidth]="1.8"
            />
          }
        }
      </button>
    </span>
  `,
  styles: `
    :host {
      display: block;
      min-width: 0;
      font-family: var(--ui-font-default);
    }
    .wrap {
      display: block;
    }
    .acct {
      display: flex;
      align-items: center;
      gap: var(--ui-space-2);
      width: 100%;
      min-width: 0;
      box-sizing: border-box;
      min-height: var(--ui-size-touch);
      padding: var(--ui-space-2);
      background: none;
      border: none;
      border-radius: var(--ui-radius);
      color: var(--ui-color-text);
      font: inherit;
      text-align: start;
      cursor: pointer;
      transition:
        background var(--ui-motion-fast) var(--ui-ease-standard),
        transform var(--ui-motion-fast) var(--ui-ease-standard);
    }
    .acct:hover:not(:disabled) {
      background: var(--ui-color-surface-hover);
    }
    .acct:active:not(:disabled) {
      background: var(--ui-color-surface-hover);
      transform: scale(var(--ui-scale-press));
    }
    /* Open as a menu trigger: ui-menu sets aria-expanded on the button. */
    .acct[aria-expanded='true'],
    .acct[aria-expanded='true']:hover:not(:disabled) {
      background: var(--ui-color-selected);
    }
    .acct:focus-visible {
      outline: none;
      box-shadow: var(--ui-focus-ring);
    }
    .acct:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
    .avatar {
      flex: none;
    }
    .text {
      flex: 1 1 auto;
      min-width: 0;
      display: flex;
      flex-direction: column;
      line-height: 1.3;
    }
    .top {
      display: flex;
      align-items: center;
      gap: var(--ui-space-2);
      min-width: 0;
    }
    .name {
      flex: 0 1 auto;
      min-width: 0;
      font-size: var(--ui-font-size-sm);
      font-weight: 600;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .badge {
      flex: none;
    }
    .line {
      font-size: 12px;
      color: var(--ui-color-text-muted);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .chev {
      flex: none;
      color: var(--ui-color-text-muted);
    }
    :host(.ui-collapsed) .acct {
      justify-content: center;
      width: auto;
      margin-inline: auto;
    }
    @media (prefers-reduced-motion: reduce) {
      .acct {
        transition: none;
      }
      .acct:active:not(:disabled) {
        transform: none;
      }
    }
  `,
})
export class UiSidebarAccount {
  /** The person's name; also the avatar's initials when there is no image. */
  name = input.required<string>();
  /** A second line, e.g. job title · section. */
  subtitle = input<string | null | undefined>(undefined);
  /** Profile photo URL; without one (or if it fails to load) the avatar shows initials. */
  src = input<string | null | undefined>(undefined);
  /** Focal point used when the profile photo is cover-cropped. */
  position = input<UiRepositionPosition>({ x: 50, y: 50 });
  /** A short label after the name, e.g. "Read-only". */
  badge = input<string | null | undefined>(undefined);
  /** The badge's colour. */
  badgeTone = input<UiStatus>('neutral');
  /** A small third line saying what the button does, e.g. "Switch test account". */
  hint = input<string | null | undefined>(undefined);
  /** The unfold chevron at the end, saying it opens something. */
  showChevron = input(true, { transform: booleanAttribute });
  disabled = input(false, { transform: booleanAttribute });
  /** Only the avatar, with the name and subtitle in a tooltip: for a sidebar narrowed to a rail. */
  collapsed = input(false, { transform: booleanAttribute });
  /** Pressed (click, Enter or Space). Not emitted while disabled. */
  activate = output<void>();

  protected readonly unfoldIcon = UnfoldMoreIcon;
  protected readonly hintId = `ui-sidebar-account-hint-${hintSeq++}`;
  /** The accessible name and the collapsed tooltip: name, subtitle and badge. */
  protected readonly label = computed(() =>
    [this.name(), this.subtitle(), this.badge()]
      .map((s) => s?.trim())
      .filter(Boolean)
      .join(', '),
  );
}
