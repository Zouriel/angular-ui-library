import { isPlatformBrowser } from '@angular/common';
import {
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  ElementRef,
  forwardRef,
  HostAttributeToken,
  inject,
  InjectionToken,
  input,
  PLATFORM_ID,
  signal,
  viewChild,
  viewChildren,
} from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { HugeiconsIconComponent, type IconSvgObject } from '@hugeicons/angular';
import Heading02Icon from '@hugeicons/core-free-icons/Heading02Icon';
import Heading03Icon from '@hugeicons/core-free-icons/Heading03Icon';
import Image01Icon from '@hugeicons/core-free-icons/Image01Icon';
import LeftToRightListBulletIcon from '@hugeicons/core-free-icons/LeftToRightListBulletIcon';
import LeftToRightListNumberIcon from '@hugeicons/core-free-icons/LeftToRightListNumberIcon';
import Link01Icon from '@hugeicons/core-free-icons/Link01Icon';
import QuoteDownIcon from '@hugeicons/core-free-icons/QuoteDownIcon';
import RedoIcon from '@hugeicons/core-free-icons/RedoIcon';
import TableIcon from '@hugeicons/core-free-icons/TableIcon';
import TextBoldIcon from '@hugeicons/core-free-icons/TextBoldIcon';
import TextItalicIcon from '@hugeicons/core-free-icons/TextItalicIcon';
import UndoIcon from '@hugeicons/core-free-icons/UndoIcon';
import { injectUiStrings, uiFormatString } from '@zouriel/ui';
import { uiIsSafeRichTextUrl, uiSanitizeRichText } from './sanitize';

/** Toolbar items supported by {@link UiRichText}. */
export type UiRichTool =
  | 'bold'
  | 'italic'
  | 'h2'
  | 'h3'
  | 'ul'
  | 'ol'
  | 'link'
  | 'quote'
  | 'image'
  | 'table'
  | 'undo'
  | 'redo';

/** Minimal editor instance contract used by {@link UiRichText}. */
export interface UiRichTextEditorLike {
  getHTML(): string;
  getText(): string;
  isActive(name: string, attrs?: Record<string, unknown>): boolean;
  can(): { undo(): boolean; redo(): boolean };
  setEditable(editable: boolean): void;
  destroy(): void;
  commands: {
    setContent(content: string, options?: { emitUpdate?: boolean }): void;
    focus(): void;
    toggleBold(): boolean;
    toggleItalic(): boolean;
    toggleHeading(attrs: { level: 2 | 3 }): boolean;
    toggleBulletList(): boolean;
    toggleOrderedList(): boolean;
    toggleBlockquote(): boolean;
    setLink(attrs: { href: string; target?: string | null }): boolean;
    unsetLink(): boolean;
    setImage(attrs: { src: string; alt?: string }): boolean;
    insertTable(attrs: { rows: number; cols: number; withHeaderRow?: boolean }): boolean;
    undo(): boolean;
    redo(): boolean;
  };
  getAttributes(name: string): Record<string, unknown>;
}

/**
 * Tiptap modules loaded lazily by {@link UI_RICH_TEXT_ENGINE}.
 * Provide a custom loader in tests to stub or control when Tiptap arrives.
 */
export interface UiRichTextEngine {
  Editor: new (options: Record<string, unknown>) => UiRichTextEditorLike;
  StarterKit: { configure(options: Record<string, unknown>): unknown };
  Link: { configure(options: Record<string, unknown>): unknown };
  Image: unknown;
  TableKit: unknown;
}

/**
 * How `ui-rich-text` loads Tiptap: dynamic `import(...)` by default so Tiptap never lands in the
 * initial bundle. Override in tests to mock the engine or test with a custom build.
 */
