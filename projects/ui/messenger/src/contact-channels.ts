import { NgTemplateOutlet } from '@angular/common';
import { Component, DestroyRef, ElementRef, afterNextRender, computed, inject, input, output, signal } from '@angular/core';
import Mail01Icon from '@hugeicons/core-free-icons/Mail01Icon';
import SmartPhone01Icon from '@hugeicons/core-free-icons/SmartPhone01Icon';
import { HugeiconsIconComponent } from '@hugeicons/angular';
import Tick02Icon from '@hugeicons/core-free-icons/Tick02Icon';
import { injectUiStrings } from '@zouriel/ui';
import { UiButton } from '@zouriel/ui/button';
import { UiTooltip } from '@zouriel/ui/overlay';
import { UiSpinner } from '@zouriel/ui/spinner';
import { UiMessengerButton } from './messenger-button';
import type { UiMessengerApp } from './messenger-brand';

let nextId = 0;

/** Where the guest's email stands. 'sent'/'delivered' tick; 'failed'/'bounced' offer Retry; 'none'/'skipped' offer Send. */
export type UiEmailStatus = 'none' | 'skipped' | 'sent' | 'delivered' | 'failed' | 'bounced';

/** How `ui-contact-channels` lays its contacts out. */
export type UiContactLayout = 'columns' | 'compact';

/** One messenger button under the number. */
export interface UiMessengerChannel {
  app: UiMessengerApp;
  /** Used already: shows the tick badge. */
  ticked?: boolean;
  /** What the tick means ("Opened in WhatsApp · 3:14 pm"). */
  tickLabel?: string;
  /** The button's accessible name ("Send to Aisha on WhatsApp"). */
  ariaLabel?: string;
  /** Leave this app out (e.g. not offered for this country). */
  hidden?: boolean;
}

/**
 * `ui-contact-channels` — one person's ways to be reached, in columns that line up: an Email row
 * (label, address, status), a Number row, and under it a row of `ui-messenger-button`s.
 *
 * Every row shares the same three columns: the label column (at least 64px, as wide as the widest
 * label), the value column (the rest; long values end in an ellipsis with the full text on hover)
 * and the status column (at least 44px). The email's status sits at the end of its row: a success
 * tick when sent or delivered (`emailTickLabel` as its tooltip and name), Retry when it failed or
 * bounced (with `emailError` under the row), Send when not sent, a spinner while `emailBusy`.
 *
 * The messenger buttons start at the value column's edge, under the number: since 0.58.0 small
 * (28px to look at, like the library's small icon buttons, 44px to tap) and icon-only, the official
 * logos alone, 8px apart, so the whole
 * block stays compact; each names itself ("Send to Aisha on WhatsApp") and keeps its own tick.
 * Each can be ticked on its own. The component only reports presses: the app sends and sets ticks.
 * Twin of Flutter's `UiContactChannels`.
 */
