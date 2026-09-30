// D-06 fixture: deliberate clean control (Case 3 / T-03-06). Imports nothing forbidden — exists
// so a checker that rejected every input it was given could not pass this suite. Never a real
// violation; never reachable from `pnpm build`.
export function harmlessHelper() {
  return 'no D1 here';
}