export const UI_RICH_TEXT_ENGINE = new InjectionToken<() => Promise<UiRichTextEngine>>('UI_RICH_TEXT_ENGINE', {
  providedIn: 'root',
  factory: () => async () => {
    const [core, starterKit, link, image, table] = await Promise.all([
      import('@tiptap/core'),
      import('@tiptap/starter-kit'),
      import('@tiptap/extension-link'),
      import('@tiptap/extension-image'),
      import('@tiptap/extension-table'),
    ]);
    return {
      Editor: core.Editor as unknown as UiRichTextEngine['Editor'],
      StarterKit: starterKit.StarterKit as unknown as UiRichTextEngine['StarterKit'],
      Link: link.Link as unknown as UiRichTextEngine['Link'],
      Image: image.Image,
      TableKit: table.TableKit,
    };
  },
});

const TOOL_ICONS: Record<UiRichTool, IconSvgObject> = {
  bold: TextBoldIcon,
  italic: TextItalicIcon,
  h2: Heading02Icon,
  h3: Heading03Icon,
  ul: LeftToRightListBulletIcon,
  ol: LeftToRightListNumberIcon,
  link: Link01Icon,
  quote: QuoteDownIcon,
  image: Image01Icon,
  table: TableIcon,
  undo: UndoIcon,
  redo: RedoIcon,
};

const TOGGLE_TOOLS = new Set<UiRichTool>(['bold', 'italic', 'h2', 'h3', 'ul', 'ol', 'link', 'quote']);

function plainTextLength(html: string): number {
  return html.replace(/<[^>]*>/g, '').length;
}

/**
 * `ui-rich-text` — accessible rich text editor (CVA) backed lazily by Tiptap/ProseMirror via
 * {@link UI_RICH_TEXT_ENGINE}. Emits and accepts only the strict {@link uiSanitizeRichText}
 * allowlist, sets `dir="auto"` on every block for mixed Thaana/English content, and supports
 * roving-tabindex keyboard toolbar navigation.
 */
