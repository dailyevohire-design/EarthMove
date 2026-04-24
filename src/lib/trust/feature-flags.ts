// Server-only feature flags for GroundCheck paid flows. Kept non-NEXT_PUBLIC_
// intentionally — the value is inspected in server components and API routes,
// never exposed to the client bundle. Client components receive the flag
// through a prop rendered by a server parent.
//
// Stays false until the redemption API + /account/gc surface land, at which
// point Juan flips GROUNDCHECK_CHECKOUT_ENABLED=true in Vercel.

export function isGroundcheckCheckoutEnabled(): boolean {
  return process.env.GROUNDCHECK_CHECKOUT_ENABLED === 'true'
}
