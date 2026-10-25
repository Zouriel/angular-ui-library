#!/usr/bin/env node
/*
 * The navigation view's overlays, measured in a real browser (0.47.1). Loads the showcase's Navigation demo
 * at 390px in English (LTR) and Dhivehi (RTL), plays the drive, wanders off (the Rerouting… status) and drags
 * the map (Recenter and the compass), then checks that the app's buttons (mute, SOS) and the status pill sit
 * under the banner and never overlap the banner, the compass, Recenter, the bar or each other; that the
 * button stack is at the inline end and 48px round; that the App bar (insets.top 48) pushes the banner below
 * it; that the banner's maneuver arrow (and the action icons) keep their element's colour over an app's icon
 * tint, with a contrast of at least 4.5:1 on the banner in every theme (light and dark, plain and glass); and
 * that a ui-fab with bottomOffset floats above a bottom sheet's peek and follows it when it opens.
 * 0.47.2: the Long status pill is two lines ending on a whole word with an ellipsis, clear of the compass column
 * and the buttons, moving nothing; the holding SOS fires only after 2 s (mouse and Space), a tap calls onTap,
 * sliding off cancels, the progress is read out, and under reduced motion the ring is whole and steady.
 *
 *   npm run audit:nav -- --dist <showcase build output>      (serves the build itself)
 *   npm run audit:nav -- --url http://localhost:4310
 *   --shots <dir>   (screenshots of the demo: LTR/RTL, light/dark, with the App bar)
 *
 * Exit code 1 when any check fails. Browser: playwright-core's Chromium, or CHROME_PATH.
 */
import { createServer } from 'node:http';
import { existsSync, mkdirSync, readFileSync, statSync } from 'node:fs';
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
const shots = arg('shots', '');
if (shots) mkdirSync(shots, { recursive: true });

