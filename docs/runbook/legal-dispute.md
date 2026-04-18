# Runbook — Legal dispute / DMCA / state AG inquiry

## Signals

- DMCA takedown notice (@ dmca@earthmove.io).
- State Attorney General inquiry letter (to the registered business address or legal@earthmove.io).
- Cease-and-desist from a contractor's counsel regarding a specific Groundcheck finding.
- Subpoena or court order requesting user or contractor data.
- FTC / FCRA investigation letter.

## First 24 hours

1. **Forward to Juan + counsel immediately.** No engineering response without counsel sign-off.
2. **Preserve everything.** Engineering places a litigation hold:
   - Do NOT delete the affected user account, contractor row, report, or dispute.
   - Do NOT modify any affected record (no scoring refresh, no moderation edits, no deletion).
   - Add a note in `audit_events` with `event_type='legal.litigation_hold'` referencing the claim.
3. **Acknowledge receipt** within 48 hours (or sooner if statute requires). Template in `docs/runbook/templates/legal-ack.md` (TODO — polish).

## What triggers freezes

| Trigger | Freeze scope |
|---|---|
| DMCA takedown of a specific review citation | The one finding + its evidence URL. Keep the rest of the report live. |
| State AG privacy inquiry | All records associated with the complainant's state residents. |
| Contractor C&D | The subject contractor's row + all reports referencing it + any disputes. |
| Subpoena / court order | Exactly what the order specifies, no more, no less. Counsel authorizes compliance. |
| FTC/FCRA letter | Everything potentially covered by the inquiry; counsel scopes. |

## What we say publicly during a dispute

Nothing unless counsel clears it. "We are aware of the matter and are reviewing with counsel." If press calls, forward to Juan.

## Common requests & responses

| Request | Response |
|---|---|
| "Remove this finding" | Evaluate under the Dispute Process page SLA. If the underlying public record is wrong → correct or withdraw. If the record is accurate → we do not retract. Counsel advises when lawsuits threatened. |
| "Give us all data on user X" | Require subpoena or court order. Counsel reviews scope. |
| "Give us all data on contractor Y" | Same — require legal process. |
| "Pay us $X or we sue" | Referral to counsel. No direct response. |
| "FCRA violation — we sue you for not complying" | Point to our FCRA Notice page + Terms prohibited-use clause. We are not a CRA; FCRA does not govern us. Counsel asserts non-applicability. |

## Document trail

Every inbound legal matter gets a folder under `docs/legal/matters/<yyyy-mm>-<short-name>/` with:
- Inbound document (PDF or email export).
- Counsel's assessment and recommended action.
- Our response (dated).
- Final resolution.

**Do not commit this folder to a public repo.** Sensitive legal documents stay in a private encrypted store. The path is documented here so ops know where to look.

## Owner
Primary: Juan. Secondary: Counsel.
