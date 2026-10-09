#!/usr/bin/env node
// 07-01 / SOC-05 / D-21: build guard for the og:image origin.
//
// The og:image origin is a COMMITTED CONSTANT (`SHARE_IMAGE_ORIGIN` in src/lib/share-meta.ts),
// deliberately superseding D-07's "built from Astro.site" wording so the new cards can be
// validated on the dev host. This guard keeps that constant honest: it must be an https origin
// (no path, query, port or credentials) whose host equals the Worker's single primary
// `custom_domain` route in wrangler.jsonc. At cutover the route moves to 915tldr.com, and this
// guard then fails until the constant follows; because the constant is module code, changing it
// changes the dependency hash of every page and Astro's incremental build re-renders them all
// (an environment variable would not, which is why this is not one).
//
// Exactly one custom_domain route is required. If a future deploy legitimately needs several
// (for example 915tldr.com and www.915tldr.com), this guard must be changed deliberately to name
// the primary; it never guesses.
//
// Wired into `guard:config` in package.json (which `pnpm build` runs first, including on Workers
// Builds). It is a separate script, not a rule inside check-config-guards.mjs, because
// tests/unit/astro-config.test.mjs spawns that CLI against temp wrangler files with no custom
// domain.
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { stripComments } from './check-config-guards.mjs';

const RULE = 'SOC-05-ORIGIN';

/**
 * Every `pattern` of a route object that sets `"custom_domain": true`, in file order. Comments are
 * stripped first, so a commented-out route does not count. Matches innermost `{...}` objects, so a
 * route's keys may appear in either order.
 */
export function customDomainHosts(wranglerText) {
  const stripped = stripComments(wranglerText);
  const hosts = [];
  for (const [object] of stripped.matchAll(/\{[^{}]*\}/g)) {
    if (!/"custom_domain"\s*:\s*true\b/.test(object)) continue;
    const pattern = object.match(/"pattern"\s*:\s*"([^"]*)"/);
    if (pattern) hosts.push(pattern[1]);
  }
  return hosts;
}

/** Violations (empty when the origin is valid and equals the single custom_domain host). */
export function checkShareOrigin({ shareOrigin, wranglerText, wranglerPath = 'wrangler.jsonc' }) {
  const violation = (message) => ({ file: wranglerPath, line: 1, rule: RULE, message });

  let url;
  try {
    url = new URL(shareOrigin);
  } catch {
    return [violation(`SHARE_IMAGE_ORIGIN ${JSON.stringify(shareOrigin)} is not a valid URL`)];
  }
  if (url.protocol !== 'https:') {
    return [violation(`SHARE_IMAGE_ORIGIN ${shareOrigin} must use https`)];
  }
  if (
    url.pathname !== '/' ||
    shareOrigin.endsWith('/') ||
    url.search ||
    url.hash ||
    url.port ||
    url.username ||
    url.password
  ) {
    return [
      violation(
        `SHARE_IMAGE_ORIGIN ${shareOrigin} must be a bare origin: no path, trailing slash, query, fragment, port or credentials`
      ),
    ];
  }

  const hosts = customDomainHosts(wranglerText);
  if (hosts.length === 0) {
    return [violation('cannot verify og:image origin: no custom_domain route in wrangler.jsonc')];
  }
  if (hosts.length > 1) {
    return [
      violation(
        `ambiguous primary: ${hosts.length} custom_domain routes in wrangler.jsonc (${hosts.join(', ')}); exactly one is required`
      ),
    ];
  }
  if (url.host !== hosts[0]) {
    return [
      violation(
        `SHARE_IMAGE_ORIGIN host ${url.host} does not match the wrangler.jsonc custom domain ${hosts[0]}`
      ),
    ];
  }
  return [];
}

function parseArgs(argv) {
  const args = { wrangler: 'wrangler.jsonc' };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--wrangler') args.wrangler = argv[++i];
    else if (argv[i].startsWith('--wrangler=')) args.wrangler = argv[i].slice('--wrangler='.length);
  }
  return args;
}

async function main() {
  const { wrangler } = parseArgs(process.argv.slice(2));
  const { SHARE_IMAGE_ORIGIN } = await import(new URL('../src/lib/share-meta.ts', import.meta.url).href);
  const wranglerText = fs.readFileSync(wrangler, 'utf8');
  const violations = checkShareOrigin({
    shareOrigin: SHARE_IMAGE_ORIGIN,
    wranglerText,
    wranglerPath: path.basename(wrangler),
  });
  if (violations.length === 0) {
    console.log(
      `[assert-share-origin] ok: og:image origin ${SHARE_IMAGE_ORIGIN} matches custom domain ${customDomainHosts(wranglerText)[0]}`
    );
    process.exitCode = 0;
    return;
  }
  for (const v of violations) {
    console.error(`[assert-share-origin] ${v.file}:${v.line} [${v.rule}] ${v.message}`);
  }
  process.exitCode = 1;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  await main();
}
