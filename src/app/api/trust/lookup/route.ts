// Thin alias over /api/trust so client callers can POST to the documented
// path /api/trust/lookup. The underlying handler (including the
// FCRA gate, rate limiter, cost cap, PII scrubber, and report_id output)
// is shared — no duplicated logic.
export { POST } from '../route'
