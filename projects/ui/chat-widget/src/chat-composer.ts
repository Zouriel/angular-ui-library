import { Component, ElementRef, input, output, signal, viewChild } from '@angular/core';
import { HugeiconsIconComponent } from '@hugeicons/angular';
import Attachment01Icon from '@hugeicons/core-free-icons/Attachment01Icon';
import SentIcon from '@hugeicons/core-free-icons/SentIcon';

/**
 * `ui-chat-composer` — multiline auto-growing chat input with Enter-to-send,
 * Shift+Enter for a newline, optional file attachment button, and a round send button.
 */
@Component({
  selector: 'ui-chat-composer',
  imports: [HugeiconsIconComponent],
  template: `
    @if (attach()) {
      <button
        class="attach"
        type="button"
        [disabled]="disabled() || busy()"
        [attr.aria-label]="attachLabel()"
        (click)="file.click()"
      >
        <hugeicons-icon aria-hidden="true" [icon]="attachIcon" [size]="22" />
      </button>
      <input #file hidden type="file" [accept]="accept()" [multiple]="multiple()" (change)="picked($event)" />
    }
    <label class="field">
      <span class="sr">{{ inputLabel() }}</span>
      <textarea
        #box
        rows="1"
        dir="auto"
        [placeholder]="placeholder()"
        [disabled]="disabled() || busy()"
        (input)="grow($event)"
        (keydown)="key($event)"
      ></textarea>
    </label>
    <button
      class="send"
      type="button"
      [disabled]="disabled() || busy() || !draft().trim()"
      [attr.aria-label]="sendLabel()"
      (click)="submit()"
    >
      <hugeicons-icon aria-hidden="true" [icon]="sendIcon" [size]="22" />
    </button>
  `,
  styles: `
    :host {
      display: flex;
      align-items: flex-end;
      gap: 6px;
      padding: 10px 10px 12px;
      border-top: 1px solid var(--ui-color-border-subtle, var(--ui-color-border));
      background: var(--ui-color-surface);
    }
    .field {
      flex: 1;
      min-width: 0;
      display: flex;
      align-items: flex-end;
      border: 1px solid var(--ui-color-border-strong);
      border-radius: 22px;
      background: var(--ui-color-bg);
      padding: 0 var(--ui-space-1) 0 14px;
    }
    .field:focus-within {
      border-color: var(--ui-color-border-focus);
      box-shadow: var(--ui-focus-ring);
    }
    textarea {
      flex: 1;
      min-width: 0;
      border: 0;
      outline: 0;
      resize: none;
      background: none;
      color: var(--ui-color-text);
      font: inherit;
      font-size: var(--ui-font-size-md);
      line-height: 20px;
      padding: 10px 0;
      height: 20px;
      max-height: 120px;
    }
    textarea::placeholder {
      color: var(--ui-color-text-muted);
    }
    button {
      flex: none;
      border: 0;
      display: grid;
      place-items: center;
      cursor: pointer;
    }
    .attach {
      width: 44px;
      height: 44px;
      border-radius: 50%;
      background: none;
      color: var(--ui-color-icon);
    }
    .attach:hover:not(:disabled) {
      background: var(--ui-color-surface-hover);
    }
    .send {
      width: 44px;
      height: 44px;
      border-radius: 50%;
      background: var(--ui-color-primary);
      color: var(--ui-color-primary-contrast);
    }
    button:disabled {
      background: var(--ui-color-surface-subtle);
      color: var(--ui-color-text-disabled);
      cursor: default;
    }
    button:focus-visible {
      outline: none;
      box-shadow: var(--ui-focus-ring);
    }
    .sr {
      position: absolute;
      width: 1px;
      height: 1px;
      overflow: hidden;
      clip: rect(0, 0, 0, 0);
    }
    :host-context([dir='rtl']) .field {
      padding: 0 14px 0 var(--ui-space-1);
    }
    :host-context([dir='rtl']) .send {
      transform: scaleX(-1);
    }
  `,
})
export class UiChatComposer {
  readonly attach = input(false);
  readonly accept = input('');
  readonly multiple = input(false);
  readonly disabled = input(false);
  readonly busy = input(false);
  readonly placeholder = input('Ask a question…');
  readonly inputLabel = input('Message');
  readonly attachLabel = input('Attach a document');
  readonly sendLabel = input('Send');

  readonly send = output<string>();
  readonly files = output<File[]>();

  protected readonly attachIcon = Attachment01Icon;
  protected readonly sendIcon = SentIcon;
  protected readonly draft = signal('');

  private readonly box = viewChild<ElementRef<HTMLTextAreaElement>>('box');

  protected grow(e: Event): void {
    const el = e.target as HTMLTextAreaElement;
    this.draft.set(el.value);
    el.style.height = '20px';
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  }

  protected key(e: KeyboardEvent): void {
    if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
      e.preventDefault();
      this.submit();
    }
  }

  protected submit(): void {
    const el = this.box()?.nativeElement;
    const text = el?.value.trim() ?? '';
    if (!text || this.disabled() || this.busy()) return;
    this.send.emit(text);
    el!.value = '';
    el!.style.height = '20px';
    this.draft.set('');
  }

  protected picked(e: Event): void {
    const el = e.target as HTMLInputElement;
    const picked = Array.from(el.files ?? []);
    if (picked.length) this.files.emit(picked);
    el.value = '';
  }
}
