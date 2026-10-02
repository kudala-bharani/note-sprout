import test from 'node:test';
import assert from 'node:assert/strict';
import { buildQuizRequest, createOllamaClient, DEFAULT_MODEL, prepareQuiz, splitSourcePassages, validateInput, validateModel, validateQuiz } from '../lib/quiz.mjs';

const notes = 'A stack follows last-in, first-out ordering. A queue follows first-in, first-out ordering. Binary search works on sorted data. A stack adds items using push. A queue removes items using dequeue.';
const questions = [
  { question: 'Which ordering does a stack follow?', options: ['Last-in, first-out', 'First-in, first-out', 'Sorted ordering', 'Random ordering'], answerIndex: 0, explanation: 'The notes describe a stack as last-in, first-out.', evidence: 'A stack follows last-in, first-out ordering.' },
  { question: 'Which ordering does a queue follow?', options: ['Last-in, first-out', 'First-in, first-out', 'Sorted ordering', 'Random ordering'], answerIndex: 1, explanation: 'The notes describe a queue as first-in, first-out.', evidence: 'A queue follows first-in, first-out ordering.' },
  { question: 'What does binary search require?', options: ['Random data', 'A queue', 'Sorted data', 'A stack'], answerIndex: 2, explanation: 'The notes state that binary search works on sorted data.', evidence: 'Binary search works on sorted data.' },
  { question: 'How does a stack add items?', options: ['Dequeue', 'Push', 'Search', 'Sort'], answerIndex: 1, explanation: 'The notes identify push as the stack insertion operation.', evidence: 'A stack adds items using push.' },
  { question: 'How does a queue remove items?', options: ['Push', 'Sort', 'Search', 'Dequeue'], answerIndex: 3, explanation: 'The notes identify dequeue as the queue removal operation.', evidence: 'A queue removes items using dequeue.' },
];
const quiz = (count = 3) => structuredClone({ title: 'CS essentials', questions: questions.slice(0, count) });
const modelQuiz = (count = 3) => ({
  title: 'CS essentials',
  questions: quiz(count).questions.map(({ question, options, answerIndex, explanation, evidence }) => ({
    question, correctAnswer: options[answerIndex],
    distractors: options.filter((_, index) => index !== answerIndex),
    explanation, evidence,
  })),
});

test('input accepts only bounded notes and the supported counts', () => {
  assert.deepEqual(validateInput({ notes: `  ${notes}  `, count: 3 }), { notes, count: 3 });
  for (const input of [null, [], { notes: 5, count: 3 }, { notes: 'short', count: 3 }, { notes: 'x'.repeat(8001), count: 3 }, { notes, count: 4 }, { notes, count: '3' }]) {
    assert.throws(() => validateInput(input));
  }
  assert.equal(validateInput({ notes: 'x'.repeat(8000), count: 5 }).notes.length, 8000);
});

test('only local model identifiers are accepted', () => {
  assert.equal(validateModel(DEFAULT_MODEL), DEFAULT_MODEL);
  for (const model of ['gpt-oss:120b-cloud', 'my-CLOUD-model', 'https://example.com/model', '', 'foo bar', 'a:b:c']) {
    assert.throws(() => validateModel(model));
  }
});

test('request uses a count-specific schema and treats notes as untrusted data', () => {
  const request = buildQuizRequest(notes, 5, DEFAULT_MODEL);
  assert.equal(request.stream, false);
  assert.equal(request.think, false);
  assert.equal(request.options.temperature, 0);
  assert.equal(request.format.properties.questions.minItems, 0);
  assert.equal(request.format.properties.questions.maxItems, 5);
  assert.match(request.system, /untrusted data/);
  assert.ok(request.prompt.includes(JSON.stringify(request.format)));
  assert.match(request.prompt, /format example/);
  const itemSchema = request.format.properties.questions.items;
  assert.deepEqual(itemSchema.properties.evidence.enum, splitSourcePassages(notes));
  assert.equal(itemSchema.properties.explanation.maxLength, 240);
  assert.equal(itemSchema.properties.answerIndex, undefined);
  assert.equal(itemSchema.properties.distractors.minItems, 3);
  assert.equal(itemSchema.properties.distractors.maxItems, 3);
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

test('server-generated answer indices remain correct in every shuffled position', () => {
  for (let position = 0; position < 4; position++) {
    const result = prepareQuiz(modelQuiz(), notes, 3, { randomIndex: (max) => max === position + 1 ? 0 : max - 1 });
    for (let index = 0; index < result.questions.length; index++) {
      const question = result.questions[index];
      assert.equal(question.answerIndex, position);
      assert.equal(question.options[position], modelQuiz().questions[index].correctAnswer);
      assert.equal(new Set(question.options).size, 4);
    }
  }
});

test('internal output rejects repeated choices, combined passages, and long explanations', () => {
  for (const mutate of [
    (value) => { value.questions[0].distractors[0] = value.questions[0].correctAnswer; },
    (value) => { value.questions[0].distractors.pop(); },
    (value) => { value.questions[0].evidence += ` ${value.questions[1].evidence}`; },
    (value) => { value.questions[0].explanation = 'x'.repeat(241); },
  ]) {
    const value = modelQuiz();
    mutate(value);
    assert.throws(() => prepareQuiz(value, notes, 3), { status: 502 });
  }
});

test('valid quizzes are accepted and source quote whitespace is normalized', () => {
  assert.deepEqual(validateQuiz(quiz(), notes, 3), quiz());
  assert.equal(validateQuiz(quiz(5), notes, 5).questions.length, 5);
  const withWhitespace = quiz();
  withWhitespace.questions[0].evidence = 'A stack follows\nlast-in, first-out ordering.';
  assert.equal(validateQuiz(withWhitespace, notes, 3).questions.length, 3);
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
    (value) => { value.questions[0].options[1] = value.questions[0].options[0]; },
    (value) => { value.questions[0].options[0] = ' '; },
    (value) => { value.questions[0].options.push('Extra'); },
    (value) => { value.questions[0].answerIndex = 4; },
    (value) => { value.questions[0].answerIndex = '0'; },
    (value) => { value.questions[0].explanation = ''; },
    (value) => { value.questions[0].question = 'x'.repeat(401); },
    (value) => { value.questions[0].evidence = 'Trees always have exactly four children.'; },
  ];
  for (const mutate of mutations) {
    const value = quiz();
    mutate(value);
    assert.throws(() => validateQuiz(value, notes, 3), { status: 502 });
  }
});

test('client sends notes only to fixed local Ollama and returns a validated quiz', async () => {
  const calls = [];
  const randomIndex = (max) => max - 1;
  const client = createOllamaClient({ randomIndex, fetchImpl: async (url, init) => {
    calls.push({ url, init });
    return Response.json({ response: JSON.stringify(modelQuiz()) });
  } });
  assert.deepEqual(await client.generate({ notes, count: 3 }), { ...prepareQuiz(modelQuiz(), notes, 3, { randomIndex }), model: DEFAULT_MODEL });
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
  const unsupported = modelQuiz();
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
  await assert.rejects(pending, { status: 408, message: 'Quiz generation was cancelled.' });
  assert.equal(modelSignal.aborted, true);
});