@Component({
  selector: 'ui-rich-text',
  imports: [HugeiconsIconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[attr.aria-label]': 'null',
    '[attr.lang]': 'resolvedLocale() || null',
    '[attr.dir]': 'resolvedDir()',
  },
  providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => UiRichText), multi: true }],
  template: `
    <div
      class="rt-shell"
      [class.focused]="focused()"
      [class.disabled]="isDisabled()"
      [class.readonly]="readonly()"
      [class.invalid]="invalid()"
    >
      <div
        class="rt-toolbar"
        role="toolbar"
        [attr.aria-label]="ariaLabel() ?? staticLabel ?? null"
        (keydown)="onToolbarKeydown($event)"
      >
        @for (tool of tools(); track tool; let idx = $index) {
          <button
            #toolBtn
            type="button"
            class="rt-tool"
            [attr.tabindex]="idx === activeToolIndex() ? 0 : -1"
            [attr.aria-label]="toolLabel(tool)"
            [attr.title]="toolLabel(tool)"
            [attr.aria-pressed]="isToggle(tool) ? isToolActive(tool) : null"
            [disabled]="isToolDisabled(tool)"
            (click)="runTool(tool)"
            (focus)="activeToolIndex.set(idx)"
          >
            <hugeicons-icon [icon]="iconFor(tool)" [size]="16" [strokeWidth]="1.8" aria-hidden="true" />
          </button>
        }
      </div>

      @if (linkPopoverOpen()) {
        <div class="rt-popover" role="dialog" [attr.aria-label]="strings.rtLink">
          <label class="rt-pop-field">
            <span class="rt-pop-label">{{ strings.rtLinkAddress }}</span>
            <input
              #linkInput
              type="url"
              class="rt-pop-input"
              [class.invalid]="linkInvalid()"
              [value]="linkAddress()"
              [placeholder]="'https://…'"
              (input)="linkAddress.set($any($event.target).value); linkInvalid.set(false)"
              (keydown.enter)="$event.preventDefault(); applyLink()"
              (keydown.escape)="closeLinkPopover()"
            />
          </label>
          <label class="rt-pop-check">
            <input
              type="checkbox"
              [checked]="linkNewTab()"
              (change)="linkNewTab.set($any($event.target).checked)"
            />
            <span>{{ strings.rtLinkNewTab }}</span>
          </label>
          <div class="rt-pop-actions">
            <button type="button" class="rt-pop-btn primary" (click)="applyLink()">{{ strings.confirm }}</button>
            <button type="button" class="rt-pop-btn" (click)="closeLinkPopover()">{{ strings.cancel }}</button>
          </div>
        </div>
      }

      @if (imagePopoverOpen()) {
        <div class="rt-popover" role="dialog" [attr.aria-label]="strings.rtImage">
          <label class="rt-pop-field">
            <span class="rt-pop-label">{{ strings.rtImageAlt }}</span>
            <input
              #altInput
              type="text"
              class="rt-pop-input"
              [value]="pendingImageAlt()"
              (input)="pendingImageAlt.set($any($event.target).value)"
              (keydown.enter)="$event.preventDefault(); confirmImageInsert()"
              (keydown.escape)="cancelImageInsert()"
            />
          </label>
          <div class="rt-pop-actions">
            <button type="button" class="rt-pop-btn primary" (click)="confirmImageInsert()">{{ strings.confirm }}</button>
            <button type="button" class="rt-pop-btn" (click)="cancelImageInsert()">{{ strings.cancel }}</button>
          </div>
        </div>
      }

      <input
        #fileInput
        type="file"
        accept="image/*"
        class="rt-file-input"
        tabindex="-1"
        aria-hidden="true"
        (change)="onFileSelected($event)"
      />

      <div
        #editorHost
        class="rt-editor"
        [class.empty]="isEmpty()"
        [attr.data-placeholder]="placeholder() || null"
        [style.min-height.px]="minHeight()"
        (focusin)="focused.set(true)"
        (focusout)="onEditorFocusOut($event)"
      ></div>

      @if (maxLength() !== null) {
        <div class="rt-footer">
          <span class="rt-counter" [class.over]="charCount() > maxLength()!" aria-live="polite">
            {{ format(strings.rtCharCount, { count: charCount(), max: maxLength()! }) }}
          </span>
        </div>
      }
    </div>
  `,
  styles: `
    :host {
      display: block;
      font-family: var(--ui-font-default);
      color: var(--ui-color-text);
    }
    .rt-shell {
      display: flex;
      flex-direction: column;
      background: var(--ui-color-surface);
      border: var(--ui-control-border-width) solid var(--ui-control-border);
      border-radius: var(--ui-field-radius);
      overflow: hidden;
      transition: border-color var(--ui-motion-base) var(--ui-ease-standard),
        box-shadow var(--ui-motion-base) var(--ui-ease-standard);
    }
    .rt-shell.focused {
      border-color: var(--ui-color-primary);
      box-shadow: var(--ui-focus-ring);
    }
    .rt-shell.invalid {
      border-color: var(--ui-color-danger);
    }
    .rt-shell.invalid.focused {
      box-shadow: 0 0 0 2px var(--ui-color-bg), 0 0 0 4px var(--ui-color-danger);
    }
    .rt-shell.disabled {
      opacity: 0.5;
      pointer-events: none;
    }
    .rt-toolbar {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: var(--ui-space-1);
      padding: var(--ui-space-1) var(--ui-space-2);
      background: var(--ui-color-surface-raised);
      border-bottom: 1px solid var(--ui-color-border);
    }
    .rt-tool {
      box-sizing: border-box;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: var(--ui-size-sm);
      height: var(--ui-size-sm);
      padding: 0;
      border: none;
      border-radius: var(--ui-radius-xs);
      background: transparent;
      color: var(--ui-color-text);
      cursor: pointer;
      transition: background var(--ui-motion-base) var(--ui-ease-standard),
        color var(--ui-motion-base) var(--ui-ease-standard),
        transform var(--ui-motion-fast) var(--ui-ease-standard);
    }
    .rt-tool:hover:not(:disabled) {
      background: var(--ui-color-elevated-hover);
    }
    .rt-tool:active:not(:disabled) {
      transform: scale(var(--ui-scale-press));
    }
    .rt-tool:focus-visible {
      outline: none;
      box-shadow: var(--ui-focus-ring);
    }
    .rt-tool[aria-pressed='true'] {
      background: var(--ui-color-primary-soft);
      color: var(--ui-color-primary);
    }
    .rt-tool:disabled {
      opacity: 0.4;
      cursor: not-allowed;
    }
    @media (pointer: coarse) {
      .rt-tool {
        width: var(--ui-size-touch);
        height: var(--ui-size-touch);
      }
    }
    .rt-popover {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: var(--ui-space-2);
      padding: var(--ui-space-2) var(--ui-space-3);
      background: var(--ui-color-surface-raised);
      border-bottom: 1px solid var(--ui-color-border);
    }
    .rt-pop-field {
      display: flex;
      align-items: center;
      gap: var(--ui-space-2);
      flex: 1 1 200px;
      min-width: 0;
    }
    .rt-pop-label {
      font-size: var(--ui-font-size-sm);
      color: var(--ui-color-text-muted);
      white-space: nowrap;
    }
    .rt-pop-input {
      flex: 1 1 auto;
      min-width: 0;
      padding: var(--ui-space-1) var(--ui-space-2);
      background: var(--ui-color-surface);
      color: var(--ui-color-text);
      border: var(--ui-control-border-width) solid var(--ui-control-border);
      border-radius: var(--ui-radius-xs);
      font-family: var(--ui-font-default);
      font-size: var(--ui-font-size-sm);
    }
    .rt-pop-input:focus-visible {
      outline: none;
      border-color: var(--ui-color-primary);
      box-shadow: var(--ui-focus-ring);
    }
    .rt-pop-input.invalid {
      border-color: var(--ui-color-danger);
    }
    .rt-pop-check {
      display: inline-flex;
      align-items: center;
      gap: var(--ui-space-1);
      font-size: var(--ui-font-size-sm);
      color: var(--ui-color-text);
      cursor: pointer;
    }
    .rt-pop-actions {
      display: inline-flex;
      gap: var(--ui-space-1);
    }
    .rt-pop-btn {
      padding: var(--ui-space-1) var(--ui-space-3);
      border: var(--ui-control-border-width) solid var(--ui-control-border);
      border-radius: var(--ui-radius-pill);
      background: var(--ui-color-surface);
      color: var(--ui-color-text);
      font-family: var(--ui-font-default);
      font-size: var(--ui-font-size-sm);
      cursor: pointer;
    }
    .rt-pop-btn.primary {
      background: var(--ui-color-primary);
      border-color: var(--ui-color-primary);
      color: var(--ui-color-on-primary);
    }
    .rt-pop-btn:focus-visible {
      outline: none;
      box-shadow: var(--ui-focus-ring);
    }
    .rt-file-input {
      position: absolute;
      width: 1px;
      height: 1px;
      overflow: hidden;
      clip-path: inset(50%);
      pointer-events: none;
    }
    .rt-editor {
      position: relative;
      padding: var(--ui-space-3);
      font-size: var(--ui-font-size-md);
      line-height: var(--ui-line-height-body, 1.45);
      cursor: text;
    }
    .rt-editor.empty[data-placeholder]::before {
      content: attr(data-placeholder);
      position: absolute;
      inset-block-start: var(--ui-space-3);
      inset-inline-start: var(--ui-space-3);
      color: var(--ui-color-text-muted);
      pointer-events: none;
    }
    .rt-editor ::ng-deep .ProseMirror {
      outline: none;
      min-height: inherit;
    }
    .rt-editor ::ng-deep .ProseMirror > :first-child { margin-top: 0; }
    .rt-editor ::ng-deep .ProseMirror > :last-child { margin-bottom: 0; }
    .rt-editor ::ng-deep .ProseMirror p { margin: 0 0 var(--ui-space-3); }
    .rt-editor ::ng-deep .ProseMirror h2 {
      margin: var(--ui-space-4) 0 var(--ui-space-2);
      font-family: var(--ui-font-display);
      font-size: var(--ui-font-size-h2);
      font-weight: var(--ui-font-weight-heading, 700);
      line-height: var(--ui-line-height-heading, 1.18);
    }
    .rt-editor ::ng-deep .ProseMirror h3 {
      margin: var(--ui-space-3) 0 var(--ui-space-2);
      font-family: var(--ui-font-display);
      font-size: var(--ui-font-size-h3);
      font-weight: var(--ui-font-weight-heading, 600);
      line-height: var(--ui-line-height-heading, 1.2);
    }
    .rt-editor ::ng-deep .ProseMirror ul,
    .rt-editor ::ng-deep .ProseMirror ol {
      margin: 0 0 var(--ui-space-3);
      padding-inline-start: var(--ui-space-5);
    }
    .rt-editor ::ng-deep .ProseMirror a {
      color: var(--ui-color-primary);
      text-decoration: underline;
    }
    .rt-editor ::ng-deep .ProseMirror blockquote {
      margin: 0 0 var(--ui-space-3);
      border-inline-start: 2px solid var(--ui-color-border-strong);
      padding: var(--ui-space-2) var(--ui-space-4);
      color: var(--ui-color-text-secondary);
      font-style: italic;
    }
    .rt-editor ::ng-deep .ProseMirror img {
      max-width: 100%;
      height: auto;
      border-radius: var(--ui-radius-sm);
    }
    .rt-editor ::ng-deep .ProseMirror table {
      width: 100%;
      border-collapse: collapse;
      margin: var(--ui-space-3) 0;
    }
    .rt-editor ::ng-deep .ProseMirror th,
    .rt-editor ::ng-deep .ProseMirror td {
      border: 1px solid var(--ui-color-border);
      padding: var(--ui-space-2) var(--ui-space-3);
      text-align: start;
    }
    .rt-footer {
      display: flex;
      justify-content: flex-end;
      padding: var(--ui-space-1) var(--ui-space-3);
      border-top: 1px solid var(--ui-color-border);
      background: var(--ui-color-surface-raised);
    }
    .rt-counter {
      font-size: var(--ui-font-size-sm);
      color: var(--ui-color-text-muted);
      font-variant-numeric: tabular-nums;
    }
    .rt-counter.over {
      color: var(--ui-color-danger);
    }
  `,
})
export class UiRichText implements ControlValueAccessor {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly destroyRef = inject(DestroyRef);
  private readonly loadEngine = inject(UI_RICH_TEXT_ENGINE);
  protected readonly strings = injectUiStrings();
  protected readonly format = uiFormatString;
  protected readonly staticLabel = inject(new HostAttributeToken('aria-label'), { optional: true });

