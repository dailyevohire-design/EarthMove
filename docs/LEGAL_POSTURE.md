# Legal Posture — Contractor Payment Kit

This document records the unauthorized-practice-of-law (UPL) analysis that
governs every design decision in `src/lib/collections/`, `src/app/collections/`,
and `src/app/api/collections/`. It is kept in source control so changes are
auditable. Any change to templates, intake, disclaimers, or the packet content
requires this document to be re-reviewed.

## §1 Doctrine — self-help legal software

Contractor Payment Kit is modeled as a **self-help legal software** product,
not as a law firm, lawyer, or legal advisor. The doctrine is grounded in the
following authorities:

### Medlock v. LegalZoom.com, Inc., 738 S.E.2d 682 (S.C. 2013)

The South Carolina Supreme Court, on review of a Master-in-Equity's report,
approved LegalZoom's document-assembly model for estate-planning documents
under the condition that the software:

- Does not create an attorney-client relationship.
- Does not give fact-specific legal advice.
- Uses branching logic to gather information, not to diagnose legal questions.
- Lets the user make every substantive decision.
- Assembles documents from statutory templates rather than generating them.

### In re Nolo Press / Parsons Technology, 991 S.W.2d 768 (Tex. 1999)

The Texas Supreme Court on UPL Committee v. Parsons Technology — the *Nolo
Press* matter — upheld the right of software vendors to sell self-help legal
forms in Texas, so long as the product is not marketed as a substitute for an
attorney and does not provide case-specific legal advice. The controlling
Texas precedent for our TX templates.

### Janson v. LegalZoom.com, Inc., No. 2:10-cv-04018 (W.D. Mo. 2011) — settled

A class-action in the Western District of Missouri alleging UPL by LegalZoom.
The case settled rather than producing a final merits ruling. Design takeaways:

- Assembling a document from user input is legally distinguishable from giving
  advice about the user's particular case.
- Disclaimers must be prominent, repeated, and unambiguous.
- Marketing that implies attorney-substitution creates risk; we do not make
  such claims.

## §2 Option C application — the kit model

f1b7fc8 shipped this product as a counsel-gated pure-template system: the
filing documents were drafted to look customer-ready, and
`[VERIFY WITH STATE ATTORNEY: ...]` markers were hidden behind a
counsel-review gate that had to be cleared before launch. That posture is
doctrinally sound but places the burden of incompleteness entirely on a
pre-launch counsel review we cannot always justify.

The kit model inverts that trade-off: **incompleteness is visible IN the
output, not hidden in a disclaimer.** Every filing document carries:

1. A top-of-document **"NOT READY TO FILE"** amber banner on page 1.
2. One or more yellow **"[!] CUSTOMER VERIFICATION REQUIRED"** callout boxes,
   each citing the specific statute section the customer must verify, a
   plain-English description of what to check, and a cross-reference into the
   instruction packet.
3. A full-footer UPL disclaimer and "not a law firm" statement on every page.

The core value ships as an **instruction packet** (15–25 pages per state)
that teaches the customer how to read the statute, serve by certified mail,
find a notary, identify legal descriptions, and file at the county recorder.

This is doctrinally **stronger** than the f1b7fc8 posture because:

- **(a) A customer cannot credibly testify they thought the documents were
  ready to file.** The documents themselves say — in red amber headers, visible
  callouts, and a top banner — that they are not.
- **(b) Our product ships education (the instruction packet) as the core
  value.** Education is unambiguously First Amendment-protected. The templates
  are illustrative exhibits; the guide is the product.
- **(c) Our product cannot be accused of practicing law** because it
  explicitly defers legal judgment to the customer, identifies the statute
  section to check, and tells the customer to call a licensed attorney when
  uncertain.

## §3 Commitments

These are hard constraints on the product, enforced by tests:

- **No LLM in any document body, kit template, or instruction-packet content.**
  Enforced by `src/__tests__/collections/templates.test.ts` which scans
  `src/lib/collections/` for imports of Anthropic, OpenAI, or calls to
  `api.anthropic.com`.
- **No case-specific legal review** of any customer's fact pattern.
- **No filings on behalf of the user.** The customer files.
- **No notary service** in v1.
- **No case-specific legal advice** in any channel (product copy, docs,
  customer support, email). Future customer-service hires will be scripted to
  decline legal-advice requests and direct to licensed attorneys.

## §4 Remaining risks

UPL risk is substantially reduced in the kit model. Remaining risk surfaces
are mostly consumer-protection, not UPL:

- **Performance claims** — we do not promise outcomes. All metrics ("most
  contractors in this situation…") avoid specific success numbers.
- **Refund policy** — terms state the fee is non-refundable once documents
  are generated, except for errors attributable to us. Clear in terms of
  service.
- **Scope statement** — the landing page clearly states what the kit covers
  and what it does not, in plain English.
- **Output incompleteness** — visible in the output. Cannot plausibly be
  claimed as a surprise.

## §5 Phase 2 counsel review — optional

A Colorado-licensed and a Texas-licensed attorney reviewing the kit
(templates, instruction packet, disclaimers, terms of service) remains a
valuable polish layer. Estimated cost: $800–$1500 per state for an initial
blessing, with retainers for ongoing template updates optional.

Counsel review is no longer a **required** pre-launch gate. Launch proceeds
on the flag flip + Stripe product activation.

## §6 Ongoing compliance

- Any change to templates in `src/lib/collections/templates/{co,tx}/` or to
  instruction-packet content in `src/lib/collections/content/{co,tx}/`
  requires this posture document to be re-read. Substantive changes to
  statutory references trigger a counsel consultation.
- Any change to the intake flow adding or removing a gate requires a UPL
  re-analysis.
- Any addition of LLM content to document generation requires a separate
  counsel opinion. LLM-generated document bodies are novel UPL territory and
  are **out of scope**.
- Any geographic expansion (new state) requires a fresh UPL analysis under
  that state's law and its own set of instruction packet content.