const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok: !!ok, detail });
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? `  (${detail})` : ''}`);
};

const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined });
const W = 390;
// A 1x1 transparent PNG for every map tile: the audit measures layout, not tiles.
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64');

async function open(route, lang, hash = '') {
  const ctx = await browser.newContext({ viewport: { width: W, height: 844 }, reducedMotion: 'reduce', hasTouch: false });
  await ctx.route(/tile|\.png(\?|$)/, (r) => (r.request().resourceType() === 'image' ? r.fulfill({ body: PNG, contentType: 'image/png' }) : r.continue()));
  const page = await ctx.newPage();
  page.on('pageerror', (e) => check(`no page error on /${route} (${lang})`, false, e.message));
  await page.goto(`${base}/${route}?lang=${lang}${hash}`, { waitUntil: 'load' });
  await page.waitForTimeout(600);
  return { ctx, page };
}

const overlap = (a, b) => a && b && a.x < b.r - 0.5 && b.x < a.r - 0.5 && a.y < b.b - 0.5 && b.y < a.b - 0.5;
const fmt = (r) => (r ? `${r.x.toFixed(0)},${r.y.toFixed(0)} ${r.w.toFixed(0)}x${r.h.toFixed(0)}` : 'none');

/** Rects of the navigation demo's parts, relative to the viewport; null for parts not shown. */
const parts = (page) => page.evaluate(() => {
  const nav = document.querySelector('ui-map-navigation');
  const r = (el) => {
    if (!el) return null;
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden' || el.hidden) return null;
    const b = el.getBoundingClientRect();
    return b.width && b.height ? { x: b.x, y: b.y, w: b.width, h: b.height, r: b.right, b: b.bottom } : null;
  };
  const compass = nav.querySelector('.ui-map-compass-bar');
  return {
    nav: r(nav),
    banner: r(nav.querySelector('.ui-nav-top')),
    status: r(nav.querySelector('.ui-nav-status')),
    actions: [...nav.querySelectorAll('.ui-nav-action')].map(r),
    recenter: r(nav.querySelector('.ui-nav-recenter')),
    compass: compass && !compass.hidden ? r(compass) : null,
    bar: r(nav.querySelector('.ui-nav-bar')),
    appbar: r(document.querySelector('.nav-appbar')),
  };
});

/** The relative luminance contrast of two "rgb(...)" colours (alpha ignored: both are opaque here). */
function contrast(a, b) {
  const lum = (c) => {
    const m = c.match(/[\d.]+/g).slice(0, 3).map(Number).map((v) => v / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
    return 0.2126 * m[0] + 0.7152 * m[1] + 0.0722 * m[2];
  };
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}

/** Brings the demo into view and sets it up: playing, off the road (status), paused, map dragged (compass, Recenter). */
async function prepare(page) {
  await page.waitForSelector('ui-map-navigation .ui-nav-banner', { timeout: 20000 });
  await page.evaluate(() => document.querySelector('ui-map-navigation').scrollIntoView({ block: 'center' }));
  const demo = page.locator('doc-section[anchor="navigation"]');
  const btn = (name) => demo.getByRole('button', { name, exact: true }).first();
  await btn('Play').click();
  await page.waitForTimeout(1500);
  // Wander off: off the route for 5 s (demo time runs at the chosen speed) -> offRoute -> the status.
  await btn('Wander off').click();
  await page.waitForFunction(() => { const s = document.querySelector('ui-map-navigation .ui-nav-status'); return s && !s.hidden; }, null, { timeout: 15000 }).catch(() => null);
  await btn('Pause').click();
  // Drag the map: following stops, Recenter shows, and (turned heading-up) the compass.
  const box = await page.locator('ui-map-navigation .ui-nav-map').boundingBox();
  const cx = box.x + box.width / 2, cy = box.y + box.height * 0.55;
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  for (let i = 1; i <= 8; i++) await page.mouse.move(cx + i * 8, cy + i * 4);
  await page.mouse.up();
  await page.waitForTimeout(500);
}

function layoutChecks(tag, p, rtl) {
  check(`${tag}: two app buttons drawn`, p.actions.length === 2 && p.actions.every(Boolean), p.actions.map(fmt).join(' | '));
  check(`${tag}: the status pill shows (Rerouting…)`, !!p.status, fmt(p.status));
  check(`${tag}: Recenter shows after a drag`, !!p.recenter, fmt(p.recenter));
  check(`${tag}: the compass shows after a drag (map turned)`, !!p.compass, fmt(p.compass));
  for (const [i, a] of p.actions.entries()) {
    if (!a) continue;
    check(`${tag}: button ${i + 1} is 48px round`, Math.abs(a.w - 48) < 0.6 && Math.abs(a.h - 48) < 0.6, fmt(a));
    check(`${tag}: button ${i + 1} under the banner`, p.banner && a.y >= p.banner.b - 0.5, `${a.y.toFixed(0)} vs banner bottom ${p.banner?.b.toFixed(0)}`);
    check(`${tag}: button ${i + 1} at the inline end`, p.nav && (rtl ? a.x - p.nav.x < p.nav.w / 4 : p.nav.r - a.r < p.nav.w / 4), `x=${(a.x - p.nav.x).toFixed(0)} of ${p.nav.w.toFixed(0)}`);
    for (const k of ['banner', 'status', 'recenter', 'compass', 'bar', 'appbar']) {
      if (p[k]) check(`${tag}: button ${i + 1} clear of the ${k}`, !overlap(a, p[k]), `${fmt(a)} / ${fmt(p[k])}`);
    }
    for (const [j, b] of p.actions.entries()) if (j > i && b) check(`${tag}: buttons ${i + 1} and ${j + 1} apart`, !overlap(a, b), `${fmt(a)} / ${fmt(b)}`);
    check(`${tag}: button ${i + 1} inside the view`, p.nav && a.x >= p.nav.x && a.r <= p.nav.r && a.b <= p.nav.b, fmt(a));
  }
  if (p.status) {
    check(`${tag}: status under the banner`, p.status.y >= p.banner.b - 0.5, `${p.status.y.toFixed(0)} vs ${p.banner.b.toFixed(0)}`);
    for (const k of ['banner', 'compass', 'recenter', 'bar', 'appbar']) if (p[k]) check(`${tag}: status clear of the ${k}`, !overlap(p.status, p[k]), `${fmt(p.status)} / ${fmt(p[k])}`);
  }
  if (p.compass) check(`${tag}: compass clear of the banner`, !overlap(p.compass, p.banner), `${fmt(p.compass)} / ${fmt(p.banner)}`);
}

for (const lang of ['en', 'dv']) {
  const rtl = lang === 'dv';
  const tag = rtl ? 'RTL' : 'LTR';
  const { ctx, page } = await open('map', lang, '#navigation');
  await prepare(page);
  let p = await parts(page);
  layoutChecks(tag, p, rtl);
  if (shots) await page.locator('.nav-wrap').screenshot({ path: join(shots, `angular-nav-${lang}-${await page.evaluate(() => document.documentElement.getAttribute('data-theme') || 'default')}.png`) });

  // insets: the App bar (48px) over the top; the banner moves under it.
  const before = p.banner && { y: p.banner.y - p.nav.y };
  await page.locator('doc-section[anchor="navigation"] ui-segmented').nth(3).getByRole('radio', { name: 'On', exact: true }).click();
  await page.waitForTimeout(500);
  p = await parts(page);
  check(`${tag} app bar: drawn`, !!p.appbar, fmt(p.appbar));
  check(`${tag} app bar: the banner sits below it`, p.appbar && p.banner && p.banner.y >= p.appbar.b - 0.5, `banner y ${p.banner?.y.toFixed(0)} app bar bottom ${p.appbar?.b.toFixed(0)}`);
  const after = p.banner && p.banner.y - p.nav.y;
  check(`${tag} app bar: the banner moved down by the inset`, before && p.banner && Math.abs(after - before.y - 48) < 1.5, `${before?.y.toFixed(0)} -> ${after?.toFixed(0)} (in the view)`);
  layoutChecks(`${tag} app bar`, p, rtl);
  if (shots) await page.locator('.nav-wrap').screenshot({ path: join(shots, `angular-nav-${lang}-appbar.png`) });
  await ctx.close();
}

// ---- 0.47.2: the status pill wraps to two lines and ends on a whole word; nothing else moves ----------------------
for (const lang of ['en', 'dv']) {
  const rtl = lang === 'dv';
  const tag = `${rtl ? 'RTL' : 'LTR'} long status`;
  const { ctx, page } = await open('map', lang, '#navigation');
  await prepare(page);
  const before = await parts(page);
  await page.locator('doc-section[anchor="navigation"] ui-segmented').nth(2).getByRole('radio', { name: 'On', exact: true }).click();
  await page.waitForTimeout(500);
  const p = await parts(page);
  const t = await page.evaluate(() => {
    const pill = document.querySelector('ui-map-navigation .ui-nav-status');
    const shown = pill.querySelector('.ui-nav-status-text');
    const lh = parseFloat(getComputedStyle(shown).lineHeight);
    return { shown: shown.textContent, full: pill.querySelector('.ui-nav-sr').textContent, h: shown.getBoundingClientRect().height, lh, scroll: shown.scrollHeight, client: shown.clientHeight };
  });
  check(`${tag}: two lines`, t.h > 1.5 * t.lh && t.h <= 2 * t.lh + 1, `${t.h.toFixed(1)}px, line ${t.lh.toFixed(1)}px`);
  check(`${tag}: nothing hidden past the clamp (the words were fitted)`, t.scroll <= t.client + 1, `scroll ${t.scroll} client ${t.client}`);
  const kept = t.shown.slice(0, -1);
  check(`${tag}: ends with an ellipsis after a whole word`, t.shown.endsWith('…') && t.full.startsWith(kept) && [' ', ',', '،'].includes(t.full[kept.length]), JSON.stringify(t.shown));
  check(`${tag}: screen readers get the whole text`, t.full.length > t.shown.length, `${t.full.length} chars`);
  for (const k of ['banner', 'compass', 'recenter', 'bar']) if (p[k]) check(`${tag}: status clear of the ${k}`, !overlap(p.status, p[k]), `${fmt(p.status)} / ${fmt(p[k])}`);
  for (const [i, a] of p.actions.entries()) check(`${tag}: status clear of button ${i + 1}`, !overlap(p.status, a), `${fmt(p.status)} / ${fmt(a)}`);
  check(`${tag}: status clear of the compass column`, rtl ? p.nav.r - p.status.r >= 12 + 48 + 12 - 0.5 : p.status.x - p.nav.x >= 12 + 48 + 12 - 0.5, fmt(p.status));
  check(`${tag}: the banner didn't move`, fmt(p.banner) === fmt(before.banner), `${fmt(before.banner)} -> ${fmt(p.banner)}`);
  check(`${tag}: the buttons didn't move`, p.actions.map(fmt).join() === before.actions.map(fmt).join(), `${before.actions.map(fmt).join(' | ')} -> ${p.actions.map(fmt).join(' | ')}`);
  check(`${tag}: the pill grew`, p.status.h > before.status.h + 10, `${before.status.h.toFixed(0)} -> ${p.status.h.toFixed(0)}`);
  if (shots) await page.locator('.nav-wrap').screenshot({ path: join(shots, `angular-nav-${lang}-long-status.png`) });
  await ctx.close();
}