@Component({
  selector: 'ui-contact-channels',
  imports: [HugeiconsIconComponent, NgTemplateOutlet, UiButton, UiTooltip, UiSpinner, UiMessengerButton],
  host: { class: 'ui-contact-channels', '[class.compact]': "layout() === 'compact'" },
  template: `
    <ng-template #emailState>
          @if (emailBusy()) {
            <ui-spinner size="sm" />
          } @else if (emailSent()) {
            <span class="tick" [class.small]="layout() === 'compact'" role="img" [attr.aria-label]="emailTickLabel() || strings.contactEmailSent" [uiTooltip]="emailTickLabel() ?? ''">
              <hugeicons-icon [icon]="tickIcon" [size]="layout() === 'compact' ? 16 : 20" [strokeWidth]="2" aria-hidden="true" />
            </span>
          } @else if (emailFailed()) {
            <ui-button size="sm" variant="outline" [ariaDescribedby]="emailError() ? errorId : undefined" (click)="emailRetry.emit()">{{ strings.contactRetry }}</ui-button>
          } @else {
            <ui-button size="sm" variant="outline" (click)="emailSend.emit()">{{ strings.contactSend }}</ui-button>
          }
    </ng-template>
    <ng-template #appButtons>
      @for (m of shown(); track m.app) {
        <ui-messenger-button [app]="m.app" size="sm" [compact]="true" [ticked]="!!m.ticked" [tickLabel]="m.tickLabel"
          [ariaLabel]="m.ariaLabel" (pressed)="messengerPress.emit(m.app)" />
      }
    </ng-template>
    @if (layout() === 'compact') {
      <div class="cmp">
        @if (email()) {
          <div class="line" data-row="email">
            <hugeicons-icon class="ico" [icon]="mailIcon" [size]="16" [strokeWidth]="1.8" aria-hidden="true" />
            <span class="v" [attr.title]="email()"><span class="vh">{{ emailLabel() ?? strings.contactEmail }}: </span>{{ email() }}</span>
            <span class="st"><ng-container [ngTemplateOutlet]="emailState" /></span>
          </div>
          @if (emailFailed() && emailError()) {
            <span class="cerr" [id]="errorId">{{ emailError() }}</span>
          }
        }
        @if (phone()) {
          <div class="line num" data-row="number">
            <hugeicons-icon class="ico" [icon]="phoneIcon" [size]="16" [strokeWidth]="1.8" aria-hidden="true" />
            <div #rest class="rest" [class.wrapped]="wrapped()">
              <span #num class="v" [attr.title]="phone()"><span class="vh">{{ numberLabel() ?? strings.contactNumber }}: </span>{{ phone() }}</span>
              @if (shown().length) {
                <div #capps class="capps"><ng-container [ngTemplateOutlet]="appButtons" /></div>
              }
            </div>
          </div>
        }
      </div>
    } @else {
    <div class="cc">
      @if (email()) {
        <span class="lbl" data-row="email">{{ emailLabel() ?? strings.contactEmail }}</span>
        <span class="val" data-row="email" [attr.title]="email()">{{ email() }}</span>
        <span class="status" data-row="email"><ng-container [ngTemplateOutlet]="emailState" /></span>
        @if (emailFailed() && emailError()) {
          <span class="err" [id]="errorId">{{ emailError() }}</span>
        }
      }
      @if (phone()) {
        <span class="lbl" data-row="number">{{ numberLabel() ?? strings.contactNumber }}</span>
        <span class="val wide" data-row="number" [attr.title]="phone()">{{ phone() }}</span>
        @if (shown().length) {
          <div class="apps"><ng-container [ngTemplateOutlet]="appButtons" /></div>
        }
      }
    </div>
    }
  `,
  styles: `
    :host { display: block; min-width: 0; }
    /* One grid for every row, so the label, value and status columns line up. */
    .cc {
      display: grid;
      grid-template-columns: minmax(64px, max-content) minmax(0, 1fr) minmax(var(--ui-size-touch), max-content);
      column-gap: var(--ui-space-3);
      row-gap: var(--ui-space-2);
      align-items: center;
      font-family: var(--ui-font-default);
      line-height: 20px;
    }
    .lbl, .status { min-height: 32px; display: flex; align-items: center; min-width: 0; }
    .lbl { grid-column: 1; font-size: var(--ui-font-size-sm); font-weight: 600; color: var(--ui-color-text-muted); white-space: nowrap; }
    /* One line, 32px, ending in an ellipsis; the full text is the title. */
    .val { grid-column: 2; display: block; min-width: 0; font-size: var(--ui-font-size-md); line-height: 32px; color: var(--ui-color-text);
      overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .val.wide { grid-column: 2 / -1; }
    .status { grid-column: 3; justify-content: flex-end; }
    /* The tick centres in a 44px box at the end, so ticks line up from row to row and card to card. */
    .tick { display: inline-flex; align-items: center; justify-content: center; width: var(--ui-size-touch); height: 32px; color: var(--ui-color-success); }
    .tick hugeicons-icon { display: block; line-height: 0; }
    .err { grid-column: 2 / -1; margin-top: calc(var(--ui-space-1) * -1); font-size: var(--ui-font-size-sm); line-height: 1.35; color: var(--ui-color-danger); overflow-wrap: anywhere; }
    /* Under the number, from the value column's edge: the logos alone on small 28px buttons, 8px
       apart, never stretched; 4px above for the tick badges. Each tap area is 44px tall and reaches
       half way across the gaps beside it (28 + 8 wide), so neighbours split the gap evenly. */
    .apps ui-messenger-button { --ui-messenger-hit-width: calc(28px + var(--ui-space-2)); }
    /* compact (0.60.0): one line per contact, no label column. Icon, value, and the state right after
       the value; the messenger buttons at the end of the number line, or under the value (from its
       text start) when the line is too narrow for both (measured). */
    /* compact fills its container's width and never widens it: a long address or number is
       ellipsised, not allowed to push a card (or a grid track) wider than the screen. */
    :host(.compact) { contain: inline-size; }
    .cmp { display: flex; flex-direction: column; gap: var(--ui-space-2); font-family: var(--ui-font-default); line-height: 20px; }
    .line { display: flex; align-items: center; gap: var(--ui-space-2); min-height: 28px; min-width: 0; }
    .ico { flex: none; display: block; line-height: 0; color: var(--ui-color-text-muted); }
    .v { position: relative; flex: 0 1 auto; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: var(--ui-font-size-md); color: var(--ui-color-text); }
    .vh { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
    .st { flex: none; display: flex; align-items: center; }
    .tick.small { width: auto; height: 28px; }
    .cerr { margin-top: calc(var(--ui-space-1) - var(--ui-space-2)); padding-inline-start: calc(16px + var(--ui-space-2)); font-size: var(--ui-font-size-sm); line-height: 1.35; color: var(--ui-color-danger); overflow-wrap: anywhere; }
    .rest { flex: 1 1 auto; min-width: 0; display: flex; align-items: center; gap: var(--ui-space-2); }
    .capps { flex: none; display: flex; align-items: center; gap: var(--ui-space-2); margin-inline-start: auto; }
    .capps ui-messenger-button { --ui-messenger-hit-width: calc(28px + var(--ui-space-2)); }
    .rest.wrapped { flex-direction: column; align-items: flex-start; gap: var(--ui-space-2); }
    .rest.wrapped .v { max-width: 100%; line-height: 28px; }
    .rest.wrapped .capps { margin-inline-start: 0; }
    .line.num:has(.rest.wrapped) { align-items: flex-start; }
    .line.num:has(.rest.wrapped) .ico { margin-top: 6px; }
    .apps { grid-column: 2 / -1; display: flex; flex-wrap: wrap; justify-content: flex-start; align-items: center; gap: var(--ui-space-2); padding-top: 4px; min-width: 0; }
  `,
})
export class UiContactChannels {
  /** The email address; no row without one. */
  email = input<string | null>();
  emailStatus = input<UiEmailStatus>('none');
  /** What the email tick means ("Emailed 4 Nov, 7:02 pm"): its tooltip and name. */
  emailTickLabel = input<string>();
  /** Why the email failed; shown under the row with Retry. */
  emailError = input<string>();
  /** Sending: a spinner in the status cell. */
  emailBusy = input(false);
  /** The phone number, shown as given (format it in the app). No row without one. */
  phone = input<string | null>();
  /** The messenger buttons under the number, in this order. */
  messengers = input<UiMessengerChannel[]>([]);
  /** Row labels; default the library strings ("Email", "Number"). */
  emailLabel = input<string>();
  numberLabel = input<string>();
  /**
   * 'columns' (default): label, value and status columns, the messenger buttons on their own row.
   * 'compact' (0.60.0, for a phone card): one line per contact, an icon instead of the label, the
   * state right after the value, the messenger buttons at the end of the number line.
   */
  layout = input<UiContactLayout>('columns');

