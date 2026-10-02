import test from 'node:test';
import assert from 'node:assert/strict';
import { buildQuizRequest, createOllamaClient, DEFAULT_MODEL, splitSourcePassages, validateInput, validateModel, validateQuiz } from '../lib/quiz.mjs';

const notes = 'A stack follows last-in, first-out ordering. A queue follows first-in, first-out ordering. Binary search works on sorted data. A stack adds items using push. A queue removes items using dequeue.';
const questions = [
  { question: 'Which ordering does a stack follow?', evidence: 'A stack follows last-in, first-out ordering.' },
  { question: 'Which ordering does a queue follow?', evidence: 'A queue follows first-in, first-out ordering.' },
  { question: 'What does binary search require?', evidence: 'Binary search works on sorted data.' },
];
const quiz = () => structuredClone({ title: 'CS essentials', questions });

test('input accepts bounded notes and exactly 3 recall cards', () => {
  assert.deepEqual(validateInput({ notes: `  ${notes}  `, count: 3 }), { notes, count: 3 });
  for (const input of [null, [], { notes: 5, count: 3 }, { notes: 'short', count: 3 }, { notes: 'x'.repeat(8001), count: 3 }, { notes, count: 4 }, { notes, count: 5 }, { notes, count: '3' }, { notes }]) {
    assert.throws(() => validateInput(input));
  }
  assert.equal(validateInput({ notes: 'x'.repeat(8000), count: 3 }).notes.length, 8000);
});

test('only local model identifiers are accepted', () => {
  assert.equal(validateModel(DEFAULT_MODEL), DEFAULT_MODEL);
  for (const model of ['gpt-oss:120b-cloud', 'my-CLOUD-model', 'https://example.com/model', '', 'foo bar', 'a:b:c']) {
    assert.throws(() => validateModel(model));
  }
});

test('request schema contains only recall prompts and exact source passages', () => {
  const request = buildQuizRequest(notes, 3, DEFAULT_MODEL);
  assert.equal(request.stream, false);
  assert.equal(request.think, false);
  assert.equal(request.options.temperature, 0);
  assert.equal(request.options.num_predict, 1200);
  assert.equal(request.options.num_ctx, 8192);
  assert.equal(request.format.properties.questions.minItems, 0);
  assert.equal(request.format.properties.questions.maxItems, 3);
  assert.match(request.system, /untrusted data/);
  assert.ok(request.prompt.includes(JSON.stringify(request.format)));
  assert.match(request.prompt, /format example/);
  const itemSchema = request.format.properties.questions.items;
  assert.deepEqual(itemSchema.properties.evidence.enum, splitSourcePassages(notes));
  assert.equal(itemSchema.properties.question.maxLength, 240);
  assert.deepEqual(itemSchema.required, ['question', 'evidence']);
  assert.deepEqual(Object.keys(itemSchema.properties).sort(), ['evidence', 'question']);
  assert.equal(itemSchema.additionalProperties, false);
  assert.match(request.system, /Do not write answers/);
  assert.throws(() => buildQuizRequest(notes, 5, DEFAULT_MODEL));
});

test('source passages split on sentences and newlines without inventing or overlong quotes', () => {
  assert.deepEqual(splitSourcePassages('First sentence. Second sentence!\nThird fact\nThird fact'), ['First sentence.', 'Second sentence!', 'Third fact']);
  const longNotes = `A short sentence.\n${'A lengthy passage with words '.repeat(80)}\n${'x'.repeat(1300)}\n${'🌱'.repeat(650)}`;
  const passages = splitSourcePassages(longNotes);
  assert.ok(passages.length > 6);
  for (const passage of passages) {
    assert.ok(passage.length > 0 && passage.length <= 600);
    assert.ok(longNotes.includes(passage));
    assert.ok(!/^[\uDC00-\uDFFF]|[\uD800-\uDBFF]$/u.test(passage));
  }
  assert.deepEqual(splitSourcePassages('x'.repeat(1300)).map((passage) => passage.length), [600, 100]);
});

test('validated cards contain no model-written answers or grading fields', () => {
  const result = validateQuiz(quiz(), notes);
  assert.deepEqual(result, quiz());
  for (const question of result.questions) {
    assert.deepEqual(Object.keys(question).sort(), ['evidence', 'question']);
  }
});

test('legacy answer, explanation, and grading fields are rejected', () => {
  for (const field of ['correctAnswer', 'distractors', 'options', 'answerIndex', 'explanation', 'grade']) {
    const value = quiz();
    value.questions[0][field] = 'not permitted';
    assert.throws(() => validateQuiz(value, notes), { status: 502 });
  }
});

