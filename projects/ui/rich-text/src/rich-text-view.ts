import { booleanAttribute, ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';
import { injectUiStrings } from '@zouriel/ui';
import { uiSanitizeRichText } from './sanitize';

const BLOCK_OPEN_TAG_RE = /<(p|h2|h3|li|blockquote|th|td)>/g;

/**
 * Adds `dir="auto"` to block elements in already-sanitized HTML so Thaana and English
 * paragraphs each flow in their own direction.
 */
export function uiAddRichTextBlockDir(sanitizedHtml: string): string {
  return sanitizedHtml.replace(BLOCK_OPEN_TAG_RE, '<$1 dir="auto">');
}

/**
 * `ui-rich-text-view` — renders sanitized rich text HTML using `ui-text` typography tokens.
 *
 * Uses {@link uiSanitizeRichText} with the same allowlist as `ui-rich-text`, sets `dir="auto"`
 * on each block for mixed Thaana/English content, and never loads Tiptap.
 */
@Component({
  selector: 'ui-rich-text-view',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[attr.lang]': 'resolvedLocale() || null',
    '[attr.dir]': 'resolvedDir()',
  },
  template: `<div class="rt-view" [innerHTML]="trustedHtml()"></div>`,
  styles: `
    :host {
      display: block;
      font-family: var(--ui-font-default);
      font-size: var(--ui-font-size-md);
      line-height: var(--ui-line-height-body, 1.45);
      color: var(--ui-color-text);
    }
    .rt-view ::ng-deep > :first-child { margin-top: 0; }
    .rt-view ::ng-deep > :last-child { margin-bottom: 0; }
    .rt-view ::ng-deep p {
      margin: 0 0 var(--ui-space-3);
      line-height: var(--ui-line-height-body, 1.45);
      text-wrap: pretty;
    }
    .rt-view ::ng-deep h2 {
      margin: var(--ui-space-5) 0 var(--ui-space-2);
      font-family: var(--ui-font-display);
      font-size: var(--ui-font-size-h2);
      font-weight: var(--ui-font-weight-heading, 700);
      line-height: var(--ui-line-height-heading, 1.18);
      letter-spacing: var(--ui-tracking-tight);
      text-wrap: balance;
    }
    .rt-view ::ng-deep h3 {
      margin: var(--ui-space-4) 0 var(--ui-space-2);
      font-family: var(--ui-font-display);
      font-size: var(--ui-font-size-h3);
      font-weight: var(--ui-font-weight-heading, 600);
      line-height: var(--ui-line-height-heading, 1.2);
      letter-spacing: var(--ui-tracking-tight);
      text-wrap: balance;
    }
    .rt-view ::ng-deep ul,
    .rt-view ::ng-deep ol {
      margin: 0 0 var(--ui-space-3);
      padding-inline-start: var(--ui-space-5);
    }
    .rt-view ::ng-deep li {
      margin-bottom: var(--ui-space-1);
      line-height: var(--ui-line-height-body, 1.45);
    }
    .rt-view ::ng-deep a {
      color: var(--ui-color-primary);
      text-decoration: underline;
      text-underline-offset: 2px;
    }
    .rt-view ::ng-deep a:focus-visible {
      outline: none;
      box-shadow: var(--ui-focus-ring);
      border-radius: var(--ui-radius-xs);
    }
    .rt-view ::ng-deep blockquote {
      margin: 0 0 var(--ui-space-3);
      border-inline-start: 2px solid var(--ui-color-border-strong);
      padding: var(--ui-space-2) var(--ui-space-4);
      color: var(--ui-color-text-secondary);
      line-height: var(--ui-line-height-body, 1.45);
      font-style: italic;
    }
    .rt-view ::ng-deep img {
      display: block;
      max-width: 100%;
      height: auto;
      margin: var(--ui-space-3) 0;
      border-radius: var(--ui-radius-sm);
    }
    .rt-view ::ng-deep table {
      width: 100%;
      border-collapse: collapse;
      margin: var(--ui-space-3) 0;
    }
    .rt-view ::ng-deep th,
    .rt-view ::ng-deep td {
      border: 1px solid var(--ui-color-border);
      padding: var(--ui-space-2) var(--ui-space-3);
      text-align: start;
      vertical-align: top;
    }
    .rt-view ::ng-deep th {
      font-weight: var(--ui-font-weight-control, 600);
      background: var(--ui-color-surface-raised);
    }
  `,
})
export class UiRichTextView {
  private readonly sanitizer = inject(DomSanitizer);
  private readonly strings = injectUiStrings();

  /** Raw or sanitized HTML to display. Always sanitized before rendering. */
  html = input<string>('');
  /** Whether `<img>` elements are kept when sanitizing. */
  image = input(true, { transform: booleanAttribute });
  /** Whether table elements are kept when sanitizing. */
  table = input(true, { transform: booleanAttribute });
  /** Optional language tag (`en`, `dv`, …) for `lang` and default direction. */
  locale = input<string | undefined>(undefined);

  protected readonly resolvedLocale = computed(() => this.locale() ?? (this.strings.locale || undefined));
  protected readonly resolvedDir = computed<'ltr' | 'rtl' | null>(() => {
    const loc = this.resolvedLocale();
    if (!loc) return null;
    return /^(dv|ar|he|fa|ur)(?:[-_]|$)/i.test(loc) ? 'rtl' : 'ltr';
  });

  protected readonly sanitizedHtml = computed(() =>
    uiAddRichTextBlockDir(uiSanitizeRichText(this.html(), { image: this.image(), table: this.table() })),
  );

  protected readonly trustedHtml = computed(() =>
    // Output has already passed uiSanitizeRichText's strict allowlist.
    this.sanitizer.bypassSecurityTrustHtml(this.sanitizedHtml()),
  );
}
