# Content Writing Style Guide — Instruction Packet

Rules for writing the instruction-packet markdown in
`src/lib/collections/content/{co,tx}/`. The goal is to stay inside the
self-help legal software doctrine while being maximally useful to a
contractor audience.

## Voice

- Second person ("you").
- Active voice where possible.
- Short sentences. Target under 25 words per sentence.
- Plain English. Every legal term that appears has a definition (either
  inline on first use or in the Glossary section).

## Rules that keep us inside the doctrine

1. **No advice voice.**
   - ✗ "We recommend you send the demand letter by certified mail."
   - ✓ "Most contractors in this situation send the demand letter by
     certified mail with return receipt requested."
   - ✗ "You should verify the statute before filing."
   - ✓ "The law requires the claimant to verify statutory language against
     the current statute before filing. Most contractors do this at…"

2. **No diagnoses.**
   - ✗ "You have a valid lien claim if…"
   - ✓ "Contractors in your general situation typically can file a lien if
     the statutory requirements in § 38-22-109 apply to their facts."

3. **Every statutory claim links to the public statute portal.**
   - Colorado: `https://leg.colorado.gov/colorado-revised-statutes`
   - Texas: `https://statutes.capitol.texas.gov`
   - A minimum of 10 statute URL references per state, enforced by test.

4. **No case citations in customer-facing content.** Case citations
   (*Medlock v. LegalZoom*, *In re Nolo Press*, etc.) belong only in
   `docs/LEGAL_POSTURE.md`.

5. **Every section ends with a call-an-attorney line.** The exact phrasing
   varies, but every file closes with a prompt to consult a licensed
   attorney in the property's state when uncertain.

6. **No outcome promises.**
   - ✗ "Sending a demand letter will get you paid."
   - ✓ "Demand letters resolve a meaningful fraction of contractor payment
     disputes without further escalation."

7. **Specific-fact questions are deferred to counsel.** When a fact pattern
   is common enough to deserve a flag but fact-specific enough to be
   advice-y, flag it and send the reader to an attorney.

## Rules that keep the content accurate

1. **No fabricated statutory language.** If a specific statute's exact
   language is required, cite the section and link to the portal. Do not
   invent or paraphrase statutory text.

2. **No fabricated filing fees, addresses, or phone numbers.** If specific
   numbers cannot be confirmed from available sources at write-time, use
   placeholders ("filing fee varies — call the recorder"; "see the county
   clerk website listed in Appendix A"). Filing fees and addresses change
   over time; specific numbers rot.

3. **No specific county addresses or phone numbers** unless directly
   confirmed. Cost/accuracy trade-off: a directory of URLs updates less
   frequently than phone numbers.

## Rules that keep the content usable

1. **Every section has a heading hierarchy.** H1 for section title; H2 for
   subsections; H3 for sub-subsections (rare).

2. **Lists over paragraphs** when the content is a set of parallel items
   (checklist, where-to-find-a-notary, what-to-bring-to-post-office, etc.).

3. **Tables for directory-style content** (county filing directory,
   comparative cost tables).

4. **Code blocks for ASCII diagrams and timelines.**

## Enforcement

- **Test gate**: `src/__tests__/collections/templates.test.ts` runs
  `grep -rn "we recommend\|you should" src/lib/collections/content/` and
  fails if any match is found.
- **Test gate**: same test scans content for case citations matching
  typical Reporter-style patterns; must be empty.
- **Test gate**: each state's content must link to the state's public
  statute portal at least 10 times.
- **Human review**: this style guide is re-read before each substantive
  content revision.

## Adding a new section

1. Create the markdown file in the correct numeric order
   (`NN-your-section-slug.md`).
2. First line: `# Section Title` — H1, extracted as the section title.
3. Write the content using the rules above.
4. Update the loader test expectation in `instruction-packet.test.ts` if the
   file count changes.
5. Run `pnpm test src/__tests__/collections/` and confirm green.

If you are not sure whether a given sentence crosses into legal-advice
territory, rewrite it in "most contractors in this situation" framing. If
that framing does not fit, the sentence is probably advice and should
instead be a prompt to the reader to consult a Colorado- or Texas-licensed
attorney.
