import { describe, expect, it } from 'vitest';
import { uiSanitizeRichText } from './sanitize';

/**
 * The sanitizer is a hand-written tokenizer, so these tests do not trust its output text: each result
 * is parsed by the real HTML parser (as a browser would, entities decoded) and every element,
 * attribute and link that survives must be on the allowlist.
 */
const BASE_TAGS = ['p', 'h2', 'h3', 'ul', 'ol', 'li', 'a', 'strong', 'em', 'blockquote', 'br'];
const ALL_TAGS = [...BASE_TAGS, 'img', 'table', 'thead', 'tbody', 'tr', 'th', 'td'];
const ATTRS: Record<string, string[]> = { a: ['href', 'target', 'rel'], img: ['src', 'alt'] };
const SAFE_SCHEME = /^(https?:|mailto:|tel:)/i;

function assertSafe(output: string, tags: string[]): void {
  const host = document.createElement('div');
  host.innerHTML = output;
  for (const el of Array.from(host.querySelectorAll('*'))) {
    const tag = el.tagName.toLowerCase();
    expect(tags, `element <${tag}> in ${JSON.stringify(output)}`).toContain(tag);
    for (const attr of Array.from(el.attributes)) {
      const allowed = (ATTRS[tag] ?? []).concat(tag === 'p' || tag === 'h2' || tag === 'h3' || tag === 'li' || tag === 'blockquote' ? ['dir'] : []);
      expect(allowed, `attribute ${attr.name} on <${tag}> in ${JSON.stringify(output)}`).toContain(attr.name);
    }
    for (const urlAttr of ['href', 'src']) {
      const value = el.getAttribute(urlAttr);
      if (value !== null) {
        // What the browser would actually navigate to after decoding and trimming.
        const resolved = value.replace(/[\u0000- ]/g, '');
        const where = `${urlAttr}=${JSON.stringify(value)} in ${JSON.stringify(output)}`;
        expect(resolved.toLowerCase(), where).not.toMatch(/^(javascript|vbscript|data|file|blob):/);
        // A link always carries one of the allowed schemes; an image may also be a relative path.
        if (urlAttr === 'href') expect(SAFE_SCHEME.test(resolved), where).toBe(true);
        else if (/^[a-z][a-z0-9+.-]*:/i.test(resolved)) expect(/^https?:/i.test(resolved), where).toBe(true);
      }
    }
  }
}

