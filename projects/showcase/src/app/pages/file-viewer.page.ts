import { Component, signal } from '@angular/core';
import { UiText } from '@zouriel/ui/text';
import {
  UiFileViewer,
  UiImageViewer,
  UiFileExplorer,
  UiMediaLightbox,
  UiAudioPlayer,
  UiVideoPlayer,
  UiTextViewer,
  UiCodeViewer,
  type UiFileNode,
  type UiMediaAction,
  type UiMediaItem,
} from '@zouriel/ui/file-viewer';
import { UiButton, UiSegmented, type UiSegmentedOption } from '@zouriel/ui/button';
import { UiPdfViewer } from '@zouriel/ui/pdf-viewer';
import { DocPage, DocSection, DocDemo, type ApiRow } from '../docs/docs-ui';

const sampleImg = 'data:image/svg+xml;utf8,' + encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="%233d5afe"/><stop offset="1" stop-color="%232faa6e"/></linearGradient></defs><rect width="640" height="360" fill="url(%23g)"/><text x="50%" y="50%" fill="white" font-family="sans-serif" font-size="28" text-anchor="middle" dominant-baseline="middle">Sample</text></svg>`);

/** A sample image with a label, so stepping between them is visible. */
function slide(label: string, a: string, b: string): string {
  return 'data:image/svg+xml;utf8,' + encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs><rect width="640" height="360" fill="url(#g)"/><text x="50%" y="50%" fill="white" font-family="sans-serif" font-size="28" text-anchor="middle" dominant-baseline="middle">${label}</text></svg>`);
}
const SLIDES = [slide('One', '#3d5afe', '#2faa6e'), slide('Two', '#8e24aa', '#3d5afe'), slide('Three', '#ef6c00', '#c62828')];

/** A two-page PDF written by hand (Helvetica text, no images), served as a blob URL so the demo needs no file. */
function samplePdf(): string {
  const page = (n: number) =>
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 420 297] /Resources << /Font << /F1 3 0 R >> >> /Contents ${n} 0 R >>`;
  const text = (t: string) => { const c = `BT /F1 22 Tf 40 220 Td (${t}) Tj /F1 12 Tf 0 -36 Td (Rendered by pdfjs-dist in ui-pdf-viewer.) Tj ET`; return `<< /Length ${c.length} >>\nstream\n${c}\nendstream`; };
  const objs = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [4 0 R 5 0 R] /Count 2 >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    page(6),
    page(7),
    text('Page one of two'),
    text('Page two of two'),
  ];
  let out = '%PDF-1.4\n';
  const offsets: number[] = [];
  objs.forEach((o, i) => { offsets.push(out.length); out += `${i + 1} 0 obj\n${o}\nendobj\n`; });
  const xref = out.length;
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n` + offsets.map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('');
  out += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return URL.createObjectURL(new Blob([out], { type: 'application/pdf' }));
}

/** One second of a quiet 440 Hz tone as a WAV data URL, so the audio demo has something to play. */
function sampleTone(): string {
  const rate = 8000, n = rate;
  const bytes = new Uint8Array(44 + n);
  const v = new DataView(bytes.buffer);
  const str = (o: number, t: string) => [...t].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  str(0, 'RIFF'); v.setUint32(4, 36 + n, true); str(8, 'WAVE'); str(12, 'fmt ');
  v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, rate, true); v.setUint32(28, rate, true); v.setUint16(32, 1, true); v.setUint16(34, 8, true);
  str(36, 'data'); v.setUint32(40, n, true);
  for (let i = 0; i < n; i++) bytes[44 + i] = 128 + Math.round(24 * Math.sin((2 * Math.PI * 440 * i) / rate) * Math.min(1, (n - i) / 800));
  let bin = '';
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  return 'data:audio/wav;base64,' + btoa(bin);
}

const SAMPLE_CODE = `import { UiFileViewer } from '@zouriel/ui/file-viewer';

export class Preview {
  url = '/files/report.pdf';
  name = 'report.pdf';
}`;

const NODE = "interface UiFileNode {\n  name: string;\n  type: 'file' | 'dir';\n  url?: string;     // file URL, used when opening it into a viewer\n  kind?: string;    // MIME or extension hint\n  children?: UiFileNode[];\n}";

