import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormsModule } from '@angular/forms';
import { describe, expect, it, vi } from 'vitest';
import {
  UI_RICH_TEXT_ENGINE,
  UiRichText,
  UiRichTextView,
  type UiRichTextEditorLike,
  type UiRichTextEngine,
  type UiRichTool,
} from './public-api';

class MockEditor implements UiRichTextEditorLike {
  html = '<p></p>';
  editable = true;
  activeMarks = new Set<string>();
  lastLink: { href: string; target?: string | null } | null = null;
  lastImage: { src: string; alt?: string } | null = null;
  private onUpdate?: () => void;
  private handleKeyDown?: (view: unknown, event: KeyboardEvent) => boolean;

  constructor(options: Record<string, unknown>) {
    this.html = String(options['content'] ?? '<p></p>');
    this.editable = Boolean(options['editable'] ?? true);
    this.onUpdate = options['onUpdate'] as (() => void) | undefined;
    const props = options['editorProps'] as Record<string, unknown> | undefined;
    this.handleKeyDown = props?.['handleKeyDown'] as ((view: unknown, event: KeyboardEvent) => boolean) | undefined;
    const el = options['element'] as HTMLElement | undefined;
    if (el) {
      el.innerHTML = `<div class="ProseMirror" contenteditable="${this.editable}">${this.html}</div>`;
    }
  }

  getHTML(): string {
    return this.html;
  }

  getText(): string {
    return this.html.replace(/<[^>]*>/g, '');
  }

  isActive(name: string): boolean {
    return this.activeMarks.has(name);
  }

  can(): { undo(): boolean; redo(): boolean } {
    return { undo: () => true, redo: () => false };
  }

  setEditable(editable: boolean): void {
    this.editable = editable;
  }

  destroy(): void {}

  triggerUpdate(nextHtml: string): void {
    this.html = nextHtml;
    this.onUpdate?.();
  }

  triggerKeyDown(event: KeyboardEvent): boolean {
    return this.handleKeyDown?.(null, event) ?? false;
  }

  getAttributes(): Record<string, unknown> {
    return {};
  }

  commands = {
    setContent: (content: string, opts?: { emitUpdate?: boolean }) => {
      this.html = content;
      if (opts?.emitUpdate) this.onUpdate?.();
    },
    focus: () => {},
    toggleBold: () => {
      this.activeMarks.has('bold') ? this.activeMarks.delete('bold') : this.activeMarks.add('bold');
      return true;
    },
    toggleItalic: () => true,
    toggleHeading: () => true,
    toggleBulletList: () => true,
    toggleOrderedList: () => true,
    toggleBlockquote: () => true,
    setLink: (attrs: { href: string; target?: string | null }) => {
      this.lastLink = attrs;
      return true;
    },
    unsetLink: () => {
      this.lastLink = null;
      return true;
    },
    setImage: (attrs: { src: string; alt?: string }) => {
      this.lastImage = attrs;
      this.triggerUpdate(`${this.html}<img src="${attrs.src}" alt="${attrs.alt ?? ''}">`);
      return true;
    },
    insertTable: () => true,
    undo: () => true,
    redo: () => true,
  };
}

function createMockEngine(): { loader: () => Promise<UiRichTextEngine>; instances: MockEditor[] } {
  const instances: MockEditor[] = [];
  const engine: UiRichTextEngine = {
    Editor: class extends MockEditor {
      constructor(opts: Record<string, unknown>) {
        super(opts);
        instances.push(this);
      }
    },
    StarterKit: { configure: () => ({}) },
    Link: { configure: () => ({}) },
    Image: {},
    TableKit: {},
  };
  return { loader: () => Promise.resolve(engine), instances };
}

@Component({
  imports: [UiRichTextView],
  template: `<ui-rich-text-view [html]="html()" [locale]="locale()" />`,
})
class ViewHost {
  html = signal('<p>Hello</p><p>މަރުޙަބާ</p><script>alert(1)</script><a href="javascript:alert(1)">Bad</a>');
  locale = signal<string | undefined>(undefined);
}

