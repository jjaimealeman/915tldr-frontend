#!/usr/bin/env node
// 07-05 (SOC-01..05, SOC-07, SOC-08; D-14, D-17, D-20, D-22): proves what a HOST actually serves
// for link previews. A tag in the HTML is not a working preview. This tool GETs the real pages,
// the real og:image URLs and the real icon files, and checks status, content type, size, PNG
// dimensions and the full share tag set. It proves what the host serves; 07-09's human pass
// proves what the platforms show.
//
// Expected values come from `src/lib/share-meta.ts` (SHARE_IMAGE_*, OG_LOCALE, ICON_LINKS), so
// copy changes applied there flow into this checker without edits here.
//
// Modes:
//   node tools/verify-share-meta.mjs [--host dev.915tldr.com] [--noindex-path /es/source/ktsm]
//        [--expect-stylesheet /_astro/x.css] [--json]
//   node tools/verify-share-meta.mjs --html <file> --lang en|es --kind page|article
//        [--site-origin https://915tldr.com]        (single file, checkSharePage only)
//
// Output is one `PASS|FAIL|SKIP <check> — <detail>` line per check; exit 1 on any FAIL. A network
// error is a FAIL, never a skip. Not wired into any unit suite: the live mode depends on a real
// deployment.
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import {
  ICON_LINKS,
  OG_LOCALE,
  SHARE_IMAGE_ALT,
  SHARE_IMAGE_HEIGHT,
  SHARE_IMAGE_TYPE,
  SHARE_IMAGE_WIDTH,
  shareImageUrl,
} from '../src/lib/share-meta.ts';
import { localizedPath } from '../src/lib/article-url.ts';
import { decodeEntities } from '../tests/helpers/html-text.mjs';
import {
  headOf,
  metaContent,
  metaContents,
  parseLinkTags,
  parseMetaTags,
} from '../tests/helpers/head-meta.mjs';
import { discoverLiveArticlePath } from './verify-edge-headers.mjs';

export const DEFAULT_SITE_ORIGIN = 'https://915tldr.com';
export const MAX_CARD_BYTES = 5_000_000;
const SITE_NAME = '915 TLDR';
const FORBIDDEN_X_TAGS = ['twitter:site', 'twitter:title', 'twitter:description', 'twitter:image'];

const ok = (check, detail) => ({ check, ok: true, detail });
const fail = (check, detail) => ({ check, ok: false, detail });
const skip = (check, detail) => ({ check, ok: true, skipped: true, detail });
const eq = (check, expected, observed) =>
  expected === observed
    ? ok(check, JSON.stringify(observed))
    : fail(check, `expected ${JSON.stringify(expected)}, observed ${JSON.stringify(observed ?? null)}`);

/**
 * PNG header facts. Throws if the buffer does not start with the 8-byte PNG signature and an
 * IHDR chunk.
 */
export function pngDimensions(buffer) {
  const buf = Buffer.from(buffer);
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  if (buf.length < 26 || !buf.subarray(0, 8).equals(signature)) {
    throw new Error('pngDimensions: buffer does not start with the PNG signature');
  }
  if (buf.toString('latin1', 12, 16) !== 'IHDR') {
    throw new Error('pngDimensions: first chunk is not IHDR');
  }
  return {
    width: buf.readUInt32BE(16),
    height: buf.readUInt32BE(20),
    bitDepth: buf[24],
    colorType: buf[25],
  };
}

function decodedTitle(head) {
  const m = head.match(/<title>([\s\S]*?)<\/title>/);
  return m ? decodeEntities(m[1]) : undefined;
}

function firstTimeDatetime(html) {
  const bodyStart = html.indexOf('</head>');
  const body = bodyStart === -1 ? html : html.slice(bodyStart);
  const m = body.match(/<time\b[^>]*\bdatetime="([^"]*)"/);
  return m ? m[1] : undefined;
}

/**
 * Every share-tag check for one page's HTML. `kind` is 'article' or 'page'. Returns an array of
 * `{ check, ok, detail }`. Pure: no network, no filesystem.
 */
