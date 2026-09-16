import { Component, ElementRef, ViewEncapsulation, forwardRef, inject, input, output, signal, viewChild } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { UI_CONFIG } from '@zouriel/ui';

/** One run of a token input's value: literal text, or an atomic token (a variable, a mention…). */
export interface UiTokenRun {
  text?: string;
  /** The token's machine value, e.g. `event.date`. */
  token?: string;
  bold?: boolean;
  italic?: boolean;
}

/**
 * `ui-token-input` — rich text where some pieces are atomic tokens rendered as chips (CVA over
 * `UiTokenRun[]`). Tokens behave like single characters: the caret skips them and one Backspace
 * removes one. Ctrl/⌘+B and Ctrl/⌘+I toggle bold and italic; pasting always inserts plain text.
 *
 * Insert a token at the caret with {@link insertToken}; `tokenLabel` turns a token value into the
 * text its chip shows.
 */
@Component({
  selector: 'ui-token-input',
  template: `
    <div #editor class="editor" [class.no-radius]="!radius()" [class.single]="!multiline()"
      [attr.contenteditable]="disabled() ? 'false' : 'true'" role="textbox" [attr.aria-multiline]="multiline()"
      [attr.aria-label]="label() || null" [attr.aria-placeholder]="placeholder() || null" spellcheck="true"
      [attr.data-placeholder]="placeholder()" [class.empty]="empty()" [style.min-height]="minHeight()"
      (input)="read()" (keydown)="onKey($event)" (paste)="onPaste($event)" (blur)="onTouched()"
      (focus)="focusChange.emit(true)" (focusout)="focusChange.emit(false)" (click)="onClick($event)"></div>
  `,
  // Unencapsulated: token chips are created at runtime, and emulated encapsulation only styles nodes
  // Angular rendered itself. Every selector is scoped under the element name instead.
  encapsulation: ViewEncapsulation.None,
  styles: `
    ui-token-input { display: block; }
    ui-token-input .editor { position: relative; box-sizing: border-box; width: 100%; padding: var(--ui-space-2) var(--ui-space-3); background: var(--ui-color-surface);
      color: var(--ui-color-text); border: 1px solid var(--ui-control-border); border-radius: var(--ui-radius);
      font-family: var(--ui-font-default); font-size: var(--ui-font-size-md); line-height: 1.6; white-space: pre-wrap;
      overflow-wrap: anywhere; outline: none; cursor: text;
      transition: border-color var(--ui-motion-base) var(--ui-ease-standard), box-shadow var(--ui-motion-base) var(--ui-ease-standard); }
    ui-token-input .editor.single { white-space: nowrap; overflow: hidden; }
    ui-token-input .editor:focus { border-color: var(--ui-color-primary); box-shadow: 0 0 0 3px color-mix(in srgb, var(--ui-color-primary) 30%, transparent); }
    ui-token-input .editor[contenteditable="false"] { opacity: .55; cursor: not-allowed; }
    ui-token-input .editor.no-radius { border-radius: 0; }
    ui-token-input .editor.empty::before { content: attr(data-placeholder); color: var(--ui-color-text-muted); pointer-events: none; position: absolute; }
    ui-token-input .ui-token { display: inline-block; margin: 0 1px; padding: 0 7px; border-radius: var(--ui-radius-pill); white-space: nowrap;
      background: color-mix(in srgb, var(--ui-color-primary) 18%, var(--ui-color-surface)); color: var(--ui-color-text);
      border: 1px solid color-mix(in srgb, var(--ui-color-primary) 45%, transparent); font-size: .86em; line-height: 1.55;
      vertical-align: baseline; cursor: default; user-select: all; }
  `,
  providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => UiTokenInput), multi: true }],
})
export class UiTokenInput implements ControlValueAccessor {
  private readonly config = inject(UI_CONFIG);
  private readonly editor = viewChild.required<ElementRef<HTMLDivElement>>('editor');

  placeholder = input('');
  label = input('');
  multiline = input(true);
  minHeight = input<string | null>(null);
  radius = input<boolean>(this.config.radius);
  /** The chip text for a token value. */
  tokenLabel = input<(token: string) => string>((t) => t);

  readonly focusChange = output<boolean>();
  /** A token chip was clicked. */
  readonly tokenClick = output<string>();

  protected readonly disabled = signal(false);
  protected readonly empty = signal(true);
  private runs: UiTokenRun[] = [];
  private onChange: (v: UiTokenRun[]) => void = () => {};
  protected onTouched: () => void = () => {};
  private lastRange: Range | null = null;

  writeValue(value: UiTokenRun[] | null): void {
    const next = normalizeRuns(value ?? []);
    if (sameRuns(next, this.runs) && this.editor().nativeElement.childNodes.length > 0) return;
    this.runs = next;
    this.render();
  }
  registerOnChange(fn: (v: UiTokenRun[]) => void): void { this.onChange = fn; }
  registerOnTouched(fn: () => void): void { this.onTouched = fn; }
  setDisabledState(d: boolean): void { this.disabled.set(d); }

  /** Inserts a token at the caret — or at the end, when the field doesn't have the caret. */
  insertToken(token: string): void {
    const el = this.editor().nativeElement;
    const chip = this.chip(token);
    const selection = window.getSelection();
    let range: Range | null = null;
    if (selection && selection.rangeCount > 0 && el.contains(selection.getRangeAt(0).startContainer)) range = selection.getRangeAt(0);
    else if (this.lastRange && el.contains(this.lastRange.startContainer)) range = this.lastRange;

    if (range) {
      range.deleteContents();
      range.insertNode(chip);
      range.setStartAfter(chip);
      range.collapse(true);
      selection?.removeAllRanges();
      selection?.addRange(range);
    } else {
      el.appendChild(chip);
    }
    this.read();
  }

