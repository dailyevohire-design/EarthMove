# Collections Assist — lib notes

## PDF library

We use **`pdf-lib`** (v1.17+). Added in the commit that introduced this module.

Rationale:
- Pure JS, no native deps, works in Node serverless (Vercel) and Edge.
- No Chromium / Puppeteer overhead (would blow Vercel function size).
- Simpler footprint than `@react-pdf/renderer` for our text-only documents.

## Golden rule — no LLM

No module under `src/lib/collections/` may import Anthropic, OpenAI, or any
LLM client. All six document templates are pure string rendering from user
input. This is enforced by `src/__tests__/collections/templates.test.ts`.

See `docs/LEGAL_POSTURE.md` for the UPL / self-help legal software doctrine
this module is modeled on.