// ---- 0.47.2: the holding SOS: hold 2 s to fire, a tap is the app's fallback, sliding off cancels -----------------
for (const reduced of [true, false]) {
  const tag = `SOS hold${reduced ? ' (reduced motion)' : ''}`;
  const ctx = await browser.newContext({ viewport: { width: W, height: 844 }, reducedMotion: reduced ? 'reduce' : 'no-preference' });
  await ctx.route(/tile|\.png(\?|$)/, (r) => (r.request().resourceType() === 'image' ? r.fulfill({ body: PNG, contentType: 'image/png' }) : r.continue()));
  const page = await ctx.newPage();
  page.on('pageerror', (e) => check(`${tag}: no page error`, false, e.message));
  await page.goto(`${base}/map?lang=en#navigation`, { waitUntil: 'load' });
  await page.waitForSelector('ui-map-navigation .ui-nav-banner', { timeout: 20000 });
  await page.evaluate(() => document.querySelector('ui-map-navigation').scrollIntoView({ block: 'center' }));
  await page.waitForTimeout(300);
  const log = () => page.evaluate(() => [...document.querySelectorAll('.nav-log li')].map((li) => li.textContent.trim()));
  const sos = page.locator('ui-map-navigation .ui-nav-action[data-tone="danger"]');
  const st = () => sos.evaluate((b) => {
    const arc = b.querySelector('.ui-nav-hold-arc');
    const track = b.querySelector('.ui-nav-hold-track');
    return { holding: b.hasAttribute('data-holding'), still: b.hasAttribute('data-still'), arc: arc && getComputedStyle(arc).display, offset: arc && parseFloat(getComputedStyle(arc).strokeDashoffset), track: track && getComputedStyle(track).opacity, live: b.querySelector('.ui-nav-hold-live')?.textContent.trim(), hint: document.getElementById(b.getAttribute('aria-describedby') ?? '')?.textContent.trim() };
  });
  check(`${tag}: described by the hold hint`, (await st()).hint === 'Press and hold to confirm', (await st()).hint);
  await sos.scrollIntoViewIfNeeded();
  await page.waitForTimeout(300);
  const box = await sos.boundingBox();
  const cx = box.x + box.width / 2, cy = box.y + box.height / 2;
  // A tap: the app's fallback.
  await page.mouse.click(cx, cy);
  await page.waitForTimeout(200);
  check(`${tag}: a tap calls onTap, sends nothing`, (await log())[0]?.startsWith('SOS tapped') && !(await log()).some((l) => l.startsWith('SOS held')), (await log())[0]);
  // Held to the end.
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  await page.waitForTimeout(1000);
  const mid = await st();
  check(`${tag}: holding after 1 s, nothing sent yet`, mid.holding && !(await log()).some((l) => l.startsWith('SOS held')), JSON.stringify(mid));
  if (reduced) check(`${tag}: no animated arc, the whole ring steady`, mid.still && mid.arc === 'none' && mid.track === '1', JSON.stringify(mid));
  else check(`${tag}: the arc is about half way round`, !mid.still && mid.arc !== 'none' && mid.offset > 30 && mid.offset < 70, JSON.stringify(mid));
  check(`${tag}: the progress is read out`, /^Holding, (25|50)%$/.test(mid.live ?? ''), mid.live);
  await page.waitForTimeout(1150);
  check(`${tag}: sent when held to the end`, (await log())[0] === 'SOS held: sent', (await log())[0]);
  await page.mouse.up();
  await page.waitForTimeout(500);
  check(`${tag}: the release after it is no tap`, (await log())[0] === 'SOS held: sent', (await log())[0]);
  // Slid off: cancelled.
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  await page.waitForTimeout(600);
  await page.mouse.move(cx - 80, cy, { steps: 4 });
  await page.waitForTimeout(100);
  const off = await st();
  check(`${tag}: sliding off cancels`, !off.holding && off.live === 'Hold cancelled', JSON.stringify(off));
  await page.waitForTimeout(2000);
  await page.mouse.up();
  await page.waitForTimeout(300);
  check(`${tag}: nothing sent after sliding off`, (await log()).filter((l) => l === 'SOS held: sent').length === 1, (await log()).join(' | '));
  // Keyboard: Space held.
  await sos.focus();
  await page.keyboard.down(' ');
  await page.waitForTimeout(2150);
  await page.keyboard.up(' ');
  await page.waitForTimeout(200);
  check(`${tag}: Space held to the end sends`, (await log()).filter((l) => l === 'SOS held: sent').length === 2, (await log()).join(' | '));
  if (shots && !reduced) {
    await page.mouse.move(cx, cy);
    await page.mouse.down();
    await page.waitForTimeout(1000);
    await page.locator('.nav-wrap').screenshot({ path: join(shots, 'angular-nav-sos-half-held.png') });
    await page.mouse.up();
  }
  await ctx.close();
}

