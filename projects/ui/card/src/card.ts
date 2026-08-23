import { Component, inject, input } from '@angular/core';
import { UI_CONFIG } from '@zouriel/ui';

/**
 * `ui-card` — surface container with optional header/footer slots.
 * Project header content with `[card-header]` and footer with `[card-footer]`.
 */
@Component({
  selector: 'ui-card',
  template: `
    <div class="ui-card" [class.glass]="glass()" [class.no-radius]="!radius()" [class.interactive]="interactive()" [attr.data-pad]="padding()">
      <div class="hd"><ng-content select="[card-header]" /></div>
      <div class="bd"><ng-content /></div>
      <div class="ft"><ng-content select="[card-footer]" /></div>
    </div>
  `,
  styles: `
    :host { display: block; }
    .ui-card {
      display: flex; flex-direction: column;
      /* Fill the host so cards in a stretched context (e.g. a CSS grid) are equal height. In normal
         flow the host height is content-driven, so this resolves to auto and changes nothing. */
      height: 100%;
      background: var(--ui-color-surface);
      border: 1px solid var(--ui-color-border);
      border-radius: var(--ui-radius-lg);
      box-shadow: var(--ui-shadow-1);
      overflow: hidden;
      font-family: var(--ui-font-default);
    }
    /* Opt-in: for cards that are themselves the clickable surface (a template/listing card
       wrapped in a link, say) — lifts the whole card on hover so it reads as a target, not
       just decoration. Static/informational cards leave this off. */
    .ui-card.interactive {
      cursor: pointer;
      transition: transform var(--ui-motion-base) var(--ui-ease-standard),
                  box-shadow var(--ui-motion-base) var(--ui-ease-standard),
                  border-color var(--ui-motion-base) var(--ui-ease-standard);
    }
    .ui-card.interactive:hover { transform: translateY(-3px); box-shadow: var(--ui-shadow-2); border-color: var(--ui-color-primary); }
    .ui-card.interactive:active { transform: translateY(-1px) scale(var(--ui-scale-press)); }
    /* Body takes the slack so a [card-footer] (e.g. an actions row) bottom-aligns across a grid of cards. */
    .bd { flex: 1 1 auto; }
    .ui-card.no-radius { border-radius: 0; }
    .ui-card.glass {
      background: var(--ui-glass-bg);
      backdrop-filter: blur(var(--ui-glass-blur));
      border-color: var(--ui-glass-border);
    }
    .hd, .bd, .ft { padding: var(--ui-space-3) var(--ui-space-4); }
    .ui-card[data-pad="sm"] .hd, .ui-card[data-pad="sm"] .bd, .ui-card[data-pad="sm"] .ft { padding: var(--ui-space-2) var(--ui-space-3); }
    .ui-card[data-pad="lg"] .hd, .ui-card[data-pad="lg"] .bd, .ui-card[data-pad="lg"] .ft { padding: var(--ui-space-6) var(--ui-space-8); }
    .hd { border-bottom: 1px solid var(--ui-color-border); font-weight: 600; }
    .ft { border-top: 1px solid var(--ui-color-border); }
    /* Collapse empty header/footer slots */
    .hd:empty, .ft:empty { display: none; }
  `,
})
export class UiCard {
  private config = inject(UI_CONFIG);
  padding = input<'sm' | 'md' | 'lg'>('md');
  glass = input<boolean>(this.config.glass);
  radius = input<boolean>(this.config.radius);
  /** Opt-in hover lift for cards that are themselves a clickable target (e.g. wrapped in
   *  an `<a>`). Off by default — static/informational cards shouldn't look clickable. */
  interactive = input(false);
}
