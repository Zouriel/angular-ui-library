#!/usr/bin/env node
/*
 * Right to left and Dhivehi, measured in a real browser (0.46.0). Loads the showcase at 390px, in English
 * (LTR) and with the RTL · ދިވެހި switch on (?lang=dv), and measures where things end up: a start drawer
 * at the inline start and sliding in from there, toasts at the bottom-end, the chat bubble's own messages at
 * the inline end, the switch's thumb, the alert's accent border, the select's chevron, the date picker's
 * arrows and Dhivehi names, the map's zoom buttons, locate button and credits (also after flipping the
 * direction at runtime, without a reload), a live switch of the built-in words, and that Thaana in
 * buttons, inputs, tabs, chips, toasts and dialogs draws in the app font (a test font named Faruma).
 * 0.46.1: an empty dir=auto field follows the page (placeholder at the start), and Thaana's marks stay inside
 * badge and chip pills (ink measured from a 4x screenshot; pass --font with Faruma for the real face).
 *
 *   npm run audit:rtl -- --dist <showcase build output>      (serves the build itself)
 *   npm run audit:rtl -- --url http://localhost:4310
 *   --font <path to a .ttf with Thaana>   (default: none; the font check then uses a stand-in face)
 *
 * Exit code 1 when any check fails. Browser: playwright-core's Chromium, or CHROME_PATH.
 */
import { createServer } from 'node:http';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';
import { chromium } from 'playwright-core';

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : fallback;
};

let server;
let base = arg('url', 'http://localhost:4310').replace(/\/$/, '');
const dist = arg('dist', '');
if (dist) {
  const root = existsSync(join(dist, 'browser')) ? join(dist, 'browser') : dist;
  const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2', '.json': 'application/json', '.ico': 'image/x-icon', '.mjs': 'text/javascript' };
  server = createServer((req, res) => {
    const p = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)).replace(/^(\.\.[/\\])+/, '');
    let file = join(root, p);
    if (!existsSync(file) || statSync(file).isDirectory()) file = join(root, 'index.html');
    res.writeHead(200, { 'content-type': types[extname(file)] || 'application/octet-stream' });
    res.end(readFileSync(file));
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${server.address().port}`;
}
const fontPath = arg('font', '');

const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok: !!ok, detail });
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? `  (${detail})` : ''}`);
};

const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined });
const W = 390;

