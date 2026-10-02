import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createOllamaClient, DEFAULT_MODEL, QuizError, validateInput } from './lib/quiz.mjs';

const ROOT = dirname(fileURLToPath(import.meta.url));
const MAX_BODY_BYTES = 40_000;
const LOOPBACK_HOSTS = new Set(['127.0.0.1', 'localhost', '::1']);
const STATIC_FILES = new Map([
  ['/', ['index.html', 'text/html; charset=utf-8']],
  ['/app.js', ['app.js', 'text/javascript; charset=utf-8']],
  ['/style.css', ['style.css', 'text/css; charset=utf-8']],
  ['/demo.js', ['demo.js', 'text/javascript; charset=utf-8']],
  ['/favicon.svg', ['favicon.svg', 'image/svg+xml']],
]);

function securityHeaders(res) {
  res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'");
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Cache-Control', 'no-store');
}

function json(res, status, value) {
  const body = JSON.stringify(value);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': Buffer.byteLength(body) });
  res.end(body);
}

function checkRequestOrigin(req) {
  const rawHost = req.headers.host;
  if (typeof rawHost !== 'string' || !/^(localhost|127\.0\.0\.1|\[::1\])(?::\d{1,5})?$/i.test(rawHost)) {
    throw new QuizError('This app only accepts requests from this computer.', 403);
  }
  let host;
  try {
    host = new URL(`http://${rawHost}`);
  } catch {
    throw new QuizError('This app only accepts requests to its local address.', 403);
  }
  if (Number(host.port || 80) !== req.socket.localPort) {
    throw new QuizError('This app only accepts requests to its local address.', 403);
  }
  if (req.headers.origin !== undefined && req.headers.origin !== host.origin) {
    throw new QuizError('Requests from another website are not allowed.', 403);
  }
  if (req.headers['sec-fetch-site'] === 'cross-site') {
    throw new QuizError('Requests from another website are not allowed.', 403);
  }
}

function readBody(req) {
  return new Promise((resolveBody, reject) => {
    let length = 0;
    const chunks = [];
    let settled = false;
    const fail = (error) => {
      if (settled) return;
      settled = true;
      reject(error);
    };
    req.on('data', (chunk) => {
      if (settled) return;
      length += chunk.length;
      if (length > MAX_BODY_BYTES) {
        chunks.length = 0;
        fail(new QuizError('That request is too large. Keep notes to 8,000 characters or fewer.', 413));
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      if (settled) return;
      settled = true;
      try {
        resolveBody(JSON.parse(Buffer.concat(chunks).toString('utf8')));
      } catch {
        reject(new QuizError('Send valid JSON with your notes and question count.'));
      }
    });
    req.on('error', () => fail(new QuizError('The request was interrupted. Please try again.')));
    req.on('aborted', () => fail(new QuizError('The request was interrupted. Please try again.')));
  });
}

export function createApp({ fetchImpl, model = DEFAULT_MODEL, timeoutMs, staticDir = join(ROOT, 'public') } = {}) {
  const ollama = createOllamaClient({ fetchImpl, model, timeoutMs });
  let generating = false;
  return async function app(req, res) {
    securityHeaders(res);
    try {
      checkRequestOrigin(req);
      const pathname = req.url?.split('?')[0];
      if (pathname === '/api/status') {
        if (req.method !== 'GET') {
          res.setHeader('Allow', 'GET');
          throw new QuizError('Use GET to check the local model.', 405);
        }
        return json(res, 200, await ollama.status());
      }
      if (pathname === '/api/quiz') {
        if (req.method !== 'POST') {
          res.setHeader('Allow', 'POST');
          throw new QuizError('Use POST to create recall cards.', 405);
        }
        if (req.headers['content-type']?.split(';')[0].trim().toLowerCase() !== 'application/json') {
          throw new QuizError('Send your notes as application/json.', 415);
        }
        if (Number(req.headers['content-length'] || 0) > MAX_BODY_BYTES) {
          req.resume();
          throw new QuizError('That request is too large. Keep notes to 8,000 characters or fewer.', 413);
        }
        const input = validateInput(await readBody(req));
        if (generating) throw new QuizError('Recall cards are already being created. Wait a moment, then try again.', 429);
        generating = true;
        const controller = new AbortController();
        const onDisconnect = () => {
          if (!res.writableEnded) controller.abort();
        };
        res.once('close', onDisconnect);
        try {
          return json(res, 200, await ollama.generate(input, { signal: controller.signal }));
        } finally {
          res.removeListener('close', onDisconnect);
          generating = false;
        }
      }
      const file = STATIC_FILES.get(pathname);
      if (!file) throw new QuizError('Page not found.', 404);
      if (req.method !== 'GET' && req.method !== 'HEAD') {
        res.setHeader('Allow', 'GET, HEAD');
        throw new QuizError('Use GET to open this page.', 405);
      }
      let contents;
      try {
        contents = await readFile(join(staticDir, file[0]));
      } catch (error) {
        if (error.code === 'ENOENT') throw new QuizError('Page not found.', 404);
        throw error;
      }
      res.writeHead(200, { 'Content-Type': file[1], 'Content-Length': contents.length });
      res.end(req.method === 'HEAD' ? undefined : contents);
    } catch (error) {
      if (!res.headersSent && !res.destroyed) {
        json(res, error instanceof QuizError ? error.status : 500, {
          error: error instanceof QuizError ? error.message : 'Something went wrong locally. Please try again.',
        });
      }
    }
  };
}

export async function startServer({ host = '127.0.0.1', port = 4173, ...options } = {}) {
  if (!LOOPBACK_HOSTS.has(host)) throw new Error('HOST must be 127.0.0.1, localhost, or ::1. Public network access is disabled.');
  if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error('PORT must be an integer from 0 to 65535.');
  const server = http.createServer(createApp(options));
  server.headersTimeout = 10_000;
  server.requestTimeout = 15_000;
  server.keepAliveTimeout = 5_000;
  await new Promise((resolveListen, reject) => {
    server.once('error', reject);
    server.listen(port, host, () => {
      server.removeListener('error', reject);
      resolveListen();
    });
  });
  return server;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const host = process.env.HOST || '127.0.0.1';
    const server = await startServer({
      host,
      port: Number(process.env.PORT || 4173),
      model: process.env.NOTE_SPROUT_MODEL || DEFAULT_MODEL,
    });
    const address = server.address();
    console.log(`Note Sprout is ready at http://${host === '::1' ? '[::1]' : host}:${address.port}`);
    console.log('Notes stay in this app and your local Ollama process. Press Ctrl+C to stop.');
    for (const signal of ['SIGINT', 'SIGTERM']) {
      process.once(signal, () => {
        server.close(() => process.exit(0));
        server.closeAllConnections();
      });
    }
  } catch (error) {
    console.error(error.code === 'EADDRINUSE' ? 'The selected port is busy. Stop the other app or choose another PORT.' : error.message);
    process.exitCode = 1;
  }
}
