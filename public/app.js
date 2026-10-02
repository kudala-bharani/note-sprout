import { SAMPLE_NOTES, DEMO_QUIZ } from './demo.js';

const $ = (id) => document.getElementById(id);
const notes = $('notes');
const content = $('quiz-content');
const state = { quiz: null, mode: null, index: 0, selected: null, checked: false, answers: [], complete: false, loading: false, controller: null, request: 0 };
const letters = ['A', 'B', 'C', 'D'];

function node(tag, props = {}, ...children) {
  const element = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (key === 'className') element.className = value;
    else if (key === 'onClick') element.addEventListener('click', value);
    else if (key === 'text') element.textContent = value;
    else if (key === 'disabled') element.disabled = value;
    else element.setAttribute(key, String(value));
  }
  for (const child of children) if (child != null) element.append(typeof child === 'string' ? document.createTextNode(child) : child);
  return element;
}

function announce(message) { $('announcement').textContent = message; }
function message(text = '', neutral = false) {
  $('form-message').textContent = text;
  $('form-message').hidden = !text;
  $('form-message').classList.toggle('is-neutral', neutral);
}
function updateNotes() {
  $('note-count').textContent = `${notes.value.length.toLocaleString()} / 8,000 characters`;
  $('clear-notes').disabled = !notes.value && !state.quiz && !state.loading;
  notes.removeAttribute('aria-invalid');
}
function setBusy(busy) {
  state.loading = busy;
  notes.readOnly = busy;
  $('generate').disabled = busy;
  $('load-sample').disabled = busy;
  $('count').disabled = busy;
  document.querySelector('.quiz-panel').setAttribute('aria-busy', String(busy));
  $('export-quiz').hidden = busy || !state.quiz;
  updateNotes();
}
function focusPractice() {
  const target = content.querySelector('[data-focus]');
  if (target) target.focus({ preventScroll: true });
  if (window.matchMedia('(max-width: 740px)').matches) document.querySelector('.quiz-panel').scrollIntoView({ behavior: 'auto', block: 'start' });
}