@Component({
  imports: [FormsModule, UiRichText],
  template: `
    <ui-rich-text
      [(ngModel)]="value"
      [tools]="tools()"
      [maxLength]="maxLength()"
      [locale]="locale()"
      [readonly]="readonly()"
      [invalid]="invalid()"
      [imageUpload]="imageUpload()"
      ariaLabel="Article body"
    />
  `,
})
class EditorHost {
  value = signal('<p>Initial</p>');
  tools = signal<UiRichTool[]>(['bold', 'italic', 'h2', 'h3', 'ul', 'ol', 'link', 'quote']);
  maxLength = signal<number | null>(null);
  locale = signal<string | undefined>(undefined);
  readonly = signal(false);
  invalid = signal(false);
  imageUpload = signal<((file: File) => Promise<{ url: string; alt?: string }>) | undefined>(undefined);
}

describe('UiRichTextView', () => {
  it('sanitizes HTML, strips scripts/javascript links, and adds dir="auto" to blocks', () => {
    const f = TestBed.createComponent(ViewHost);
    f.detectChanges();
    const view = f.nativeElement.querySelector('.rt-view') as HTMLElement;
    expect(view.querySelector('script')).toBeNull();
    expect(view.querySelector('a')).toBeNull();
    const ps = view.querySelectorAll('p');
    expect(ps.length).toBe(2);
    expect(ps[0].getAttribute('dir')).toBe('auto');
    expect(ps[1].getAttribute('dir')).toBe('auto');
  });

  it('sets lang and dir from locale', () => {
    const f = TestBed.createComponent(ViewHost);
    f.componentInstance.locale.set('dv');
    f.detectChanges();
    const host = f.nativeElement.querySelector('ui-rich-text-view') as HTMLElement;
    expect(host.getAttribute('lang')).toBe('dv');
    expect(host.getAttribute('dir')).toBe('rtl');
  });
});

