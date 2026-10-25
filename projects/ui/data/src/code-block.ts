import { Component, inject, input, signal } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { HugeiconsIconComponent } from '@hugeicons/angular';
import { UiScrollFade } from '@zouriel/ui/behaviors';
import Alert02Icon from '@hugeicons/core-free-icons/Alert02Icon';
import Copy01Icon from '@hugeicons/core-free-icons/Copy01Icon';
import Tick02Icon from '@hugeicons/core-free-icons/Tick02Icon';

/** `ui-code-block` — monospace code panel with language label and copy button; long lines scroll sideways, the cut edge fading out. */
@Component({
  selector: 'ui-code-block',
  imports: [HugeiconsIconComponent, UiScrollFade],
  template: `
    <div class="cb" [class.no-radius]="!radius()">
      <div class="bar">
        <span class="lang">{{ language() }}</span>
        <button type="button" class="copy" [class.failed]="state() === 'failed'" (click)="copy()">
          <hugeicons-icon [icon]="state() === 'copied' ? tickIcon : state() === 'failed' ? alertIcon : copyIcon" [size]="14" [strokeWidth]="1.5" aria-hidden="true" />
          <span aria-live="polite">{{ state() === 'copied' ? 'Copied' : state() === 'failed' ? 'Copy failed' : 'Copy' }}</span>
        </button>
      </div>
      <!-- Code reads left to right in every language (0.46.0): an RTL page mirrors the header, not the code. -->
      <pre class="code" dir="ltr" uiScrollFade><code>{{ code() }}</code></pre>
    </div>
  `,
  styles: `
    :host { display: block; }
    .cb { border: 1px solid var(--ui-color-border); border-radius: var(--ui-radius); overflow: hidden; background: var(--ui-color-surface); }
    .cb.no-radius { border-radius: 0; }
    .bar { display: flex; align-items: center; justify-content: space-between; padding: 2px var(--ui-space-2) 2px var(--ui-space-3);
      background: var(--ui-color-surface-raised); border-bottom: 1px solid var(--ui-color-border); }
    .lang { font-family: var(--ui-font-default); font-size: 12px; color: var(--ui-color-text-muted); text-transform: uppercase; letter-spacing: 0.04em; }
    .copy { position: relative; box-sizing: border-box; display: inline-flex; align-items: center; gap: var(--ui-space-1); height: var(--ui-size-sm); padding: 0 var(--ui-space-2); border: none; border-radius: var(--ui-radius-xs);
      background: transparent; color: var(--ui-color-text-muted); cursor: pointer; font: inherit; font-family: var(--ui-font-default); font-size: 12px;
      transition: background var(--ui-motion-fast) var(--ui-ease-standard), color var(--ui-motion-fast) var(--ui-ease-standard); }
    .copy:hover { background: var(--ui-color-surface-hover); color: var(--ui-color-text); }
    .copy.failed { color: var(--ui-color-danger); }
    @media (pointer: coarse) { .copy::before { content: ''; position: absolute; inset: calc((var(--ui-size-sm) - var(--ui-size-touch)) / 2) 0; } }
    .copy:focus-visible { outline: none; box-shadow: var(--ui-focus-ring); border-radius: var(--ui-radius-xs); }
    .code { margin: 0; padding: var(--ui-space-3); overflow: auto; }
    code { font-family: var(--ui-font-mono); font-size: var(--ui-font-size-sm); color: var(--ui-color-text); white-space: pre; line-height: 1.5; tab-size: 2; }
  `,
})
export class UiCodeBlock {
  private doc = inject(DOCUMENT);
  code = input('');
  language = input('text');
  radius = input(true);
  protected readonly copyIcon = Copy01Icon;
  protected readonly tickIcon = Tick02Icon;
  protected readonly alertIcon = Alert02Icon;
  protected readonly state = signal<'idle' | 'copied' | 'failed'>('idle');
  private resetTimer?: ReturnType<typeof setTimeout>;

  protected async copy(): Promise<void> {
    const text = this.code();
    const clipboard = this.doc.defaultView?.navigator.clipboard;
    try {
      if (!clipboard) throw new Error('Clipboard unavailable');
      await clipboard.writeText(text);
      this.state.set('copied');
    } catch {
      // Insecure context or permission denied: say so rather than claim it worked.
      this.state.set('failed');
    }
    clearTimeout(this.resetTimer);
    this.resetTimer = setTimeout(() => this.state.set('idle'), 1500);
  }
}
