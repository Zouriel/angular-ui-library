/**
 * Options for {@link uiSanitizeRichText}.
 */
export interface UiRichTextSanitizeOptions {
  /** Allow `<img>` with `src` and `alt` attributes. */
  image?: boolean;
  /** Allow `<table>`, `<thead>`, `<tbody>`, `<tr>`, `<th>`, and `<td>`. */
  table?: boolean;
}

const BASE_TAGS = new Set([
  'p', 'h2', 'h3', 'ul', 'ol', 'li', 'a', 'strong', 'em', 'blockquote', 'br',
]);

const TABLE_TAGS = new Set(['table', 'thead', 'tbody', 'tr', 'th', 'td']);

const VOID_TAGS = new Set([
  'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr',
]);

const DROP_CONTENT_TAGS = new Set(['script', 'style']);

const NAMED_ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: '\u00a0',
  colon: ':',
  tab: '\t',
  newline: '\n',
};

/** Decodes HTML numeric and common named character references. */
function decodeHtmlEntities(value: string): string {
  return value.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);?/gi, (full, body: string) => {
    const lower = body.toLowerCase();
    if (lower.startsWith('#x')) {
      const code = Number.parseInt(lower.slice(2), 16);
      return Number.isFinite(code) && code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : '';
    }
    if (lower.startsWith('#')) {
      const code = Number.parseInt(lower.slice(1), 10);
      return Number.isFinite(code) && code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : '';
    }
    return NAMED_ENTITIES[lower] ?? full;
  });
}

