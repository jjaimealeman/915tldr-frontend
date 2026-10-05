// 04-02 (Task 2): proves Base.astro's approved chrome and head-metadata contract against a REAL
// built article page under `dist/client` — not the source template, so a regression that only
// shows up post-render (a missing `set:html`, a swallowed prop) is caught here rather than only
// in a component-level unit test. Follows the `node:test` + `assert/strict` style and the
// `findArticleHtmlFiles` file-discovery convention `tests/unit/build-stamp.test.mjs` and
// `tests/tracer/tracer.test.mjs` already use for the `<slug>-<uuid>.html` output shape
// (`build.format: 'file'`).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import path from 'node:path';
import { CATEGORIES } from '../../src/lib/categories.ts';

const REPO_ROOT = path.resolve(import.meta.dirname, '../..');
const DIST_CLIENT = path.join(REPO_ROOT, 'dist', 'client');
const DIST_BUILT = existsSync(DIST_CLIENT);
const SKIP_REASON = 'dist/client not found — run `pnpm build` first (pnpm test:unit does this automatically)';

const ARTICLE_FILE_RE =
  /^(.+)-([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})\.html$/;

function findArticleHtmlFiles(dir) {
  const found = [];
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (!statSync(full).isDirectory()) continue;
    for (const inner of readdirSync(full)) {
      const innerFull = path.join(full, inner);
      if (statSync(innerFull).isFile() && ARTICLE_FILE_RE.test(inner)) {
        found.push(innerFull);
      }
    }
  }
  return found;
}

function readSampleArticleHtml() {
  const files = findArticleHtmlFiles(DIST_CLIENT);
  assert.ok(files.length > 0, 'expected at least one built article HTML file under dist/client');
  return readFileSync(files[0], 'utf8');
}

test(
  'chrome: nav lists all 8 categories in CATEGORIES order, each an absolute no-trailing-slash href',
  { skip: !DIST_BUILT && SKIP_REASON },
  () => {
    const html = readSampleArticleHtml();
    const navMatch = html.match(/<nav\b[^>]*aria-label="Sections"[^>]*>([\s\S]*?)<\/nav>/);
    assert.ok(navMatch, 'expected a <nav aria-label="Sections"> block');
    const navHtml = navMatch[1];

    // Attribute order within a tag isn't guaranteed by a single regex, so look up each
    // category's href independently rather than relying on match-group positions.
    for (const category of CATEGORIES) {
      const linkRe = new RegExp(
        `<a[^>]*data-nav-category="${category.slug}"[^>]*href="([^"]*)"|<a[^>]*href="([^"]*)"[^>]*data-nav-category="${category.slug}"`
      );
      const linkMatch = navHtml.match(linkRe);
      assert.ok(linkMatch, `expected a nav link for category "${category.slug}"`);
      const href = linkMatch[1] ?? linkMatch[2];
      assert.equal(
        href,
        `/${category.slug}`,
        `category "${category.slug}" href should be absolute with no trailing slash`
      );
    }

    // Order: every category's data-nav-category attribute should appear in CATEGORIES order.
    const orderMatches = [...navHtml.matchAll(/data-nav-category="([a-z]+)"/g)].map((m) => m[1]);
    assert.deepEqual(
      orderMatches,
      CATEGORIES.map((c) => c.slug)
    );
  }
);

test(
  'chrome: exactly one Organization and one WebSite JSON-LD script block',
  { skip: !DIST_BUILT && SKIP_REASON },
  () => {
    const html = readSampleArticleHtml();
    const scripts = [...html.matchAll(/<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)].map(
      (m) => m[1]
    );
    // 04-04: parse and check each script's own TOP-LEVEL @type — a plain substring match on
    // '"@type":"Organization"' also matches a NewsArticle node's nested `isBasedOn.publisher`
    // (itself typed Organization, naming the original outlet), which is a real, distinct JSON-LD
    // node one level down, not a second site-wide Organization block.
    const nodes = scripts.map((s) => JSON.parse(s));
    const organizationBlocks = nodes.filter((n) => n['@type'] === 'Organization');
    const websiteBlocks = nodes.filter((n) => n['@type'] === 'WebSite');
    assert.equal(organizationBlocks.length, 1, 'expected exactly one Organization JSON-LD block');
    assert.equal(websiteBlocks.length, 1, 'expected exactly one WebSite JSON-LD block');
  }
);