  /** Focuses the field with the caret at the end. */
  focus(): void {
    const el = this.editor().nativeElement;
    el.focus();
    const range = document.createRange();
    range.selectNodeContents(el);
    range.collapse(false);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
  }

  protected onKey(e: KeyboardEvent): void {
    const mod = e.metaKey || e.ctrlKey;
    if (mod && (e.key === 'b' || e.key === 'i')) {
      e.preventDefault();
      document.execCommand(e.key === 'b' ? 'bold' : 'italic');
      this.read();
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      if (this.multiline()) {
        document.execCommand('insertLineBreak');
        this.read();
      }
    }
    queueMicrotask(() => this.remember());
  }

  protected onPaste(e: ClipboardEvent): void {
    e.preventDefault();
    let text = e.clipboardData?.getData('text/plain') ?? '';
    if (!this.multiline()) text = text.replace(/\s*\n\s*/g, ' ');
    document.execCommand('insertText', false, text);
    this.read();
  }

  protected onClick(e: MouseEvent): void {
    const chip = (e.target as HTMLElement).closest?.('.ui-token') as HTMLElement | null;
    if (chip?.dataset['token']) this.tokenClick.emit(chip.dataset['token']);
    this.remember();
  }

  /** Reads the DOM back into runs and reports them. */
  protected read(): void {
    const el = this.editor().nativeElement;
    const runs: UiTokenRun[] = [];
    const walk = (node: Node, bold: boolean, italic: boolean) => {
      if (node.nodeType === Node.TEXT_NODE) {
        const text = (node.textContent ?? '').replace(/​/g, '');
        if (text) runs.push({ text, bold, italic });
        return;
      }
      if (!(node instanceof HTMLElement)) return;
      if (node.classList.contains('ui-token')) {
        runs.push({ token: node.dataset['token'] ?? '', bold, italic });
        return;
      }
      if (node.tagName === 'BR') {
        // A trailing <br> is how browsers keep an empty last line open; it isn't content.
        if (node.nextSibling || node.parentElement !== el) runs.push({ text: '\n', bold, italic });
        return;
      }
      const weight = node.style.fontWeight;
      const b = bold || node.tagName === 'B' || node.tagName === 'STRONG' || weight === 'bold' || Number(weight) >= 600;
      const i = italic || node.tagName === 'I' || node.tagName === 'EM' || node.style.fontStyle === 'italic';
      const block = node.tagName === 'DIV' || node.tagName === 'P';
      if (block && runs.length > 0) runs.push({ text: '\n', bold: false, italic: false });
      node.childNodes.forEach((child) => walk(child, b, i));
    };
    el.childNodes.forEach((child) => walk(child, false, false));

    this.runs = normalizeRuns(runs);
    this.empty.set(this.runs.length === 0);
    this.onChange(this.runs.map((r) => ({ ...r })));
    this.remember();
  }

  private render(): void {
    const el = this.editor().nativeElement;
    el.replaceChildren();
    for (const run of this.runs) {
      let node: Node = run.token !== undefined ? this.chip(run.token) : document.createTextNode(run.text ?? '');
      if (run.text !== undefined && run.text.includes('\n')) {
        const fragment = document.createDocumentFragment();
        run.text.split('\n').forEach((part, index) => {
          if (index > 0) fragment.appendChild(document.createElement('br'));
          if (part) fragment.appendChild(document.createTextNode(part));
        });
        node = fragment;
      }
      if (run.italic) { const i = document.createElement('i'); i.appendChild(node); node = i; }
      if (run.bold) { const b = document.createElement('b'); b.appendChild(node); node = b; }
      el.appendChild(node);
    }
    this.empty.set(this.runs.length === 0);
  }

  private chip(token: string): HTMLElement {
    const chip = document.createElement('span');
    chip.className = 'ui-token';
    chip.contentEditable = 'false';
    chip.dataset['token'] = token;
    chip.textContent = this.tokenLabel()(token);
    return chip;
  }

  private remember(): void {
    const selection = window.getSelection();
    const el = this.editor().nativeElement;
    if (selection && selection.rangeCount > 0 && el.contains(selection.getRangeAt(0).startContainer))
      this.lastRange = selection.getRangeAt(0).cloneRange();
  }
}

/** Merges adjacent text runs with the same marks and drops empty ones. */
export function normalizeRuns(runs: readonly UiTokenRun[]): UiTokenRun[] {
  const out: UiTokenRun[] = [];
  for (const run of runs) {
    const bold = !!run.bold;
    const italic = !!run.italic;
    if (run.token !== undefined && run.token !== null) {
      out.push({ token: run.token, ...(bold ? { bold } : {}), ...(italic ? { italic } : {}) });
      continue;
    }
    if (!run.text) continue;
    const prev = out[out.length - 1];
    if (prev && prev.token === undefined && !!prev.bold === bold && !!prev.italic === italic) prev.text = (prev.text ?? '') + run.text;
    else out.push({ text: run.text, ...(bold ? { bold } : {}), ...(italic ? { italic } : {}) });
  }
  return out;
}

function sameRuns(a: readonly UiTokenRun[], b: readonly UiTokenRun[]): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}
