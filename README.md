# NoteSprout

A small study corner built for a friend studying computer science. Paste revision notes, recall an idea, reveal the original passage, and decide what needs another look.

Built from scratch starting October 2, 2026, for the Hacktoberfest Weekend Challenge: **Build for a Friend**. The friend this was built for finds it difficult to revise topics he has already studied. NoteSprout is intended to give him a small, repeatable way to revisit those topics using his own notes. He has not yet tested the app; no endorsement or learning outcomes are claimed.

## Run locally

You need Node.js 22+ and [Ollama](https://ollama.com/download). In a terminal:

```sh
git clone https://github.com/kudala-bharani/note-sprout.git
cd note-sprout
npm run ai
```

If the Ollama desktop app is already running, you don't need a second server. In another terminal, from this repository:

```sh
npm run model:pull
npm start
```

Open **http://127.0.0.1:4173**. There are no npm dependencies to install. The default model download is approximately 2.5 GB; allow additional memory for inference. Once the runtime and model are installed, card generation uses the local machine and needs no hosted API key.

The launcher uses a project-local `.runtime/ollama/ollama` binary if present, otherwise the installed `ollama` command. The development machine's downloaded runtime and models are gitignored and are not distributed with the code. The helper starts Ollama with cloud features disabled and a loopback-only address.

If Ollama isn't available yet, **Try sample study cards** demonstrates the interaction with a clearly labeled, handwritten example. This is not AI generation and isn't used as a fallback when generation fails.

## What it does

- Turns a bounded set of pasted notes into three short recall prompts.
- Allows an optional written response, kept only in the browser tab and never sent to the model.
- Reveals an exact original passage, then asks the student to select **Got it** or **Practice again**.
- Shows self-marked confidence, not a test score, and allows another pass over practice cards.
- Rejects malformed output, invented quotations, and model-written answer or grading fields.
- Keeps notes and responses in memory, with no accounts, analytics, browser persistence, or server-side note files.
- Exports prompts and original passages as Markdown, without the student's written responses.

An exact quotation is **not a proof that a question is well written**. The model can still misunderstand a passage or ask about something the passage doesn't support. Check prompts and notes against your course material. The app neither grades responses nor generates an answer key.

**Why self-check cards?** An earlier multiple-choice prototype produced ambiguous options and a misleading answer. Those live tests led to removing generated answers and automated grading entirely. See the verification record for the history and current checks.

Each session has three cards. Generation has a 90-second deadline; shorten your notes if your machine times out. There is no silent sample fallback.

## Why open weights?

The actual recall prompts are produced by **Qwen3 4B through Ollama**, with thinking disabled, not by a hosted proprietary API or a fixed question list. Its Apache-2.0 model weights can run locally. This lets a student keep private revision notes on their machine and change the local model without an API subscription. Local inference still uses disk space, memory, time, and electricity.

The app talks only to Ollama on the loopback interface. It doesn't pull models automatically. Keep Ollama local and use a local model, not a cloud model. This prototype isn't designed for public hosting: don't expose its port or Ollama's port to the internet.

## Development

```sh
npm test
npm run check
```

The unit and HTTP tests use controlled model responses. They do not substitute for a real-model check. See [verification notes](docs/VERIFICATION.md) for exactly what was exercised.

## Credits and transparency

- [Ollama](https://github.com/ollama/ollama): local model runtime, under its own license.
- [Qwen3](https://github.com/QwenLM/Qwen3) / [the 4B Ollama model](https://ollama.com/library/qwen3:4b): open-weight model, Apache-2.0. Model files are not included in this repository.
- Original application code and sample study material were developed with **OpenAI Codex assistance**. Bharani supplied the project direction and intended recipient. Do not describe this as unaided work or as tested by the intended recipient until he has tried it.
- The code is MIT-licensed; external runtime/model licenses remain separate.
