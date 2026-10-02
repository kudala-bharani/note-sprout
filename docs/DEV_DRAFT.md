---
title: "NoteSprout: a quiet study corner for a computer-science friend"
published: false
tags: devchallenge, weekendchallenge, hf26challenge
---

**Draft only. Do not submit until the demo, code link, verification, and personal account below have been reviewed. Mark AI assistance using DEV's disclosure control.**

This is a planned submission for the [Hacktoberfest Weekend Challenge: Build for a Friend](https://dev.to/challenges/hacktoberfest-weekend-2026-10-01).

## What I Built

NoteSprout is a small notes-to-quiz tool intended for my friend Narasimha, who studies computer science. It lets him attempt a few questions before seeing an explanation and a passage from his own notes.

[Before publishing, describe in your own words the specific revision difficulty Narasimha confirmed. We have not yet asked him for feedback or measured whether it helps.]

## Demo

[Add a genuine recording of local model generation and the quiz interaction, or a working deployment. Label the built-in sample quiz honestly if it is shown.]

## Code

[Add the reviewed repository link.]

## How I Built It

The application uses a small Node.js server and plain HTML, CSS, and JavaScript. Ollama runs the open-weight Qwen3 4B model locally. The server asks for structured quiz output, constrains evidence to real note passages, and constructs the shuffled answer choices itself.

OpenAI Codex assisted with implementation, tests, and this draft. I remain responsible for reviewing the final project and article. The runtime and model are credited in the README.

All 22 automated tests passed locally. I also checked real local generation, the answer/retry flow, and Markdown export in the browser. The smaller model I initially tried produced unreliable answers and source quotes, so the current version uses Qwen3 4B, constrains evidence to actual passages, and computes answer positions in code. This increases the download and local compute requirements. Later tests still produced an ambiguous choice and a definition-versus-solution mistake, and a five-question run timed out. Source grounding does not establish answer correctness: this prototype still needs content-quality improvements and human review before it can be described as a reliable study quiz.

## Why Does Open Innovation Matter?

The model can run on the student's own machine. Revision notes don't have to be sent to a hosted AI provider, and there is no per-request API bill. The tradeoff is a model download and local compute cost. Open weights also make it possible to change the model later.

Evidence excerpts make answers easier to inspect, not automatically correct. This is a revision aid, not an examiner.

## What Narasimha Thought

[Optional: include only actual feedback, with permission. Remove this section if he hasn't tested it.]
