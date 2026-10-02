---
title: "NoteSprout: a quiet study corner for a computer-science friend"
published: false
tags: devchallenge, weekendchallenge, hf26challenge
---

**Draft only. Do not submit until the demo, code link, verification, and personal account below have been reviewed. Mark AI assistance using DEV's disclosure control.**

This is a planned submission for the [Hacktoberfest Weekend Challenge: Build for a Friend](https://dev.to/challenges/hacktoberfest-weekend-2026-10-01).

## What I Built

My friend studies computer science. When I asked what he finds difficult, he said revising topics he has already studied. I'm keeping his name private.

I built NoteSprout around that problem. He can paste a short section of his notes and get three recall prompts. For each one, he thinks through an answer, reveals the original passage, and marks it **Got it** or **Practice again**. At the end, he can revisit just the cards he marked for more practice. The idea is to make revisiting a topic a small session rather than another long read-through.

The app does not grade him. He has not tried it yet, so I can describe the problem he reported and the flow I built, but not claim it has improved his revision.

## Demo

[Add a genuine recording of local model generation and the recall-card interaction, or a working deployment. Label the built-in handwritten sample honestly if it is shown.]

## Code

[NoteSprout source code](https://github.com/kudala-bharani/note-sprout)

## How I Built It

The application uses a small Node.js server and plain HTML, CSS, and JavaScript. Ollama runs the open-weight Qwen3 4B model locally. The server asks for three short prompts and constrains each source excerpt to an actual passage from the notes. Written responses stay in the tab; they are not sent to the model.

OpenAI Codex assisted with implementation, tests, and this draft. I remain responsible for reviewing the final project and article. The runtime and model are credited in the README.

All 22 automated unit and HTTP tests passed locally. They check the contract and failure handling, not model accuracy. See the repository's verification record for separate real-model and browser checks.

The first version was a multiple-choice quiz. Live testing exposed an ambiguous option and a question that asked how to solve a problem while its answer merely defined it. Quoting the source did not make those answers correct. I changed the design: no generated answers, no distractors, and no automatic score. The student compares their recall with the original passage and makes the judgment. Prompts can still be imperfect, so this remains a study aid to review rather than an examiner to trust.

## Why Does Open Innovation Matter?

The model can run on the student's own machine. Revision notes don't have to be sent to a hosted AI provider, and there is no per-request API bill. The tradeoff is a model download and local compute cost. Open weights also make it possible to change the model later.

Original excerpts make prompts easier to inspect, not automatically correct. This is a revision aid, not an examiner.
