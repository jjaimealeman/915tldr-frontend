<!-- D-06 fixture: deliberate violation of ARCH-03. Imports the D1-reaching helper directly from
     a .vue component — this is the file the island case's rejection message must name, proving
     island coverage extends past `.astro` wrappers into the Vue component tree itself, not only
     the wrapper that renders it. Never a real island component; never reachable from
     `pnpm build` (this file lives outside `src/islands/**`). -->
<script setup lang="ts">
import { helperReachingD1 } from './helper-reaching-d1';

const article = await helperReachingD1();
</script>

<template>
  <p>{{ article }}</p>
</template>