const ITEM = "interface UiMediaItem {\n  src: string;            // full-size image, or the playable video\n  thumb?: string;         // filmstrip tile, and a clip's poster\n  kind?: 'image' | 'video';   // default 'image'\n  alt?: string;\n  caption?: string;       // the line the chrome shows\n}\n\ninterface UiMediaAction {\n  id: string;\n  label: string;\n  tone?: 'default' | 'danger';\n  when?: (item: UiMediaItem, index: number) => boolean;    // hide where it does not apply\n  href?: (item: UiMediaItem, index: number) => string;     // renders an anchor instead\n  download?: (item: UiMediaItem, index: number) => string; // the anchor's download name\n}";

@Component({
  selector: 'page-file-viewer',
  imports: [UiText, UiButton, UiSegmented, UiFileViewer, UiImageViewer, UiFileExplorer, UiMediaLightbox, UiAudioPlayer, UiVideoPlayer, UiTextViewer, UiCodeViewer, UiPdfViewer, DocPage, DocSection, DocDemo],
  template: `
    <doc-page eyebrow="Flagship" title="File viewer"
      lead="A viewer for any file: a dispatcher works out the file's type and hands it to the matching renderer. Each renderer can also be used on its own, inline or inside a ui-window. The PDF viewer is a separate entry point that loads pdfjs-dist only when it is used.">

      <doc-section name="File viewer (dispatcher)" selector="ui-file-viewer" [api]="fvApi"
        summary="Works out the type and renders an image, video, audio, text, code or PDF viewer, or a file icon with the name and a download link when it doesn't know the type. kind may be a type ('image', 'video', 'audio', 'pdf', 'text', 'code'), a MIME type ('application/pdf', 'image/png'), or an extension ('ts'). Without kind, the extension of name (or of src) decides. The PDF branch sits in a @defer block, so pdfjs-dist is only downloaded when a PDF is opened. Import from @zouriel/ui/file-viewer.">
        <doc-demo code="<ui-file-viewer [src]=&quot;url&quot; [name]=&quot;'report.pdf'&quot; />
<ui-file-viewer [src]=&quot;url&quot; kind=&quot;application/pdf&quot; />">
          <div class="cols2">
            <ui-file-explorer [root]="tree" (open)="opened.set($event)" />
            <div class="vh">
              @if (opened(); as f) { <ui-file-viewer [src]="f.url!" [name]="f.name" [kind]="f.kind" /> }
              @else { <ui-image-viewer [src]="img" alt="Sample" /> }
            </div>
          </div>
          <ui-text variant="caption">Open a file in the explorer: each type goes to its own renderer. notes.bin has no known type, so it gets the download fallback.</ui-text>
        </doc-demo>
      </doc-section>

      <doc-section name="Image viewer" selector="ui-image-viewer" [api]="imgApi" [outputs]="imgOut"
        summary="Zoom with the buttons, Ctrl+wheel (or a trackpad pinch), a touch pinch or a double-click; pan by dragging or with the wheel; Fit resets the view. When zoomed in, the arrow keys pan (Shift for bigger steps); otherwise Left/Right ask for the neighbour. With hasPrevious/hasNext set it shows step buttons and reads swipes, and emits previous/next for the host to change src: the host keeps the list. kind='video' frames a clip the same way, with the browser's own video controls.">
        <doc-demo code="<ui-image-viewer [src]=&quot;photos[i]&quot; alt=&quot;Description&quot;
  [hasPrevious]=&quot;i &gt; 0&quot; [hasNext]=&quot;i &lt; photos.length - 1&quot;
  (previous)=&quot;i = i - 1&quot; (next)=&quot;i = i + 1&quot; />">
          <div class="vh tall">
            <ui-image-viewer [src]="slides[slideAt()]" [alt]="'Slide ' + (slideAt() + 1)"
              [hasPrevious]="slideAt() > 0" [hasNext]="slideAt() < slides.length - 1"
              (previous)="slideAt.set(slideAt() - 1)" (next)="slideAt.set(slideAt() + 1)" />
          </div>
          <ui-text variant="caption">Slide {{ slideAt() + 1 }} of {{ slides.length }}. Use the step buttons, a swipe, or Left/Right with the image focused.</ui-text>
        </doc-demo>
      </doc-section>

      <doc-section name="Full-page document viewer" selector="ui-image-viewer fill · ui-pdf-viewer fill" [api]="fillApi"
        summary="For a page whose whole point is one document, such as a payment slip opened from a list: give the viewer fill and a parent with a height (a full-height page, or a flex: 1 child under the title). It takes all of that space, the photo or page is fitted into it (contain, centred; 100% is fitted), pinch, Ctrl+wheel and the buttons still zoom, a zoomed photo still pans, and the controls float over the bottom on the glass surface, above the home indicator, instead of sitting in a bar of their own. There is no frame around it. With fill the image viewer is focusable and takes + - 0; the PDF viewer adds a Fit button.">
        <doc-demo lang="html + css" code="<main class=&quot;slip-page&quot;>
  <h1>Payment slip</h1>
  @if (isPdf) {
    <ui-pdf-viewer fill [src]=&quot;url&quot; />
  } @else {
    <ui-image-viewer fill [src]=&quot;url&quot; alt=&quot;Payment slip&quot; />
  }
</main>

.slip-page { display: flex; flex-direction: column; height: 100dvh; }
.slip-page > ui-image-viewer, .slip-page > ui-pdf-viewer { flex: 1; min-height: 0; }">
          <ui-segmented [options]="fillKinds" [value]="fillKind()" (valueChange)="fillKind.set($any($event))" label="Document" />
          <div class="phone" data-demo="fill">
            <div class="phone-top"><ui-text variant="h5">Payment slip</ui-text></div>
            @if (fillKind() === 'pdf') {
              <ui-pdf-viewer fill [src]="pdf" />
            } @else {
              <ui-image-viewer fill [src]="slipPhoto" alt="Photo of a payment receipt" />
            }
          </div>
          <ui-text variant="caption">A phone-sized page: the title, then the viewer filling everything below it. Switch between a photo and a PDF.</ui-text>
        </doc-demo>
      </doc-section>

      <doc-section name="Media lightbox" selector="ui-media-lightbox" [api]="lbApi" [outputs]="lbOut" [shapes]="ITEM"
        summary="Full-screen gallery over everything else: a native dialog in the top layer, so no ancestor's overflow, transform or z-index can clip it. Photographs zoom (pinch, wheel, double-tap) and pan; clips get themed controls, a filmstrip, swipe between items, drag-down to dismiss, and chrome that fades away while a clip plays. The host owns the list: items says what there is, index says where you are, and both are two-way. Keys: Left/Right step (Shift seeks a clip), Space or k plays, j/l seek 10s, m mutes, f toggles fullscreen, 0 resets the zoom, Esc closes. Extra top-bar controls can be projected with the lightbox-actions attribute.">
        <doc-demo code="<ui-media-lightbox [items]=&quot;photos&quot; [(index)]=&quot;at&quot; [(open)]=&quot;open&quot;
  label=&quot;Photos from the night&quot; [actions]=&quot;actions&quot; (action)=&quot;on($event)&quot; />">
          <ui-button variant="primary" (click)="lightbox.set(true)">Open the lightbox</ui-button>
          <ui-media-lightbox
            [items]="shots"
            [(index)]="shot"
            [(open)]="lightbox"
            label="A sample set"
            [actions]="lbActions"
            (action)="lastAction.set($event.id + ' on item ' + ($event.index + 1))"
          />
          <ui-text variant="caption">
            Swipe or use the arrow keys to move, drag down to dismiss, double-tap to zoom.
            @if (lastAction()) { Last action: {{ lastAction() }}. }
          </ui-text>
        </doc-demo>
      </doc-section>

      <doc-section name="Audio player" selector="ui-audio-player" [api]="audioApi"
        summary="A native audio element with themed controls: play/pause, the elapsed time, a seek slider and the duration. The buttons and slider are labelled for screen readers. There is no volume control; the device's volume applies.">
        <doc-demo code="<ui-audio-player src=&quot;/audio/interview.mp3&quot; title=&quot;Interview&quot; />">
          <div class="wide"><ui-audio-player [src]="tone" title="A one-second tone" /></div>
        </doc-demo>
      </doc-section>

      <doc-section name="Video player" selector="ui-video-player" [api]="videoApi"
        summary="A native video element with themed controls: play/pause, a seek slider, the time, volume, speed (0.5× to 2×) and fullscreen. Project track elements for captions or subtitles. ui-file-viewer uses it for video files.">
        <doc-demo code="<ui-video-player src=&quot;/clips/tour.mp4&quot; poster=&quot;/clips/tour.jpg&quot;>
  <track kind=&quot;captions&quot; src=&quot;/clips/tour.en.vtt&quot; srclang=&quot;en&quot; label=&quot;English&quot; default />
</ui-video-player>">
          <!-- A four-second test pattern served with the showcase (relative, so it works under the docs' base path). -->
          <div class="wide video"><ui-video-player src="clips/sample.webm" poster="clips/sample.jpg" /></div>
        </doc-demo>
      </doc-section>

      <doc-section name="Text and code viewers" selector="ui-text-viewer · ui-code-viewer" [api]="textApi"
        summary="ui-text-viewer shows plain text with wrapped lines. ui-code-viewer shows monospace source with sticky line numbers and a language label; long lines scroll sideways. Both take the text as content, or fetch src when content is not set, showing Loading… and then the text or the error.">
        <doc-demo code="<ui-code-viewer [content]=&quot;source&quot; language=&quot;ts&quot; />
<ui-text-viewer src=&quot;/notes/readme.txt&quot; />">
          <div class="cols2">
            <div class="vh"><ui-code-viewer [content]="code" language="ts" /></div>
            <div class="vh"><ui-text-viewer content="Plain text keeps its line breaks.&#10;&#10;Long lines wrap inside the box instead of scrolling sideways, which suits notes, logs and READMEs." /></div>
          </div>
        </doc-demo>
      </doc-section>

      <doc-section name="PDF viewer" selector="ui-pdf-viewer" [api]="pdfApi"
        summary="Its own entry point, @zouriel/ui/pdf-viewer, so apps that never show a PDF never bundle it. It imports pdfjs-dist dynamically on first use; install pdfjs-dist yourself (it is an optional peer dependency). It shows one page at a time with previous/next page buttons and zoom from 40% to 400%, drawn sharp on high-density screens. The pdfjs worker loads from cdnjs by default, matching the installed pdfjs-dist version; set workerSrc to serve it yourself (for example, copy node_modules/pdfjs-dist/build/pdf.worker.min.mjs into your public assets). If the file can't be loaded, it shows the error in place of the page.">
        <doc-demo lang="ts + html" code="import { UiPdfViewer } from '@zouriel/ui/pdf-viewer';

<ui-pdf-viewer src=&quot;/docs/handbook.pdf&quot; workerSrc=&quot;/pdf.worker.min.mjs&quot; />">
          <div class="vh pdf"><ui-pdf-viewer [src]="pdf" /></div>
          <ui-text variant="caption">A two-page PDF made in the browser, rendered with the default (CDN) worker.</ui-text>
        </doc-demo>
      </doc-section>

      <doc-section name="File explorer" selector="ui-file-explorer" [api]="fxApi" [outputs]="fxOut" [shapes]="NODE"
        summary="Folder browser: a breadcrumb path above a list of the current folder, folders first and then files, each sorted by name, with an icon per type. Clicking a folder goes into it; clicking a file emits open with its node, ready to pass to ui-file-viewer. Click a breadcrumb to go back up.">
        <doc-demo code="<ui-file-explorer [root]=&quot;tree&quot; (open)=&quot;file = $event&quot; />">
          <div class="wide"><ui-file-explorer [root]="tree" (open)="explored.set($event.name)" /></div>
          <ui-text variant="caption">{{ explored() ? 'open emitted for ' + explored() + '.' : 'Open a file to see the open output.' }}</ui-text>
        </doc-demo>
      </doc-section>
    </doc-page>
  `,
  styles: `
    .cols2 { display: grid; grid-template-columns: 1fr 1fr; gap: var(--ui-space-3); width: 100%; }
    .vh { height: 240px; border: 1px solid var(--ui-color-border); border-radius: var(--ui-radius); overflow: hidden; min-width: 0; width: 100%; }
    .vh.tall { height: 300px; }
    .vh.pdf { height: 420px; }
    .wide { width: 100%; }
    .video { max-width: 560px; }
    @media (max-width: 720px) { .cols2 { grid-template-columns: 1fr; } }
    /* A phone-sized page for the fill demo: a title, then the viewer taking the rest. */
    .phone { display: flex; flex-direction: column; width: min(100%, 390px); height: 640px; margin-top: var(--ui-space-3);
      border: 1px solid var(--ui-color-border); border-radius: var(--ui-radius-lg); overflow: hidden; background: var(--ui-color-bg); }
    .phone-top { flex: none; padding: var(--ui-space-3) var(--ui-space-4); }
    .phone > ui-image-viewer, .phone > ui-pdf-viewer { flex: 1; min-height: 0; }
  `,
})
export class FileViewerPage {
  protected readonly img = sampleImg;
  /** A photo of a receipt on a table (relative, so it works under the docs' base path). */
  protected readonly slipPhoto = 'demo/slip.jpg';
  protected readonly fillKinds: UiSegmentedOption[] = [{ value: 'image', label: 'Photo' }, { value: 'pdf', label: 'PDF' }];
  protected readonly fillKind = signal<'image' | 'pdf'>('image');
  protected readonly slides = SLIDES;
  protected readonly slideAt = signal(0);
  protected readonly pdf = samplePdf();
  protected readonly tone = sampleTone();
  protected readonly code = SAMPLE_CODE;
  protected readonly NODE = NODE;
  protected readonly ITEM = ITEM;
  protected readonly opened = signal<UiFileNode | null>(null);
  protected readonly explored = signal('');
  protected readonly lastAction = signal('');
  protected readonly tree: UiFileNode = {
    name: 'project', type: 'dir', children: [
      { name: 'src', type: 'dir', children: [
        { name: 'main.ts', type: 'file', url: 'data:text/plain,console.log(%22hi%22)' },
        { name: 'styles.css', type: 'file', url: 'data:text/plain,:root%7Bcolor:red%7D' },
      ]},
      { name: 'README.md', type: 'file', url: 'data:text/plain,%23%20Readme%0AHello.' },
      { name: 'logo.svg', type: 'file', kind: 'image', url: sampleImg },
      { name: 'handbook.pdf', type: 'file', url: this.pdf },
      { name: 'tone.wav', type: 'file', url: this.tone },
      { name: 'notes.bin', type: 'file', url: 'data:application/octet-stream,hello' },
    ],
  };