  /** Toolbar buttons to show, in order. */
  tools = input<UiRichTool[]>(['bold', 'italic', 'h2', 'h3', 'ul', 'ol', 'link', 'quote']);
  /** Placeholder text when the document is empty. */
  placeholder = input<string>('');
  /** Minimum height of the editing surface in px. */
  minHeight = input<number>(160);
  /** Maximum text character count, shown as a counter when set. */
  maxLength = input<number | null>(null);
  /** Language tag (`en`, `dv`, …) setting `lang` and default direction. */
  locale = input<string | undefined>(undefined);
  /** Required for the `'image'` tool; uploads a file and returns its URL and optional alt text. */
  imageUpload = input<((file: File) => Promise<{ url: string; alt?: string }>) | undefined>(undefined);
  /** Disables editing and toolbar actions. */
  disabled = input(false, { transform: booleanAttribute });
  /** Prevents editing while keeping text selectable. */
  readonly = input(false, { transform: booleanAttribute });
  /** Marks the field invalid (danger border and focus ring). */
  invalid = input(false, { transform: booleanAttribute });
  /** Accessible name for the editor toolbar/region. */
  ariaLabel = input<string | undefined>(undefined);

  private readonly editorHost = viewChild.required<ElementRef<HTMLElement>>('editorHost');
  private readonly fileInput = viewChild.required<ElementRef<HTMLInputElement>>('fileInput');
  private readonly toolButtons = viewChildren<ElementRef<HTMLButtonElement>>('toolBtn');
  private readonly linkInput = viewChild<ElementRef<HTMLInputElement>>('linkInput');
  private readonly altInput = viewChild<ElementRef<HTMLInputElement>>('altInput');

