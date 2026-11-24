import { Component, input, output } from '@angular/core';
import { HugeiconsIconComponent } from '@hugeicons/angular';
import Link01Icon from '@hugeicons/core-free-icons/Link01Icon';

export interface UiChatAction { id: string; label: string }

@Component({
  selector: 'ui-chat-actions',
  template: `@for (action of actions(); track action.id) { <button type="button" [disabled]="disabled()" (click)="pick.emit(action.id)">{{ action.label }}</button> }`,
  styles: `:host{display:flex;flex-wrap:wrap;gap:var(--ui-space-2)}button{min-height:36px;padding:6px 14px;border-radius:var(--ui-radius-pill);border:1px solid color-mix(in srgb,var(--ui-color-primary) 45%,var(--ui-color-border));background:var(--ui-color-surface);color:var(--ui-color-primary);font:inherit;font-size:var(--ui-font-size-sm);cursor:pointer}button:hover:not(:disabled){background:color-mix(in srgb,var(--ui-color-primary) 8%,var(--ui-color-surface));border-color:var(--ui-color-primary)}button:focus-visible{outline:none;box-shadow:var(--ui-focus-ring)}button:disabled{opacity:.5;cursor:default}`,
})
export class UiChatActions {
  readonly actions = input<readonly UiChatAction[]>([]);
  readonly disabled = input(false);
  readonly pick = output<string>();
}

@Component({
  selector: 'ui-chat-typing',
  host: { role: 'status', '[attr.aria-live]': "'polite'", '[attr.aria-label]': 'label()' },
  template: `<span aria-hidden="true"></span><span aria-hidden="true"></span><span aria-hidden="true"></span>`,
  styles: `:host{align-self:flex-start;display:inline-flex;gap:4px;padding:13px 14px;border:1px solid var(--ui-color-border);border-radius:var(--ui-radius-lg);border-end-start-radius:var(--ui-radius-xs);background:var(--ui-color-surface-raised)}span{width:7px;height:7px;border-radius:50%;background:var(--ui-color-text-muted);animation:ui-chat-blink 1.2s infinite ease-in-out}span:nth-child(2){animation-delay:.15s}span:nth-child(3){animation-delay:.3s}@keyframes ui-chat-blink{0%,60%,100%{opacity:.3;transform:translateY(0)}30%{opacity:1;transform:translateY(-3px)}}@media(prefers-reduced-motion:reduce){span{animation:none;opacity:.6}}`,
})
export class UiChatTyping { readonly label = input('Assistant is typing'); }

@Component({
  selector: 'ui-chat-source',
  imports: [HugeiconsIconComponent],
  host: { '[class.link]': '!!href()' },
  template: `@if (href()) {<a [href]="href()"><hugeicons-icon aria-hidden="true" [icon]="icon" [size]="13"/><span>{{label()}}</span></a>} @else {<span class="plain"><hugeicons-icon aria-hidden="true" [icon]="icon" [size]="13"/><span>{{label()}}</span></span>}`,
  styles: `:host{display:inline-flex;max-width:100%}a,.plain{display:inline-flex;align-items:center;gap:5px;max-width:100%;padding:3px 9px 3px 7px;border-radius:var(--ui-radius-pill);font:inherit;font-size:12px;color:var(--ui-color-text-secondary);background:var(--ui-color-surface);border:1px solid var(--ui-color-border);text-decoration:none}a:hover{border-color:var(--ui-color-border-strong);color:var(--ui-color-text)}a:focus-visible{outline:none;box-shadow:var(--ui-focus-ring)}span span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}`,
})
export class UiChatSource { readonly label = input.required<string>(); readonly href = input<string | null>(null); protected readonly icon = Link01Icon; }