  readonly emailSend = output<void>();
  readonly emailRetry = output<void>();
  readonly messengerPress = output<UiMessengerApp>();

  protected readonly strings = injectUiStrings();
  protected readonly tickIcon = Tick02Icon;
  protected readonly errorId = `ui-cc-err-${nextId++}`;
  protected readonly emailSent = computed(() => ['sent', 'delivered'].includes(this.emailStatus()));
  protected readonly emailFailed = computed(() => ['failed', 'bounced'].includes(this.emailStatus()));
  protected readonly shown = computed(() => this.messengers().filter((m) => !m.hidden));
  protected readonly mailIcon = Mail01Icon;
  protected readonly phoneIcon = SmartPhone01Icon;
  /** compact: the number and its buttons don't fit on one line, so the buttons go under the number. */
  protected readonly wrapped = signal(false);

  constructor() {
    const host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
    const destroy = inject(DestroyRef);
    afterNextRender(() => {
      if (typeof ResizeObserver === 'undefined') return;
      const measure = () => {
        const rest = host.querySelector<HTMLElement>('.rest');
        const num = rest?.querySelector<HTMLElement>('.v');
        const apps = rest?.querySelector<HTMLElement>('.capps');
        if (!rest || !num || !apps) return this.wrapped.set(false);
        // The number's full width (scrollWidth also counts what an ellipsis hides) + gap + the buttons.
        const need = num.scrollWidth + 8 + apps.getBoundingClientRect().width;
        this.wrapped.set(rest.getBoundingClientRect().width + 0.5 < need);
      };
      const ro = new ResizeObserver(measure);
      ro.observe(host);
      const mo = new MutationObserver(() => {
        ro.disconnect();
        ro.observe(host);
        for (const el of host.querySelectorAll('.rest, .rest .v, .capps')) ro.observe(el);
        measure();
      });
      mo.observe(host, { childList: true, subtree: true, characterData: true });
      for (const el of host.querySelectorAll('.rest, .rest .v, .capps')) ro.observe(el);
      measure();
      destroy.onDestroy(() => {
        ro.disconnect();
        mo.disconnect();
      });
    });
  }
}