test('source evidence must match one complete passage exactly', () => {
  for (const evidence of [
    'A stack follows\nlast-in, first-out ordering.',
    `${questions[0].evidence} ${questions[1].evidence}`,
    questions[0].evidence.toUpperCase(),
    'last-in, first-out',
  ]) {
    const value = quiz();
    value.questions[0].evidence = evidence;
    assert.throws(() => validateQuiz(value, notes), { status: 502 });
  }
});

test('a model refusal returns an actionable insufficient-notes error', () => {
  assert.throws(() => validateQuiz({ title: 'More detail needed', questions: [] }, notes, 3), {
    status: 422,
    message: /enough distinct facts/,
  });
});

test('malformed, duplicate, empty, and ungrounded model output is rejected', () => {
  const mutations = [
    (value) => { value.title = ''; },
    (value) => { value.questions.pop(); },
    (value) => { value.questions[1].question = value.questions[0].question.toUpperCase(); },
    (value) => { value.questions.push(questions[0]); },
    (value) => { value.questions[0].question = ' '; },
    (value) => { value.questions[0].question = 'x'.repeat(241); },
    (value) => { value.questions[0].evidence = ''; },
    (value) => { value.questions[0].evidence = 'Trees always have exactly four children.'; },
  ];
  for (const mutate of mutations) {
    const value = quiz();
    mutate(value);
    assert.throws(() => validateQuiz(value, notes, 3), { status: 502 });
  }
});

test('client sends notes only to fixed local Ollama and returns three recall cards', async () => {
  const calls = [];
  const client = createOllamaClient({ fetchImpl: async (url, init) => {
    calls.push({ url, init });
    return Response.json({ response: JSON.stringify(quiz()) });
  } });
  assert.deepEqual(await client.generate({ notes, count: 3 }), { ...quiz(), model: DEFAULT_MODEL });
  assert.equal(calls[0].url, 'http://127.0.0.1:11434/api/generate');
  assert.equal(calls[0].init.redirect, 'error');
  assert.equal(JSON.parse(calls[0].init.body).model, DEFAULT_MODEL);
});

test('status distinguishes installed and missing models and offline Ollama', async () => {
  for (const [models, ready] of [[[{ name: DEFAULT_MODEL }], true], [[], false]]) {
    const client = createOllamaClient({ fetchImpl: async () => Response.json({ models }) });
    assert.equal((await client.status()).ready, ready);
  }
  const offline = createOllamaClient({ fetchImpl: async () => { throw new TypeError('socket failure'); } });
  assert.equal((await offline.status()).ready, false);
  await assert.rejects(offline.generate({ notes, count: 3 }), { status: 503 });
});

test('missing models, malformed JSON, ungrounded output, and huge replies never get a fallback quiz', async () => {
  const unsupported = quiz();
  unsupported.questions[0].evidence = 'This is not in the notes';
  for (const [response, status] of [
    [new Response('missing', { status: 404 }), 503],
    [new Response('failure', { status: 500 }), 502],
    [new Response('not json'), 502],
    [Response.json({ response: 'not json' }), 502],
    [Response.json({ response: JSON.stringify(unsupported) }), 502],
    [new Response('x'.repeat(128_001)), 502],
  ]) {
    const client = createOllamaClient({ fetchImpl: async () => response });
    await assert.rejects(client.generate({ notes, count: 3 }), { status });
  }
});

test('timeouts produce an actionable error and timeout bounds are enforced', async () => {
  const client = createOllamaClient({ timeoutMs: 10, fetchImpl: async (_url, { signal }) => new Promise((_, reject) => {
    const keeper = setTimeout(() => reject(new Error('test stalled')), 1000);
    signal.addEventListener('abort', () => { clearTimeout(keeper); reject(new DOMException('Aborted', 'AbortError')); }, { once: true });
  }) });
  await assert.rejects(client.generate({ notes, count: 3 }), { status: 504 });
  assert.throws(() => createOllamaClient({ timeoutMs: 90_001 }));
});

test('caller cancellation propagates to the local model request', async () => {
  const controller = new AbortController();
  let modelSignal;
  const client = createOllamaClient({ fetchImpl: async (_url, { signal }) => {
    modelSignal = signal;
    return new Promise((_, reject) => {
      signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true });
    });
  } });
  const pending = client.generate({ notes, count: 3 }, { signal: controller.signal });
  controller.abort();
  await assert.rejects(pending, { status: 408, message: 'Recall card generation was cancelled.' });
  assert.equal(modelSignal.aborted, true);
});