test('chrome: RSS alternate link is present', { skip: !DIST_BUILT && SKIP_REASON }, () => {
  const html = readSampleArticleHtml();
  assert.match(html, /<link rel="alternate" type="application\/rss\+xml" title="915 TLDR" href="\/rss\.xml"/);
});

test(
  'chrome: footer links to /changelog, /contact, /about, /privacy and /terms',
  { skip: !DIST_BUILT && SKIP_REASON },
  () => {
    const html = readSampleArticleHtml();
    const footerMatch = html.match(/<footer>([\s\S]*?)<\/footer>/);
    assert.ok(footerMatch, 'expected a <footer> block');
    const footerHtml = footerMatch[1];
    for (const path of ['/changelog', '/contact', '/about', '/privacy', '/terms']) {
      assert.ok(
        footerHtml.includes(`href="${path}"`),
        `expected the footer to link to "${path}"`
      );
    }
  }
);

test('chrome: a [data-dateline] element is present', { skip: !DIST_BUILT && SKIP_REASON }, () => {
  const html = readSampleArticleHtml();
  assert.match(html, /data-dateline/);
});

test(
  // 04-followups (task 1): owner-requested credit link, present in Base.astro's footer on
  // every page — asserted here on a real built article page, and separately on the homepage
  // below, to prove it survives the `buildStamp`-gated footer split (04-11a) unaffected.
  'chrome: footer credits 915website.com on an article page',
  { skip: !DIST_BUILT && SKIP_REASON },
  () => {
    const html = readSampleArticleHtml();
    const footerMatch = html.match(/<footer>([\s\S]*?)<\/footer>/);
    assert.ok(footerMatch, 'expected a <footer> block');
    const footerHtml = footerMatch[1];
    assert.match(footerHtml, /data-credit/, 'expected a [data-credit] element in the footer');
    assert.match(
      footerHtml,
      /<a href="https:\/\/915website\.com\/"[^>]*>915website\.com/,
      'expected the credit link text "915website.com" to link to https://915website.com/'
    );
  }
);

test(
  'chrome: footer credits 915website.com on the homepage',
  { skip: !DIST_BUILT && SKIP_REASON },
  () => {
    const homeHtml = readFileSync(path.join(DIST_CLIENT, 'index.html'), 'utf8');
    const footerMatch = homeHtml.match(/<footer>([\s\S]*?)<\/footer>/);
    assert.ok(footerMatch, 'expected a <footer> block on the homepage');
    const footerHtml = footerMatch[1];
    assert.match(footerHtml, /data-credit/, 'expected a [data-credit] element in the footer');
    assert.match(
      footerHtml,
      /<a href="https:\/\/915website\.com\/"[^>]*>915website\.com/,
      'expected the credit link text "915website.com" to link to https://915website.com/'
    );
  }
);

test(
  // 04-11a: the footer's commit-hash/build-stamp line is opt-in (Base.astro's `buildStamp` prop,
  // default false) so an unchanged article's rendered bytes don't change on every commit —
  // see docs/phase-04/build-measurements.md's "near-total asset re-upload" finding. Article
  // pages do not pass `buildStamp`, so the element must be ABSENT here, not present.
  'chrome: article pages do NOT render a [data-build] stamp element (04-11a — homepage/version.json only)',
  { skip: !DIST_BUILT && SKIP_REASON },
  () => {
    const html = readSampleArticleHtml();
    assert.doesNotMatch(
      html,
      /<p data-build/,
      'article pages must not carry the footer build stamp — only the homepage and /version.json do (04-11a)'
    );
  }
);

// ---------------------------------------------------------------------------
// 06-05 (Task 2, D-11/D-12): the Umami analytics tag and the language-switch/localized-footer
// chrome, sampled across home, a category, an article, a tag page and /es.
// ---------------------------------------------------------------------------

