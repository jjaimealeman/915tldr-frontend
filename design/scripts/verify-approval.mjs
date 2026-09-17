#!/usr/bin/env node
// D-16: verifies 01-APPROVAL.md — the file fingerprints still match on disk,
// and (unless --pending-ok) exactly one valid Owner sign-off line exists.
// Reusable as the Phase 3 guard per the plan's own framing.

import { readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';

const PACKET_PATH = '.planning/phases/01-design-sketch-editorial-identity/01-APPROVAL.md';
const SIGNOFF_LINE_RE = /^Approved-by: \S.* — \d{4}-\d{2}-\d{2}$/;

function sha256(relPath) {
  const full = path.resolve(relPath);
  if (!existsSync(full)) return null;
  return createHash('sha256').update(readFileSync(full)).digest('hex');
}

function parseFingerprintTable(md) {
  const lines = md.split('\n');
  const rows = [];
  let inTable = false;
  for (const line of lines) {
    if (line.startsWith('## File fingerprints')) {
      inTable = true;
      continue;
    }
    if (inTable) {
      if (line.startsWith('## ')) break; // next section
      const m = line.match(/^\|\s*`([^`]+)`\s*\|\s*`([^`]+)`\s*\|$/);
      if (m) rows.push({ file: m[1], sha: m[2] });
    }
  }
  return rows;
}

function extractSection(md, heading) {
  const idx = md.indexOf(heading);
  if (idx === -1) return null;
  const rest = md.slice(idx + heading.length);
  const nextHeadingIdx = rest.search(/\n## /);
  return nextHeadingIdx === -1 ? rest : rest.slice(0, nextHeadingIdx);
}

function main() {
  const pendingOk = process.argv.includes('--pending-ok');

  if (!existsSync(path.resolve(PACKET_PATH))) {
    console.error(`FATAL: ${PACKET_PATH} does not exist. Run "npm run approval:packet" first.`);
    process.exit(1);
  }

  const md = readFileSync(path.resolve(PACKET_PATH), 'utf8');

  // 1. Fingerprint check.
  const rows = parseFingerprintTable(md);
  if (rows.length === 0) {
    console.error('FATAL: no file fingerprints found in 01-APPROVAL.md — malformed packet.');
    process.exit(1);
  }

  const mismatches = [];
  for (const { file, sha } of rows) {
    if (sha.startsWith('MISSING:')) {
      mismatches.push(`${file}: recorded as missing at packet time`);
      continue;
    }
    const current = sha256(file);
    if (current === null) {
      mismatches.push(`${file}: file no longer exists`);
    } else if (current !== sha) {
      mismatches.push(`${file}: recorded ${sha}, now ${current}`);
    }
  }

  if (mismatches.length > 0) {
    console.error(
      'files changed since the packet was generated — re-run verify:phase-1, regenerate the packet and re-sign (D-16)'
    );
    for (const m of mismatches) console.error(`  - ${m}`);
    process.exit(1);
  }

  console.log(`Fingerprints OK (${rows.length} files unchanged since packet generation).`);

  // 2. Sign-off check.
  if (pendingOk) {
    console.log('Sign-off check skipped (--pending-ok).');
    process.exit(0);
  }

  const signoffSection = extractSection(md, '## Owner sign-off');
  if (signoffSection === null) {
    console.error('FATAL: "## Owner sign-off" section not found in 01-APPROVAL.md.');
    process.exit(1);
  }

  const signoffLines = signoffSection
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => SIGNOFF_LINE_RE.test(l));

  if (signoffLines.length === 0) {
    console.error('Owner sign-off missing — no "Approved-by: <name> — <YYYY-MM-DD>" line found. Not approved.');
    process.exit(1);
  }
  if (signoffLines.length > 1) {
    console.error(`FATAL: ${signoffLines.length} Approved-by lines found — exactly one is required.`);
    process.exit(1);
  }

  console.log(`Sign-off OK: ${signoffLines[0]}`);
  process.exit(0);
}

main();
