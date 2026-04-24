# Legal Posture — Collections Assist

This document records the unauthorized-practice-of-law (UPL) analysis that
governs every design decision in `src/lib/collections/`, `src/app/collections/`,
and `src/app/api/collections/`. It must be reviewed by counsel before the
launch flag is flipped, and re-reviewed whenever any template, intake step, or
disclaimer is changed.

## §1 Self-help legal software doctrine

Collections Assist is modeled as a **self-help legal software** product, not as
a law firm, lawyer, or legal advisor. The doctrine is grounded in the
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

We follow those same five tests on every surface.

### In re Nolo Press / Parsons Technology, 991 S.W.2d 768 (Tex. 1999)

The Texas Supreme Court on UPL Committee v. Parsons Technology — better known
as the *Nolo Press* matter — upheld the right of software vendors to sell
self-help legal forms in Texas, so long as the product is not marketed as a
substitute for an attorney and does not provide case-specific legal advice.
This is the controlling Texas precedent for our v0 TX templates.

### Janson v. LegalZoom.com, Inc., No. 2:10-cv-04018 (W.D. Mo. 2011) — settled

A class-action in the Western District of Missouri alleging UPL by LegalZoom.
The case **settled** rather than producing a final merits ruling. The
takeaways relevant to our design are:
- Assembling a document from user input is legally distinguishable from giving
  advice about the user's particular case.
- Disclaimers must be prominent, repeated, and unambiguous.
- Marketing that implies attorney-substitution creates risk; we do not make
  such claims.

### State bar guidance (NY, NC, FL)

General document-assembly guidance from these bar associations is consistent:
the product is permissible when disclaimers are clear and no fact-specific
legal recommendation is made. These are persuasive only; they are not
binding on Colorado or Texas.

## §2 How Collections Assist aligns with the doctrine

| Doctrinal test | Our implementation |
|---|---|
| No attorney-client relationship formed | `UPL_DISCLAIMER` verbatim on landing page, on every wizard step, in PDF header + footer, in terms of service. Explicit "Earth Pro Connect LLC is not a law firm." |
| No fact-specific legal advice given | No LLM touches document bodies. All six templates are pure string rendering. |
| Branching intake is information gathering | State, property type, homestead, and contractor role are **scope filters** — we say "we don't offer that here" rather than "you can't do this." |
| User makes every substantive decision | Amount owed, who to name as respondent, which property to target, whether to file — user-entered or user-chosen, never inferred. |
| Documents assembled from templates | Statutory section numbers (e.g. C.R.S. § 38-22-109, Tex. Prop. Code § 53.056) appear as cross-references; exact statutory language that would require legal judgment is deferred to `[VERIFY WITH {STATE} ATTORNEY: ...]` placeholders. |
| Prominent disclaimers | Every surface: layout wrapper, wizard Step 6 required-checkbox, PDF header line ("GENERATED DOCUMENT — NOT LEGAL ADVICE"), PDF footer (full UPL disclaimer), terms of service page. |

## §3 Identified UPL risk surfaces and mitigations

### §3.1 Pre-lien notice compliance (TX § 53.056)

**Risk**: a subcontractor or supplier could rely on the pre-lien notice form
output and miss the 15th-of-3rd-month deadline.

**Mitigation**: the intake wizard surfaces a warning when the `contractor_role`
is subcontractor or material supplier and the selected state is TX. The API
response `warnings` array includes deadline arithmetic. The generated notice
contains a `[VERIFY WITH TEXAS ATTORNEY: ...]` placeholder for the exact
statutory form. We do not advise whether the user is on time — we state the
deadline and defer the judgment call.

### §3.2 `[VERIFY WITH {STATE} ATTORNEY: ...]` placeholders

**Risk**: a user could file the document without replacing the placeholder.

**Mitigation**: rendered in bold red in the PDF. The case download screen
carries an amber "DO NOT FILE WITHOUT ATTORNEY REVIEW" callout. Terms of
service requires user to represent they will consult a licensed attorney
before filing.

### §3.3 4-month / deadline validations

**Risk**: a validation message that sounds like legal advice.

**Mitigation**: messages cite the statute (C.R.S. § 38-22-109(5), Tex. Prop.
Code § 53.052) and quote the deadline arithmetically. No "you will win / lose"
language.

### §3.4 Homestead exclusion

**Risk**: a user on a homestead property receives a document that creates
liability under Tex. Const. art. XVI § 50.

**Mitigation**: scope gate at the DB `CHECK` constraint level, at the API
validation level, and at the UI Step 1 blocker. Three layers. The user-facing
message is "we don't offer this" rather than "you can't do this."

### §3.5 Marketing copy

**Risk**: landing-page language that reads like attorney-substitution.

**Mitigation**: landing page (`src/app/collections/page.tsx`) contains a "How
this is different from a law firm" explainer block and the full
`UPL_DISCLAIMER` verbatim.

## §4 What we do NOT do (commitments)

- **No LLM in document body generation** in v0. Enforced by
  `src/__tests__/collections/templates.test.ts` test #9 — the templates
  directory must not import Anthropic, OpenAI, or any LLM client, and must not
  fetch from any LLM endpoint.
- **No legal research** on behalf of the user. County assessor URLs are static
  references; no claim-validity evaluation.
- **No filing with county on behalf of the user.** We produce PDFs; the user
  (with their attorney) takes it from there.
- **No notary service** in v0. The user obtains their own notary.
- **No case-specific recommendations.** We do not tell the user whether to
  sue, how to negotiate, or whether their claim will succeed.

## §5 What attorneys must confirm before launch

Enumerated in `docs/COLLECTIONS_LAUNCH_CHECKLIST.md` §3 "Counsel review."
Both a Colorado-licensed attorney and a Texas-licensed attorney must sign off
on their respective state's templates, statutory citations, and any
`[VERIFY WITH {STATE} ATTORNEY: ...]` placeholders.

## §6 Ongoing compliance commitments

- Any change to a template in `src/lib/collections/templates/{co,tx}/`
  requires counsel re-review for that state before deployment.
- Any change to the intake flow that adds a new gate or removes an existing
  gate requires a UPL re-analysis.
- Any addition of LLM content to document generation requires a separate
  counsel opinion. LLM-assembled document bodies are novel UPL territory and
  are **out of scope for v0**.
- Any geographic expansion (new state) requires a fresh UPL analysis under
  that state's law.