function illustration() {
  const holder = node('div', { 'aria-hidden': 'true' });
  holder.append($('notebook-art').content.cloneNode(true));
  return holder;
}
function renderEmpty() {
  content.replaceChildren(node('div', { className: 'empty-state' }, illustration(),
    node('h3', { text: 'Good things grow with practice.' }),
    node('p', { className: 'empty-copy', text: 'Your notes become a few thoughtful questions. Take them one at a time, at your own pace.' }),
    node('ol', { className: 'study-steps' }, ...['Add notes', 'Take a quiz', 'Let it sink in'].map((text, index) => node('li', {}, node('span', { text: index + 1 }), text))),
    node('button', { type: 'button', className: 'button button-secondary sample-button', onClick: startDemo, text: 'Try a sample quiz ↗' }),
    node('p', { className: 'sample-label', text: '3 handwritten CS questions. No AI required.' })
  ));
  $('export-quiz').hidden = true;
}
function origin() {
  return node('div', { className: `quiz-origin${state.mode === 'sample' ? ' is-sample' : ''}`, text: state.mode === 'sample' ? 'Sample quiz — not AI-generated' : `Local AI · ${state.quiz.model || 'Ollama'}` });
}
function warning() { return node('p', { className: 'ai-warning', text: state.mode === 'sample' ? 'Handwritten practice using the CS sample notes.' : 'AI can make mistakes. Check against your notes.' }); }
function startQuiz(quiz, mode) {
  Object.assign(state, { quiz, mode, index: 0, selected: null, checked: false, answers: [], complete: false });
  renderQuiz();
  updateNotes();
  focusPractice();
}
function startDemo() {
  message();
  startQuiz(DEMO_QUIZ, 'sample');
  announce('Sample quiz ready. Three handwritten questions, not AI-generated. Your own notes have not changed.');
}
function renderQuiz() {
  if (!state.quiz) return renderEmpty();
  if (state.complete) return renderResults();
  const question = state.quiz.questions[state.index];
  const heading = node('legend', { className: 'question-title', text: question.question, tabindex: '-1', 'data-focus': '', id: 'current-question' });
  const nextButton = node('button', { type: 'button', className: 'button button-primary', disabled: !state.checked && state.selected === null, text: state.checked ? (state.index === state.quiz.questions.length - 1 ? 'See my results →' : 'Next question →') : 'Check answer', onClick: state.checked ? nextQuestion : checkAnswer });
  const options = node('div', { className: 'answer-list' });
  question.options.forEach((option, index) => {
    const correct = state.checked && index === question.answerIndex;
    const wrong = state.checked && index === state.selected && index !== question.answerIndex;
    const radio = node('input', { type: 'radio', name: 'answer', value: index, disabled: state.checked });
    radio.checked = state.selected === index;
    radio.addEventListener('change', () => { state.selected = index; nextButton.disabled = false; });
    options.append(node('label', { className: `answer-option${correct ? ' is-correct' : ''}${wrong ? ' is-wrong' : ''}` }, radio, node('span', { className: 'option-letter', 'aria-hidden': 'true', text: letters[index] }), node('span', { className: 'option-copy', text: option }), correct || wrong ? node('span', { className: 'option-result', text: correct ? 'Correct' : 'Your answer' }) : null));
  });
  const progress = node('progress', { className: 'quiz-progress', max: state.quiz.questions.length, value: state.index + (state.checked ? 1 : 0), 'aria-label': 'Questions completed' });
  const children = [origin(), node('div', { className: 'quiz-progress-heading' }, node('strong', { text: `Question ${state.index + 1} of ${state.quiz.questions.length}` }), node('span', { text: 'A little progress, every time.' })), progress, node('fieldset', { className: 'question-set', 'aria-labelledby': 'current-question' }, heading, options)];
  if (state.checked) {
    const correct = state.selected === question.answerIndex;
    children.push(node('div', { className: 'answer-feedback', tabindex: '-1', id: 'answer-feedback' },
      node('h4', { className: `feedback-title${correct ? '' : ' needs-practice'}`, text: correct ? 'That’s right. It’s taking root.' : 'Not quite — here’s the idea.' }),
      node('p', { text: question.explanation }),
      node('span', { className: 'evidence-label', text: state.mode === 'sample' ? 'FROM THE SAMPLE NOTES' : 'FROM THE NOTES USED FOR THIS QUIZ' }),
      node('blockquote', { text: question.evidence })
    ));
  }
  children.push(node('div', { className: 'quiz-actions' }, node('p', { text: state.checked ? 'Understanding beats guessing.' : 'No rush. Think it through.' }), nextButton), warning());
  content.replaceChildren(...children);
  $('export-quiz').hidden = false;
}
function checkAnswer() {
  if (state.selected === null || state.checked) return;
  state.checked = true;
  state.answers[state.index] = state.selected;
  renderQuiz();
  const correct = state.selected === state.quiz.questions[state.index].answerIndex;
  announce(correct ? 'Correct answer. Read the explanation below.' : 'Not quite. The correct answer and explanation are below.');
  $('answer-feedback').focus({ preventScroll: true });
}
function nextQuestion() {
  if (state.index + 1 === state.quiz.questions.length) {
    state.complete = true;
    renderResults();
  } else {
    state.index++;
    state.selected = null;
    state.checked = false;
    renderQuiz();
  }
  focusPractice();
}
function renderResults() {
  const total = state.quiz.questions.length;
  const missed = state.quiz.questions.filter((question, index) => state.answers[index] !== question.answerIndex);
  const score = total - missed.length;
  const actions = node('div', { className: 'result-actions' });
  if (missed.length) actions.append(node('button', { type: 'button', className: 'button button-primary', text: `Retry missed (${missed.length})`, onClick: () => startQuiz({ ...state.quiz, title: `${state.quiz.title} — a second look`, questions: missed }, state.mode) }));
  actions.append(node('button', { type: 'button', className: `button ${missed.length ? 'button-plain' : 'button-primary'}`, text: 'Start over', onClick: () => { Object.assign(state, { quiz: null, complete: false, answers: [] }); renderEmpty(); updateNotes(); notes.focus(); } }));
  content.replaceChildren(origin(), node('div', { className: 'results-state' },
    node('div', { className: 'score-circle', 'aria-label': `${score} out of ${total} correct` }, node('div', {}, String(score), node('span', { text: `/ ${total}` }))),
    node('h3', { text: missed.length ? 'A little stronger than before.' : 'Look at what’s taking root.', tabindex: '-1', 'data-focus': '' }),
    node('p', { text: missed.length ? 'Every answer showed you something. Give the tricky ones another try — that’s where the learning happens.' : 'You’ve given these ideas a good bit of practice. Take a breath, then come back to them another day.' }),
    actions
  ), warning());
  announce(`Practice complete. ${score} out of ${total} correct.`);
}
function renderLoading() {
  const sprout = node('div', { className: 'loading-sprout', 'aria-hidden': 'true' });
  sprout.append(document.querySelector('.brand-mark svg').cloneNode(true));
  content.replaceChildren(node('div', { className: 'loading-state' }, sprout,
    node('h3', { text: 'Making room for a little growth.', tabindex: '-1', 'data-focus': '' }),
    node('p', { text: 'Your local model is reading your notes and making a few questions. This can take a minute or two, especially the first time.' }),
    node('div', { className: 'loading-dots', 'aria-hidden': 'true' }, node('span'), node('span'), node('span')),
    node('button', { type: 'button', className: 'text-button', text: 'Cancel generation', onClick: cancelGeneration })
  ));
  announce('Generating your quiz on this computer. This can take a minute or two.');
}
function cancelGeneration() {
  state.request++;
  state.controller?.abort();
  state.controller = null;
  setBusy(false);
  renderQuiz();
  message('Generation cancelled. Your notes are still here.', true);
  $('generate').focus();
}
function validQuiz(quiz) {
  const hasText = (value) => typeof value === 'string' && value.trim().length > 0;
  return quiz && hasText(quiz.title) && (quiz.model === undefined || hasText(quiz.model)) && Array.isArray(quiz.questions) && quiz.questions.length > 0 && quiz.questions.length <= 5 && quiz.questions.every((q) => q && hasText(q.question) && Array.isArray(q.options) && q.options.length === 4 && q.options.every(hasText) && Number.isInteger(q.answerIndex) && q.answerIndex >= 0 && q.answerIndex < 4 && hasText(q.explanation) && hasText(q.evidence));
}
async function generateQuiz(event) {
  event.preventDefault();
  if (state.loading) return;
  const text = notes.value.trim();
  if (text.length < 80 || text.length > 8000) {
    message('Add between 80 and 8,000 characters of notes so there’s enough to practice. You can also load the CS sample.');
    notes.setAttribute('aria-invalid', 'true');
    notes.focus();
    return;
  }
  message();
  const request = ++state.request;
  const controller = new AbortController();
  state.controller = controller;
  let timedOut = false;
  const timeout = window.setTimeout(() => { timedOut = true; controller.abort(); }, 120000);
  setBusy(true);
  renderLoading();
  focusPractice();
  try {
    const response = await fetch('/api/quiz', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ notes: text, count: Number($('count').value) }), signal: controller.signal });
    let data;
    try { data = await response.json(); } catch { throw new Error('The local server sent an unreadable response. Please try again.'); }
    if (request !== state.request) return;
    if (!response.ok) throw new Error(typeof data.error === 'string' ? data.error : 'The local model couldn’t make this quiz. Check the connection and try again.');
    if (!validQuiz(data)) throw new Error('The model returned an incomplete quiz. Your notes are safe — please try again.');
    setBusy(false);
    startQuiz(data, 'ai');
    announce(`Your local AI quiz is ready. ${data.questions.length} questions.`);
  } catch (error) {
    if (request !== state.request) return;
    setBusy(false);
    renderQuiz();
    message(timedOut ? 'The local model took longer than two minutes. Your notes are still here. Try fewer questions or a shorter section of notes.' : error.name === 'AbortError' ? 'Generation cancelled. Your notes are still here.' : error instanceof TypeError ? 'Couldn’t reach the local server. Make sure NoteSprout is running, then try again. Your notes are still here.' : error.message);
    $('form-message').setAttribute('tabindex', '-1');
    $('form-message').focus({ preventScroll: true });
  } finally {
    window.clearTimeout(timeout);
    if (request === state.request) state.controller = null;
  }
}