  protected readonly focused = signal(false);
  protected readonly activeToolIndex = signal(0);
  protected readonly charCount = signal(0);
  protected readonly isEmpty = signal(true);
  protected readonly linkPopoverOpen = signal(false);
  protected readonly linkAddress = signal('');
  protected readonly linkNewTab = signal(false);
  protected readonly linkInvalid = signal(false);
  protected readonly imagePopoverOpen = signal(false);
  protected readonly pendingImageUrl = signal('');
  protected readonly pendingImageAlt = signal('');

  private readonly cvaDisabled = signal(false);
  protected readonly isDisabled = computed(() => this.disabled() || this.cvaDisabled());
  private readonly selectionTick = signal(0);

  protected readonly resolvedLocale = computed(() => this.locale() ?? (this.strings.locale || undefined));
  protected readonly resolvedDir = computed<'ltr' | 'rtl' | null>(() => {
    const loc = this.resolvedLocale();
    if (!loc) return null;
    return /^(dv|ar|he|fa|ur)(?:[-_]|$)/i.test(loc) ? 'rtl' : 'ltr';
  });

  private readonly sanitizeOpts = computed(() => ({
    image: this.tools().includes('image'),
    table: this.tools().includes('table'),
  }));

  private editor: UiRichTextEditorLike | null = null;
  private currentValue = '';
  private suppressUpdate = false;
  private onChange: (value: string) => void = () => {};
  private onTouched: () => void = () => {};

