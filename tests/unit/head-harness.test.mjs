// 07-01 (SOC-02 / SOC-05): proves the share-card head tags by building tests/fixtures/head-harness,
// a standalone Astro root that renders the real src/layouts/Base.astro with NO content loaders, so
// the build performs zero D1 reads and zero KV writes. A full `pnpm build` runs the D1 loaders and
// bulk-writes production KV (06-15 SUMMARY, deviation 2), which is why head metadata is proven here.
// This test never substitutes for the live validator checks (07-08): it reads built HTML only.
// 07-03 extends it from the og:image group to the full og/twitter set, the icon links, attribute
// escaping of hostile text (T-07-01), build determinism (T-07-10) and asset existence.
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { VARIANTS } from '../fixtures/head-harness/src/variants.ts';
import { SHARE_IMAGE_PATH, ICON_LINKS } from '../../src/lib/share-meta.ts';
import { headOf, parseMetaTags, parseLinkTags, metaContent, metaContents } from '../helpers/head-meta.mjs';
import { decodeEntities } from '../helpers/html-text.mjs';

const REPO_ROOT = path.resolve(import.meta.dirname, '../..');
const HARNESS = path.join(REPO_ROOT, 'tests/fixtures/head-harness');
const HARNESS_REL = 'tests/fixtures/head-harness';
const REPO_CACHE = path.join(REPO_ROOT, 'node_modules/.astro/incremental-build.json');

const mtimeOrNull = (p) => (existsSync(p) ? statSync(p).mtimeMs : null);
let cacheBefore = null;
let cacheAfter = null;
let buildMs = 0;

function walk(dir) {
  const files = [];
  if (!existsSync(dir)) return files;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...walk(full));
    else files.push(full);
  }
  return files;
}

function gitCheckIgnored(file) {
  try {
    execFileSync('git', ['check-ignore', '-q', file], { cwd: REPO_ROOT });
    return true;
  } catch {
    return false;
  }
}

before(() => {
  cacheBefore = mtimeOrNull(REPO_CACHE);
  const started = Date.now();
  execFileSync(
    process.execPath,
    [path.join(REPO_ROOT, 'node_modules/astro/bin/astro.mjs'), 'build', '--root', HARNESS],
    { cwd: REPO_ROOT, env: { ...process.env, ASTRO_TELEMETRY_DISABLED: '1' }, timeout: 120000, stdio: 'pipe' }
  );
  buildMs = Date.now() - started;
  cacheAfter = mtimeOrNull(REPO_CACHE);
  console.log(`# head-harness build: ${buildMs}ms`);
});

function builtHtml(variantName, distDir = path.join(HARNESS, 'dist')) {
  return readFileSync(path.join(distDir, `${variantName}.html`), 'utf8');
}

function builtMeta(variantName) {
  return parseMetaTags(headOf(builtHtml(variantName)));
}

// 07-03: the fixed share-tag order (07-UI-SPEC "Head Metadata Contract"); article:* tags join in 07-04.
const SHARE_ORDER = [
  'og:title',
  'og:description',
  'og:url',
  'og:site_name',
  'og:type',
  'og:locale',
  'og:locale:alternate',
  'og:image',
  'og:image:width',
  'og:image:height',
  'og:image:type',
  'og:image:alt',
  'twitter:card',
  'twitter:image:alt',
];
const isShareKey = (key) => key.startsWith('og:') || key.startsWith('twitter:');

test('head-harness: every variant carries its literal expected meta tags', () => {
  for (const v of VARIANTS) {
    const tags = builtMeta(v.name);
    for (const [key, expected] of Object.entries(v.expectMeta)) {
      if (Array.isArray(expected)) {
        assert.deepEqual(metaContents(tags, key), expected, `${v.name}: ${key}`);
      } else {
        assert.equal(metaContent(tags, key), expected, `${v.name}: ${key}`);
      }
    }
    for (const key of v.expectAbsent ?? []) {
      assert.equal(metaContent(tags, key), undefined, `${v.name}: ${key} must be absent`);
    }
  }
});

test('head-harness: og:image is an absolute https URL whose path is SHARE_IMAGE_PATH[lang]', () => {
  for (const v of VARIANTS) {
    const url = new URL(metaContent(builtMeta(v.name), 'og:image'));
    assert.equal(url.protocol, 'https:', v.name);
    assert.equal(url.pathname, SHARE_IMAGE_PATH[v.props.lang], v.name);
  }
});

test('head-harness: harness site literal equals the root astro.config.mjs site literal', () => {
  const siteOf = (file) => readFileSync(file, 'utf8').match(/^\s*site:\s*['"]([^'"]+)['"]/m)?.[1];
  const root = siteOf(path.join(REPO_ROOT, 'astro.config.mjs'));
  const harness = siteOf(path.join(HARNESS, 'astro.config.mjs'));
  assert.ok(root, 'root astro.config.mjs has a site literal');
  assert.equal(harness, root);
});