async function open(route, lang, opts = {}) {
  const ctx = await browser.newContext({ viewport: { width: W, height: 844 }, reducedMotion: opts.motion ? 'no-preference' : 'reduce', hasTouch: true });
  if (fontPath) {
    const font = readFileSync(fontPath);
    await ctx.route('**/__audit-font.ttf', (r) => r.fulfill({ body: font, contentType: 'font/ttf' }));
  }
  const page = await ctx.newPage();
  page.on('pageerror', (e) => check(`no page error on /${route} (${lang})`, false, e.message));
  await page.goto(`${base}/${route}?lang=${lang}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(400);
  return { ctx, page };
}

const rect = (page, sel) => page.evaluate((s) => {
  const el = document.querySelector(s);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return { x: r.x, y: r.y, w: r.width, h: r.height, r: r.right, b: r.bottom };
}, sel);

for (const lang of ['en', 'dv']) {
  const rtl = lang === 'dv';
  const tag = rtl ? 'RTL' : 'LTR';

  // ---- The page itself ---------------------------------------------------------------------------
  {
    const { ctx, page } = await open('overlays', lang, { motion: true });
    const dir = await page.evaluate(() => [document.documentElement.dir, document.documentElement.lang]);
    check(`${tag}: <html dir lang> set by the switch`, rtl ? dir[0] === 'rtl' && dir[1] === 'dv' : dir[0] === 'ltr', dir.join(' '));

    // Start drawer (the Chats demo): where it ends up, and which way it came from.
    const btn = page.getByRole('button', { name: /chats/i }).first();
    if (await btn.count()) {
      await btn.scrollIntoViewIfNeeded();
      await btn.click();
      await page.waitForTimeout(40);
      const early = await rect(page, '.ui-layer .panel[data-side="start"]');
      await page.waitForTimeout(700);
      const done = await rect(page, '.ui-layer .panel[data-side="start"]');
      check(`${tag}: start drawer sits at the inline start`, done && (rtl ? Math.abs(done.r - W) < 1 : Math.abs(done.x) < 1), done && `x=${done.x.toFixed(0)} r=${done.r.toFixed(0)}`);
      check(`${tag}: start drawer slides in from the inline start`, early && done && (rtl ? early.x > done.x + 1 : early.x < done.x - 1), early && `early x=${early.x.toFixed(0)} final x=${done?.x.toFixed(0)}`);
      const radius = await page.evaluate(() => { const p = document.querySelector('.ui-layer .panel[data-side="start"]'); const c = getComputedStyle(p); return [c.borderTopLeftRadius, c.borderTopRightRadius]; });
      check(`${tag}: start drawer rounds its inner corners`, rtl ? radius[0] !== '0px' && radius[1] === '0px' : radius[0] === '0px' && radius[1] !== '0px', radius.join(' / '));
      await page.keyboard.press('Escape');
      await page.waitForTimeout(500);
    } else check(`${tag}: Chats drawer demo found`, false);

    // Toast: the shell's host is bottom-end.
    const success = page.getByRole('button', { name: /^success$/i }).first();
    await success.scrollIntoViewIfNeeded();
    await success.click();
    await page.waitForTimeout(600);
    const toast = await rect(page, 'ui-toast-host .toast');
    check(`${tag}: toast at the bottom-end`, toast && (rtl ? toast.x < W / 4 : toast.r > (W * 3) / 4), toast && `x=${toast.x.toFixed(0)} r=${toast.r.toFixed(0)}`);
    const accent = await page.evaluate(() => { const c = getComputedStyle(document.querySelector('ui-toast-host .toast')); return [c.borderLeftWidth, c.borderRightWidth]; });
    check(`${tag}: toast accent border on the inline start`, rtl ? accent[1] === '3px' && accent[0] === '1px' : accent[0] === '3px', accent.join(' / '));
    if (rtl) {
      const dismiss = await page.evaluate(() => document.querySelector('ui-toast-host .toast .x')?.getAttribute('aria-label'));
      check(`${tag}: toast dismiss named in Dhivehi`, dismiss === 'ފޮރުވާލާ', dismiss);
    }
    await ctx.close();
  }

  // ---- Chat bubble, alert ------------------------------------------------------------------------
  {
    const { ctx, page } = await open('data', lang);
    const m = await page.evaluate(() => {
      const b = document.querySelector('ui-chat-bubble.mine .bubble');
      const host = b?.closest('ui-chat-bubble');
      if (!b || !host) return null;
      const r = b.getBoundingClientRect(), h = host.getBoundingClientRect(), c = getComputedStyle(b);
      return { left: r.left - h.left, right: h.right - r.right, bl: c.borderBottomLeftRadius, br: c.borderBottomRightRadius };
    });
    check(`${tag}: chat bubble (mine) at the inline end`, m && (rtl ? m.left < 1 && m.right > 1 : m.right < 1 && m.left > 1), m && `left gap ${m.left.toFixed(0)} right gap ${m.right.toFixed(0)}`);
    check(`${tag}: chat bubble tail (tucked corner) at the inline end`, m && (rtl ? parseFloat(m.bl) < parseFloat(m.br) : parseFloat(m.br) < parseFloat(m.bl)), m && `${m.bl} / ${m.br}`);
    // 0.46.3 mineSide="right" (the second demo, which starts on Right): yours on the physical right and theirs on
    // the left whatever the page direction, tails on the outer bottom corners, meta right-aligned, and each text
    // in its own direction (Thaana rtl, Latin ltr). The demo has its own LTR/RTL switch; it follows the page here.
    const sides = await page.evaluate((dir) => {
      const box = document.querySelector('.chat-side');
      if (!box) return null;
      box.setAttribute('dir', dir);
      return [...box.querySelectorAll('ui-chat-bubble')].map((host) => {
        const b = host.querySelector('.bubble'), t = host.querySelector('.text'), meta = host.querySelector('.meta');
        const r = b.getBoundingClientRect(), h = host.getBoundingClientRect(), c = getComputedStyle(b);
        const mr = meta.getBoundingClientRect(), mt = document.createRange();
        mt.selectNodeContents(meta);
        const ink = mt.getBoundingClientRect();
        return { mine: host.classList.contains('mine'), text: t.textContent.trim(), left: r.left - h.left, right: h.right - r.right,
          bl: parseFloat(c.borderBottomLeftRadius), br: parseFloat(c.borderBottomRightRadius), textDir: getComputedStyle(t).direction,
          metaGap: mr.right - ink.right };
      });
    }, rtl ? 'rtl' : 'ltr');
    check(`${tag}: mineSide right demo found`, sides && sides.length >= 4 && sides.some((s) => s.mine) && sides.some((s) => !s.mine));
    for (const s of sides ?? []) {
      const who = `${s.mine ? 'mine' : 'theirs'} "${s.text.slice(0, 12)}"`;
      check(`${tag}: right mode, ${who} on the ${s.mine ? 'right' : 'left'}`, s.mine ? s.right < 1 && s.left > 1 : s.left < 1 && s.right > 1, `left gap ${s.left.toFixed(0)} right gap ${s.right.toFixed(0)}`);
      check(`${tag}: right mode, ${who} tucked corner at the bottom ${s.mine ? 'right' : 'left'}`, s.mine ? s.br < s.bl : s.bl < s.br, `${s.bl} / ${s.br}`);
      const thaana = /[\u0780-\u07BF]/.test(s.text);
      check(`${tag}: right mode, ${who} text in its own direction`, s.textDir === (thaana ? 'rtl' : 'ltr'), s.textDir);
      check(`${tag}: right mode, ${who} meta at the bubble's right`, s.metaGap < 1, `gap ${s.metaGap.toFixed(1)}`);
    }
    await ctx.close();
  }
  {
    const { ctx, page } = await open('feedback', lang);
    const a = await page.evaluate(() => { const el = document.querySelector('ui-alert .ui-alert'); if (!el) return null; const c = getComputedStyle(el); return [c.borderLeftWidth, c.borderRightWidth]; });
    check(`${tag}: alert accent border on the inline start`, a && (rtl ? a[1] === '3px' : a[0] === '3px'), a?.join(' / '));
    await ctx.close();
  }

  // ---- Form controls -----------------------------------------------------------------------------
  {
    const { ctx, page } = await open('forms', lang);
    const sw = await page.evaluate(() => {
      for (const host of document.querySelectorAll('ui-switch')) {
        const input = host.querySelector('input');
        if (!input?.checked) continue;
        const t = host.querySelector('.track').getBoundingClientRect(), th = host.querySelector('.thumb').getBoundingClientRect();
        return { thumb: th.left + th.width / 2 - t.left, track: t.width };
      }
      return null;
    });
    check(`${tag}: a switch that is on has its thumb at the inline end`, sw && (rtl ? sw.thumb < sw.track / 2 : sw.thumb > sw.track / 2), sw && `thumb centre ${sw.thumb.toFixed(1)} of ${sw.track.toFixed(1)}`);
    const sel = await page.evaluate(() => {
      const w = document.querySelector('ui-select .wrap');
      const c = w?.querySelector('.chevron');
      if (!w || !c) return null;
      const a = w.getBoundingClientRect(), b = c.getBoundingClientRect();
      return { start: b.left - a.left, end: a.right - b.right };
    });
    check(`${tag}: select chevron at the inline end`, sel && (rtl ? sel.start < sel.end : sel.end < sel.start), sel && `from left ${sel.start.toFixed(0)}, from right ${sel.end.toFixed(0)}`);
    const otp = await page.evaluate(() => { const c = [...document.querySelectorAll('ui-otp-input .cell')]; return c.length > 1 ? c[0].getBoundingClientRect().left < c[1].getBoundingClientRect().left : null; });
    check(`${tag}: OTP boxes run left to right`, otp === true);
    // 0.46.1: an empty dir="auto" field follows the page, so its placeholder sits at the start; once it has
    // text it follows the text. (Chromium resolves an empty dir="auto" control to LTR.)
    const auto = page.locator('.slot-demos ui-textarea textarea').first();
    if (await auto.count()) {
      const d0 = await auto.evaluate((el) => getComputedStyle(el).direction);
      check(`${tag}: empty dir=auto field follows the page (placeholder at the start)`, d0 === (rtl ? 'rtl' : 'ltr'), d0);
      await auto.fill('hello');
      await page.waitForTimeout(150);
      const d1 = await auto.evaluate((el) => getComputedStyle(el).direction);
      await auto.fill('ދިވެހި');
      await page.waitForTimeout(150);
      const d2 = await auto.evaluate((el) => getComputedStyle(el).direction);
      check(`${tag}: dir=auto field follows the text once typed in`, d1 === 'ltr' && d2 === 'rtl', `${d1} / ${d2}`);
      await auto.fill('');
      await page.waitForTimeout(150);
      const d3 = await auto.evaluate((el) => getComputedStyle(el).direction);
      check(`${tag}: cleared dir=auto field follows the page again`, d3 === (rtl ? 'rtl' : 'ltr'), d3);
    } else check(`${tag}: dir=auto textarea demo found`, false);
    const ph = await page.evaluate(() => document.querySelector('ui-search-input input')?.getAttribute('placeholder'));
    if (rtl) check(`${tag}: default search placeholder in Dhivehi`, ph === 'ހޯދާ…' || (ph && !/^Search/.test(ph)), ph);

    // Date picker: open it, read the arrows, the weekday header and its first column.
    const field = page.locator('ui-date-picker input').first();
    if (await field.count()) {
      await field.scrollIntoViewIfNeeded();
      await field.click();
      await page.waitForTimeout(400);
      const dp = await page.evaluate(() => {
        const panel = document.querySelector('.cal-panel');
        if (!panel) return null;
        const navs = [...panel.querySelectorAll('.nav')];
        const icon = navs[0]?.querySelector('hugeicons-icon');
        const prev = navs[0].getBoundingClientRect(), next = navs[1].getBoundingClientRect();
        return { transform: icon ? getComputedStyle(icon).transform : '', prevLeft: prev.left, nextLeft: next.left, wd: panel.querySelector('.wd')?.textContent?.trim(), prevLabel: navs[0].getAttribute('aria-label') };
      });
      check(`${tag}: date picker: previous arrow at the inline start`, dp && (rtl ? dp.prevLeft > dp.nextLeft : dp.prevLeft < dp.nextLeft), dp && `${dp.prevLeft.toFixed(0)} vs ${dp.nextLeft.toFixed(0)}`);
      check(`${tag}: date picker: arrows mirrored`, dp && (rtl ? dp.transform.startsWith('matrix(-1') : !dp.transform.startsWith('matrix(-1')), dp?.transform);
      check(`${tag}: date picker: weekday names`, dp && (rtl ? dp.wd === 'އާދި' : dp.wd === 'Sun'), dp?.wd);
      if (rtl) check(`${tag}: date picker: arrow names in Dhivehi`, dp?.prevLabel === 'ކުރީ މަސް', dp?.prevLabel);
      await page.keyboard.press('Escape');
    } else check(`${tag}: date picker demo found`, false);
    await ctx.close();
  }

  // ---- Map ---------------------------------------------------------------------------------------
  {
    const { ctx, page } = await open('map', lang);
    await page.waitForSelector('.ui-map .leaflet-control-zoom', { timeout: 15000 }).catch(() => null);
    const map = async () => page.evaluate(() => {
      const m = document.querySelector('ui-map');
      const z = m?.querySelector('.leaflet-control-zoom'), at = m?.querySelector('.leaflet-control-attribution');
      if (!m || !z || !at) return null;
      const r = m.getBoundingClientRect(), zr = z.getBoundingClientRect(), ar = at.getBoundingClientRect();
      const mid = r.left + r.width / 2;
      // The credits can be wider than half a phone map: which edge they touch says where they sit.
      return { zoomRight: zr.left > mid, creditsRight: r.right - ar.right < ar.left - r.left, zoomTitle: m.querySelector('.leaflet-control-zoom-in')?.getAttribute('title') };
    });
    const m1 = await map();
    check(`${tag}: map zoom buttons at the inline start`, m1 && (rtl ? m1.zoomRight : !m1.zoomRight));
    check(`${tag}: map credits at the inline end`, m1 && (rtl ? !m1.creditsRight : m1.creditsRight));
    if (rtl) check(`${tag}: map zoom button named in Dhivehi`, m1?.zoomTitle === 'ބޮޑުކުރޭ', m1?.zoomTitle);
    // Flip the language at runtime with the top-bar switch: the controls move without a reload.
    await page.locator('.lang-toggle button, .lang-toggle').first().click();
    await page.waitForTimeout(500);
    const m2 = await map();
    check(`${tag}→${rtl ? 'LTR' : 'RTL'} at runtime: zoom buttons move`, m1 && m2 && m2.zoomRight !== m1.zoomRight);
    check(`${tag}→${rtl ? 'LTR' : 'RTL'} at runtime: credits move`, m1 && m2 && m2.creditsRight !== m1.creditsRight);
    check(`${tag}→${rtl ? 'LTR' : 'RTL'} at runtime: zoom name switches language`, m1 && m2 && m2.zoomTitle !== m1.zoomTitle, `${m1?.zoomTitle} → ${m2?.zoomTitle}`);
    await ctx.close();
  }

  // ---- Swipe screens: the back strip -------------------------------------------------------------
  {
    const { ctx, page } = await open('layout', lang);
    const strip = await page.evaluate(() => {
      const s = document.querySelector('.ui-swipe-edge');
      const screen = s?.closest('ui-swipe-screen');
      if (!s || !screen) return null;
      const a = s.getBoundingClientRect(), b = screen.getBoundingClientRect();
      return { start: a.left - b.left, end: b.right - a.right };
    });
    if (strip) check(`${tag}: swipe-back strip on the leading edge`, rtl ? strip.end < 1 : strip.start < 1, `from left ${strip.start.toFixed(0)}, from right ${strip.end.toFixed(0)}`);
    else console.log(`note ${tag}: no back-swipe strip in view on /layout (checked in unit tests)`);
    await ctx.close();
  }
}

