<!-- D-06 / T-03-02a fixture: deliberate violation. Imports the KV-reaching helper directly from
     a .vue component — proves island coverage extends into `src/lib/server/kv-manifest.ts`, not
     only `d1-client.ts`. Never a real island component; never reachable from `pnpm build` (this
     file lives outside `src/islands/**`). -->
<script setup lang="ts">
import { helperReachingKv } from './helper-reaching-kv';

const entry = await helperReachingKv();
</script>

<template>
  <p>{{ entry }}</p>
</template>
