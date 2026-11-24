import { describe, expect, it } from 'vitest';
import { uiIsSafeRichTextUrl, uiSanitizeRichText } from './sanitize';

describe('uiSanitizeRichText', () => {
  it('keeps the base allowlist tags and strips disallowed attributes', () => {
    const input =
      '<h2 class="title" style="color:red">Heading</h2>' +
      '<h3 onclick="alert(1)">Sub</h3>' +
      '<p id="p1" data-x="1">Hello <strong>bold</strong> and <em>italic</em><br>line 2</p>' +
      '<blockquote cite="x">Quote</blockquote>' +
      '<a href="https://addu.gov.mv" target="_blank" rel="noopener" onclick="evil()">Link</a>';

    expect(uiSanitizeRichText(input)).toBe(
      '<h2>Heading</h2>' +
        '<h3>Sub</h3>' +
        '<p>Hello <strong>bold</strong> and <em>italic</em><br>line 2</p>' +
        '<blockquote>Quote</blockquote>' +
        '<a href="https://addu.gov.mv">Link</a>',
    );
  });

  it('preserves nested lists', () => {
    const input =
      '<ul><li>One<ul><li>Nested <strong>item</strong></li></ul></li><li>Two</li></ul>' +
      '<ol><li>First</li><li>Second</li></ol>';
    expect(uiSanitizeRichText(input)).toBe(input);
  });

  it('allows http, https, mailto, and tel links and blocks javascript: in all forms', () => {
    expect(uiIsSafeRichTextUrl('http://example.com')).toBe(true);
    expect(uiIsSafeRichTextUrl('https://example.com/a?b=1')).toBe(true);
    expect(uiIsSafeRichTextUrl('mailto:info@addu.gov.mv')).toBe(true);
    expect(uiIsSafeRichTextUrl('tel:+9606885000')).toBe(true);

    const vectors = [
      'javascript:alert(1)',
      'JaVaScRiPt:alert(1)',
      '  java\tscript:alert(1)',
      'java\nscript:alert(1)',
      '&#106;&#97;vascript:alert(1)',
      '&#x6a;avascript:alert(1)',
      '&#0000106avascript:alert(1)',
      'java&#x09;script:alert(1)',
      'data:text/html,<script>alert(1)</script>',
      'vbscript:msgbox(1)',
      '/relative/path',
    ];

    for (const url of vectors) {
      expect(uiIsSafeRichTextUrl(url)).toBe(false);
      expect(uiSanitizeRichText(`<a href="${url}">Click</a>`)).toBe('Click');
    }
  });

  it('removes script and style elements with their content', () => {
    expect(uiSanitizeRichText('<p>Safe</p><script>alert(1)</script><STYLE>body{display:none}</STYLE>')).toBe(
      '<p>Safe</p>',
    );
    expect(uiSanitizeRichText('<p>Before</p><script src="x.js">alert(2)')).toBe('<p>Before</p>');
    expect(uiSanitizeRichText('<scr<script>ipt>alert(1)</script><p>Ok</p>')).toBe('ipt&gt;alert(1)<p>Ok</p>');
  });

  it('unwraps unknown elements to their text and strips event handlers', () => {
    expect(uiSanitizeRichText('<svg onload="alert(1)"><p>Inside SVG</p></svg>')).toBe('<p>Inside SVG</p>');
    expect(uiSanitizeRichText('<iframe src="https://evil.com">Fallback text</iframe>')).toBe('Fallback text');
    expect(uiSanitizeRichText('<div class="box"><h1>Title</h1><span>Text</span></div>')).toBe('TitleText');
    expect(uiSanitizeRichText('<img src="https://example.com/a.png" onerror="alert(1)">')).toBe('');
  });

  it('allows img[src,alt] only when image option is enabled and validates src', () => {
    const html = '<p>Pic <img src="https://example.com/a.jpg" alt="Addu" onerror="alert(1)" width="100"></p>';
    expect(uiSanitizeRichText(html)).toBe('<p>Pic </p>');
    expect(uiSanitizeRichText(html, { image: true })).toBe(
      '<p>Pic <img src="https://example.com/a.jpg" alt="Addu"></p>',
    );

    expect(
      uiSanitizeRichText('<img src="data:image/png;base64,iVBOR==" alt="dot">', { image: true }),
    ).toBe('<img src="data:image/png;base64,iVBOR==" alt="dot">');
    expect(
      uiSanitizeRichText('<img src="data:image/svg+xml;base64,PHN2Zz4=" alt="bad">', { image: true }),
    ).toBe('');
    expect(
      uiSanitizeRichText('<img src="javascript:alert(1)" alt="bad">', { image: true }),
    ).toBe('');
  });

  it('allows table elements only when table option is enabled and strips attributes', () => {
    const html =
      '<table class="t"><thead><tr><th colspan="2">Name</th></tr></thead><tbody><tr><td style="color:red">Ali</td></tr></tbody></table>';
    expect(uiSanitizeRichText(html)).toBe('NameAli');
    expect(uiSanitizeRichText(html, { table: true })).toBe(
      '<table><thead><tr><th>Name</th></tr></thead><tbody><tr><td>Ali</td></tr></tbody></table>',
    );
  });

  it('strips HTML comments and escapes stray angle brackets', () => {
    expect(uiSanitizeRichText('<!-- secret --><p>2 < 5 & 7 > 3</p>')).toBe('<p>2 &lt; 5 &amp; 7 &gt; 3</p>');
  });
});
