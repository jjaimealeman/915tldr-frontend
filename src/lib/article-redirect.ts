// D-08 / T-04-22 / T-04-23: pure uuid extraction + redirect-decision logic for the 04-06 Worker.
// STUB (TDD RED phase) — real implementation lands in the GREEN commit.
export function extractArticleUuid(_pathname: string): string | null {
  throw new Error('not implemented');
}

export type RedirectDecision = { type: 'redirect'; location: string } | { type: 'not-found' };

export function resolveRedirect(_pathname: string, _entry: unknown): RedirectDecision {
  throw new Error('not implemented');
}