export function checkSharePage(html, { lang, kind, siteOrigin = DEFAULT_SITE_ORIGIN, imageOrigin } = {}) {
  if (lang !== 'en' && lang !== 'es') throw new Error(`checkSharePage: lang must be en or es, got ${lang}`);
  if (kind !== 'article' && kind !== 'page') throw new Error(`checkSharePage: kind must be article or page, got ${kind}`);
  const head = headOf(html);
  const tags = parseMetaTags(head);
  const links = parseLinkTags(head);
  const other = lang === 'en' ? 'es' : 'en';
  const out = [];

  // Title, description, url, site name.
  const title = decodedTitle(head);
  out.push(title === undefined ? fail('og:title', 'page has no <title>') : eq('og:title', title, metaContent(tags, 'og:title')));
  const desc = metaContent(tags, 'og:description');
  out.push(desc && desc.trim() !== '' ? ok('og:description', `${desc.length} chars`) : fail('og:description', 'missing or empty'));

  const ogUrl = metaContent(tags, 'og:url');
  const canonical = links.find((l) => l.rel === 'canonical')?.href;
  if (canonical !== undefined) {
    out.push(eq('og:url', canonical, ogUrl));
  } else {
    let good = false;
    try {
      const u = new URL(ogUrl ?? '');
      good = u.protocol === 'https:' && u.origin === new URL(siteOrigin).origin;
    } catch {
      good = false;
    }
    out.push(good ? ok('og:url', `${ogUrl} (no canonical link on page)`) : fail('og:url', `no canonical link, and ${JSON.stringify(ogUrl ?? null)} is not an https URL on ${siteOrigin}`));
  }
  out.push(eq('og:site_name', SITE_NAME, metaContent(tags, 'og:site_name')));
  out.push(eq('og:type', kind === 'article' ? 'article' : 'website', metaContent(tags, 'og:type')));
  out.push(eq('og:locale', OG_LOCALE[lang], metaContent(tags, 'og:locale')));
  out.push(eq('og:locale:alternate', OG_LOCALE[other], metaContent(tags, 'og:locale:alternate')));

  // The card.
  out.push(eq('og:image', shareImageUrl(lang, imageOrigin), metaContent(tags, 'og:image')));
  out.push(eq('og:image:width', String(SHARE_IMAGE_WIDTH), metaContent(tags, 'og:image:width')));
  out.push(eq('og:image:height', String(SHARE_IMAGE_HEIGHT), metaContent(tags, 'og:image:height')));
  out.push(eq('og:image:type', SHARE_IMAGE_TYPE, metaContent(tags, 'og:image:type')));
  out.push(eq('og:image:alt', SHARE_IMAGE_ALT[lang], metaContent(tags, 'og:image:alt')));

  // X.
  out.push(eq('twitter:card', 'summary_large_image', metaContent(tags, 'twitter:card')));
  out.push(eq('twitter:image:alt', SHARE_IMAGE_ALT[lang], metaContent(tags, 'twitter:image:alt')));
  const forbidden = FORBIDDEN_X_TAGS.filter((k) => metaContents(tags, k).length > 0);
  out.push(forbidden.length === 0 ? ok('no forbidden X tags', FORBIDDEN_X_TAGS.join(', ') + ' absent') : fail('no forbidden X tags', `present: ${forbidden.join(', ')}`));

  // Icons: exactly the three ICON_LINKS.
  const iconKey = (l) => [l.rel, l.href, l.type ?? '', l.sizes ?? ''].join('|');
  const observedIcons = links.filter((l) => l.rel === 'icon' || l.rel === 'apple-touch-icon').map(iconKey);
  const expectedIcons = ICON_LINKS.map(iconKey);
  out.push(
    JSON.stringify(observedIcons) === JSON.stringify(expectedIcons)
      ? ok('icon links', `${expectedIcons.length} links as in ICON_LINKS`)
      : fail('icon links', `expected ${JSON.stringify(expectedIcons)}, observed ${JSON.stringify(observedIcons)}`)
  );

  // Hygiene.
  const empties = tags.filter((t) => t.content.trim() === '').map((t) => t.key);
  out.push(empties.length === 0 ? ok('no empty meta content', 'none') : fail('no empty meta content', `empty: ${empties.join(', ')}`));
  const seen = new Map();
  for (const t of tags) seen.set(t.key, (seen.get(t.key) ?? 0) + 1);
  const dupes = [...seen].filter(([k, n]) => n > 1 && k !== 'article:tag' && k !== 'og:locale:alternate').map(([k]) => k);
  out.push(dupes.length === 0 ? ok('no duplicate meta keys', 'none') : fail('no duplicate meta keys', `duplicated: ${dupes.join(', ')}`));

  // article:* group.
  const articleKeys = tags.filter((t) => t.key.startsWith('article:'));
  if (kind === 'page') {
    out.push(articleKeys.length === 0 ? ok('no article:* tags on a page', 'none') : fail('no article:* tags on a page', `present: ${[...new Set(articleKeys.map((t) => t.key))].join(', ')}`));
  } else {
    const bodyTime = firstTimeDatetime(html);
    if (bodyTime === undefined) {
      out.push(fail('article:published_time', 'no <time datetime> in the page body to compare against'));
      out.push(fail('article:modified_time', 'no <time datetime> in the page body to compare against'));
    } else {
      out.push(eq('article:published_time', bodyTime, metaContent(tags, 'article:published_time')));
      out.push(eq('article:modified_time', bodyTime, metaContent(tags, 'article:modified_time')));
    }
    const section = metaContent(tags, 'article:section');
    out.push(section && section.trim() !== '' ? ok('article:section', JSON.stringify(section)) : fail('article:section', 'missing or empty'));
    out.push(eq('article:author', new URL(localizedPath('/about', lang), siteOrigin).href, metaContent(tags, 'article:author')));
    const blank = metaContents(tags, 'article:tag').filter((v) => v.trim() === '').length;
    out.push(blank === 0 ? ok('every article:tag non-empty', `${metaContents(tags, 'article:tag').length} tags`) : fail('every article:tag non-empty', `${blank} empty article:tag`));
  }
  return out;
}