  constructor() {
    if (isPlatformBrowser(this.platformId)) {
      void this.initEditor();
    }

    effect(() => {
      const editable = !this.isDisabled() && !this.readonly();
      this.editor?.setEditable(editable);
    });

    this.destroyRef.onDestroy(() => {
      this.editor?.destroy();
      this.editor = null;
    });
  }

  writeValue(value: string | null): void {
    const clean = uiSanitizeRichText(value ?? '', this.sanitizeOpts());
    this.currentValue = clean;
    this.charCount.set(plainTextLength(clean));
    this.isEmpty.set(plainTextLength(clean) === 0);
    if (this.editor) {
      this.suppressUpdate = true;
      this.editor.commands.setContent(clean || '<p></p>', { emitUpdate: false });
      this.charCount.set(this.editor.getText().length);
      this.isEmpty.set(this.editor.getText().length === 0);
      this.suppressUpdate = false;
    }
  }

  registerOnChange(fn: (value: string) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.cvaDisabled.set(isDisabled);
  }

  private async initEditor(): Promise<void> {
    const engine = await this.loadEngine();
    const hostEl = this.editorHost().nativeElement;
    const opts = this.sanitizeOpts();
    const extensions: unknown[] = [
      engine.StarterKit.configure({
        heading: { levels: [2, 3], HTMLAttributes: { dir: 'auto' } },
        paragraph: { HTMLAttributes: { dir: 'auto' } },
        blockquote: { HTMLAttributes: { dir: 'auto' } },
        listItem: { HTMLAttributes: { dir: 'auto' } },
        link: false,
      }),
      engine.Link.configure({
        openOnClick: false,
        validate: (url: string) => uiIsSafeRichTextUrl(url),
      }),
    ];
    if (opts.image) extensions.push(engine.Image);
    if (opts.table) extensions.push(engine.TableKit);

    this.editor = new engine.Editor({
      element: hostEl,
      extensions,
      content: this.currentValue || '<p></p>',
      editable: !this.isDisabled() && !this.readonly(),
      editorProps: {
        attributes: {
          role: 'textbox',
          'aria-multiline': 'true',
          ...(this.ariaLabel() ?? this.staticLabel ? { 'aria-label': this.ariaLabel() ?? this.staticLabel! } : {}),
        },
        transformPastedHTML: (html: string) => uiSanitizeRichText(html, this.sanitizeOpts()),
        handleKeyDown: (_view: unknown, event: KeyboardEvent) => {
          if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
            event.preventDefault();
            if (!this.isDisabled() && !this.readonly() && this.tools().includes('link')) {
              this.openLinkPopover();
            }
            return true;
          }
          return false;
        },
      },
      onUpdate: () => {
        if (this.suppressUpdate || !this.editor) return;
        const clean = uiSanitizeRichText(this.editor.getHTML(), this.sanitizeOpts());
        const textLen = plainTextLength(clean);
        const max = this.maxLength();
        if (max !== null && textLen > max) {
          this.suppressUpdate = true;
          this.editor.commands.setContent(this.currentValue || '<p></p>', { emitUpdate: false });
          this.suppressUpdate = false;
          const prevLen = plainTextLength(this.currentValue);
          this.charCount.set(prevLen);
          this.isEmpty.set(prevLen === 0);
          return;
        }
        this.currentValue = clean;
        this.charCount.set(textLen);
        this.isEmpty.set(textLen === 0);
        this.selectionTick.update((n) => n + 1);
        this.onChange(clean);
      },
      onSelectionUpdate: () => {
        this.selectionTick.update((n) => n + 1);
      },
    });

