// src/lib/user-context.ts
//
// Single source of truth for the personalization context of the current
// request. Every server component that needs to render market/user-aware
// content should call getUserContext() instead of separately calling
// getCurrentMarket(), supabase.auth.getUser(), profile lookups, etc.
//
// Why this matters now (instead of after launch):
//   When you eventually flip on contractor-tier pricing, loyalty discounts,
//   "you usually order this," etc., the rendering layer should not need to
//   know how to assemble the personalization shape. It already does today.
//   That keeps every consumer one-line-stable across that future flip.
//
// What this returns:
//   {
//     market:       the user's selected launch market (or null pre-ZIP)
//     marketId:     shorthand for market?.id
//     user:         the auth.users row (or null if anonymous)
//     userId:       shorthand for user?.id
//     profile:      profiles row (first_name, last_name, role, etc.)
//     tier:         pricing tier (anon | retail | contractor | wholesale)
//     loyaltyTier:  customer loyalty tier (none | bronze | silver | gold)
//     isAuthenticated: boolean
//     wasGuestCheckout: did this user check out as a guest before claiming?
//   }
//
// Tier resolution today is intentionally simple — every signed-in user
// is `retail`, anon is `anon`. This is the seam to expand without
// touching call sites.

import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { LAUNCH_MARKET_SLUGS } from '@/lib/zip-market'

export type PricingTier = 'anon' | 'retail' | 'contractor' | 'wholesale'
export type LoyaltyTier = 'none' | 'bronze' | 'silver' | 'gold'

export interface Market {
  id: string
  name: string
  slug: string
  state: string
  center_lat: number | null
  center_lng: number | null
}

export interface Profile {
  id: string
  first_name: string | null
  last_name: string | null
  company_name: string | null
  phone: string | null
  role: string | null
  default_market_id: string | null
}

export interface UserContext {
  market: Market | null
  marketId: string | null
  user: { id: string; email?: string } | null
  userId: string | null
  profile: Profile | null
  tier: PricingTier
  loyaltyTier: LoyaltyTier
  isAuthenticated: boolean
  wasGuestCheckout: boolean
}

/**
 * Resolves the personalization context for the current request. Cheap to
 * call from any server component — does at most three Supabase round trips
 * (markets, auth.getUser, profiles) and they parallelize where possible.
 */
export async function getUserContext(): Promise<UserContext> {
  const supabase = await createClient()
  const cookieStore = await cookies()

  // Read both data sources in parallel
  const [marketResult, userResult] = await Promise.all([
    resolveMarket(supabase, cookieStore.get('market_id')?.value ?? null),
    supabase.auth.getUser(),
  ])

  const market = marketResult
  const authUser = userResult.data.user

  let profile: Profile | null = null
  let wasGuestCheckout = false
  if (authUser) {
    const { data } = await supabase
      .from('profiles')
      .select('id, first_name, last_name, company_name, phone, role, default_market_id')
      .eq('id', authUser.id)
      .maybeSingle()
    profile = data ?? null
    wasGuestCheckout = !!(authUser.user_metadata as any)?.was_guest_checkout
  }

  return {
    market,
    marketId: market?.id ?? null,
    user: authUser ? { id: authUser.id, email: authUser.email ?? undefined } : null,
    userId: authUser?.id ?? null,
    profile,
    tier: resolveTier(profile),
    loyaltyTier: resolveLoyaltyTier(profile),
    isAuthenticated: !!authUser,
    wasGuestCheckout,
  }
}

async function resolveMarket(
  supabase: any,
  cookieValue: string | null
): Promise<Market | null> {
  if (!cookieValue) return null
  const { data } = await supabase
    .from('markets')
    .select('id, name, slug, state, center_lat, center_lng')
    .eq('id', cookieValue)
    .eq('is_active', true)
    .in('slug', LAUNCH_MARKET_SLUGS as unknown as string[])
    .maybeSingle()
  return (data as Market) ?? null
}

/**
 * Resolves the user's pricing tier. Today this is a simple anon/retail split,
 * but the seam is here so when you add contractor pricing or wholesale tiers
 * you only edit this function — every consumer continues to read `ctx.tier`.
 */
function resolveTier(profile: Profile | null): PricingTier {
  if (!profile) return 'anon'
  // Future hooks:
  //   if (profile.role === 'contractor') return 'contractor'
  //   if (profile.role === 'wholesale') return 'wholesale'
  return 'retail'
}

/**
 * Resolves the user's loyalty tier. Stub for now — wire to lifetime spend
 * once you have order history.
 */
function resolveLoyaltyTier(_profile: Profile | null): LoyaltyTier {
  // Future: query lifetime_spend on profiles or aggregate orders.total_amount
  // and bucket: 0–500 none, 500–2k bronze, 2k–10k silver, 10k+ gold.
  return 'none'
}
