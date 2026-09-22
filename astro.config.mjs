// ARCH-04 / ARCH-05 / ARCH-06: this config is the one place those three requirements are
// asserted in code. `output: 'static'` (not the removed v5 keyword `'hybrid'`); the Cloudflare
// adapter's `imageService` set EXPLICITLY as the two-key object form — `@astrojs/cloudflare`
// v14.2.0+ silently defaults `imageService` to `'cloudflare-binding'`, which would introduce a
// live Cloudflare-account dependency into the build unless overridden here; and the D1-import
// assertion (ARCH-02/ARCH-03) registered as a Vite plugin so it runs inside `astro build`'s own
// Rollup pipeline, not as a separate, skippable step.
//
// `prerenderEnvironment: 'node'` — a finding from this task's own tracer run, not in
// 03-RESEARCH.md: `@astrojs/cloudflare` defaults prerendering to a simulated `workerd` sandbox
// (Miniflare) since v13.1.0, NOT plain Node, so `process.env` inside `getStaticPaths()` is not
// automatically populated from the host shell the way Pattern 2 (03-RESEARCH.md) assumes ("the
// Content Loader ... runs once, in Node, during `astro build`"). Setting this explicitly to
// `'node'` is the documented lever (Astro adapter-reference) for making that assumption true —
// without it, `src/lib/server/d1-client.ts`'s `process.env.CLOUDFLARE_ACCOUNT_ID` read throws
// inside the workerd sandbox even though the host process has the variable set.
import { defineConfig } from 'astro/config';
import cloudflare from '@astrojs/cloudflare';
import vue from '@astrojs/vue';
import { assertNoD1Plugin } from './tools/assert-no-d1.mjs';

export default defineConfig({
  output: 'static',
  site: 'https://dev.915tldr.com',
  adapter: cloudflare({
    imageService: { build: 'compile', runtime: 'passthrough' },
    prerenderEnvironment: 'node',
    // This tracer uses no `server:defer` islands and no Astro Sessions API. Without this,
    // the adapter auto-provisions a `SESSION` KV binding and worker bundle we never asked for
    // and never use — noise discovered against a real build, not in 03-RESEARCH.md.
    session: false,
  }),
  integrations: [vue()],
  vite: {
    plugins: [assertNoD1Plugin()],
  },
});