    this.charCount.set(this.editor.getText().length);
    this.isEmpty.set(this.editor.getText().length === 0);
  }

  protected iconFor(tool: UiRichTool): IconSvgObject {
    return TOOL_ICONS[tool];
  }

  protected isToggle(tool: UiRichTool): boolean {
    return TOGGLE_TOOLS.has(tool);
  }

  protected toolLabel(tool: UiRichTool): string {
    switch (tool) {
      case 'bold': return this.strings.rtBold;
      case 'italic': return this.strings.rtItalic;
      case 'h2': return this.strings.rtHeading2;
      case 'h3': return this.strings.rtHeading3;
      case 'ul': return this.strings.rtBulletList;
      case 'ol': return this.strings.rtNumberList;
      case 'link': return this.strings.rtLink;
      case 'quote': return this.strings.rtQuote;
      case 'image': return this.strings.rtImage;
      case 'table': return this.strings.rtTable;
      case 'undo': return this.strings.rtUndo;
      case 'redo': return this.strings.rtRedo;
    }
  }

  protected isToolActive(tool: UiRichTool): boolean {
    this.selectionTick();
    if (!this.editor) return false;
    switch (tool) {
      case 'bold': return this.editor.isActive('bold');
      case 'italic': return this.editor.isActive('italic');
      case 'h2': return this.editor.isActive('heading', { level: 2 });
      case 'h3': return this.editor.isActive('heading', { level: 3 });
      case 'ul': return this.editor.isActive('bulletList');
      case 'ol': return this.editor.isActive('orderedList');
      case 'link': return this.editor.isActive('link');
      case 'quote': return this.editor.isActive('blockquote');
      default: return false;
    }
  }

  protected isToolDisabled(tool: UiRichTool): boolean {
    this.selectionTick();
    if (this.isDisabled() || this.readonly()) return true;
    if (tool === 'image' && !this.imageUpload()) return true;
    if (!this.editor) return false;
    if (tool === 'undo') return !this.editor.can().undo();
    if (tool === 'redo') return !this.editor.can().redo();
    return false;
  }

  protected runTool(tool: UiRichTool): void {
    if (this.isToolDisabled(tool)) return;
    if (tool === 'link') {
      this.openLinkPopover();
      return;
    }
    if (tool === 'image') {
      this.fileInput().nativeElement.click();
      return;
    }
    if (!this.editor) return;
    const cmds = this.editor.commands;
    switch (tool) {
      case 'bold': cmds.toggleBold(); break;
      case 'italic': cmds.toggleItalic(); break;
      case 'h2': cmds.toggleHeading({ level: 2 }); break;
      case 'h3': cmds.toggleHeading({ level: 3 }); break;
      case 'ul': cmds.toggleBulletList(); break;
      case 'ol': cmds.toggleOrderedList(); break;
      case 'quote': cmds.toggleBlockquote(); break;
      case 'table': cmds.insertTable({ rows: 3, cols: 3, withHeaderRow: true }); break;
      case 'undo': cmds.undo(); break;
      case 'redo': cmds.redo(); break;
    }
    this.selectionTick.update((n) => n + 1);
  }

  protected openLinkPopover(): void {
    const attrs = this.editor?.getAttributes('link') ?? {};
    this.linkAddress.set(typeof attrs['href'] === 'string' ? attrs['href'] : '');
    this.linkNewTab.set(attrs['target'] === '_blank');
    this.linkInvalid.set(false);
    this.imagePopoverOpen.set(false);
    this.linkPopoverOpen.set(true);
    queueMicrotask(() => this.linkInput()?.nativeElement.focus());
  }

  protected closeLinkPopover(): void {
    this.linkPopoverOpen.set(false);
    this.linkInvalid.set(false);
    this.editor?.commands.focus();
  }

  protected applyLink(): void {
    const url = this.linkAddress().trim();
    if (!url) {
      this.editor?.commands.unsetLink();
      this.closeLinkPopover();
      return;
    }
    if (!uiIsSafeRichTextUrl(url)) {
      this.linkInvalid.set(true);
      return;
    }
    this.editor?.commands.setLink({
      href: url,
      target: this.linkNewTab() ? '_blank' : null,
    });
    this.closeLinkPopover();
  }

  protected async onFileSelected(event: Event): Promise<void> {
    const inputEl = event.target as HTMLInputElement;
    const file = inputEl.files?.[0];
    inputEl.value = '';
    const upload = this.imageUpload();
    if (!file || !upload) return;
    const res = await upload(file);
    this.pendingImageUrl.set(res.url);
    this.pendingImageAlt.set(res.alt ?? '');
    this.linkPopoverOpen.set(false);
    this.imagePopoverOpen.set(true);
    queueMicrotask(() => this.altInput()?.nativeElement.focus());
  }

  protected confirmImageInsert(): void {
    const src = this.pendingImageUrl().trim();
    if (src) {
      this.editor?.commands.setImage({ src, alt: this.pendingImageAlt().trim() });
    }
    this.imagePopoverOpen.set(false);
    this.pendingImageUrl.set('');
    this.pendingImageAlt.set('');
    this.editor?.commands.focus();
  }

  protected cancelImageInsert(): void {
    this.imagePopoverOpen.set(false);
    this.pendingImageUrl.set('');
    this.pendingImageAlt.set('');
    this.editor?.commands.focus();
  }

  protected onEditorFocusOut(event: FocusEvent): void {
    const next = event.relatedTarget as Node | null;
    const host = this.editorHost().nativeElement.closest('.rt-shell');
    if (next && host?.contains(next)) return;
    this.focused.set(false);
    this.onTouched();
  }

  protected onToolbarKeydown(event: KeyboardEvent): void {
    const btns = this.toolButtons().map((b) => b.nativeElement);
    if (btns.length === 0) return;

    const isRtl = this.resolvedDir() === 'rtl' || getComputedStyle(event.currentTarget as Element).direction === 'rtl';
    const nextKey = isRtl ? 'ArrowLeft' : 'ArrowRight';
    const prevKey = isRtl ? 'ArrowRight' : 'ArrowLeft';

    let step = 0;
    if (event.key === nextKey) step = 1;
    else if (event.key === prevKey) step = -1;
    else if (event.key === 'Home') step = -btns.length;
    else if (event.key === 'End') step = btns.length;
    else return;

    event.preventDefault();
    const enabled = btns
      .map((el, i) => ({ el, i }))
      .filter(({ el }) => !el.disabled);
    if (enabled.length === 0) return;

    const currentIdx = enabled.findIndex(({ i }) => i === this.activeToolIndex());
    let target: { el: HTMLButtonElement; i: number };
    if (event.key === 'Home') {
      target = enabled[0];
    } else if (event.key === 'End') {
      target = enabled[enabled.length - 1];
    } else {
      const pos = currentIdx === -1 ? 0 : (currentIdx + step + enabled.length) % enabled.length;
      target = enabled[pos];
    }
    this.activeToolIndex.set(target.i);
    target.el.focus();
  }
}