describe('UiRichText (mocked engine)', () => {
  it('renders toolbar with one tab stop and arrow-key navigation', async () => {
    const mock = createMockEngine();
    TestBed.configureTestingModule({
      providers: [{ provide: UI_RICH_TEXT_ENGINE, useValue: mock.loader }],
    });
    const f = TestBed.createComponent(EditorHost);
    f.detectChanges();
    await Promise.resolve();

    const toolbar = f.nativeElement.querySelector('[role="toolbar"]') as HTMLElement;
    const buttons = [...toolbar.querySelectorAll('button')] as HTMLButtonElement[];
    expect(buttons.length).toBe(8);
    expect(buttons.filter((b) => b.getAttribute('tabindex') === '0').length).toBe(1);
    expect(buttons[0].getAttribute('aria-pressed')).toBe('false');

    toolbar.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    f.detectChanges();
    expect(buttons[1].getAttribute('tabindex')).toBe('0');
    expect(buttons[0].getAttribute('tabindex')).toBe('-1');

    toolbar.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true }));
    f.detectChanges();
    expect(buttons[7].getAttribute('tabindex')).toBe('0');
  });

  it('sanitizes CVA writeValue and editor updates, and enforces maxLength', async () => {
    const mock = createMockEngine();
    TestBed.configureTestingModule({
      providers: [{ provide: UI_RICH_TEXT_ENGINE, useValue: mock.loader }],
    });
    const f = TestBed.createComponent(EditorHost);
    f.componentInstance.maxLength.set(10);
    f.componentInstance.value.set('<p onclick="x()">Hi</p><script>evil()</script>');
    f.detectChanges();
    await Promise.resolve();
    await new Promise((r) => setTimeout(r, 0));
    f.detectChanges();

    const editor = mock.instances[0];
    expect(editor.getHTML()).toBe('<p>Hi</p>');
    expect(f.nativeElement.querySelector('.rt-counter')?.textContent?.trim()).toBe('2 / 10');

    // Valid update within maxLength
    editor.triggerUpdate('<p><strong>Hello</strong></p><script>bad()</script>');
    f.detectChanges();
    expect(f.componentInstance.value()).toBe('<p><strong>Hello</strong></p>');
    expect(f.nativeElement.querySelector('.rt-counter')?.textContent?.trim()).toBe('5 / 10');

    // Update exceeding maxLength is reverted
    editor.triggerUpdate('<p>This text is way too long</p>');
    f.detectChanges();
    expect(f.componentInstance.value()).toBe('<p><strong>Hello</strong></p>');
  });

  it('validates link schemes in the link popover and blocks javascript: URLs', async () => {
    const mock = createMockEngine();
    TestBed.configureTestingModule({
      providers: [{ provide: UI_RICH_TEXT_ENGINE, useValue: mock.loader }],
    });
    const f = TestBed.createComponent(EditorHost);
    f.detectChanges();
    await Promise.resolve();

    const editor = mock.instances[0];
    const linkBtn = f.nativeElement.querySelector('button[aria-label="Link"]') as HTMLButtonElement;
    linkBtn.click();
    f.detectChanges();

    const input = f.nativeElement.querySelector('.rt-pop-input') as HTMLInputElement;
    const confirmBtn = f.nativeElement.querySelector('.rt-pop-btn.primary') as HTMLButtonElement;

    input.value = 'javascript:alert(1)';
    input.dispatchEvent(new Event('input'));
    confirmBtn.click();
    f.detectChanges();

    expect(input.classList.contains('invalid')).toBe(true);
    expect(editor.lastLink).toBeNull();

    input.value = 'https://addu.gov.mv';
    input.dispatchEvent(new Event('input'));
    confirmBtn.click();
    f.detectChanges();

    expect(editor.lastLink).toEqual({ href: 'https://addu.gov.mv', target: null });
    expect(f.nativeElement.querySelector('.rt-popover')).toBeNull();
  });

  it('requires imageUpload for image tool and asks for alt text on insert', async () => {
    const mock = createMockEngine();
    TestBed.configureTestingModule({
      providers: [{ provide: UI_RICH_TEXT_ENGINE, useValue: mock.loader }],
    });
    const f = TestBed.createComponent(EditorHost);
    f.componentInstance.tools.set(['bold', 'image']);
    f.detectChanges();
    await Promise.resolve();

    const imgBtn = f.nativeElement.querySelector('button[aria-label="Image"]') as HTMLButtonElement;
    expect(imgBtn.disabled).toBe(true);

    const uploadSpy = vi.fn(async () => ({ url: 'https://example.com/photo.jpg', alt: 'Default alt' }));
    f.componentInstance.imageUpload.set(uploadSpy);
    f.detectChanges();
    expect(imgBtn.disabled).toBe(false);

    const fileInput = f.nativeElement.querySelector('.rt-file-input') as HTMLInputElement;
    const file = new File(['abc'], 'photo.jpg', { type: 'image/jpeg' });
    Object.defineProperty(fileInput, 'files', { value: [file], configurable: true });
    fileInput.dispatchEvent(new Event('change'));
    await Promise.resolve();
    await Promise.resolve();
    f.detectChanges();

    expect(uploadSpy).toHaveBeenCalledWith(file);
    const altInput = f.nativeElement.querySelector('.rt-pop-input') as HTMLInputElement;
    expect(altInput.value).toBe('Default alt');
    altInput.value = 'Hithadhoo harbour';
    altInput.dispatchEvent(new Event('input'));
    (f.nativeElement.querySelector('.rt-pop-btn.primary') as HTMLButtonElement).click();
    f.detectChanges();

    expect(mock.instances[0].lastImage).toEqual({
      src: 'https://example.com/photo.jpg',
      alt: 'Hithadhoo harbour',
    });
  });
});

describe('UiRichText (real Tiptap engine)', () => {
  it('loads real Tiptap in jsdom, renders ProseMirror with dir="auto" blocks, and formats text', async () => {
    const f = TestBed.createComponent(EditorHost);
    f.componentInstance.value.set('<p>Hello <strong>world</strong></p>');
    f.detectChanges();

    // Wait for dynamic Tiptap imports to resolve
    for (let i = 0; i < 30; i++) {
      if (f.nativeElement.querySelector('.ProseMirror')) break;
      await new Promise((r) => setTimeout(r, 20));
    }
    f.detectChanges();

    const pm = f.nativeElement.querySelector('.ProseMirror') as HTMLElement;
    expect(pm).not.toBeNull();
    const p = pm.querySelector('p');
    expect(p?.getAttribute('dir')).toBe('auto');
    expect(p?.textContent).toContain('Hello world');
  });
});
