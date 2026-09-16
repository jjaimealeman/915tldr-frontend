#!/usr/bin/env node
// Dependency-free static file server rooted at design/. Serves mockups,
// fonts, and test fixtures for Playwright's webServer, and can be started
// directly by the OWNER via `npm run serve:mockups` for manual browsing.
//
// Security posture (see 01-01-PLAN.md threat model T-01-01):
//   - binds to the loopback address only, never a wildcard/all-interfaces host
//   - only GET and HEAD are accepted; everything else is 405
//   - the request path is percent-decoded exactly once, then resolved
//     against the design/ root; any resolution that escapes design/ is 404
//   - malformed percent-encoding is 400; NUL bytes are rejected

import http from 'node:http';
import fs from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(fileURLToPath(new URL('../', import.meta.url)));

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.json': 'application/json',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
};

function mimeFor(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return MIME_TYPES[ext] ?? 'application/octet-stream';
}

/**
 * Resolves an incoming request pathname to an absolute filesystem path
 * inside ROOT, or returns null if the request should be rejected.
 * Returns { status } for early-exit cases (400) or { filePath } on success.
 */
function resolveRequestPath(rawPathname) {
  let decoded;
  try {
    decoded = decodeURIComponent(rawPathname);
  } catch {
    return { status: 400 };
  }
  if (decoded.includes('\0')) {
    return { status: 400 };
  }
  const resolved = path.resolve(ROOT, '.' + decoded);
  if (resolved !== ROOT && !resolved.startsWith(ROOT + path.sep)) {
    return { status: 404 };
  }
  return { filePath: resolved };
}

async function handleRequest(req, res) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('Method Not Allowed');
    return;
  }

  // req.url may contain a query string; strip it before path resolution.
  const rawUrl = req.url ?? '/';
  const queryIndex = rawUrl.indexOf('?');
  const rawPathname = queryIndex === -1 ? rawUrl : rawUrl.slice(0, queryIndex);

  if (rawPathname === '/__health') {
    res.writeHead(200, {
      'content-type': 'text/plain; charset=utf-8',
      'cache-control': 'no-store',
    });
    res.end(req.method === 'HEAD' ? undefined : 'ok');
    return;
  }

  const resolution = resolveRequestPath(rawPathname);
  if (resolution.status) {
    res.writeHead(resolution.status, { 'content-type': 'text/plain; charset=utf-8' });
    res.end(resolution.status === 400 ? 'Bad Request' : 'Not Found');
    return;
  }

  let filePath = resolution.filePath;
  let stat;
  try {
    stat = await fs.stat(filePath);
  } catch {
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('Not Found');
    return;
  }

  if (stat.isDirectory()) {
    filePath = path.join(filePath, 'index.html');
    try {
      stat = await fs.stat(filePath);
    } catch {
      res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
      res.end('Not Found');
      return;
    }
  }

  res.writeHead(200, {
    'content-type': mimeFor(filePath),
    'cache-control': 'no-store',
  });

  if (req.method === 'HEAD') {
    res.end();
    return;
  }

  createReadStream(filePath).pipe(res);
}

/**
 * Starts the static server. Returns { url, close }.
 */
export async function startServer({ port = 4319, host = '127.0.0.1' } = {}) {
  const server = http.createServer((req, res) => {
    handleRequest(req, res).catch((err) => {
      if (!res.headersSent) {
        res.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' });
      }
      res.end(`Internal Server Error: ${err?.message ?? err}`);
    });
  });

  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, host, () => {
      server.removeListener('error', reject);
      resolve(undefined);
    });
  });

  const address = server.address();
  const actualPort = typeof address === 'object' && address ? address.port : port;
  const url = `http://${host}:${actualPort}`;

  return {
    url,
    close: () =>
      new Promise((resolve, reject) => {
        server.close((err) => (err ? reject(err) : resolve(undefined)));
      }),
  };
}

function parseArgs(argv) {
  const args = { port: 4319 };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--port' && argv[i + 1]) {
      args.port = Number(argv[i + 1]);
      i++;
    }
  }
  return args;
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  const { port } = parseArgs(process.argv.slice(2));
  const { url } = await startServer({ port });
  console.log(`Mockup server listening at ${url}`);
}