async function checkModel() {
  $('check-model').disabled = true;
  $('model-status').textContent = 'Checking your local model…';
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 10000);
  try {
    const response = await fetch('/api/status', { signal: controller.signal });
    if (!response.ok) throw new Error('Status unavailable');
    const status = await response.json();
    const ready = status.ready === true;
    $('model-dot').className = `status-dot ${ready ? 'is-ready' : 'is-offline'}`;
    $('model-status').textContent = ready ? `Local model ready · ${status.model || 'Ollama'}` : 'Local model not connected · sample quiz available';
    $('model-message').textContent = typeof status.message === 'string' ? status.message : 'NoteSprout uses Ollama on this computer. No account or API key needed.';
    $('model-setup').open = !ready;
  } catch {
    $('model-dot').className = 'status-dot is-offline';
    $('model-status').textContent = 'Connection unavailable · sample quiz available';
    $('model-message').textContent = 'Make sure the NoteSprout server and Ollama are running on this computer, then check the connection again.';
    $('model-setup').open = true;
  } finally {
    window.clearTimeout(timeout);
    $('check-model').disabled = false;
  }
}
function exportQuiz() {
  if (!state.quiz) return;
  const escape = (text) => text.replace(/[\\`*_{}\[\]<>#+.!|~]/g, '\\$&');
  const lines = [`# ${escape(state.quiz.title)}`, '', state.mode === 'sample' ? 'Sample quiz — handwritten, not AI-generated.' : `Generated locally with ${escape(state.quiz.model || 'Ollama')}. AI can make mistakes; check against your notes.`, ''];
  state.quiz.questions.forEach((q, index) => {
    lines.push(`## ${index + 1}. ${escape(q.question)}`, '', ...q.options.map((option, optionIndex) => `- ${letters[optionIndex]}. ${escape(option)}`), '', `**Answer: ${letters[q.answerIndex]}. ${escape(q.options[q.answerIndex])}**`, '', escape(q.explanation), '', '**Evidence from the notes:**', ...q.evidence.split('\n').map((line) => `> ${escape(line)}`), '');
  });
  lines.push('---', 'Made with NoteSprout. A little practice. A little progress.');
  const url = URL.createObjectURL(new Blob([lines.join('\n')], { type: 'text/markdown;charset=utf-8' }));
  const link = node('a', { href: url, download: 'notesprout-quiz.md' });
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  announce('Quiz and answers exported as a Markdown file.');
}

notes.addEventListener('input', updateNotes);
$('notes-form').addEventListener('submit', generateQuiz);
$('load-sample').addEventListener('click', () => {
  notes.value = SAMPLE_NOTES;
  updateNotes();
  message('CS sample notes loaded. Generate a new quiz with your local model, or try the handwritten sample on the right.', true);
  notes.focus();
});
$('clear-notes').addEventListener('click', () => {
  state.request++;
  state.controller?.abort();
  Object.assign(state, { quiz: null, mode: null, index: 0, selected: null, checked: false, answers: [], complete: false, controller: null });
  notes.value = '';
  message();
  setBusy(false);
  renderEmpty();
  notes.focus();
  announce('Notes and quiz cleared. Nothing was saved.');
});
$('check-model').addEventListener('click', checkModel);
$('export-quiz').addEventListener('click', exportQuiz);
renderEmpty();
checkModel();
