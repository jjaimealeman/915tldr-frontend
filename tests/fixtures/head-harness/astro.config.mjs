// 07-01: a standalone Astro root that renders `src/layouts/Base.astro` and nothing else, so a test
// can read real built `<head>` HTML with zero D1 reads and zero KV writes. The repo's own
// `pnpm build` runs the D1 content loaders and bulk-writes production KV (06-15 SUMMARY,
// deviation 2), so head metadata is proven here and never by a full build.
//
// `cacheDir`, `outDir` and Vite's `cacheDir` stay INSIDE this directory (gitignored `dist/` and
// `.astro/`) so this build never touches the repo's `node_modules/.astro` (the production
// incremental-build cache) or the repo `dist/`. A standalone root without the Vite override
// measured as writing its dependency cache to `<root>/node_modules/.vite/deps`.
//
// Mirrors four keys of the root astro.config.mjs (site, trailingSlash, build.format, session);
// tests/unit/head-harness.test.mjs asserts `site` has not drifted. No adapter, no integrations.
import { defineConfig } from 'astro/config';

export default defineConfig({
  output: 'static',
  site: 'https://915tldr.com',
  trailingSlash: 'never',
  build: { format: 'file' },
  session: false,
  cacheDir: './.astro/cache',
  outDir: './dist',
  vite: { cacheDir: './.astro/vite' },
});
