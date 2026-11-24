import { Component, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { UiRichText, UiRichTextView, type UiRichTool } from '@zouriel/ui/rich-text';
import { UiText } from '@zouriel/ui/text';
import { DocDemo, DocPage, DocSection, type ApiRow } from '../docs/docs-ui';

const EDITOR_SNIPPET = `import { UiRichText, type UiRichTool } from '@zouriel/ui/rich-text';

const tools: UiRichTool[] = [
  'bold', 'italic', 'h2', 'h3', 'ul', 'ol', 'link', 'quote',
  'image', 'table', 'undo', 'redo',
];

<ui-rich-text
  [(ngModel)]="html"
  [tools]="tools"
  [maxLength]="500"
  [imageUpload]="uploadImage"
  placeholder="Write an announcement..."
/>`;

const VIEW_SNIPPET = `import { UiRichTextView } from '@zouriel/ui/rich-text';

<ui-rich-text-view [html]="html()" />`;

const SANITIZE_SNIPPET = `import { uiSanitizeRichText } from '@zouriel/ui/rich-text';

// Mirror the exact same allowlist on the server:
const safe = uiSanitizeRichText(dirtyHtml, { image: true, table: true });`;

const INITIAL_HTML =
  '<h2>Harbourside City Public Notice</h2>' +
  '<p>Council consultation on the <strong>Northgate Harbour</strong> upgrade is open until <em>30 November</em>.</p>' +
  '<p>ސިޓީ ކައުންސިލްގެ ޢާންމު މަޝްވަރާ ބައްދަލުވުމަށް މަރުޙަބާ. ޕްރޮޖެކްޓް ކޯޑު: PRJ-2026-14.</p>' +
  '<ul><li>Review the draft plan</li><li>Submit feedback online</li></ul>' +
  '<blockquote>All submissions are published in the public consultation log.</blockquote>' +
  '<p>More details at <a href="https://example.com">example.com</a>.</p>';

const ALL_TOOLS: UiRichTool[] = [
  'bold',
  'italic',
  'h2',
  'h3',
  'ul',
  'ol',
  'link',
  'quote',
  'image',
  'table',
  'undo',
  'redo',
];

const FALLBACK_PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAQAAAAECAIAAAAmkwkpAAAADElEQVR4nGP4z8DAwAAABgEB/6R7bAAAAABJRU5ErkJggg==';

@Component({
  imports: [FormsModule, DocPage, DocSection, DocDemo, UiRichText, UiRichTextView, UiText],
  template: `
    <doc-page
      eyebrow="Components"
      title="Rich text"
      lead="Structured rich-text editing (ui-rich-text, lazily backed by Tiptap/ProseMirror via UI_RICH_TEXT_ENGINE) and safe rendering (ui-rich-text-view) with a shared, dependency-free allowlist sanitizer (uiSanitizeRichText)."
    >
      <doc-section
        name="Rich text editor"
        selector="ui-rich-text"
        [api]="editorApi"
        summary="ControlValueAccessor emitting sanitized HTML from a fixed allowlist. Each block gets dir='auto' so Thaana and English paragraphs flow naturally in the same document."
      >
        <doc-demo [code]="EDITOR_SNIPPET">
          <div class="rt-demo">
            <ui-rich-text
              [(ngModel)]="html"
              [tools]="allTools"
              [maxLength]="600"
              [imageUpload]="fakeUpload"
              placeholder="Write an announcement..."
              ariaLabel="Announcement body"
            />
            <div class="rt-split">
              <div class="rt-pane">
                <ui-text variant="label">Rendered viewer (ui-rich-text-view)</ui-text>
                <div class="rt-card">
                  <ui-rich-text-view [html]="html()" />
                </div>
              </div>
              <div class="rt-pane">
                <ui-text variant="label">Live sanitized HTML output</ui-text>
                <pre class="rt-output"><code>{{ html() }}</code></pre>
              </div>
            </div>
          </div>
        </doc-demo>
      </doc-section>

      <doc-section
        name="Rich text viewer"
        selector="ui-rich-text-view"
        [api]="viewApi"
        summary="Renders sanitized HTML using ui-text typography tokens without loading Tiptap. Ideal for public news, consultation pages, and knowledge base articles."
      >
        <doc-demo [code]="VIEW_SNIPPET">
          <div class="rt-card">
            <ui-rich-text-view [html]="bilingualSample" />
          </div>
        </doc-demo>
      </doc-section>

      <doc-section
        name="Shared sanitizer"
        selector="uiSanitizeRichText"
        [api]="sanitizeApi"
        summary="Pure, dependency-free allowlist sanitizer exported for servers to mirror. Strips disallowed tags/attributes, blocks unsafe link schemes, and unwraps unknown elements to their text (while removing script and style with their content)."
      >
        <doc-demo [code]="SANITIZE_SNIPPET">
          <ui-text variant="body" tone="muted">
            Allowed tags: <code>p, h2, h3, ul, ol, li, a[href], strong, em, blockquote, br</code>, plus
            <code>img[src,alt]</code> and <code>table, thead, tbody, tr, th, td</code> when enabled.
          </ui-text>
        </doc-demo>
      </doc-section>
    </doc-page>
  `,
  styles: `
    .rt-demo {
      display: flex;
      flex-direction: column;
      gap: var(--ui-space-4);
      width: 100%;
    }
    .rt-split {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: var(--ui-space-4);
      align-items: start;
    }
    .rt-pane {
      display: flex;
      flex-direction: column;
      gap: var(--ui-space-2);
      min-width: 0;
    }
    .rt-card {
      padding: var(--ui-space-4);
      background: var(--ui-color-surface);
      border: 1px solid var(--ui-color-border);
      border-radius: var(--ui-radius);
    }
    .rt-output {
      margin: 0;
      padding: var(--ui-space-3);
      background: var(--ui-color-surface-raised);
      border: 1px solid var(--ui-color-border);
      border-radius: var(--ui-radius);
      font-family: var(--ui-font-mono);
      font-size: var(--ui-font-size-xs);
      line-height: 1.5;
      white-space: pre-wrap;
      word-break: break-word;
      max-height: 260px;
      overflow: auto;
    }
    @media (max-width: 760px) {
      .rt-split {
        grid-template-columns: minmax(0, 1fr);
      }
    }
  `,
})
export class RichTextPage {
  protected readonly EDITOR_SNIPPET = EDITOR_SNIPPET;
  protected readonly VIEW_SNIPPET = VIEW_SNIPPET;
  protected readonly SANITIZE_SNIPPET = SANITIZE_SNIPPET;
  protected readonly allTools = ALL_TOOLS;
  protected readonly html = signal(INITIAL_HTML);
  protected readonly bilingualSample =
    '<h2>Mixed Thaana &amp; English</h2>' +
    '<p>ދިވެހިބަހާއި އިނގިރޭސިބަސް އެއް ލިޔުމެއްގައި ބޭނުންކުރެވޭނެއެވެ. Reference: DOC-2026-01.</p>' +
    '<p>Each paragraph carries <strong>dir="auto"</strong> so RTL and LTR blocks align naturally.</p>';

  protected readonly fakeUpload = async (file: File) => {
    const url = typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function'
      ? URL.createObjectURL(file)
      : FALLBACK_PNG;
    return { url, alt: file.name.replace(/\.[^.]+$/, '') };
  };

  protected readonly editorApi: ApiRow[] = [
    { name: 'tools', type: 'UiRichTool[]', default: "['bold','italic','h2','h3','ul','ol','link','quote']", desc: 'Toolbar buttons to display. Also supports image, table, undo, redo.' },
    { name: 'placeholder', type: 'string', default: "''", desc: 'Placeholder text shown when empty.' },
    { name: 'minHeight', type: 'number', default: '160', desc: 'Minimum editing surface height in px.' },
    { name: 'maxLength', type: 'number | null', default: 'null', desc: 'Maximum text character count, shown as a live counter.' },
    { name: 'locale', type: 'string', default: 'page language', desc: 'Sets lang and default writing direction.' },
    { name: 'imageUpload', type: '(file: File) => Promise<{ url: string; alt?: string }>', default: '—', desc: 'Required to enable the image tool; prompts for alt text on insert.' },
    { name: 'disabled', type: 'boolean', default: 'false', desc: 'Disables editing and toolbar controls.' },
    { name: 'readonly', type: 'boolean', default: 'false', desc: 'Prevents edits while keeping content selectable.' },
    { name: 'invalid', type: 'boolean', default: 'false', desc: 'Applies the danger border and focus ring.' },
    { name: 'ariaLabel', type: 'string', default: '—', desc: 'Accessible name for the toolbar and editor.' },
  ];

  protected readonly viewApi: ApiRow[] = [
    { name: 'html', type: 'string', default: "''", desc: 'HTML string to sanitize and render.' },
    { name: 'image', type: 'boolean', default: 'true', desc: 'Allow img[src,alt] in sanitized output.' },
    { name: 'table', type: 'boolean', default: 'true', desc: 'Allow table elements in sanitized output.' },
    { name: 'locale', type: 'string', default: 'page language', desc: 'Sets lang and default writing direction.' },
  ];

  protected readonly sanitizeApi: ApiRow[] = [
    { name: 'html', type: 'string', default: 'required', desc: 'Raw HTML input to sanitize.' },
    { name: 'options.image', type: 'boolean', default: 'false', desc: 'Allow img[src,alt] with safe image URLs.' },
    { name: 'options.table', type: 'boolean', default: 'false', desc: 'Allow table, thead, tbody, tr, th, td.' },
  ];
}