// ---- Colour: the banner arrow over an app's icon tint, every theme, plain and glass --------------------------
{
  const { ctx, page } = await open('map', 'en', '#navigation');
  await page.waitForSelector('ui-map-navigation .ui-nav-banner', { timeout: 20000 });
  await page.evaluate(() => document.querySelector('ui-map-navigation').scrollIntoView({ block: 'center' }));
  // A theme-like tint and an app's own icon rules, the way an app makes icons Lagoon.
  await page.addStyleTag({ content: ':root, [data-theme] { --ui-color-icon: rgb(159, 216, 224) !important; } hugeicons-icon { color: rgb(159, 216, 224); } body hugeicons-icon { color: rgb(159, 216, 224); }' });
  const themes = await page.evaluate(() => [...new Set([...document.styleSheets].flatMap((s) => { try { return [...s.cssRules]; } catch { return []; } })
    .flatMap((r) => (r.selectorText ?? '').match(/\[data-theme="([\w-]+)"\]/g) ?? []).map((m) => m.slice(13, -2)))]);
  check('themes found', themes.length >= 10, themes.join(' '));
  const measure = () => page.evaluate(() => {
    const nav = document.querySelector('ui-map-navigation');
    const icon = nav.querySelector('.ui-nav-maneuver svg');
    const glass = nav.hasAttribute('data-glass');
    const bg = getComputedStyle(glass ? nav.querySelector('.ui-nav-maneuver') : nav.querySelector('.ui-nav-banner')).backgroundColor;
    const action = (sel) => { const b = nav.querySelector(sel); return b ? [getComputedStyle(b.querySelector('svg')).color, getComputedStyle(b).backgroundColor] : null; };
    return { icon: getComputedStyle(icon).color, bg, scheme: getComputedStyle(document.documentElement).colorScheme, mute: action('.ui-nav-action:not([data-tone="danger"])'), sos: action('.ui-nav-action[data-tone="danger"]') };
  });
  for (const glass of [false, true]) {
    if (glass) {
      await page.locator('doc-section[anchor="navigation"] ui-segmented').nth(1).getByRole('radio', { name: 'On', exact: true }).click();
      await page.waitForTimeout(300);
    }
    for (const theme of themes) {
      await page.evaluate((t) => document.documentElement.setAttribute('data-theme', t), theme);
      await page.waitForTimeout(60);
      const m = await measure();
      const c = contrast(m.icon, m.bg);
      check(`banner arrow ${glass ? 'glass' : 'plain'} ${theme}: contrast ${c.toFixed(2)} >= 4.5`, c >= 4.5 && m.icon !== 'rgb(159, 216, 224)', `${m.icon} on ${m.bg}`);
      if (!glass && m.mute && m.sos) {
        const cm = contrast(...m.mute), cs = contrast(...m.sos);
        check(`action icons ${theme}: mute ${cm.toFixed(2)}, SOS ${cs.toFixed(2)} >= 3 (graphics)`, cm >= 3 && cs >= 3 && m.mute[0] !== 'rgb(159, 216, 224)', `${m.mute.join(' on ')} | ${m.sos.join(' on ')}`);
      }
      if (shots && !glass && (theme === 'maldives' || theme === 'maldives-dark')) await page.locator('.nav-wrap').screenshot({ path: join(shots, `angular-nav-tinted-${theme}.png`) });
    }
  }
  await ctx.close();
}

