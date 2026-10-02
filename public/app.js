import { SAMPLE_NOTES, DEMO_QUIZ } from './demo.js';

const $ = (id) => document.getElementById(id);
const notes = $('notes');
const content = $('quiz-content');
const state = { deck: null, mode: null, index: 0, revealed: false, recalls: [], ratings: [], complete: false, loading: false, controller: null, request: 0 };

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

function announce(text) { $('announcement').textContent = text; }
function message(text = '', neutral = false) {
  $('form-message').textContent = text;
  $('form-message').hidden = !text;
  $('form-message').classList.toggle('is-neutral', neutral);
}
function updateNotes() {
  $('note-count').textContent = `${notes.value.length.toLocaleString()} / 8,000 characters`;
  $('clear-notes').disabled = !notes.value && !state.deck && !state.loading;
  notes.removeAttribute('aria-invalid');
}
function setBusy(busy) {
  state.loading = busy;
  notes.readOnly = busy;
  $('generate').disabled = busy;
  $('load-sample').disabled = busy;
  document.querySelector('.quiz-panel').setAttribute('aria-busy', String(busy));
  $('export-quiz').hidden = busy || !state.deck;
  updateNotes();
}
function focusPractice() {
  content.querySelector('[data-focus]')?.focus({ preventScroll: true });
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
    node('p', { className: 'empty-copy', text: 'Three prompts for a little active recall. Think it through, reveal the original passage, and decide what needs another look.' }),
    node('ol', { className: 'study-steps' }, ...['Recall', 'Reveal', 'Reflect'].map((text, index) => node('li', {}, node('span', { text: index + 1 }), text))),
    node('button', { type: 'button', className: 'button button-secondary sample-button', onClick: startDemo, text: 'Try sample study cards ↗' }),
    node('p', { className: 'sample-label', text: '3 handwritten CS prompts. No AI required.' })
  ));
  $('export-quiz').hidden = true;
}
function origin() {
  return node('div', { className: `quiz-origin${state.mode === 'sample' ? ' is-sample' : ''}`, text: state.mode === 'sample' ? 'Sample cards — not AI-generated' : `Local AI prompts · ${state.deck.model || 'Ollama'}` });
}
function warning() {
  return node('p', { className: 'ai-warning', text: state.mode === 'sample' ? 'Handwritten prompts. Check your recall against the sample passage. Ratings are your own.' : 'AI prompts may be imperfect; use the original passage to check your recall. Ratings are your own.' });
}
function startCards(deck, mode) {
  Object.assign(state, { deck, mode, index: 0, revealed: false, recalls: [], ratings: [], complete: false });
  renderCard();
  updateNotes();
  focusPractice();
}
function startDemo() {
  message();
  startCards(DEMO_QUIZ, 'sample');
  announce('Sample study cards ready. Three handwritten prompts, not AI-generated. Your own notes have not changed.');
}
function renderCard() {
  if (!state.deck) return renderEmpty();
  if (state.complete) return renderResults();
  const card = state.deck.questions[state.index];
  const recall = node('textarea', { id: 'recall-answer', className: 'recall-answer', rows: '3', maxlength: '2000', autocomplete: 'off', spellcheck: 'false', 'aria-describedby': 'recall-hint', placeholder: 'What comes to mind? A few words are enough.' });
  recall.value = state.recalls[state.index] || '';
  recall.readOnly = state.revealed;
  recall.addEventListener('input', () => { state.recalls[state.index] = recall.value; });
  const children = [origin(),
    node('div', { className: 'quiz-progress-heading' }, node('strong', { text: `Card ${state.index + 1} of ${state.deck.questions.length}` }), node('span', { text: 'Recall, not a test.' })),
    node('progress', { className: 'quiz-progress', max: state.deck.questions.length, value: state.index, 'aria-label': 'Cards reflected on' }),
    node('h3', { className: 'question-title', text: card.question, tabindex: '-1', 'data-focus': '', id: 'current-question' }),
    node('label', { className: 'recall-label', for: 'recall-answer', text: 'Write your answer (optional)' }), recall,
    node('p', { className: 'recall-hint', id: 'recall-hint', text: state.revealed ? 'Your recall stays here for comparison. Nothing is sent or graded.' : 'Think it through first. This stays in this tab and is never graded.' })
  ];
  if (state.revealed) {
    children.push(node('section', { className: 'answer-feedback source-reveal', tabindex: '-1', id: 'source-passage', 'aria-labelledby': 'source-title' },
      node('h4', { className: 'feedback-title', id: 'source-title', text: 'Check against the original passage.' }),
      node('span', { className: 'evidence-label', text: state.mode === 'sample' ? 'EXACT PASSAGE FROM THE SAMPLE NOTES' : 'EXACT PASSAGE FROM THE NOTES USED FOR THESE CARDS' }),
      node('blockquote', { text: card.evidence })
    ));
    children.push(node('fieldset', { className: 'self-assessment' },
      node('legend', { text: 'How did your recall feel?' }),
      node('div', { className: 'assessment-actions' },
        node('button', { type: 'button', className: 'button button-secondary', text: 'Practice again', onClick: () => rateCard('practice') }),
        node('button', { type: 'button', className: 'button button-primary', text: 'Got it', onClick: () => rateCard('confident') })
      ),
      node('p', { className: 'assessment-hint', text: 'Your choice, not an AI judgment.' })
    ));
  } else {
    children.push(node('div', { className: 'quiz-actions' }, node('p', { text: 'No rush. Think it through.' }), node('button', { type: 'button', className: 'button button-primary', text: 'Reveal source', onClick: revealSource })));
  }
  children.push(warning());
  content.replaceChildren(...children);
  $('export-quiz').hidden = false;
}
function revealSource() {
  if (state.revealed) return;
  state.revealed = true;
  renderCard();
  $('source-passage').focus({ preventScroll: true });
  announce('Original passage revealed. Compare it with your recall, then choose Got it or Practice again.');
}
function rateCard(rating) {
  if (!state.revealed || state.complete) return;
  state.ratings[state.index] = rating;
  if (state.index + 1 === state.deck.questions.length) {
    state.complete = true;
    renderResults();
  } else {
    state.index++;
    state.revealed = false;
    renderCard();
    announce(rating === 'confident' ? 'Marked confident. Next card.' : 'Marked for more practice. Next card.');
  }
  focusPractice();
}
function renderResults() {
  const total = state.deck.questions.length;
  const practice = state.deck.questions.filter((card, index) => state.ratings[index] === 'practice');
  const confident = state.ratings.filter((rating) => rating === 'confident').length;
  const actions = node('div', { className: 'result-actions' });
  if (practice.length) actions.append(node('button', { type: 'button', className: 'button button-primary', text: `Revisit practice cards (${practice.length})`, onClick: () => startCards({ ...state.deck, title: `${state.deck.title} — a second look`, questions: practice }, state.mode) }));
  actions.append(node('button', { type: 'button', className: `button ${practice.length ? 'button-plain' : 'button-primary'}`, text: 'Start over', onClick: () => { Object.assign(state, { deck: null, mode: null, complete: false, recalls: [], ratings: [] }); renderEmpty(); updateNotes(); notes.focus(); } }));
  content.replaceChildren(origin(), node('div', { className: 'results-state' },
    node('div', { className: 'score-circle', 'aria-label': `You marked ${confident} of ${total} cards confident` }, node('div', {}, String(confident), node('span', { text: `/ ${total}` }))),
    node('p', { className: 'confidence-label', text: 'Self-marked confident · not a test score' }),
    node('h3', { text: 'A little time, thoughtfully spent.', tabindex: '-1', 'data-focus': '' }),
    node('p', { text: practice.length ? `You marked ${practice.length} ${practice.length === 1 ? 'card' : 'cards'} for another look. Return to the source and give those ideas a little more practice.` : 'You marked every card confident. These are your own reflections, not checked answers. Revisit the ideas another day to see what stays.' }),
    actions
  ), warning());
  announce(`Practice complete. You marked ${confident} of ${total} cards confident. This is your self-assessment, not an automatically graded score.`);
}
function renderLoading() {
  const sprout = node('div', { className: 'loading-sprout', 'aria-hidden': 'true' });
  sprout.append(document.querySelector('.brand-mark svg').cloneNode(true));
  content.replaceChildren(node('div', { className: 'loading-state' }, sprout,
    node('h3', { text: 'Making room for a little growth.', tabindex: '-1', 'data-focus': '' }),
    node('p', { text: 'Your local model is reading your notes and creating three recall prompts. This can take a minute or two, especially the first time.' }),
    node('div', { className: 'loading-dots', 'aria-hidden': 'true' }, node('span'), node('span'), node('span')),
    node('button', { type: 'button', className: 'text-button', text: 'Cancel generation', onClick: cancelGeneration })
  ));
  announce('Creating your study cards on this computer. This can take a minute or two.');
}
function cancelGeneration() {
  state.request++;
  state.controller?.abort();
  state.controller = null;
  setBusy(false);
  renderCard();
  message('Generation cancelled. Your notes are still here.', true);
  $('generate').focus();
}
function validDeck(deck, source) {
  const hasText = (value) => typeof value === 'string' && value.trim().length > 0;
  return deck && hasText(deck.title) && (deck.model === undefined || hasText(deck.model)) && Array.isArray(deck.questions) && deck.questions.length === 3 && deck.questions.every((card) => card && hasText(card.question) && hasText(card.evidence) && source.includes(card.evidence));
}
async function generateCards(event) {
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
    const response = await fetch('/api/quiz', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ notes: text, count: 3 }), signal: controller.signal });
    let data;
    try { data = await response.json(); } catch { throw new Error('The local server sent an unreadable response. Please try again.'); }
    if (request !== state.request) return;
    if (!response.ok) throw new Error(typeof data.error === 'string' ? data.error : 'The local model couldn’t create these study cards. Check the connection and try again.');
    if (!validDeck(data, text)) throw new Error('The model returned incomplete cards or passages that don’t match your notes. Your notes are safe — please try again.');
    setBusy(false);
    startCards(data, 'ai');
    announce('Your three local AI study cards are ready. Recall each idea, then reveal its original source passage.');
  } catch (error) {
    if (request !== state.request) return;
    setBusy(false);
    renderCard();
    message(timedOut ? 'The local model took longer than two minutes. Your notes are still here. Try a shorter section of notes.' : error.name === 'AbortError' ? 'Generation cancelled. Your notes are still here.' : error instanceof TypeError ? 'Couldn’t reach the local server. Make sure NoteSprout is running, then try again. Your notes are still here.' : error.message);
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
    $('model-status').textContent = ready ? `Local model ready · ${status.model || 'Ollama'}` : 'Local model not connected · sample cards available';
    $('model-message').textContent = typeof status.message === 'string' ? status.message : 'NoteSprout uses Ollama on this computer. No account or API key needed.';
    $('model-setup').open = !ready;
  } catch {
    $('model-dot').className = 'status-dot is-offline';
    $('model-status').textContent = 'Connection unavailable · sample cards available';
    $('model-message').textContent = 'Make sure the NoteSprout server and Ollama are running on this computer, then check the connection again.';
    $('model-setup').open = true;
  } finally {
    window.clearTimeout(timeout);
    $('check-model').disabled = false;
  }
}
function exportCards() {
  if (!state.deck) return;
  const escape = (text) => text.replace(/[\\`*_{}\[\]<>#+.!|~]/g, '\\$&');
  const lines = [`# ${escape(state.deck.title)}`, '', state.mode === 'sample' ? 'Sample study cards — handwritten, not AI-generated.' : `Recall prompts generated locally with ${escape(state.deck.model || 'Ollama')}.`, '', 'Recall the idea before reading its original passage. These passages are sources, not AI-generated answer keys. Reflect on your own understanding; nothing is automatically graded.', ''];
  if (state.mode !== 'sample') lines.push('AI prompts may be imperfect; use the original passage to check your recall. Ratings are your own.', '');
  state.deck.questions.forEach((card, index) => {
    lines.push(`## Card ${index + 1}: ${escape(card.question)}`, '', '**Original passage from the notes:**', ...card.evidence.split('\n').map((line) => `> ${escape(line)}`), '', 'Self-check: Got it / Practice again', '');
  });
  lines.push('---', 'Made with NoteSprout. A little practice. A little progress.');
  const url = URL.createObjectURL(new Blob([lines.join('\n')], { type: 'text/markdown;charset=utf-8' }));
  const link = node('a', { href: url, download: 'notesprout-study-cards.md' });
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  announce('Study prompts and original passages exported as a Markdown file. Your optional recall text was not included.');
}

notes.addEventListener('input', updateNotes);
$('notes-form').addEventListener('submit', generateCards);
$('load-sample').addEventListener('click', () => {
  notes.value = SAMPLE_NOTES;
  updateNotes();
  message('CS sample notes loaded. Create new prompts with your local model, or try the handwritten sample cards on the right.', true);
  notes.focus();
});
$('clear-notes').addEventListener('click', () => {
  state.request++;
  state.controller?.abort();
  Object.assign(state, { deck: null, mode: null, index: 0, revealed: false, recalls: [], ratings: [], complete: false, controller: null });
  notes.value = '';
  message();
  setBusy(false);
  renderEmpty();
  notes.focus();
  announce('Notes, study cards, and recall text cleared from this tab. Any files you exported are unchanged.');
});
$('check-model').addEventListener('click', checkModel);
$('export-quiz').addEventListener('click', exportCards);
renderEmpty();
checkModel();