const UMAMI_WEBSITE_ID = '8e82b1af-925f-4a5a-b0d1-e02f616ae077';
// `is:inline` is an Astro compile-time directive — it tells Astro not to bundle/process the
// script, but is itself stripped from the rendered output, so the built HTML carries only
// `defer src="..." data-website-id="..."`.
const UMAMI_TAG_RE = new RegExp(
  `<script defer src="https://stats\\.915websites\\.com/script\\.js" data-website-id="${UMAMI_WEBSITE_ID}"></script>`
);

function sampledPagePaths() {
  const paths = ['index.html', `${CATEGORIES[0].slug}.html`, 'es.html'];
  const articleFiles = findArticleHtmlFiles(DIST_CLIENT);
  if (articleFiles.length > 0) paths.push(path.relative(DIST_CLIENT, articleFiles[0]));
  const tagDir = path.join(DIST_CLIENT, 'tag');
  if (existsSync(tagDir)) {
    const tagFiles = readdirSync(tagDir).filter((f) => f.endsWith('.html'));
    if (tagFiles.length > 0) paths.push(path.join('tag', tagFiles[0]));
  }
  return paths;
}

test(
  'chrome: every sampled page (home, a category, an article, a tag, /es) carries the Umami tag exactly once, with defer',
  { skip: !DIST_BUILT && SKIP_REASON },
  async (t) => {
    for (const relPath of sampledPagePaths()) {
      await t.test(relPath, () => {
        const html = readFileSync(path.join(DIST_CLIENT, relPath), 'utf8');
        const matches = html.match(new RegExp(UMAMI_TAG_RE, 'g')) ?? [];
        assert.equal(matches.length, 1, `expected exactly one Umami tag on ${relPath}, found ${matches.length}`);
        assert.match(html, UMAMI_TAG_RE, `expected ${relPath} to carry the Umami tag verbatim, with defer`);
      });
    }
  }
);

test(
  'chrome: es.html carries the localized footer (Spanish link labels) and the English page carries the English ones',
  { skip: !DIST_BUILT && SKIP_REASON },
  () => {
    const esHtml = readFileSync(path.join(DIST_CLIENT, 'es.html'), 'utf8');
    const enHtml = readFileSync(path.join(DIST_CLIENT, 'index.html'), 'utf8');

    const esFooter = esHtml.match(/<footer>([\s\S]*?)<\/footer>/)[1];
    const enFooter = enHtml.match(/<footer>([\s\S]*?)<\/footer>/)[1];

    assert.ok(esFooter.includes('href="/es/changelog"') && esFooter.includes('Registro de cambios'));
    assert.ok(esFooter.includes('href="/es/contact"') && esFooter.includes('Contacto'));
    assert.ok(esFooter.includes('href="/es/about"') && esFooter.includes('Acerca de'));
    assert.ok(esFooter.includes('href="/es/privacy"') && esFooter.includes('Privacidad'));
    assert.ok(esFooter.includes('href="/es/terms"') && esFooter.includes('Términos'));

    assert.ok(enFooter.includes('href="/changelog"') && enFooter.includes('>Changelog<'));
    assert.ok(enFooter.includes('href="/contact"') && enFooter.includes('>Contact<'));
  }
);

test(
  'chrome: es.html\'s language switch points to "/" with text "English"; index.html\'s points to "/es" with text "Español"',
  { skip: !DIST_BUILT && SKIP_REASON },
  () => {
    const esHtml = readFileSync(path.join(DIST_CLIENT, 'es.html'), 'utf8');
    const enHtml = readFileSync(path.join(DIST_CLIENT, 'index.html'), 'utf8');

    const esSwitch = esHtml.match(/<p data-lang-switch>\s*<a href="([^"]+)"[^>]*>([^<]+)<\/a>/);
    const enSwitch = enHtml.match(/<p data-lang-switch>\s*<a href="([^"]+)"[^>]*>([^<]+)<\/a>/);

    assert.ok(esSwitch);
    assert.equal(esSwitch[1], '/');
    assert.equal(esSwitch[2], 'English');

    assert.ok(enSwitch);
    assert.equal(enSwitch[1], '/es');
    assert.equal(enSwitch[2], 'Español');
  }
);