// ---------------------------------------------------------------------------------------------
// Live checks
// ---------------------------------------------------------------------------------------------

/** One GET. Never throws: a network error comes back as `{ error }`. */
async function get(fetchImpl, url, { userAgent, binary = false } = {}) {
  try {
    const res = await fetchImpl(url, {
      redirect: 'manual',
      headers: userAgent ? { 'user-agent': userAgent } : {},
    });
    const buf = Buffer.from(await res.arrayBuffer());
    return {
      url,
      status: res.status,
      contentType: res.headers.get('content-type') ?? '',
      xRobotsTag: res.headers.get('x-robots-tag') ?? '',
      bytes: buf.length,
      buf,
      text: binary ? undefined : buf.toString('utf8'),
    };
  } catch (err) {
    return { url, error: err instanceof Error ? err.message : String(err) };
  }
}

function prefixed(label, results) {
  return results.map((r) => ({ ...r, check: `${label}: ${r.check}` }));
}

async function assetChecks(fetchImpl, url, label, { expect }) {
  const res = await get(fetchImpl, url, { binary: true });
  if (res.error) return [fail(label, `network error fetching ${url}: ${res.error}`)];
  const facts = `${res.status} ${res.contentType || '(no content-type)'} ${res.bytes} bytes x-robots-tag=${res.xRobotsTag || '(absent)'}`;
  const out = [];
  out.push(res.status === 200 ? ok(`${label} status`, facts) : fail(`${label} status`, `${url} -> ${facts}`));
  if (res.status !== 200) return out;
  if (expect.type) {
    out.push(res.contentType.toLowerCase().includes(expect.type) ? ok(`${label} content-type`, res.contentType) : fail(`${label} content-type`, `expected ${expect.type}, observed ${res.contentType || '(none)'}`));
  }
  if (expect.maxBytes) {
    out.push(res.bytes < expect.maxBytes ? ok(`${label} size`, `${res.bytes} < ${expect.maxBytes}`) : fail(`${label} size`, `${res.bytes} >= ${expect.maxBytes}`));
  }
  if (expect.nonEmpty) {
    out.push(res.bytes > 0 ? ok(`${label} non-empty`, `${res.bytes} bytes`) : fail(`${label} non-empty`, '0 bytes'));
  }
  if (expect.png) {
    try {
      const d = pngDimensions(res.buf);
      const good = d.width === expect.png.width && d.height === expect.png.height;
      out.push(good ? ok(`${label} PNG dimensions`, `${d.width}x${d.height}`) : fail(`${label} PNG dimensions`, `expected ${expect.png.width}x${expect.png.height}, observed ${d.width}x${d.height}`));
    } catch (err) {
      out.push(fail(`${label} PNG dimensions`, err.message));
    }
  }
  return out;
}

