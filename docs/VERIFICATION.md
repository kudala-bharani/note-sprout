# Verification record

Checked locally on October 2, 2026. Automated checks, real inference, and recipient feedback are separate claims.

## Automated checks

- Node.js 22.23.3: all 22 unit/HTTP tests passed, with no failures or skips.
- `npm run check`: JavaScript syntax checks passed for server, model client, browser modules, and runtime launcher.
- `git diff --check`: passed.
- Tests cover note limits, exact source passages, answer shuffling, malformed/duplicate output, insufficient-note refusal, timeouts, cancellation, single-generation locking, fixed static routes, and same-origin/loopback restrictions.
- These tests use controlled model responses. They do not measure model accuracy.

## Real local model

- Official Ollama 0.35.1, bound to loopback with cloud features disabled.
- Qwen3 4B, Q4_K_M, `think: false`, running on an 8 GB Apple-silicon Mac.
- A three-question quiz was generated through the browser and real local model, exported, and inspected. The questions covered the expansion of LIFO, stack insertion, and binary-search complexity. All three answer keys and supporting passages matched the sample notes.
- Five-question generation completed and exported, but manual inspection found a semantic error: a question asked how hash collisions are handled while its answer only defined a collision. Structural validation did not catch this. The prompt was tightened to distinguish definitions from solutions; this is not a guarantee that such mistakes cannot recur.
- A subsequent five-question run hit the 90-second deadline; the browser displayed a useful error, retained the notes, and allowed a shorter retry. Three questions remain the recommended default on this machine.
- The final three-question retry completed, but its first question contained an ambiguous distractor: "a hash function fails to produce a unique index" can also describe a collision. This confirms that prompt instructions alone do not ensure exactly one semantically correct choice. **Model-generated quizzes remain experimental and require human review; content quality is not cleared for submission as a reliable grading tool.**
- Qwen2.5 1.5B was tried first and rejected as the default after live tests exposed paraphrased evidence, duplicate choices, and wrong numerical answer indices. The app rejected malformed quizzes rather than substituting the handwritten demo. The revised implementation selects evidence from actual passages and computes answer indices itself.
- This small test is not a general accuracy evaluation. The model can still make factual or pedagogical mistakes; source quotation does not prove correctness.

## Browser checks

Using the connected Chromium-based browser:

- Page loads with meaningful content and no app console errors in the inspected log.
- Desktop two-column layout and a narrow single-column layout were inspected. At the narrow size, document scroll width matched the viewport width (341 CSS pixels); no horizontal overflow was observed. The temporary viewport override was reset.
- Empty-note validation, loading, sample loading, correct/incorrect feedback, source quotations, final score (2/3), retrying one missed question, and clearing the quiz were exercised.
- Notes are read-only while generation runs. Cancelling preserved the notes and prior quiz, and a subsequent request started successfully.
- Both handwritten and real-model quizzes downloaded as Markdown; the resulting files were read to confirm answers, evidence, and truthful sample/model labels.
- No physical-phone test, screen-reader audit, or cross-browser matrix has been performed.

## Still required before submission

- Narasimha has not tested the app or supplied feedback. Confirm the actual revision problem and collect an honest trial.
- User review, public repository, demo video/deployment, and DEV submission are not complete.
- The handwritten sample demonstrates the interface; it is never presented as proof of AI inference.

## Environment note

macOS offloaded the source files from the iCloud-synced Documents folder during development, causing file reads and server startup to hang. Individual iCloud download requests restored them. Keep this project downloaded locally when running it; the app cannot run from unavailable source files.
