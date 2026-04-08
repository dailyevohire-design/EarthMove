import Link from 'next/link'
import { Logo } from '@/components/layout/logo'
import { SignupForm } from '@/components/auth/signup-form'
import { Zap, Truck, Gift, Bell, Bookmark, ShieldCheck } from 'lucide-react'

export const metadata = {
  title: 'Create Account',
  description: 'Join EarthMove for daily deal alerts, free delivery on first orders, loyalty rewards, and one-tap reorder.',
}

interface Props {
  searchParams: Promise<{
    redirectTo?: string
    email?: string
    first_name?: string
    last_name?: string
    from_order?: string
  }>
}

const BENEFITS = [
  {
    icon: Zap,
    title: 'Daily deal alerts',
    body: 'Get notified the moment your usual materials drop in price. Members save an average of 12% per order.',
  },
  {
    icon: Truck,
    title: 'Free delivery — first 3 orders',
    body: 'Skip delivery fees on your first three loads. Most contractors save $80–$240 just signing up.',
  },
  {
    icon: Gift,
    title: 'Loyalty rewards',
    body: 'Earn $10 back for every $500 spent. Redeem on any future order — no expiration.',
  },
  {
    icon: Bell,
    title: 'SMS dispatch updates',
    body: 'Real-time text alerts when your truck rolls. Know exactly when to be on site.',
  },
  {
    icon: Bookmark,
    title: 'One-tap reorder',
    body: 'Save delivery addresses and project specs. Reorder the same load to the same site in 10 seconds.',
  },
  {
    icon: ShieldCheck,
    title: 'Order history & receipts',
    body: 'Every order tracked with itemized receipts for tax season and project bookkeeping.',
  },
]

export default async function SignupPage({ searchParams }: Props) {
  const { redirectTo, email, first_name, last_name, from_order } = await searchParams
  const loginHref = redirectTo ? `/login?redirectTo=${encodeURIComponent(redirectTo)}` : '/login'
  const isClaimingGuest = !!from_order

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-[#0a1628] via-[#0d2137] to-[#091a0e]">
      {/* Subtle grid */}
      <div className="absolute inset-0 opacity-[0.04] pointer-events-none" style={{
        backgroundImage: 'linear-gradient(rgba(255,255,255,1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,1) 1px, transparent 1px)',
        backgroundSize: '60px 60px',
      }} />

      <div className="relative flex-1 flex items-center justify-center px-4 py-12 lg:py-16">
        <div className="w-full max-w-6xl grid grid-cols-1 lg:grid-cols-[1.1fr_1fr] gap-10 lg:gap-16 items-center">

          {/* Left: Benefits panel */}
          <div className="order-2 lg:order-1">
            <div className="flex justify-center lg:justify-start mb-8">
              <Logo />
            </div>
            <h1 className="text-3xl md:text-5xl font-black text-white leading-[1.05] mb-4 text-center lg:text-left">
              Join the <span className="text-emerald-400" style={{ textShadow: '0 0 32px rgba(16,185,129,0.5)' }}>insider list.</span>
            </h1>
            <p className="text-white/60 text-base md:text-lg mb-10 text-center lg:text-left max-w-xl">
              Free to join. No credit card. Members get prices and perks that don&apos;t exist on the public site.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {BENEFITS.map((b) => {
                const Icon = b.icon
                return (
                  <div
                    key={b.title}
                    className="relative p-4 rounded-2xl bg-white/[0.03] border border-white/[0.08] backdrop-blur-sm transition-all hover:bg-white/[0.05] hover:border-emerald-500/30"
                    style={{
                      boxShadow:
                        '0 1px 0 0 rgba(255,255,255,0.06) inset, 0 8px 24px -12px rgba(0,0,0,0.4), 0 0 32px -16px rgba(16,185,129,0.2)',
                    }}
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className="flex-shrink-0 w-9 h-9 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center"
                        style={{ boxShadow: '0 0 16px rgba(16,185,129,0.25), inset 0 1px 0 rgba(255,255,255,0.1)' }}
                      >
                        <Icon size={16} className="text-emerald-400" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-white font-bold text-sm mb-0.5">{b.title}</div>
                        <div className="text-white/50 text-xs leading-relaxed">{b.body}</div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>

            <div className="mt-8 flex items-center gap-6 text-white/40 text-xs">
              <div className="flex items-center gap-2">
                <ShieldCheck size={13} className="text-emerald-400" />
                Bank-grade encryption
              </div>
              <div className="flex items-center gap-2">
                <Truck size={13} className="text-emerald-400" />
                Used by 7,000+ contractors
              </div>
            </div>
          </div>

          {/* Right: Signup form */}
          <div className="order-1 lg:order-2">
            <div
              className="relative rounded-2xl bg-white p-6 md:p-8"
              style={{
                boxShadow:
                  '0 1px 0 0 rgba(255,255,255,0.9) inset, 0 4px 12px rgba(15,23,42,0.08), 0 32px 64px -24px rgba(0,0,0,0.6), 0 0 80px -20px rgba(16,185,129,0.4)',
              }}
            >
              <h2 className="text-2xl font-extrabold text-gray-900 mb-1">
                {isClaimingGuest ? 'Claim your account' : 'Create your account'}
              </h2>
              <p className="text-gray-500 text-sm mb-6">
                {isClaimingGuest
                  ? `Order #${from_order} is yours. Set a password to track delivery, reorder in one tap, and unlock member benefits.`
                  : 'Takes 30 seconds. Start saving on your next load.'}
              </p>
              <SignupForm
                redirectTo={redirectTo}
                prefillEmail={email}
                prefillFirstName={first_name}
                prefillLastName={last_name}
              />
            </div>

            <p className="text-center text-white/50 text-sm mt-6">
              Already have an account?{' '}
              <Link
                href={loginHref}
                className="text-emerald-400 hover:text-emerald-300 font-bold transition-colors"
              >
                Sign in
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
