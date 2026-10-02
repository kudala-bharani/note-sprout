import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { startServer } from '../server.mjs';
import { DEFAULT_MODEL, splitSourcePassages } from '../lib/quiz.mjs';

const notes = 'A stack follows last-in, first-out ordering. A queue follows first-in, first-out ordering. Binary search works on sorted data.';
const quiz = {
  title: 'Study check',
  questions: ['What ordering does a stack follow?', 'What ordering does a queue follow?', 'What data does binary search need?'].map((question, index) => ({
    question,
    options: ['Last-in, first-out', 'First-in, first-out', 'Sorted data', 'Random data'],
    answerIndex: index,
    explanation: 'The answer is stated in the notes.',
    evidence: splitSourcePassages(notes)[index],
  })),
};
const modelQuiz = {
  title: quiz.title,
  questions: quiz.questions.map(({ question, options, answerIndex, explanation, evidence }) => ({
    question, correctAnswer: options[answerIndex],
    distractors: options.filter((_, index) => index !== answerIndex),
    explanation, evidence,
  })),
};

async function launch(t, fetchImpl = async (url) => url.endsWith('/api/tags') ? Response.json({ models: [{ name: DEFAULT_MODEL }] }) : Response.json({ response: JSON.stringify(modelQuiz) })) {
  const server = await startServer({ port: 0, fetchImpl });
  t.after(() => { server.closeAllConnections(); return new Promise((done) => server.close(done)); });
  return { server, url: `http://127.0.0.1:${server.address().port}` };
}

function post(url, body = { notes, count: 3 }, headers = {}) {
  return fetch(`${url}/api/quiz`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body) });
}

function rawRequest(server, { path = '/api/status', host, origin, method = 'GET', body, headers = {} } = {}) {
  return new Promise((resolveResponse, reject) => {
    const req = http.request({
      host: '127.0.0.1', port: server.address().port, path, method,
      headers: { Host: host || `127.0.0.1:${server.address().port}`, ...(origin === undefined ? {} : { Origin: origin }), ...headers },
    }, (res) => {
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => resolveResponse({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks).toString() }));
    });
    req.on('error', reject);
    req.end(body);
  });
}

test('status and generation API return their documented shapes', async (t) => {
  const { url } = await launch(t);
  const status = await fetch(`${url}/api/status`);
  assert.equal(status.status, 200);
  assert.deepEqual(await status.json(), { ready: true, model: DEFAULT_MODEL, message: 'Your local model is ready.' });
  const response = await post(url);
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.title, quiz.title);
  assert.equal(body.model, DEFAULT_MODEL);
  assert.equal(body.questions.length, 3);
  for (let index = 0; index < body.questions.length; index++) {
    const question = body.questions[index];
    assert.equal(question.question, quiz.questions[index].question);
    assert.equal(question.options[question.answerIndex], modelQuiz.questions[index].correctAnswer);
    assert.equal(question.evidence, quiz.questions[index].evidence);
    assert.deepEqual([...question.options].sort(), [...quiz.questions[index].options].sort());
  }
  assert.equal(response.headers.get('access-control-allow-origin'), null);
  assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
  assert.match(response.headers.get('content-security-policy'), /connect-src 'self'/);
  assert.equal(response.headers.get('cache-control'), 'no-store');
});

