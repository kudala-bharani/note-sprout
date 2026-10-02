# NoteSprout

A small study corner for Narasimha, a friend studying computer science. Paste revision notes, make a short quiz, and check each explanation against an excerpt from those notes.

Built from scratch starting October 2, 2026, for the Hacktoberfest Weekend Challenge: **Build for a Friend**. The intended recipient and subject were supplied by Bharani. Recipient testing and feedback have not yet happened; no endorsement or learning outcomes are claimed.

## Run locally

You need Node.js 22+ and [Ollama](https://ollama.com/download). In a terminal:

```sh
npm run ai
```

If the Ollama desktop app is already running, you don't need a second server. In another terminal, from this repository:

```sh
npm run model:pull
npm start
```

Open **http://127.0.0.1:4173**. There are no npm dependencies to install. The default model download is approximately 2.5 GB; allow additional memory for inference. Once the runtime and model are installed, quiz generation uses the local machine and needs no hosted API key.

The launcher uses a project-local `.runtime/ollama/ollama` binary if present, otherwise the installed `ollama` command. The development machine's downloaded runtime and models are gitignored and are not distributed with the code. The helper starts Ollama with cloud features disabled and a loopback-only address.

If Ollama isn't available yet, **Try a sample quiz** demonstrates the interaction with a clearly labeled, handwritten example. This is not AI generation and isn't used as a fallback when generation fails.

## What it does

- Turns a bounded set of pasted notes into three or five multiple-choice questions.
- Reveals the answer, an explanation, and a supporting quotation after an attempt.
- Checks model output structure and verifies that each evidence excerpt occurs in the submitted notes.
- Keeps notes and quiz answers in memory, with no accounts, analytics, browser persistence, or server-side note files.
- Lets the student download their quiz for revision.

An exact quotation is **not a proof that an answer is correct**. The model can misunderstand a passage or write a poor question. Check the explanations against your course material; don't use this as an authoritative marking tool.

**Prototype limitation:** live testing found ambiguous answer choices even with the stronger model. Generated quizzes need human review; the included handwritten sample is more predictable. See the verification record for failures as well as successful checks.

Start with three questions on a low-memory computer. Five questions can hit the 90-second generation deadline; if that happens, choose three or shorten the notes. There is no silent sample fallback.

## Why open weights?

The actual quiz is produced by **Qwen3 4B through Ollama**, with thinking disabled, not by a hosted proprietary API or a fixed question list. Its Apache-2.0 model weights can run locally. This lets a student keep private revision notes on their machine and change the local model without an API subscription. Local inference still uses disk space, memory, time, and electricity.

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
- Original application code and sample study material were developed with **OpenAI Codex assistance**. Bharani supplied the project direction and intended recipient. Do not describe this as unaided work or as tested by Narasimha until he has tried it.
- The code is MIT-licensed; external runtime/model licenses remain separate.

## Challenge status

This is a local project, **not yet a submitted contest entry**. Before submission: have Narasimha try it, review the implementation and write-up, provide an honest deployed/video demo and code link, confirm eligibility and rules, and disclose AI assistance on DEV. See [the draft](docs/DEV_DRAFT.md). The entry deadline is October 5, 2026 at 2:59 AM EDT. Any commits after the deadline must be identified here if the project is submitted.