/**
 * Live checks against one host. `fetchImpl` and `discoverArticle` are injectable so unit tests
 * never touch the network. Returns `{ host, versionCommit, stylesheet, results }`.
 */
export async function runShareChecks({
  host,
  fetchImpl = fetch,
  discoverArticle = discoverLiveArticlePath,
  noindexPath = '/es/source/ktsm',
  expectStylesheet,
  siteOrigin = DEFAULT_SITE_ORIGIN,
} = {}) {
  const base = `https://${host}`;
  const results = [];
  const pageWeights = [];

  // Build provenance.
  let versionCommit = null;
  const version = await get(fetchImpl, `${base}/version.json`);
  if (version.error) {
    results.push(fail('version.json', `network error: ${version.error}`));
  } else if (version.status !== 200) {
    results.push(fail('version.json', `status ${version.status}`));
  } else {
    try {
      versionCommit = JSON.parse(version.text).commit ?? null;
      results.push(ok('version.json', `commit ${versionCommit}`));
    } catch {
      results.push(fail('version.json', 'not JSON'));
    }
  }

  const discovered = await discoverArticle(host);
  const articlePath = discovered.path ?? null;
  if (!articlePath) results.push(fail('live article discovery', discovered.error ?? 'no article path'));
  else results.push(ok('live article discovery', articlePath));

  const pages = [
    { label: 'EN home', path: '/', lang: 'en', kind: 'page' },
    { label: 'ES home', path: '/es', lang: 'es', kind: 'page' },
  ];
  if (articlePath) {
    pages.push({ label: 'EN article', path: articlePath, lang: 'en', kind: 'article' });
    pages.push({ label: 'ES article', path: localizedPath(articlePath, 'es'), lang: 'es', kind: 'article' });
  }
  pages.push({ label: 'noindex page', path: noindexPath, lang: noindexPath.startsWith('/es') ? 'es' : 'en', kind: 'page', noindex: true });

  let stylesheet = null;
  for (const page of pages) {
    const res = await get(fetchImpl, `${base}${page.path}`);
    if (res.error) {
      results.push(fail(`${page.label} (${page.path})`, `network error: ${res.error}`));
      continue;
    }
    if (res.status !== 200) {
      results.push(fail(`${page.label} (${page.path})`, `status ${res.status}, expected 200`));
      continue;
    }
    pageWeights.push(`${page.label} ${res.bytes} bytes`);
    if (page.noindex && !/<meta[^>]+name=["']robots["'][^>]*noindex/i.test(res.text)) {
      results.push(fail(`${page.label} (${page.path})`, 'not a noindex page; pass --noindex-path'));
    }
    try {
      results.push(...prefixed(`${page.label} (${page.path})`, checkSharePage(res.text, { lang: page.lang, kind: page.kind, siteOrigin })));
    } catch (err) {
      results.push(fail(`${page.label} (${page.path})`, `could not parse head: ${err.message}`));
    }
    if (page.path === '/') {
      stylesheet = res.text.match(/<link[^>]+rel="stylesheet"[^>]+href="([^"]*\/_astro\/[^"]*\.css)"/)?.[1] ?? null;
    }
  }
  results.push(skip('page weight (info)', pageWeights.join('; ') || 'no page fetched'));

  if (expectStylesheet !== undefined) {
    results.push(stylesheet === expectStylesheet ? ok('homepage stylesheet', stylesheet) : fail('homepage stylesheet', `expected ${expectStylesheet}, observed ${stylesheet ?? '(none)'}`));
  } else {
    results.push(skip('homepage stylesheet', `${stylesheet ?? '(none found)'} (no --expect-stylesheet given)`));
  }

  // Assets: the cards exactly as emitted, then the icons.
  for (const lang of ['en', 'es']) {
    results.push(...(await assetChecks(fetchImpl, shareImageUrl(lang), `card ${lang}`, {
      expect: { type: 'image/png', maxBytes: MAX_CARD_BYTES, png: { width: SHARE_IMAGE_WIDTH, height: SHARE_IMAGE_HEIGHT } },
    })));
  }
  for (const icon of ICON_LINKS) {
    const expect =
      icon.rel === 'apple-touch-icon'
        ? { type: 'image/png', png: { width: 180, height: 180 } }
        : icon.type === 'image/svg+xml'
          ? { type: 'svg' }
          : { nonEmpty: true };
    results.push(...(await assetChecks(fetchImpl, `${base}${icon.href}`, icon.href, { expect })));
  }

  return { host, versionCommit, stylesheet, results };
}

// ---------------------------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------------------------

export function parseArgs(argv) {
  const args = { host: 'dev.915tldr.com', noindexPath: '/es/source/ktsm', json: false, siteOrigin: DEFAULT_SITE_ORIGIN };
  const valued = {
    '--host': 'host',
    '--noindex-path': 'noindexPath',
    '--expect-stylesheet': 'expectStylesheet',
    '--html': 'html',
    '--lang': 'lang',
    '--kind': 'kind',
    '--site-origin': 'siteOrigin',
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--json') { args.json = true; continue; }
    const [flag, inline] = arg.includes('=') ? [arg.slice(0, arg.indexOf('=')), arg.slice(arg.indexOf('=') + 1)] : [arg, undefined];
    if (valued[flag]) {
      args[valued[flag]] = inline ?? argv[++i];
    } else {
      throw new Error(`verify-share-meta: unknown argument ${arg}`);
    }
  }
  return args;
}

function printResults(results) {
  for (const r of results) {
    const label = r.skipped ? 'SKIP' : r.ok ? 'PASS' : 'FAIL';
    console.log(`${label} ${r.check} — ${r.detail}`);
  }
}

async function main() {
  let args;
  try {
    args = parseArgs(process.argv.slice(2));
  } catch (err) {
    console.error(err.message);
    process.exitCode = 2;
    return;
  }
  let report;
  if (args.html) {
    const html = readFileSync(args.html, 'utf8');
    report = { file: args.html, results: checkSharePage(html, { lang: args.lang, kind: args.kind, siteOrigin: args.siteOrigin }) };
  } else {
    report = await runShareChecks({
      host: args.host,
      noindexPath: args.noindexPath,
      expectStylesheet: args.expectStylesheet,
      siteOrigin: args.siteOrigin,
    });
  }
  const failed = report.results.filter((r) => !r.ok);
  if (args.json) {
    console.log(JSON.stringify({ host: report.host, versionCommit: report.versionCommit, ...report }, null, 2));
  } else {
    if (report.host) console.log(`[verify-share] host ${report.host}, version.json commit ${report.versionCommit ?? '(unavailable)'}, homepage stylesheet ${report.stylesheet ?? '(none)'}`);
    printResults(report.results);
    console.log(failed.length === 0 ? '[verify-share] all checks passed' : `[verify-share] ${failed.length} check(s) FAILED`);
  }
  process.exitCode = failed.length === 0 ? 0 : 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