  protected readonly lightbox = signal(false);
  protected readonly shot = signal(0);
  protected readonly shots: UiMediaItem[] = SLIDES.map((src, i) => ({ src, thumb: src, alt: `Slide ${i + 1}`, caption: `${['First', 'Second', 'Third'][i]} of three` }));
  protected readonly lbActions: UiMediaAction[] = [
    { id: 'save', label: 'Download', href: (item) => item.src, download: () => 'sample.svg' },
    { id: 'remove', label: 'Remove', tone: 'danger', when: (_item, index) => index > 0 },
  ];

  protected readonly fvApi: ApiRow[] = [
    { name: 'src', type: 'string (required)', default: '—', desc: 'File URL, passed on to the renderer.' },
    { name: 'name', type: 'string', default: '—', desc: 'File name. Its extension picks the renderer when kind is not set, and it is shown in the download fallback and as the audio title.' },
    { name: 'kind', type: 'string', default: '—', desc: "A type ('image', 'video', 'audio', 'pdf', 'text', 'code'), a MIME type, or an extension. Overrides the name. Unknown values fall back to the download view." },
  ];
  protected readonly imgApi: ApiRow[] = [
    { name: 'src', type: 'string (required)', default: '—', desc: 'Image (or video) URL. The view resets when a new one loads.' },
    { name: 'alt', type: 'string', default: "''", desc: 'Alt text for the image.' },
    { name: 'kind', type: "'image' | 'video'", default: "'image'", desc: 'What src points at.' },
    { name: 'hasPrevious', type: 'boolean', default: 'false', desc: 'A previous item exists: shows the step buttons and allows the swipe and the Left key.' },
    { name: 'hasNext', type: 'boolean', default: 'false', desc: 'A next item exists.' },
    { name: 'fill', type: 'boolean', default: 'false', desc: 'Take all the space the parent gives, with the picture fitted and the controls floating over the bottom. See Full-page document viewer.' },
  ];
  protected readonly fillApi: ApiRow[] = [
    { name: 'fill', type: 'boolean', default: 'false', desc: 'On ui-image-viewer and ui-pdf-viewer. The parent must give a height (a flex: 1 child with min-height: 0, or height: 100dvh).' },
    { name: '--ui-image-viewer-min-height / --ui-pdf-viewer-min-height', type: 'CSS length', default: '60svh', desc: 'Without fill: the height the viewer takes in a parent that gives none (it stays within a parent that does).' },
  ];
  protected readonly imgOut: ApiRow[] = [
    { name: 'previous', type: 'void', default: '—', desc: 'Swipe, arrow key or step button asked for the previous item.' },
    { name: 'next', type: 'void', default: '—', desc: 'Same, for the next item.' },
  ];
  protected readonly lbApi: ApiRow[] = [
    { name: 'items', type: 'readonly UiMediaItem[]', default: '[]', desc: 'Everything the lightbox can show, in order.' },
    { name: 'index', type: 'number', default: '0', desc: 'Two-way (`[(index)]`). Which item is shown; swipes, keys and the filmstrip move it.' },
    { name: 'open', type: 'boolean', default: 'false', desc: 'Two-way (`[(open)]`). Whether the lightbox is up; Escape and the close button set it false.' },
    { name: 'label', type: 'string', default: "''", desc: 'Name of the set, shown when an item has no caption.' },
    { name: 'actions', type: 'readonly UiMediaAction[]', default: '[]', desc: 'Buttons in the top bar; href makes one a link, when hides it for some items.' },
    { name: '[lightbox-actions]', type: 'slot', default: '—', desc: 'Extra controls projected into the top bar.' },
  ];
  protected readonly lbOut: ApiRow[] = [
    { name: 'action', type: '{ id: string; item: UiMediaItem; index: number }', default: '—', desc: 'An action button (not a link) was pressed.' },
    { name: 'closed', type: 'void', default: '—', desc: 'The lightbox closed, however it was closed.' },
  ];
  protected readonly audioApi: ApiRow[] = [
    { name: 'src', type: 'string (required)', default: '—', desc: 'Audio URL.' },
    { name: 'title', type: 'string', default: '—', desc: 'Label shown next to the play button.' },
  ];
  protected readonly videoApi: ApiRow[] = [
    { name: 'src', type: 'string (required)', default: '—', desc: 'Video URL.' },
    { name: 'poster', type: 'string', default: '—', desc: 'Image shown before playback starts.' },
    { name: '<track>', type: 'slot', default: '—', desc: 'Captions or subtitles, projected into the video element.' },
  ];
  protected readonly textApi: ApiRow[] = [
    { name: 'content', type: 'string', default: '—', desc: 'The text to show. When set, src is not fetched.' },
    { name: 'src', type: 'string', default: '—', desc: 'URL to fetch the text from (with fetch), used when content is not set.' },
    { name: 'language', type: 'string', default: "'text'", desc: 'ui-code-viewer only: the label in its top bar. There is no syntax highlighting.' },
  ];
  protected readonly pdfApi: ApiRow[] = [
    { name: 'src', type: 'string (required)', default: '—', desc: 'PDF URL (also a blob: or data: URL). Changing it loads the new file from page 1.' },
    { name: 'fill', type: 'boolean', default: 'false', desc: 'Fill the parent: each page fitted (100% = fitted), controls floating at the bottom, a Fit button. See Full-page document viewer.' },
    { name: 'workerSrc', type: 'string', default: 'cdnjs URL', desc: 'URL of pdf.worker.min.mjs. Default: https://cdnjs.cloudflare.com/ajax/libs/pdf.js/<version>/pdf.worker.min.mjs. pdfjs keeps one worker setting per page, so use the same value everywhere.' },
  ];
  protected readonly fxApi: ApiRow[] = [
    { name: 'root', type: 'UiFileNode (required)', default: '—', desc: 'The top folder; its children are listed first.' },
  ];
  protected readonly fxOut: ApiRow[] = [{ name: 'open', type: 'UiFileNode', default: '—', desc: 'A file (not a folder) was clicked.' }];
}
