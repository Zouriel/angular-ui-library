import { Component, computed, effect, input, signal } from '@angular/core';
import { injectUiStrings } from '@zouriel/ui';

/** `ui-code-viewer` — monospace source view with line numbers (content or fetched src). */
@Component({
  selector: 'ui-code-viewer',
  template: `
    <div class="cv">
      <div class="bar"><span class="lang">{{ language() }}</span></div>
      @if (loading()) { <div class="msg" role="status">{{ strings.loading }}</div> }
      @else if (error()) { <div class="msg err">{{ error() }}</div> }
      @else {
        <!-- Code and its line numbers read left to right on an RTL page too (0.46.0). -->
        <div class="body" dir="ltr">
          <div class="gutter" aria-hidden="true">@for (n of lineNumbers(); track n) { <span>{{ n }}</span> }</div>
          <pre class="code"><code>{{ text() }}</code></pre>
        </div>
      }
    </div>
  `,
  styles: `
    :host { display: block; height: 100%; }
    .cv { display: flex; flex-direction: column; height: 100%; background: var(--ui-color-surface); border-radius: var(--ui-radius); overflow: hidden; }
    .bar { display: flex; align-items: center; box-sizing: border-box; min-height: var(--ui-size-sm); padding: 0 var(--ui-space-3); line-height: 1.35; background: var(--ui-color-surface-raised); border-bottom: 1px solid var(--ui-color-border); }
    .lang { font-family: var(--ui-font-default); font-size: 11px; text-transform: uppercase; letter-spacing: 0.04em; color: var(--ui-color-text-muted); }
    .body { display: flex; flex: 1; overflow: auto; }
    /* Sticky so the line numbers stay put while long lines scroll sideways. */
    .gutter { position: sticky; left: 0; z-index: 1; display: flex; flex-direction: column; padding: var(--ui-space-3) var(--ui-space-2); text-align: right;
      color: var(--ui-color-text-muted); font-family: var(--ui-font-mono); font-size: var(--ui-font-size-sm); line-height: 1.5;
      user-select: none; border-right: 1px solid var(--ui-color-border); background: var(--ui-color-surface); }
    .code { margin: 0; padding: var(--ui-space-3); flex: 1; }
    code { font-family: var(--ui-font-mono); font-size: var(--ui-font-size-sm); color: var(--ui-color-text); white-space: pre; line-height: 1.5; }
    .msg { padding: var(--ui-space-4); color: var(--ui-color-text-muted); font-family: var(--ui-font-default); }
    .msg.err { color: var(--ui-color-danger); }
  `,
})
export class UiCodeViewer {
  protected readonly strings = injectUiStrings();
  src = input<string>();
  content = input<string>();
  language = input('text');
  protected readonly fetched = signal<string | null>(null);
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly text = computed(() => this.content() ?? this.fetched() ?? '');
  protected readonly lineNumbers = computed(() => {
    const lines = this.text().split('\n').length;
    return Array.from({ length: Math.max(1, lines) }, (_, i) => i + 1);
  });

  constructor() {
    effect(() => {
      const url = this.src();
      if (!url || this.content() !== undefined) return;
      this.loading.set(true);
      this.error.set(null);
      fetch(url)
        .then((r) => (r.ok ? r.text() : Promise.reject(new Error(`HTTP ${r.status}`))))
        .then((t) => this.fetched.set(t))
        .catch((e) => this.error.set(String(e)))
        .finally(() => this.loading.set(false));
    });
  }
}
