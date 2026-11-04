# AI Email Assistant

**One-line pitch:** Paste a thread, get the gist, next steps and a draft reply.

## Description (about 120 words)
Paste an email or a whole thread and the assistant summarises it, shows who said what, and picks out questions, meeting requests, deadlines and attachments. It suggests concrete next actions and writes an editable draft reply in a friendly, formal or short tone, signed with your name. Quoted replies are ignored. Demo mode is offline and rule-based; live mode uses your own OpenAI-compatible model.

## Tech used
- Plain HTML, CSS and ES modules
- Rule-based thread parsing, intent detection and drafting
- Node test runner and Playwright (Python) end-to-end smoke

## What you can demo in 30 seconds
1. Click "Load sample". 2. Click "Analyse and draft". 3. See the questions, the meeting request and the draft reply, then copy it.

## Resume bullets
- Built an email assistant that parses threads, detects intents and drafts tone-aware replies, with an offline mode and an optional live model.
- Wrote 67 unit tests covering thread parsing, intent detection, deadlines, action suggestions and drafting, plus a Playwright smoke test.
- Designed the thread parser to ignore quoted replies and signatures so summaries reflect only the newest message.

## LinkedIn post draft
Built an AI email assistant: paste a thread and get a summary, the questions and deadlines inside it, next steps and a draft reply in the tone you pick. Works offline; optional live mode with your own model. 67 unit tests and a Playwright smoke test. Repo link in the comments.