function escapeHtmlText(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function escapeHtmlAttr(value: string): string {
  return escapeHtmlText(value).replace(/"/g, '&quot;');
}

/**
 * Checks whether a URL uses an allowed link scheme (`http`, `https`, `mailto`, `tel`).
 * Strips ASCII whitespace/control characters after entity decoding so obfuscated `javascript:`
 * schemes cannot slip through.
 */
export function uiIsSafeRichTextUrl(rawUrl: string): boolean {
  const decoded = decodeHtmlEntities(rawUrl);
  const normalized = decoded.replace(/[\u0000-\u0020\u007f]+/g, '');
  return /^(?:https?:|mailto:|tel:)/i.test(normalized);
}

function isSafeImageSrc(rawUrl: string): boolean {
  const decoded = decodeHtmlEntities(rawUrl);
  const normalized = decoded.replace(/[\u0000-\u0020\u007f]+/g, '');
  return /^(?:https?:|blob:|data:image\/(?:png|jpeg|jpg|gif|webp);base64,)/i.test(normalized);
}

interface ParsedTag {
  name: string;
  closing: boolean;
  selfClosing: boolean;
  attrs: Map<string, string>;
  nextIndex: number;
}

function parseTag(html: string, start: number): ParsedTag | null {
  let i = start + 1;
  const len = html.length;
  let closing = false;
  if (i < len && html[i] === '/') {
    closing = true;
    i++;
  }
  const nameStart = i;
  if (i >= len || !/[a-zA-Z]/.test(html[i])) return null;
  while (i < len && /[a-zA-Z0-9:-]/.test(html[i])) i++;
  const name = html.slice(nameStart, i).toLowerCase();

  const attrs = new Map<string, string>();
  let selfClosing = false;

  while (i < len) {
    while (i < len && /[\s/]/.test(html[i])) {
      if (html[i] === '/') selfClosing = true;
      i++;
    }
    if (i >= len) break;
    if (html[i] === '>') {
      i++;
      break;
    }
    selfClosing = false;
    const attrStart = i;
    while (i < len && !/[\s=/>]/.test(html[i])) i++;
    const attrName = html.slice(attrStart, i).toLowerCase();
    while (i < len && /\s/.test(html[i])) i++;
    let attrVal = '';
    if (i < len && html[i] === '=') {
      i++;
      while (i < len && /\s/.test(html[i])) i++;
      if (i < len && (html[i] === '"' || html[i] === "'")) {
        const quote = html[i++];
        const valStart = i;
        while (i < len && html[i] !== quote) i++;
        attrVal = html.slice(valStart, i);
        if (i < len && html[i] === quote) i++;
      } else {
        const valStart = i;
        while (i < len && !/[\s>]/.test(html[i])) i++;
        attrVal = html.slice(valStart, i);
      }
    }
    if (attrName && !attrs.has(attrName)) {
      attrs.set(attrName, attrVal);
    }
  }

  return { name, closing, selfClosing, attrs, nextIndex: i };
}

function skipDropTagContent(html: string, startAfterOpen: number, tagName: string): number {
  const closeRegex = new RegExp(`</${tagName}(?:\\s[^>]*)?>`, 'i');
  const slice = html.slice(startAfterOpen);
  const match = closeRegex.exec(slice);
  if (!match) return html.length;
  return startAfterOpen + match.index + match[0].length;
}

/**
 * Pure, dependency-free allowlist HTML sanitizer for `@zouriel/ui/rich-text`.
 *
 * Keeps only `p, h2, h3, ul, ol, li, a[href], strong, em, blockquote, br` (plus `img[src,alt]`
 * when `image` is enabled and `table, thead, tbody, tr, th, td` when `table` is enabled).
 * Strips all other attributes, styles, classes, scripts, and event handlers. Unknown elements
 * are unwrapped to their inner content, except `script` and `style` which are removed with
 * their content.
 */
export function uiSanitizeRichText(html: string, options?: UiRichTextSanitizeOptions): string {
  if (!html || typeof html !== 'string') return '';

  const allowImage = Boolean(options?.image);
  const allowTable = Boolean(options?.table);
  const isAllowed = (tag: string): boolean => {
    if (BASE_TAGS.has(tag)) return true;
    if (allowImage && tag === 'img') return true;
    if (allowTable && TABLE_TAGS.has(tag)) return true;
    return false;
  };

  const out: string[] = [];
  const openStack: string[] = [];
  let i = 0;
  const len = html.length;

  while (i < len) {
    const ch = html[i];
    if (ch !== '<') {
      const nextLt = html.indexOf('<', i);
      const rawText = nextLt === -1 ? html.slice(i) : html.slice(i, nextLt);
      out.push(escapeHtmlText(decodeHtmlEntities(rawText)));
      i = nextLt === -1 ? len : nextLt;
      continue;
    }

    if (html.startsWith('<!--', i)) {
      const endComment = html.indexOf('-->', i + 4);
      i = endComment === -1 ? len : endComment + 3;
      continue;
    }

    if (html.startsWith('<!', i) || html.startsWith('<?', i)) {
      const endDecl = html.indexOf('>', i + 2);
      i = endDecl === -1 ? len : endDecl + 1;
      continue;
    }

    const parsed = parseTag(html, i);
    if (!parsed) {
      out.push('&lt;');
      i++;
      continue;
    }

    i = parsed.nextIndex;

    if (!parsed.closing && DROP_CONTENT_TAGS.has(parsed.name)) {
      if (!parsed.selfClosing) {
        i = skipDropTagContent(html, i, parsed.name);
      }
      continue;
    }

    if (!isAllowed(parsed.name)) {
      continue;
    }

    if (parsed.closing) {
      if (VOID_TAGS.has(parsed.name)) continue;
      const idx = openStack.lastIndexOf(parsed.name);
      if (idx !== -1) {
        for (let j = openStack.length - 1; j >= idx; j--) {
          out.push(`</${openStack.pop()}>`);
        }
      }
      continue;
    }

    if (parsed.name === 'br') {
      out.push('<br>');
      continue;
    }

    if (parsed.name === 'img') {
      const rawSrc = parsed.attrs.get('src') ?? '';
      if (!isSafeImageSrc(rawSrc)) continue;
      const cleanSrc = decodeHtmlEntities(rawSrc).trim();
      const cleanAlt = decodeHtmlEntities(parsed.attrs.get('alt') ?? '');
      out.push(`<img src="${escapeHtmlAttr(cleanSrc)}" alt="${escapeHtmlAttr(cleanAlt)}">`);
      continue;
    }

    if (parsed.name === 'a') {
      const rawHref = parsed.attrs.get('href') ?? '';
      if (!uiIsSafeRichTextUrl(rawHref)) {
        // Unwrap unsafe or empty links rather than keeping a broken or dangerous <a>.
        continue;
      }
      const cleanHref = decodeHtmlEntities(rawHref).trim();
      out.push(`<a href="${escapeHtmlAttr(cleanHref)}">`);
      if (parsed.selfClosing) {
        out.push('</a>');
      } else {
        openStack.push('a');
      }
      continue;
    }

    out.push(`<${parsed.name}>`);
    if (parsed.selfClosing) {
      out.push(`</${parsed.name}>`);
    } else {
      openStack.push(parsed.name);
    }
  }

  while (openStack.length > 0) {
    out.push(`</${openStack.pop()}>`);
  }

  return out.join('');
}