// ---- Thaana marks stay inside pills (0.46.1) ------------------------------------------------------
// Renders the /data Thaana row (lang="dv") with the app font (--font, e.g. Faruma, as an app loads it:
// Thaana range only, 110% size), paints the text black on white, and finds the ink's top and bottom
// rows in a 4x screenshot: each must stay at least 1px inside the pill's border. Latin badges must
// keep their height in RTL (within 2px of LTR).
if (!fontPath) console.log('note: Thaana pill check uses a local Thaana face; pass --font <Faruma.ttf> for the real one');
{
  const heights = {};
  for (const lang of ['en', 'dv']) {
    const ctx = await browser.newContext({ viewport: { width: W, height: 844 }, deviceScaleFactor: 4, reducedMotion: 'reduce' });
    if (fontPath) {
      const font = readFileSync(fontPath);
      await ctx.route('**/__audit-font.ttf', (r) => r.fulfill({ body: font, contentType: 'font/ttf' }));
    }
    const page = await ctx.newPage();
    await page.goto(`${base}/data?lang=${lang}`, { waitUntil: 'networkidle' });
    await page.addStyleTag({ content: `@font-face { font-family: 'AuditPill'; src: ${fontPath ? "url('/__audit-font.ttf')" : 'local("Noto Sans Thaana"), local("MV Faruma"), local("Faruma")'}; unicode-range: U+0780-07BF; size-adjust: 110%; }
      .thaana-pills { background: #fff !important; padding-block: 12px !important; }
      .thaana-pills .ui-badge, .thaana-pills .ui-chip { color: #000 !important; background: #fff !important; border-color: #f00 !important; }` });
    await page.evaluate(() => {
      const root = document.documentElement;
      root.style.setProperty('--ui-font-default', `'AuditPill', ${getComputedStyle(root).getPropertyValue('--ui-font-default')}`);
    });
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(300);
    heights[lang] = await page.evaluate(() => [...document.querySelectorAll('ui-badge .ui-badge:not(.dot)')].filter((b) => !b.closest('.thaana-pills')).slice(0, 3).map((b) => b.getBoundingClientRect().height));
    const pills = page.locator('.thaana-pills :is(.ui-badge, .ui-chip)');
    const n = await pills.count();
    if (!n) { check(`${lang}: Thaana pill demo found on /data`, false); await ctx.close(); continue; }
    for (let i = 0; i < n; i++) {
      const pill = pills.nth(i);
      await pill.scrollIntoViewIfNeeded();
      const box = await pill.boundingBox();
      const pad = 8;
      const buf = await page.screenshot({ clip: { x: box.x, y: box.y - pad, width: box.width, height: box.height + 2 * pad } });
      const [top, bot] = await page.evaluate(async (b64) => {
        const img = new Image();
        img.src = 'data:image/png;base64,' + b64;
        await img.decode();
        const c = document.createElement('canvas');
        c.width = img.width; c.height = img.height;
        const g = c.getContext('2d');
        g.drawImage(img, 0, 0);
        const d = g.getImageData(0, 0, c.width, c.height).data;
        let t = Infinity, b = -Infinity;
        for (let y = 0; y < c.height; y++) for (let x = 0; x < c.width; x++) {
          const k = (y * c.width + x) * 4;
          if (d[k] < 110 && d[k + 1] < 110 && d[k + 2] < 110) { t = Math.min(t, y); b = Math.max(b, y); }
        }
        return [t, b];
      }, buf.toString('base64'));
      const kind = await pill.evaluate((el) => el.className.includes('ui-chip') ? 'chip' : 'badge');
      const gapTop = top / 4 - pad - 1, gapBottom = box.height - 1 - ((bot + 1) / 4 - pad);
      check(`${lang}: Thaana ${kind} ${i + 1}: marks inside the pill`, Number.isFinite(top) && gapTop >= 1 && gapBottom >= 1, `h=${box.height.toFixed(1)} gap top ${gapTop.toFixed(2)} bottom ${gapBottom.toFixed(2)}`);
    }
    await ctx.close();
  }
  const d = heights.en.map((h, i) => Math.abs(h - (heights.dv[i] ?? h)));
  check('Latin badges keep their height in RTL (within 2px)', heights.en.length && d.every((x) => x <= 2), `LTR ${heights.en.join(',')} RTL ${heights.dv.join(',')}`);
}