// ---- ui-fab bottomOffset: above a sheet's peek, following it ----------------------------------------------------
{
  const { ctx, page } = await open('buttons', 'en');
  const frame = page.locator('.fab-sheet-frame');
  await frame.scrollIntoViewIfNeeded();
  const m = () => page.evaluate(() => {
    const f = document.querySelector('.fab-sheet-frame');
    const fab = f.querySelector('button.ui-fab').getBoundingClientRect();
    const sheet = f.querySelector('.fab-sheet').getBoundingClientRect();
    return { fabBottom: fab.bottom, sheetTop: sheet.top, gap: sheet.top - fab.bottom };
  });
  const peek = await m();
  check('fab bottomOffset: above the sheet\'s peek, 24px clear', Math.abs(peek.gap - 24) < 1.5, `gap ${peek.gap.toFixed(1)}`);
  await page.getByRole('radiogroup', { name: 'Sheet (demo)' }).getByRole('radio', { name: 'Open', exact: true }).click();
  await page.waitForTimeout(600);
  const opened = await m();
  check('fab bottomOffset: follows the sheet when it opens', Math.abs(opened.gap - 24) < 1.5 && opened.fabBottom < peek.fabBottom - 50, `gap ${opened.gap.toFixed(1)}, moved ${(peek.fabBottom - opened.fabBottom).toFixed(0)}px`);
  if (shots) await frame.screenshot({ path: join(shots, 'angular-fab-bottom-offset.png') });
  await ctx.close();
}

await browser.close();
server?.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
process.exit(failed.length ? 1 : 0);
