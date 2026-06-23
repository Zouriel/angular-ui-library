import { Component, signal } from '@angular/core';
import { UiText } from 'ui/text';
import { UiFileViewer, UiImageViewer, UiFileExplorer, type UiFileNode } from 'ui/file-viewer';
import { DocPage, DocSection, DocDemo, type ApiRow } from '../docs/docs-ui';

const sampleImg = 'data:image/svg+xml;utf8,' + encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="%233d5afe"/><stop offset="1" stop-color="%232faa6e"/></linearGradient></defs><rect width="640" height="360" fill="url(%23g)"/><text x="50%" y="50%" fill="white" font-family="sans-serif" font-size="28" text-anchor="middle" dominant-baseline="middle">Sample</text></svg>`);

const NODE = "interface UiFileNode {\n  name: string;\n  type: 'file' | 'dir';\n  url?: string;     // file URL for opening into a viewer\n  kind?: string;    // MIME or extension hint\n  children?: UiFileNode[];\n}";

@Component({
  selector: 'page-file-viewer',
  imports: [UiText, UiFileViewer, UiImageViewer, UiFileExplorer, DocPage, DocSection, DocDemo],
  template: `
    <doc-page eyebrow="Flagship" title="File viewer"
      lead="A content-agnostic viewer system: a dispatcher detects a file's type and delegates to the matching renderer. Embed inline or inside a ui-window. PDF (pdfjs) is isolated in its own entry and lazy-loaded.">

      <doc-section name="File viewer (dispatcher)" selector="ui-file-viewer" [api]="fvApi"
        summary="Detects type from kind/extension and renders image / video / audio / text / code / pdf, or a metadata + download fallback. kind may be a type ('image'…), a MIME ('application/pdf'), or an extension; otherwise inferred from name/src.">
        <doc-demo code="<ui-file-viewer [src]=&quot;url&quot; [name]=&quot;name&quot; [kind]=&quot;kind&quot; />">
          <div class="cols2">
            <ui-file-explorer [root]="tree" (open)="opened.set($event)" />
            <div class="vh">
              @if (opened()) { <ui-file-viewer [src]="opened()!.url!" [name]="opened()!.name" [kind]="opened()!.kind" /> }
              @else { <ui-image-viewer [src]="img" alt="Sample" /> }
            </div>
          </div>
          <ui-text variant="caption">Open a file in the explorer to dispatch to the matching renderer.</ui-text>
        </doc-demo>
      </doc-section>

      <doc-section name="Image viewer" selector="ui-image-viewer" [api]="imgApi"
        summary="Zoom (buttons + wheel), pan (drag), fit/reset. src is required.">
        <doc-demo code="<ui-image-viewer [src]=&quot;url&quot; alt=&quot;Description&quot; />"></doc-demo>
      </doc-section>

      <doc-section name="Media & text sub-renderers" selector="ui-video-player · ui-audio-player · ui-text-viewer · ui-code-viewer" [api]="subApi"
        summary="video/audio use native APIs with themed controls; text/code fetch a URL (src) or take a content string; code-viewer adds line numbers + a language label.">
        <doc-demo code="<ui-video-player [src]=&quot;'/clip.mp4'&quot; [poster]=&quot;'/p.jpg'&quot; />
<ui-audio-player [src]=&quot;'/a.mp3'&quot; [title]=&quot;'Track'&quot; />
<ui-code-viewer [src]=&quot;'/main.ts'&quot; language=&quot;ts&quot; />"></doc-demo>
      </doc-section>

      <doc-section name="PDF viewer" selector="ui-pdf-viewer" [api]="pdfApi"
        summary="Own secondary entry (ui/pdf-viewer); dynamically imports pdfjs-dist so it ships only when used. Page nav + zoom. The worker defaults to a CDN URL — override with workerSrc to self-host. pdfjs-dist is an optional peer dependency consumers install.">
        <doc-demo code="<ui-pdf-viewer [src]=&quot;'/doc.pdf'&quot; [workerSrc]=&quot;'/pdf.worker.min.mjs'&quot; />"></doc-demo>
      </doc-section>

      <doc-section name="File explorer" selector="ui-file-explorer" [api]="fxApi" [outputs]="fxOut" [shapes]="NODE"
        summary="Directory browser: breadcrumb path + list view, typed icons, open-into-viewer via (open). root is a required UiFileNode tree.">
        <doc-demo code="<ui-file-explorer [root]=&quot;tree&quot; (open)=&quot;open($event)&quot; />"></doc-demo>
      </doc-section>
    </doc-page>
  `,
  styles: `
    .cols2 { display: grid; grid-template-columns: 1fr 1fr; gap: var(--ui-space-3); }
    .vh { height: 240px; border: 1px solid var(--ui-color-border); border-radius: var(--ui-radius); overflow: hidden; }
    @media (max-width: 720px) { .cols2 { grid-template-columns: 1fr; } }
  `,
})
export class FileViewerPage {
  protected readonly img = sampleImg;
  protected readonly NODE = NODE;
  protected readonly opened = signal<UiFileNode | null>(null);
  protected readonly tree: UiFileNode = {
    name: 'project', type: 'dir', children: [
      { name: 'src', type: 'dir', children: [
        { name: 'main.ts', type: 'file', kind: 'ts', url: 'data:text/plain,console.log(%22hi%22)' },
        { name: 'styles.css', type: 'file', kind: 'css', url: 'data:text/plain,:root{color:red}' },
      ]},
      { name: 'README.md', type: 'file', kind: 'md', url: 'data:text/plain,%23%20Readme%0AHello.' },
      { name: 'logo.svg', type: 'file', kind: 'image', url: sampleImg },
    ],
  };

  protected readonly fvApi: ApiRow[] = [
    { name: 'src', type: 'string (required)', default: '—', desc: 'File URL.' },
    { name: 'name', type: 'string', default: '—', desc: 'Display name + extension hint.' },
    { name: 'kind', type: 'string', default: '—', desc: 'Type / MIME / extension override.' },
  ];
  protected readonly imgApi: ApiRow[] = [
    { name: 'src', type: 'string (required)', default: '—', desc: 'Image URL.' },
    { name: 'alt', type: 'string', default: "''", desc: 'Alt text.' },
  ];
  protected readonly subApi: ApiRow[] = [
    { name: 'video: src / poster', type: 'string', default: '—', desc: 'Video URL / poster.' },
    { name: 'audio: src / title', type: 'string', default: '—', desc: 'Audio URL / label.' },
    { name: 'text/code: src', type: 'string', default: '—', desc: 'URL to fetch.' },
    { name: 'text/code: content', type: 'string', default: '—', desc: 'Inline content (skips fetch).' },
    { name: 'code: language', type: 'string', default: "'text'", desc: 'Language label.' },
  ];
  protected readonly pdfApi: ApiRow[] = [
    { name: 'src', type: 'string (required)', default: '—', desc: 'PDF URL.' },
    { name: 'workerSrc', type: 'string', default: 'CDN', desc: 'Override the pdfjs worker URL.' },
  ];
  protected readonly fxApi: ApiRow[] = [
    { name: 'root', type: 'UiFileNode (required)', default: '—', desc: 'Directory tree.' },
  ];
  protected readonly fxOut: ApiRow[] = [{ name: 'open', type: 'UiFileNode', default: '—', desc: 'File opened.' }];
}