test('head-harness: the build did not touch the repo-root incremental cache', () => {
  assert.equal(cacheAfter, cacheBefore);
});

test('head-harness: every build output is git-ignored and none shows in git status', () => {
  const outputs = [...walk(path.join(HARNESS, 'dist')), ...walk(path.join(HARNESS, '.astro'))];
  assert.ok(outputs.length > 0, 'harness build produced output');
  for (const file of outputs) {
    const rel = path.relative(REPO_ROOT, file);
    assert.ok(gitCheckIgnored(rel), `${rel} must be git-ignored`);
  }
  assert.ok(!existsSync(path.join(HARNESS, 'node_modules')) || gitCheckIgnored(`${HARNESS_REL}/node_modules`));
  const status = execFileSync('git', ['status', '--porcelain', '--untracked-files=all', HARNESS_REL], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
  });
  for (const line of status.split('\n').filter(Boolean)) {
    const p = line.slice(3);
    assert.ok(
      !/\/(dist|\.astro|node_modules)\//.test(p),
      `build output shows in git status: ${line}`
    );
  }
});

test('head-harness: the harness covers all 8 variants', () => {
  assert.deepEqual(
    VARIANTS.map((v) => v.name),
    ['en-listing', 'es-listing', 'en-home', 'en-self', 'es-noindex', 'en-no-description', 'no-canonical', 'injection']
  );
});

test('head-harness (a): every variant carries the share keys in the fixed order, og:locale:alternate included on every one (D-22)', () => {
  for (const v of VARIANTS) {
    const keys = builtMeta(v.name)
      .map((t) => t.key)
      .filter(isShareKey);
    assert.deepEqual(keys, SHARE_ORDER, v.name);
  }
});

test('head-harness (a): og:* tags use property and twitter:* tags use name', () => {
  for (const v of VARIANTS) {
    for (const tag of builtMeta(v.name).filter((t) => isShareKey(t.key))) {
      assert.equal(tag.attr, tag.key.startsWith('twitter:') ? 'name' : 'property', `${v.name}: ${tag.key}`);
    }
  }
});

test('head-harness (b): no meta tag in any head has empty content', () => {
  for (const v of VARIANTS) {
    for (const tag of builtMeta(v.name)) {
      assert.ok(tag.content.trim().length > 0, `${v.name}: ${tag.key} has empty content`);
    }
  }
});

test('head-harness (c): og:title equals the decoded <title>; og:url equals the canonical link when there is one', () => {
  for (const v of VARIANTS) {
    const head = headOf(builtHtml(v.name));
    const title = decodeEntities(head.match(/<title>([\s\S]*?)<\/title>/)[1]);
    const tags = parseMetaTags(head);
    assert.equal(metaContent(tags, 'og:title'), title, v.name);
    const canonical = parseLinkTags(head).find((l) => l.rel === 'canonical');
    if (v.props.canonicalPath) {
      assert.ok(canonical, `${v.name}: canonical link present`);
      assert.equal(metaContent(tags, 'og:url'), canonical.href, v.name);
    } else {
      assert.equal(canonical, undefined, `${v.name}: no canonical link`);
      assert.equal(metaContent(tags, 'og:url'), v.expectMeta['og:url'], v.name);
    }
  }
});

test('head-harness (c): og:url never takes the og:image origin (T-07-09)', () => {
  for (const v of VARIANTS) {
    const tags = builtMeta(v.name);
    assert.equal(new URL(metaContent(tags, 'og:url')).origin, 'https://915tldr.com', v.name);
    assert.notEqual(new URL(metaContent(tags, 'og:url')).origin, new URL(metaContent(tags, 'og:image')).origin, v.name);
  }
});

test('head-harness: noindex variant keeps robots noindex AND the full share set (D-14)', () => {
  const tags = builtMeta('es-noindex');
  assert.equal(metaContent(tags, 'robots'), 'noindex');
  assert.equal(metaContent(tags, 'twitter:card'), 'summary_large_image');
  assert.equal(metaContent(tags, 'og:locale:alternate'), 'en_US');
});

test('head-harness: the no-description variant renders no <meta name="description"> but still has og:description', () => {
  const tags = builtMeta('en-no-description');
  assert.equal(metaContent(tags, 'description'), undefined);
  assert.ok(metaContent(tags, 'og:description').length > 0);
});

