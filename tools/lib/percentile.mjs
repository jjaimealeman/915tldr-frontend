// Shared nearest-rank percentile helper — the ONLY definition in this repo.
//
// 03-06-PLAN.md Task 1 and Task 2 both need p50/p95 over a latency distribution and are
// required to share one implementation (`grep -rn "nearestRank|percentile" tools/` must show
// one definition — Task 2 acceptance criteria). This is that definition.
//
// Method matches 915tldr.com2/docs/phase-02/corpus-measurements.md's own stated approach
// ("D1/SQLite has no percentile function") — nearest-rank, no statistics dependency.

/**
 * Nearest-rank percentile over an ALREADY sorted-ascending numeric array.
 * Returns null for an empty array (there is no percentile of nothing) rather than 0, which
 * would be indistinguishable from a genuine zero-latency sample.
 */
export function nearestRank(sortedAscending, p) {
  if (!Array.isArray(sortedAscending) || sortedAscending.length === 0) return null;
  if (sortedAscending.length === 1) return sortedAscending[0];
  const rank = Math.ceil((p / 100) * sortedAscending.length);
  const idx = Math.min(Math.max(rank - 1, 0), sortedAscending.length - 1);
  return sortedAscending[idx];
}

/** min/p50/p95/max/sampleCount over a latency array, sorting a copy (never mutates the input). */
export function distributionStats(latencies) {
  const sorted = [...latencies].sort((a, b) => a - b);
  return {
    sampleCount: sorted.length,
    min: sorted.length ? sorted[0] : null,
    p50: nearestRank(sorted, 50),
    p95: nearestRank(sorted, 95),
    max: sorted.length ? sorted[sorted.length - 1] : null,
  };
}
