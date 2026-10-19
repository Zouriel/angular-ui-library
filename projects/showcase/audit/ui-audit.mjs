#!/usr/bin/env node
/*
 * Visual audit of every showcase page, in a real browser, across themes and screen sizes.
 *
 *   npm run audit:ui                          # needs the showcase running (npm start / ng serve showcase)
 *   npm run audit:ui -- --url http://localhost:4310 --themes dark,light --widths 1440,390
 *   npm run audit:ui -- --json audit.json     # full findings as JSON
 *
 * It measures what jsdom can't: rendered text contrast, font family and size, controls that sit in
 * one row at different heights, page-wide horizontal scroll, text that is cut off, small tap targets
 * spacing off the token scale, and crowding: controls too close to their neighbours, button labels
 * near the button edge, content flush against a card's edge, and overlapping text. Each finding
 * names the nearest ui-* component so it maps to code.
 *
 * Errors (exit 1): contrast below WCAG AA, a font outside the theme's families, text under 11px,
 * the page scrolling sideways, misaligned controls in a row, overlapping text, a control touching
 * its neighbour or a label touching its button edge. Warnings: cut-off text, tap targets under
 * 24px, controls closer than 8px to other content (4px to another control), labels within 6px of
 * the button edge, content within 4px of a card's edge. Info: spacing values off the 2px grid.
 *
 * Browser: uses playwright-core's Chromium. Run `npx playwright-core install chromium` once if it
 * isn't downloaded, or point CHROME_PATH at any Chrome/Chromium.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const here = dirname(fileURLToPath(import.meta.url));
const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : fallback;
};
const base = arg('url', 'http://localhost:4200').replace(/\/$/, '');
const themes = arg('themes', 'dark,light,goldBlack,lightTeal,darkOrange').split(',');
const widths = arg('widths', '1440,390').split(',').map(Number);
const only = arg('pages', '');
const jsonOut = arg('json', '');

const routesSrc = readFileSync(join(here, '../src/app/app.routes.ts'), 'utf8');
let routes = [...routesSrc.matchAll(/path: '([^'*]*)'/g)].map((m) => m[1]);
if (only) routes = routes.filter((r) => only.split(',').includes(r || 'overview'));

/** Runs inside the page: returns findings for what's on screen now. */
function collect() {
  const out = [];
  const vw = document.documentElement.clientWidth;
  const rootStyle = getComputedStyle(document.documentElement);
  const families = ['--ui-font-default', '--ui-font-mono', '--ui-font-display']
    .map((v) => rootStyle.getPropertyValue(v).split(',')[0].trim().replace(/["']/g, '').toLowerCase())
    .filter(Boolean);

  const parse = (c) => {
    const m = c.match(/rgba?\(([^)]+)\)/);
    if (!m) {
      // color(srgb r g b / a) from color-mix
      const s = c.match(/color\(srgb ([\d.e-]+) ([\d.e-]+) ([\d.e-]+)(?: \/ ([\d.e-]+))?\)/);
      if (!s) return null;
      return [s[1] * 255, s[2] * 255, s[3] * 255, s[4] === undefined ? 1 : +s[4]];
    }
    const p = m[1].split(/[ ,/]+/).filter(Boolean).map(Number);
    return [p[0], p[1], p[2], p[3] === undefined ? 1 : p[3]];
  };
  const over = (top, bottom) => {
    const a = top[3];
    return [top[0] * a + bottom[0] * (1 - a), top[1] * a + bottom[1] * (1 - a), top[2] * a + bottom[2] * (1 - a), 1];
  };
  const lum = ([r, g, b]) => {
    const f = (v) => ((v /= 255) <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  };
  const ratio = (a, b) => {
    const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
    return (x + 0.05) / (y + 0.05);
  };
  /** The solid colour behind an element, or null when an image/gradient/filter makes it unknowable. */
  const backdrop = (el) => {
    const layers = [];
    for (let n = el; n; n = n.parentElement) {
      const s = getComputedStyle(n);
      if (s.backgroundImage !== 'none' || (s.backdropFilter && s.backdropFilter !== 'none' && s.backdropFilter !== '')) return null;
      const c = parse(s.backgroundColor);
      if (c && c[3] > 0) {
        layers.push(c);
        if (c[3] >= 1) break;
      }
    }
    let bg = [255, 255, 255, 1];
    const last = layers[layers.length - 1];
    if (last && last[3] >= 1) bg = last;
    else bg = parse(getComputedStyle(document.body).backgroundColor) || bg;
    for (let i = layers.length - (last && last[3] >= 1 ? 2 : 1); i >= 0; i--) bg = over(layers[i], bg);
    return bg;
  };
  const opacity = (el) => {
    let o = 1;
    for (let n = el; n; n = n.parentElement) o *= +getComputedStyle(n).opacity;
    return o;
  };
  const visible = (el) => {
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) return false;
    const s = getComputedStyle(el);
    return s.visibility !== 'hidden' && s.display !== 'none';
  };
  const component = (el) => {
    for (let n = el; n; n = n.parentElement) {
      const t = n.tagName.toLowerCase();
      if (t.startsWith('ui-') || t.startsWith('hugeicons')) return t;
    }
    return 'page';
  };
  const describe = (el) => {
    const cls = typeof el.className === 'string' ? el.className.trim().split(/\s+/).filter((c) => !c.startsWith('ng-')).slice(0, 2).join('.') : '';
    const text = (el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 40);
    return `${el.tagName.toLowerCase()}${cls ? '.' + cls : ''}${text ? ` “${text}”` : ''}`;
  };
  const disabled = (el) => !!el.closest('[disabled], [aria-disabled="true"], .disabled, [inert]');
  const decorative = (el) => !!el.closest('[aria-hidden="true"], .ui-skeleton, ui-skeleton, canvas, svg, pre code, .doc-code, ui-device-frame');
  const add = (severity, rule, el, detail) => out.push({ severity, rule, component: component(el), element: describe(el), detail });

  const main = document.querySelector('main') || document.body;
  const all = [main, ...main.querySelectorAll('*')].filter(visible);

  for (const el of all) {
    const s = getComputedStyle(el);
    const hasText = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());

    if (hasText && !decorative(el)) {
      const size = parseFloat(s.fontSize);
      if (size < 11) add('error', 'font-size', el, `${size}px text`);
      const fam = s.fontFamily.split(',')[0].trim().replace(/["']/g, '').toLowerCase();
      // Inside a scoped theme (ui-theme-provider) the fonts are that theme's, not the page's.
      const scoped = el.closest('[data-theme]') !== document.documentElement;
      if (families.length && !scoped && !families.includes(fam) && !['monospace', 'inherit'].includes(fam) && !el.closest('code, pre, kbd, samp'))
        add('error', 'font-family', el, `uses “${fam}”, theme fonts are ${families.join(', ')}`);

      if (!disabled(el) && !el.closest('input, textarea, select')) {
        const bg = backdrop(el);
        const fg = parse(s.color);
        const o = opacity(el);
        if (bg && fg && o > 0.15) {
          const shown = over([fg[0], fg[1], fg[2], fg[3] * o], bg);
          const cr = ratio(shown, bg);
          const large = size >= 24 || (size >= 18.66 && +s.fontWeight >= 700);
          // A lone symbol (★, ×, ›) is a graphic, so WCAG 1.4.11 asks 3:1 rather than the text ratio.
          const glyph = !/[\p{L}\p{N}]/u.test(el.textContent || '');
          const need = large || glyph ? 3 : 4.5;
          if (cr < need - 0.05) add(cr < need - 1 ? 'error' : 'warn', 'contrast', el, `${cr.toFixed(2)}:1, needs ${need}:1`);
        }
      }

      // Text cut off: hidden overflow without an ellipsis.
      // (1px boxes are screen-reader-only text, hidden on purpose.)
      if ((s.overflowX === 'hidden' || s.overflow === 'hidden') && el.clientWidth > 1 && el.scrollWidth > el.clientWidth + 1 && s.textOverflow !== 'ellipsis' && el.clientWidth > 0)
        add('warn', 'clipped-text', el, `${el.scrollWidth}px of text in ${el.clientWidth}px`);
    }

    // Spacing on the 2px grid (tokens are 4/8/12/16/24…; 1px hairlines and 2px nudges are fine).
    if (s.display === 'inline') continue; // inline code/kbd use em padding that scales with the text
    const vals = ['paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft', 'rowGap', 'columnGap'].map((k) => s[k]).filter((v) => v && v !== 'normal' && v.endsWith('px'));
    const odd = vals.map(parseFloat).filter((v) => v > 2 && Math.abs(v - Math.round(v / 2) * 2) > 0.01);
    if (odd.length) add('info', 'spacing-scale', el, `odd spacing ${[...new Set(odd)].join('px, ')}px`);
  }

  // Interactive targets.
  for (const el of main.querySelectorAll('button, a[href], input:not([type=hidden]), select, textarea, [role=button], [role=tab], [role=option], [role=menuitem], [role=switch], [role=checkbox], [role=radio]')) {
    // Links inside running text are exempt from the target size (WCAG 2.5.8 inline exception).
    const inline = el.tagName === 'A' && (el.closest('p, li > a:only-child') || [...el.parentElement.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim()));
    if (!visible(el) || disabled(el) || inline) continue;
    const r = el.getBoundingClientRect();
    if (el.matches('input[type=checkbox], input[type=radio], input[type=range]')) continue; // label is the target
    if (r.width < 24 || r.height < 24) {
      // WCAG 2.5.8 allows a smaller target with 24px of clear space around its centre; we only warn.
      add('warn', 'target-size', el, `${Math.round(r.width)}×${Math.round(r.height)}px`);
    }
  }

  // Controls placed side by side in one row should be the same height.
  const controls = [...main.querySelectorAll('button, input:not([type=checkbox]):not([type=radio]):not([type=range]):not([type=color]):not([type=file]), select, [role=combobox], .ui-btn, .ui-input')]
    .filter(visible).filter((c) => !c.closest('[role=toolbar] .ui-fbf, table, ui-calendar, .ui-cal, [role=grid], [role=tablist], ui-segmented, pre'));
  const byParent = new Map();
  for (const c of controls) {
    // Group by the nearest flex/grid row container.
    let p = c.parentElement;
    while (p && p !== main) {
      const d = getComputedStyle(p).display;
      if (d.includes('flex') || d.includes('grid')) break;
      p = p.parentElement;
    }
    if (!p || p === main || getComputedStyle(p).flexDirection?.startsWith('column')) continue;
    // A bordered row no taller than a control is itself one compound field (input + reveal button).
    const ps = getComputedStyle(p);
    if (parseFloat(ps.borderTopWidth) > 0 && p.getBoundingClientRect().height <= 48) continue;
    if (!byParent.has(p)) byParent.set(p, []);
    byParent.get(p).push(c);
  }
  for (const [p, list] of byParent) {
    const tops = new Map();
    for (const c of list) {
      const r = c.getBoundingClientRect();
      const key = Math.round(r.top + r.height / 2);
      const near = [...tops.keys()].find((k) => Math.abs(k - key) <= 6);
      tops.set(near ?? key, [...(tops.get(near ?? key) || []), r.height]);
    }
    for (const hs of tops.values()) {
      const hi = Math.max(...hs), lo = Math.min(...hs);
      if (hs.length > 1 && hi - lo > 1.5 && lo >= 20 && hi <= 48) add('error', 'row-heights', p, `controls in one row are ${[...new Set(hs.map(Math.round))].join('/')}px tall`);
    }
  }

  // Spacing around controls. Leaves are what the eye sees as separate things: controls, text runs,
  // icons and media, and small painted shapes (swatches, dots, badges). Every rect is clipped to its
  // scrolling or overflow-hidden ancestors, so content scrolled out of view or cut by an ellipsis
  // doesn't count, and wrapped inline text is measured line by line.
  const CONTROL = 'button, .ui-btn, a.ui-btn, input:not([type=hidden]):not([type=checkbox]):not([type=radio]), select, textarea, [role=button], [role=switch], [role=combobox]';
  const isControl = (el) => el.matches(CONTROL);
  // A box the eye reads as a container: a fill, or a border on every side (a lone rule is a divider).
  const painted = (s) => (parse(s.backgroundColor)?.[3] ?? 0) > 0.05 || ['Top', 'Right', 'Bottom', 'Left'].every((k) => parseFloat(s[`border${k}Width`]) > 0);
  const hiddenText = (el) => !!el.closest('.sr-only, [class*="sr-only"], .cdk-visually-hidden') || getComputedStyle(el).clipPath.startsWith('inset(50%');
  const clipCache = new Map();
  /** The visible part of the viewport-space box the element is drawn in, after every clipping ancestor. */
  const clipOf = (el) => {
    if (clipCache.has(el)) return clipCache.get(el);
    let c = { left: -1e9, top: -1e9, right: 1e9, bottom: 1e9 };
    for (let n = el; n && n !== document.documentElement; n = n.parentElement) {
      const s = getComputedStyle(n);
      if (s.position === 'fixed') break;
      if (s.overflowX !== 'visible' || s.overflowY !== 'visible') {
        const r = n.getBoundingClientRect();
        c = { left: Math.max(c.left, r.left), top: Math.max(c.top, r.top), right: Math.min(c.right, r.right), bottom: Math.min(c.bottom, r.bottom) };
      }
    }
    clipCache.set(el, c);
    return c;
  };
  const clip = (r, c) => {
    const x = { left: Math.max(r.left, c.left), top: Math.max(r.top, c.top), right: Math.min(r.right, c.right), bottom: Math.min(r.bottom, c.bottom) };
    return x.right - x.left > 0.5 && x.bottom - x.top > 0.5 ? { ...x, width: x.right - x.left, height: x.bottom - x.top } : null;
  };
  const union = (rs) => rs.length ? rs.reduce((a, r) => ({ left: Math.min(a.left, r.left), top: Math.min(a.top, r.top), right: Math.max(a.right, r.right), bottom: Math.max(a.bottom, r.bottom) })) : null;
  /** Line boxes of the glyphs: an element's own text, or all of a control's text. */
  const textLines = (el, deep = false) => {
    const range = document.createRange();
    const out = [];
    for (const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT); w.nextNode(); ) {
      const n = w.currentNode;
      if ((!deep && n.parentNode !== el) || !n.textContent.trim() || hiddenText(n.parentElement)) continue;
      range.selectNodeContents(n);
      const c = clipOf(n.parentElement);
      for (const r of range.getClientRects()) { const x = r.width && clip(r, c); if (x) out.push(x); }
    }
    return out;
  };
  /** What an unboxed control looks like: its label, else its icon, else nothing measurable (a CSS-drawn dot). */
  const drawnLines = (el) => {
    const t = textLines(el, true);
    if (t.length) return t;
    const icon = el.querySelector('svg, img, hugeicons-icon');
    const r = icon && clip(icon.getBoundingClientRect(), clipOf(icon));
    return r ? [r] : [];
  };
  const leaves = [];
  for (const el of all) {
    if (decorative(el) && !el.matches('[aria-hidden="true"]')) continue;
    if (el.closest(CONTROL) && !isControl(el)) continue; // a control's insides belong to it
    const s = getComputedStyle(el);
    const control = isControl(el);
    const textLeaf = !control && [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim()) && !hiddenText(el);
    const media = el.matches('img, svg, canvas, video, hugeicons-icon');
    const box = clip(el.getBoundingClientRect(), clipOf(el.parentElement || el));
    // An unboxed control (a text or icon button) is seen as what it draws, not its padded hit area.
    const lines = control ? (painted(s) ? (box ? [box] : []) : drawnLines(el)) : textLeaf ? textLines(el) : box ? [box] : [];
    if (!lines.length) continue;
    const shape = !el.children.length && painted(s) && box && box.width <= 64 && box.height <= 64;
    if (control || textLeaf || media || shape) leaves.push({ el, lines, r: union(lines), control, text: textLeaf });
  }
  const related = (a, b) => a.contains(b) || b.contains(a);
  // Grouped controls are meant to touch: button groups, segmented rows, toolbars, input adornments,
  // and the timeline/canvas editors whose lanes, bars and handles abut by design.
  const grouped = (el) => !!el.closest('ui-button-group, ui-segmented, ui-split-button, [role=toolbar], [role=tablist], [role=radiogroup], ui-pagination, table, [role=grid], ui-calendar, .ui-cal, pre, ui-input, ui-select, ui-autocomplete, ui-chip-input, ui-number-input, ui-date-picker, ui-time-picker, ui-sequencer, ui-scrubber, ui-transform-box, ui-path-editor, ui-anchor-picker');
  /** A label or hint that belongs to this control sits close to it on purpose. */
  const ownLabel = (ctrl, t) => {
    if (t.el.closest('label') && (t.el.closest('label').contains(ctrl) || t.el.closest('label').htmlFor === ctrl.id)) return true;
    const ids = `${ctrl.getAttribute('aria-labelledby') || ''} ${ctrl.getAttribute('aria-describedby') || ''}`.split(/\s+/).filter(Boolean);
    if (ids.some((id) => document.getElementById(id)?.contains(t.el))) return true;
    const field = ctrl.closest('ui-form-field, .ui-field, .field, .fld, label');
    return !!field && field.contains(t.el);
  };
  const lineGap = (a, b) => {
    const overlapY = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
    const overlapX = Math.min(a.right, b.right) - Math.max(a.left, b.left);
    if (overlapY > 2) return { gap: Math.max(b.left - a.right, a.left - b.right), axis: 'x' };
    if (overlapX > 2) return { gap: Math.max(b.top - a.bottom, a.top - b.bottom), axis: 'y' };
    return null;
  };
  for (const a of leaves.filter((l) => l.control && !grouped(l.el) && !disabled(l.el))) {
    const pos = getComputedStyle(a.el).position;
    if (pos === 'absolute' || pos === 'fixed') continue; // overlay controls (viewer arrows, close buttons) are placed deliberately
    let worst = null;
    for (const b of leaves) {
      if (a === b || related(a.el, b.el)) continue;
      for (const ar of a.lines) for (const br of b.lines) {
        const g = lineGap(ar, br);
        if (!g || g.gap < -1) continue; // not neighbours, or stacked on purpose (badge on a button)
        // Controls may sit 4px apart (icon toolbars), as may a control and its own label or hint, a
        // separator glyph, or a caption in the same cell. Other content wants 8px beside, 6px above/below.
        const tight = b.control || ownLabel(a.el, b) || (b.text && !/[\p{L}\p{N}]/u.test(b.el.textContent)) || b.el.parentElement === a.el.parentElement;
        const need = tight ? 4 : g.axis === 'x' ? 8 : 6;
        if (g.gap < need - 0.5 && (!worst || g.gap < worst.gap)) worst = { gap: g.gap, b, need };
      }
    }
    if (worst) add(worst.gap < 2 ? 'error' : 'warn', 'crowded', a.el, `${Math.round(worst.gap)}px from ${describe(worst.b.el)} (wants ${worst.need}px)`);
  }

  // Buttons with too little room around their label.
  for (const el of main.querySelectorAll('button, .ui-btn')) {
    if (!visible(el) || el.matches('[data-variant="link"]') || el.closest('[role=tablist], [role=grid], table, ui-calendar')) continue;
    // Only a button that looks like a box (fill or border) needs inner room.
    if (!painted(getComputedStyle(el))) continue;
    const lines = textLines(el, true);
    if (!lines.length) continue;
    const u = union(lines);
    const r = el.getBoundingClientRect();
    const pad = Math.min(u.left - r.left, r.right - u.right);
    if (pad < 6) add(pad < 2 ? 'error' : 'warn', 'button-padding', el, `label is ${Math.round(pad)}px from the button edge`);
  }

  // Content flush against the edge of a card-like box (border or its own background).
  const scrolls = (n) => { const s = getComputedStyle(n); return (/(auto|scroll)/.test(s.overflowX) && n.scrollWidth > n.clientWidth + 1) || (/(auto|scroll)/.test(s.overflowY) && n.scrollHeight > n.clientHeight + 1); };
  for (const box of all) {
    const s = getComputedStyle(box);
    if (!painted(s) || isControl(box) || box.closest(CONTROL) || decorative(box)) continue;
    const r = box.getBoundingClientRect();
    if (r.height <= 40 || r.width <= 64 || box === main) continue; // pills, chips, badges, dots
    if (box.matches('table, thead, tbody, tr, td, th, ui-table, [role=grid], [role=row], [role=gridcell], ul[role=listbox], ui-divider, hr, ui-progress, ui-slider, ui-skeleton, img, video, canvas, iframe') || box.closest('table, [role=grid], ui-sequencer, ui-scrubber, ui-anchor-picker')) continue;
    const bl = parseFloat(s.borderLeftWidth), bt = parseFloat(s.borderTopWidth), br = parseFloat(s.borderRightWidth), bb = parseFloat(s.borderBottomWidth);
    const inner = { left: r.left + bl, top: r.top + bt, right: r.right - br, bottom: r.bottom - bb };
    let worst = null;
    for (const l of leaves) {
      if (!box.contains(l.el) || l.el === box) continue;
      // Leaves that sit inside a nearer painted box, or in a scroller that is cut off, are not this box's edge.
      let p = l.el.parentElement, skip = false;
      while (p && p !== box) { if ((painted(getComputedStyle(p)) && p.getBoundingClientRect().height > 40) || scrolls(p)) { skip = true; break; } p = p.parentElement; }
      if (skip || scrolls(box)) continue;
      // Full-bleed on purpose: rows, bars, tab items and media that span the box on one axis.
      if (l.r.right - l.r.left >= inner.right - inner.left - 2 || l.r.bottom - l.r.top >= inner.bottom - inner.top - 2) continue;
      const d = Math.min(l.r.left - inner.left, l.r.top - inner.top, inner.right - l.r.right, inner.bottom - l.r.bottom);
      if (d < 4 && d > -1 && (!worst || d < worst.d)) worst = { d, l };
    }
    if (worst) add('warn', 'edge-hug', box, `${describe(worst.l.el)} is ${Math.round(worst.d)}px from the box edge`);
  }

  // Text that overlaps other text, line by line.
  const texts = leaves.filter((l) => l.text);
  for (let i = 0; i < texts.length; i++) {
    for (let j = i + 1; j < texts.length; j++) {
      const a = texts[i], b = texts[j];
      if (related(a.el, b.el)) continue;
      const ux = Math.min(a.r.right, b.r.right) - Math.max(a.r.left, b.r.left), uy = Math.min(a.r.bottom, b.r.bottom) - Math.max(a.r.top, b.r.top);
      if (ux <= 3 || uy <= 3) continue;
      const hit = a.lines.some((x) => b.lines.some((y) => Math.min(x.right, y.right) - Math.max(x.left, y.left) > 3 && Math.min(x.bottom, y.bottom) - Math.max(x.top, y.top) > 3));
      if (hit) add('error', 'overlap', a.el, `overlaps ${describe(b.el)}`);
    }
  }

  // Sideways scroll of the whole page, and who causes it.
  if (document.documentElement.scrollWidth > vw + 1) {
    const culprits = all.filter((el) => el.getBoundingClientRect().right > vw + 1 && ![...el.children].some((c) => c.getBoundingClientRect().right > vw + 1)).slice(0, 3);
    for (const el of culprits.length ? culprits : [main]) add('error', 'page-overflow', el, `page is ${document.documentElement.scrollWidth}px wide in a ${vw}px window`);
  }
  return out;
}

const executablePath = process.env.CHROME_PATH || undefined;
const browser = await chromium.launch({ executablePath });
const findings = new Map();
let pages = 0;

for (const width of widths) {
  const ctx = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: 'reduce', hasTouch: width < 700 });
  const page = await ctx.newPage();
  for (const route of routes) {
    for (const theme of themes) {
      await page.goto(`${base}/${route}`, { waitUntil: 'networkidle' });
      await page.evaluate((t) => document.documentElement.setAttribute('data-theme', t), theme);
      await page.waitForTimeout(450);
      const found = await page.evaluate(collect);
      pages++;
      for (const f of found) {
        const key = `${route}|${f.rule}|${f.component}|${f.element}|${f.detail}`;
        const prev = findings.get(key);
        if (prev) prev.where.add(`${theme}@${width}`);
        else findings.set(key, { route: route || 'overview', ...f, where: new Set([`${theme}@${width}`]) });
      }
    }
  }
  await ctx.close();
}
await browser.close();

const list = [...findings.values()].map((f) => ({ ...f, where: [...f.where] }));
const order = { error: 0, warn: 1, info: 2 };
list.sort((a, b) => order[a.severity] - order[b.severity] || a.rule.localeCompare(b.rule) || a.route.localeCompare(b.route));
if (jsonOut) writeFileSync(jsonOut, JSON.stringify(list, null, 2));

const count = (sev) => list.filter((f) => f.severity === sev).length;
for (const f of list.filter((x) => x.severity !== 'info')) {
  console.log(`${f.severity.toUpperCase().padEnd(5)} ${f.rule.padEnd(14)} /${f.route}  <${f.component}> ${f.element}  ${f.detail}  [${f.where.length > 3 ? f.where.length + ' views' : f.where.join(' ')}]`);
}
console.log(`\n${pages} page views · ${count('error')} errors · ${count('warn')} warnings · ${count('info')} spacing notes${jsonOut ? ` (all in ${jsonOut})` : ''}`);
process.exit(count('error') ? 1 : 0);