test('head-harness (d): exactly three icon links, in ICON_LINKS order, after the robots meta and before the first og tag', () => {
  for (const v of VARIANTS) {
    const head = headOf(builtHtml(v.name));
    const icons = parseLinkTags(head)
      .filter((l) => l.rel === 'icon' || l.rel === 'apple-touch-icon')
      .map(({ rel, href, type, sizes }) => ({ rel, href, type, sizes }));
    const expected = ICON_LINKS.map((i) => ({ rel: i.rel, href: i.href, type: i.type, sizes: i.sizes }));
    assert.deepEqual(icons, expected, v.name);
    assert.equal(icons.length, 3, v.name);

    const firstIcon = head.indexOf('rel="icon"');
    const firstOg = head.indexOf('property="og:title"');
    assert.ok(firstIcon !== -1 && firstIcon < firstOg, `${v.name}: icons precede og:title`);
    if (v.props.noindex) {
      assert.ok(head.indexOf('name="robots"') < firstIcon, `${v.name}: robots precedes icons`);
    }
  }
});

test('head-harness (d): the icon links render with the exact attribute text the contract names', () => {
  const head = headOf(builtHtml('en-home'));
  assert.ok(head.includes('rel="apple-touch-icon" href="/apple-touch-icon.png"'));
  assert.ok(head.includes('rel="icon" href="/favicon.ico" sizes="32x32"'));
  assert.ok(head.includes('rel="icon" href="/favicon.svg" type="image/svg+xml"'));
});

test('head-harness (e): hostile title and description cannot leave their attribute or add an element (T-07-01)', () => {
  const rawTitle = 'Quote " & <script>alert(1)</script> — 915 TLDR';
  const rawDescription = '<b>bold</b> & "quoted"';
  const head = headOf(builtHtml('injection'));

  // Raw attribute text: every " and & of the hostile strings appears only as an entity. Astro leaves
  // < and > literal inside a quoted attribute value (toAttributeString), where they are inert.
  for (const key of ['og:title', 'og:description']) {
    const raw = head.match(new RegExp(`<meta property="${key}" content="([^"]*)"`))[1];
    assert.ok(!/&(?!quot;|amp;|lt;|gt;|#\d+;|#x[0-9a-fA-F]+;)/.test(raw), `${key}: bare ampersand in raw attribute`);
    assert.ok(raw.includes('&quot;'), `${key}: quote escaped`);
    assert.ok(raw.includes('&amp;'), `${key}: ampersand escaped`);
  }

  // Element structure, read with a quote-aware scanner: a literal `<script>` inside a quoted content
  // value is consumed as part of that value, so it is NOT counted as an element. The hostile head
  // must have exactly the element sequence of a benign head with the same props shape.
  const elementNames = (h) =>
    [...h.matchAll(/<([a-zA-Z][\w-]*)\b(?:"[^"]*"|'[^']*'|[^>"'])*>/g)].map((m) => m[1].toLowerCase());
  assert.deepEqual(elementNames(head), elementNames(headOf(builtHtml('en-listing'))), 'no new element in the head');
  assert.equal(
    elementNames(head).filter((n) => n === 'script').length,
    elementNames(headOf(builtHtml('en-listing'))).filter((n) => n === 'script').length,
    'no new <script> element'
  );

  assert.ok(/<title>[^<]*&lt;script&gt;/.test(head), '<title> text carries &lt;script&gt;');

  const tags = parseMetaTags(head);
  assert.equal(metaContent(tags, 'og:title'), rawTitle);
  assert.equal(metaContent(tags, 'og:description'), rawDescription);
  assert.equal(metaContent(tags, 'og:url'), 'https://915tldr.com/injection');
});

test('head-harness (f): a second build of the same commit leaves every head byte-identical (04-11a / T-07-10)', () => {
  const copy = path.join(HARNESS, '.astro', 'determinism-copy');
  mkdirSync(copy, { recursive: true });
  cpSync(path.join(HARNESS, 'dist'), copy, { recursive: true, force: true });
  execFileSync(
    process.execPath,
    [path.join(REPO_ROOT, 'node_modules/astro/bin/astro.mjs'), 'build', '--root', HARNESS],
    { cwd: REPO_ROOT, env: { ...process.env, ASTRO_TELEMETRY_DISABLED: '1' }, timeout: 120000, stdio: 'pipe' }
  );
  for (const v of VARIANTS) {
    const first = headOf(builtHtml(v.name, copy));
    const second = headOf(builtHtml(v.name));
    assert.ok(first.length > 0);
    assert.equal(second, first, `${v.name}: head changed between builds`);
  }
});

test('head-harness (g): every ICON_LINKS href and every SHARE_IMAGE_PATH names an existing file under public/', () => {
  const paths = [...ICON_LINKS.map((i) => i.href), ...Object.values(SHARE_IMAGE_PATH)];
  assert.equal(paths.length, 5);
  for (const p of paths) {
    assert.ok(p.startsWith('/'), p);
    const file = path.join(REPO_ROOT, 'public', p);
    assert.ok(existsSync(file), `${p} must exist under public/`);
    assert.ok(statSync(file).size > 0, `${p} must not be empty`);
  }
});