test('invalid input is rejected before the model is called', async (t) => {
  let calls = 0;
  const { server, url } = await launch(t, async () => { calls++; throw new Error('unexpected call'); });
  for (const body of [{ notes: 'short', count: 3 }, { notes, count: 2 }, { notes: 'x'.repeat(8001), count: 3 }]) {
    assert.equal((await post(url, body)).status, 400);
  }
  assert.equal((await post(url, { notes, count: 3 }, { 'Content-Type': 'text/plain' })).status, 415);
  assert.equal((await fetch(`${url}/api/quiz`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{broken' })).status, 400);
  assert.equal((await post(url, { notes: 'x'.repeat(41000), count: 3 })).status, 413);
  assert.equal((await rawRequest(server, {
    path: '/api/quiz', method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Transfer-Encoding': 'chunked' },
    body: JSON.stringify({ notes: 'x'.repeat(41000), count: 3 }),
  })).status, 413);
  assert.equal(calls, 0);
});

test('cross-origin, DNS-rebinding, wrong-port, and cross-site requests are rejected', async (t) => {
  const { server, url } = await launch(t);
  for (const options of [{ host: 'attacker.example' }, { host: '127.0.0.1:1' }, { host: 'localhost:99999' }, { origin: 'https://attacker.example' }, { origin: 'null' }, { headers: { 'Sec-Fetch-Site': 'cross-site' } }]) {
    assert.equal((await rawRequest(server, options)).status, 403);
  }
  assert.equal((await post(url, { notes, count: 3 }, { Origin: url })).status, 200);
});

test('only fixed static files are exposed and API methods are enforced', async (t) => {
  const { server, url } = await launch(t);
  for (const path of ['/server.mjs', '/package.json', '/../server.mjs', '/%2e%2e/server.mjs', '/lib/quiz.mjs', '/.env']) {
    assert.equal((await rawRequest(server, { path })).status, 404);
  }
  assert.equal((await fetch(`${url}/api/quiz`)).status, 405);
  assert.equal((await fetch(`${url}/api/status`, { method: 'POST' })).status, 405);
  assert.equal((await fetch(`${url}/`, { method: 'POST' })).status, 405);
});

test('Ollama failures return a friendly error and never a synthetic quiz', async (t) => {
  const { url } = await launch(t, async () => { throw new Error('secret internal details'); });
  const status = await (await fetch(`${url}/api/status`)).json();
  assert.equal(status.ready, false);
  const response = await post(url);
  assert.equal(response.status, 503);
  const body = await response.json();
  assert.match(body.error, /Cannot reach Ollama/);
  assert.equal(body.questions, undefined);
  assert.ok(!JSON.stringify(body).includes('secret internal details'));
});

test('only one generation runs at a time and a completed request releases the lock', async (t) => {
  let release;
  let entered;
  const started = new Promise((resolveStarted) => { entered = resolveStarted; });
  const blocked = new Promise((resolveBlocked) => { release = resolveBlocked; });
  let calls = 0;
  const { url } = await launch(t, async () => {
    calls++;
    if (calls === 1) { entered(); await blocked; }
    return Response.json({ response: JSON.stringify(modelQuiz) });
  });
  const first = post(url);
  await started;
  assert.equal((await post(url)).status, 429);
  release();
  assert.equal((await first).status, 200);
  assert.equal((await post(url)).status, 200);
});

test('a disconnected browser cancels inference and releases the generation lock', { timeout: 3000 }, async (t) => {
  let entered;
  let cancelled;
  const started = new Promise((resolveStarted) => { entered = resolveStarted; });
  const aborted = new Promise((resolveAborted) => { cancelled = resolveAborted; });
  let first = true;
  const { server, url } = await launch(t, async (_url, { signal }) => {
    if (!first) return Response.json({ response: JSON.stringify(modelQuiz) });
    first = false;
    entered();
    return new Promise((_, reject) => {
      signal.addEventListener('abort', () => {
        cancelled();
        reject(new DOMException('Aborted', 'AbortError'));
      }, { once: true });
    });
  });
  const req = http.request({
    host: '127.0.0.1', port: server.address().port, path: '/api/quiz', method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });
  req.on('error', () => {});
  req.end(JSON.stringify({ notes, count: 3 }));
  await started;
  req.destroy();
  await aborted;
  assert.equal((await post(url)).status, 200);
});

test('the listener refuses public hosts and cloud-tagged model configuration', async () => {
  await assert.rejects(startServer({ host: '0.0.0.0', port: 0 }), /Public network access is disabled/);
  await assert.rejects(startServer({ port: 0, model: 'gpt-oss:120b-cloud' }), /local Ollama model/);
});