// ---- Thaana draws in the app font ----------------------------------------------------------------
{
  const { ctx, page } = await open('overlays', 'dv');
  await page.addStyleTag({ content: `@font-face { font-family: 'AuditThaana'; src: ${fontPath ? "url('/__audit-font.ttf')" : 'local("Noto Sans Thaana"), local("MV Faruma"), local("Faruma")'}; }
    :root { --ui-font-default: 'AuditThaana', system-ui, sans-serif !important; --ui-font-display: 'AuditThaana', system-ui, sans-serif !important; }` });
  await page.evaluate(() => { document.documentElement.style.setProperty('--ui-font-default', "'AuditThaana', system-ui, sans-serif"); });
  const success = page.getByRole('button', { name: /^success$/i }).first();
  await success.scrollIntoViewIfNeeded();
  await success.click();
  await page.waitForTimeout(500);
  const fonts = await page.evaluate(() => {
    const pick = (sel) => { const el = document.querySelector(sel); return el ? getComputedStyle(el).fontFamily : null; };
    return {
      button: pick('ui-button button'), input: pick('ui-input input, input.ui-input'), tab: pick('ui-tabs .tab'), chip: pick('ui-chip .ui-chip, ui-chip span'),
      toastTitle: pick('ui-toast-host .toast .msg'), toastAction: pick('ui-toast-host .toast .x'),
    };
  });
  for (const [k, v] of Object.entries(fonts)) {
    if (v === null) { console.log(`note: no ${k} on this page`); continue; }
    check(`Thaana font: ${k} draws with --ui-font-default`, v.includes('AuditThaana'), v);
  }
  await ctx.close();
}
{
  const { ctx, page } = await open('forms', 'dv');
  await page.evaluate(() => { document.documentElement.style.setProperty('--ui-font-default', "'AuditThaana', system-ui, sans-serif"); });
  const fonts = await page.evaluate(() => {
    const out = {};
    for (const [k, sel] of Object.entries({ input: 'ui-input input', textarea: 'ui-textarea textarea', select: 'ui-select select', search: 'ui-search-input input', date: 'ui-date-picker input', password: 'ui-password-input input', checkbox: 'ui-checkbox', switch: 'ui-switch', radio: 'ui-radio-group' })) {
      const el = document.querySelector(sel);
      out[k] = el ? getComputedStyle(el).fontFamily : null;
    }
    return out;
  });
  for (const [k, v] of Object.entries(fonts)) {
    if (v === null) { console.log(`note: no ${k} on /forms`); continue; }
    check(`Thaana font: ${k} draws with --ui-font-default`, v.includes('AuditThaana'), v);
  }
  await ctx.close();
}
for (const route of ['data', 'buttons', 'feedback', 'navigation']) {
  const { ctx, page } = await open(route, 'dv');
  await page.evaluate(() => { document.documentElement.style.setProperty('--ui-font-default', "'AuditThaana', system-ui, sans-serif"); });
  const f = await page.evaluate(() => { const c = document.querySelector('ui-chip .ui-chip'); return c ? getComputedStyle(c).fontFamily : null; });
  await ctx.close();
  if (f !== null) { check(`Thaana font: chip (/${route}) draws with --ui-font-default`, f.includes('AuditThaana'), f); break; }
}
{
  const { ctx, page } = await open('overlays', 'dv');
  await page.evaluate(() => { document.documentElement.style.setProperty('--ui-font-default', "'AuditThaana', system-ui, sans-serif"); });
  const b = page.getByRole('button', { name: /^open modal$|^modal$|open dialog/i }).first();
  if (await b.count()) {
    await b.scrollIntoViewIfNeeded();
    await b.click();
    await page.waitForTimeout(500);
    const f = await page.evaluate(() => { const d = document.querySelector('[role="dialog"]'); return d ? getComputedStyle(d).fontFamily : null; });
    check('Thaana font: dialog draws with --ui-font-default', f && f.includes('AuditThaana'), f);
  } else console.log('note: no modal button found on /overlays');
  await ctx.close();
}
{
  const { ctx, page } = await open('navigation', 'dv');
  await page.evaluate(() => { document.documentElement.style.setProperty('--ui-font-default', "'AuditThaana', system-ui, sans-serif"); });
  const f = await page.evaluate(() => { const t = document.querySelector('ui-tabs .tab'); return t ? getComputedStyle(t).fontFamily : null; });
  if (f !== null) check('Thaana font: tabs draw with --ui-font-default', f.includes('AuditThaana'), f);
  const keys = await page.evaluate(() => {
    const tabs = [...document.querySelectorAll('ui-tabs')[0]?.querySelectorAll('.tab') ?? []];
    if (tabs.length < 2) return null;
    const r0 = tabs[0].getBoundingClientRect(), r1 = tabs[1].getBoundingClientRect();
    return { firstOnRight: r0.left > r1.left };
  });
  if (keys) check('RTL: tabs read right to left', keys.firstOnRight);
  await ctx.close();
}

await browser.close();
server?.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
process.exit(failed.length ? 1 : 0);