const PAYLOADS = [
  '<script>alert(1)</script>',
  '<img src=x onerror=alert(1)>',
  '<IMG SRC="javascript:alert(1)">',
  '<a href="javascript:alert(1)">x</a>',
  '<a href="JaVaScRiPt:alert(1)">x</a>',
  '<a href=" javascript:alert(1)">x</a>',
  '<a href="java\tscript:alert(1)">x</a>',
  '<a href="java&#x09;script:alert(1)">x</a>',
  '<a href="&#106;&#97;&#118;&#97;&#115;&#99;&#114;&#105;&#112;&#116;&#58;alert(1)">x</a>',
  '<a href="&#x6A;avascript:alert(1)">x</a>',
  '<a href="javascript&colon;alert(1)">x</a>',
  '<a href="data:text/html,<script>alert(1)</script>">x</a>',
  '<a href="vbscript:msgbox(1)">x</a>',
  '<a href=javascript:alert(1)>x</a>',
  "<a href='javascript:alert(1)'>x</a>",
  '<a href="https://ok.mv" onclick="alert(1)">x</a>',
  '<a href="https://ok.mv" style="x:expression(alert(1))">x</a>',
  '<svg onload=alert(1)>',
  '<svg><script>alert(1)</script></svg>',
  '<math><mi xlink:href="javascript:alert(1)">x</mi></math>',
  '<iframe src="javascript:alert(1)"></iframe>',
  '<object data="javascript:alert(1)"></object>',
  '<embed src="javascript:alert(1)">',
  '<form action="javascript:alert(1)"><button>x</button></form>',
  '<input onfocus=alert(1) autofocus>',
  '<details open ontoggle=alert(1)>',
  '<body onload=alert(1)>',
  '<style>@import "javascript:alert(1)";</style>',
  '<p style="background:url(javascript:alert(1))">x</p>',
  '<p onmouseover="alert(1)">x</p>',
  '<p/onmouseover=alert(1)>x</p>',
  '<p\nonmouseover=alert(1)>x</p>',
  '<<script>script>alert(1)<</script>/script>',
  '<scr<script>ipt>alert(1)</scr</script>ipt>',
  '<!--<img src=x onerror=alert(1)>-->',
  '<![CDATA[<img src=x onerror=alert(1)>]]>',
  '<noscript><p title="</noscript><img src=x onerror=alert(1)>"></noscript>',
  '<textarea><img src=x onerror=alert(1)></textarea>',
  '<title><img src=x onerror=alert(1)></title>',
  '<a href="https://ok.mv"><img src=x onerror=alert(1)></a>',
  '<strong title="x" class="y" id="z">bold</strong>',
  '<img src="https://ok.mv/a.png" alt="ok" onerror="alert(1)">',
  '<img src="data:image/svg+xml;base64,PHN2ZyBvbmxvYWQ9YWxlcnQoMSk+">',
  '<table onclick=alert(1)><tr><td onmouseover=alert(1)>x</td></tr></table>',
  '<a href="https://ok.mv" target="_blank">x</a>',
  '<base href="javascript:alert(1)//">',
  '<meta http-equiv="refresh" content="0;url=javascript:alert(1)">',
  '<link rel=stylesheet href="javascript:alert(1)">',
  '"><img src=x onerror=alert(1)>',
  '<p>ok</p><img src=x onerror=alert(1)//',
  '<a href="https://ok.mv"\x00onclick=alert(1)>x</a>',
  '<a href="h&#116;tps://ok.mv">fine</a>',
  'plain text with < and > and & characters',
];

describe('uiSanitizeRichText against attack strings', () => {
  for (const [label, options, tags] of [
    ['default tools', undefined, BASE_TAGS],
    ['image and table on', { image: true, table: true }, ALL_TAGS],
  ] as const) {
    it(`leaves nothing outside the allowlist once parsed (${label})`, () => {
      for (const payload of PAYLOADS) {
        assertSafe(uiSanitizeRichText(payload, options), tags);
        // Sanitizing twice must not change the result (no second-pass surprises).
        const once = uiSanitizeRichText(payload, options);
        expect(uiSanitizeRichText(once, options), `not idempotent for ${JSON.stringify(payload)}`).toBe(once);
      }
    });
  }

  it('survives random mixes of attack fragments', () => {
    const parts = ['<', '>', '"', "'", '=', '/', ' ', '\t', '\n', 'a', 'img', 'p', 'script', 'svg', 'href', 'src', 'on', 'onerror', 'javascript:', '&#106;', '&colon;', 'alert(1)', '<!--', '-->', '<a ', '<img ', '</a>', 'style', 'x'];
    let seed = 12345;
    const next = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
    for (let i = 0; i < 1500; i++) {
      let s = '';
      const n = 4 + Math.floor(next() * 24);
      for (let j = 0; j < n; j++) s += parts[Math.floor(next() * parts.length)];
      assertSafe(uiSanitizeRichText(s, { image: true, table: true }), ALL_TAGS);
    }
  });

  it('keeps ordinary rich text intact', () => {
    const html = '<h2>Title</h2><p>Hello <strong>bold</strong> <em>it</em> <a href="https://addu.gov.mv">link</a></p><ul><li>one</li></ul>';
    const out = uiSanitizeRichText(html);
    for (const piece of ['<h2', 'Title', '<strong>bold</strong>', '<em>it</em>', 'href="https://addu.gov.mv"', '<li']) {
      expect(out).toContain(piece);
    }
  });
});
