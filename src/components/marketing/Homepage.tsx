/**
 * Homepage — v6 marketing landing (the without-market branch of `/`).
 *
 * Server component. Contractor-only audience.
 * Interactive bits (ZIP form, calculator, nav scroll) are client islands.
 *
 * LAUNCH MARKETS: Denver + Dallas–Fort Worth (2026). Co-equal launch.
 * Portland moved to expansion pipeline 2026-04-27 — list it in expansion contexts only.
 * NEVER reintroduce Portland (or any expansion-pipeline city) as a launch-market claim
 * in this surface. Do not invent product metrics. Do not list synthetic pricing.
 */
import Image from 'next/image'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { NavScroll } from './NavScroll'
import { HeroLeftColumn } from './HeroLeftColumn'
import { MaterialsSection } from './MaterialsSection'
import { MaterialSpecSection } from './MaterialSpecSection'
import { HowItWorksSection } from './HowItWorksSection'
import { MarketStatusStrip } from './MarketStatusStrip'
import { CoverageCalculator } from './CoverageCalculator'
import { MobileNav } from '@/components/layout/mobile-nav'
import { SiteFooter } from '@/components/layout/site-footer'
import { Logo } from '@/components/logo'

const ChevronDown = ({ size = 18 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="m6 9 6 6 6-6" />
  </svg>
)


const ArrowRight = ({ size = 16, weight = 2 }: { size?: number; weight?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={weight} strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 12h14" /><path d="m13 5 7 7-7 7" />
  </svg>
)

export async function Homepage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  let profileRole: string | null = null
  if (user) {
    const { data } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()
    profileRole = data?.role ?? null
  }

  return (
    <div className="marketing-v6">
      <NavScroll>
          <div className="max nav-inner">
            <Link href="/" className="nav-logo" aria-label="Earthmove home"><Logo variant="wordmark" size={28} color="#1F3D2E" /></Link>
            <nav className="nav-links">
              <Link href="/browse">Materials</Link>
              <Link href="/deals">Deals</Link>
              <Link href="/learn">Learn</Link>
              <Link href="/material-match">Material Match</Link>
              <Link href="/login">Sign in</Link>
            </nav>
            <a href="#zipForm" className="btn btn-primary nav-cta-desktop" style={{ padding: '0 16px', height: 36, fontSize: 13.5 }}>Sign up</a>
            <MobileNav isLoggedIn={!!user} role={profileRole} />
          </div>
        </NavScroll>

        {/* HERO */}
        <MarketStatusStrip />
        <section className="hv-bg">
          <div className="max hv-wrap">
            <div className="hv-grid">
              <HeroLeftColumn />

              {/* RIGHT — Operations panel (feature-illustrative, demo-labeled) */}
              <div style={{ display: 'flex', flexDirection: 'column', alignSelf: 'flex-start' }}>
                <div className="op" style={{ display: 'flex', flexDirection: 'column' }}>
                  <div className="op-head">
                    <div className="op-eyebrow">
                      <span className="op-mark" />
                      <span className="op-eyebrow-lbl">How dispatch works</span>
                      <span className="op-region">Denver · Sample view</span>
                    </div>
                    <span className="op-tag">Demo</span>
                  </div>

                  <div className="op-pillars">
                    <div className="op-pillar">
                      <div className="op-pillar-icon">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 21s-7-7.5-7-13a7 7 0 1 1 14 0c0 5.5-7 13-7 13z" /><circle cx="12" cy="8" r="2.5" /></svg>
                      </div>
                      <div className="op-pillar-ttl">Closest yard wins</div>
                      <div className="op-pillar-sub">Routed from the nearest verified yard to the drop ZIP — not a queue.</div>
                    </div>
                    <div className="op-pillar">
                      <div className="op-pillar-icon">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></svg>
                      </div>
                      <div className="op-pillar-ttl">Live ETA, not "later"</div>
                      <div className="op-pillar-sub">Driver assigned, route locked, arrival to the minute.</div>
                    </div>
                    <div className="op-pillar">
                      <div className="op-pillar-icon">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="6" width="18" height="14" rx="2" /><circle cx="12" cy="13" r="4" /><path d="M8 6V4h8v2" /></svg>
                      </div>
                      <div className="op-pillar-ttl">Drop confirmed on file</div>
                      <div className="op-pillar-sub">Geotagged photo + signed ticket attached to invoice on tip.</div>
                    </div>
                  </div>

                  <div className="op-map">
                    <svg className="grid" viewBox="0 0 600 260" preserveAspectRatio="none">
                      <defs>
                        <pattern id="opGrid" width="30" height="30" patternUnits="userSpaceOnUse">
                          <path d="M 30 0 L 0 0 0 30" fill="none" stroke="rgba(255,255,255,.04)" strokeWidth="1" />
                        </pattern>
                        <radialGradient id="opMapGlow" cx="50%" cy="50%" r="60%">
                          <stop offset="0" stopColor="rgba(94,169,255,.10)" />
                          <stop offset="1" stopColor="rgba(94,169,255,0)" />
                        </radialGradient>
                      </defs>
                      <rect width="600" height="260" fill="url(#opGrid)" />
                      <rect width="600" height="260" fill="url(#opMapGlow)" />
                      <path d="M 0 80 Q 200 60 380 100 T 600 130" fill="none" stroke="rgba(255,255,255,.05)" strokeWidth="14" strokeLinecap="round" />
                      <path d="M 0 80 Q 200 60 380 100 T 600 130" fill="none" stroke="rgba(255,255,255,.07)" strokeWidth="1" />
                      <path d="M 80 0 Q 100 130 60 260" fill="none" stroke="rgba(255,255,255,.05)" strokeWidth="10" strokeLinecap="round" />
                      <path d="M 80 0 Q 100 130 60 260" fill="none" stroke="rgba(255,255,255,.07)" strokeWidth="1" />
                      <path d="M 420 0 Q 460 130 500 260" fill="none" stroke="rgba(255,255,255,.05)" strokeWidth="10" strokeLinecap="round" />
                      <path d="M 420 0 Q 460 130 500 260" fill="none" stroke="rgba(255,255,255,.07)" strokeWidth="1" />
                      <path d="M 130 95 C 220 110, 310 140, 470 170" fill="none" stroke="rgba(40,199,111,.55)" strokeWidth="2" strokeLinecap="round" />
                      <path d="M 130 95 C 220 110, 310 140, 470 170" fill="none" stroke="rgba(40,199,111,.18)" strokeWidth="6" strokeLinecap="round" />
                      <g>
                        <rect x="123" y="88" width="14" height="14" rx="2" fill="#1F3D2E" stroke="#4F8B6A" strokeWidth="1.5" />
                        <rect x="127" y="92" width="6" height="6" fill="#7FB893" />
                      </g>
                      <g transform="translate(470,170)">
                        <path d="M 0 -14 a 7 7 0 1 1 0.001 0 z M 0 -14 L -4 -2 L 4 -2 Z" fill="#fff" opacity=".95" />
                        <circle cx="0" cy="-14" r="3" fill="#0F1A28" />
                      </g>
                    </svg>
                    <div className="op-truck">
                      <svg viewBox="0 0 28 18" width="28" height="18">
                        <rect x="0" y="4" width="16" height="9" rx="1.2" fill="#F6B23F" />
                        <rect x="16" y="2" width="9" height="11" rx="1.2" fill="#FFD78A" />
                        <circle cx="5" cy="14.5" r="2.2" fill="#0F1A28" stroke="#F6B23F" strokeWidth="1" />
                        <circle cx="20" cy="14.5" r="2.2" fill="#0F1A28" stroke="#F6B23F" strokeWidth="1" />
                      </svg>
                    </div>
                    <div className="op-map-tag" style={{ left: '9%', top: '24%' }}><span className="dot stone" />Yard · Commerce City</div>
                    <div className="op-map-tag" style={{ right: '11%', top: '51%' }}><span className="dot pin" />Drop · 80205</div>
                  </div>

                  <div className="op-row">
                    <div className="op-row-l">
                      <div className="op-row-status">
                        <span className="op-row-pip" />
                        <span>Sample · in transit</span>
                        <span className="op-row-id">EM-DEMO</span>
                      </div>
                      <div className="op-row-ttl">14 tons · ABC road base</div>
                      <div className="op-row-meta">
                        <span>Yard · Commerce City</span>
                        <span className="arr">→</span>
                        <span>Denver 80205</span>
                        <span className="dot" />
                        <span>11.2 mi</span>
                      </div>
                    </div>
                    <div className="op-row-r">
                      <div className="op-eta-lbl">ETA</div>
                      <div className="op-eta-val">2:46<span className="u"> PM</span></div>
                      <div className="op-eta-sub">in 32 min · on schedule</div>
                    </div>
                  </div>

                  <div className="op-proof">
                    <div className="op-proof-icon">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="6" width="18" height="14" rx="2" /><circle cx="12" cy="13" r="4" /><path d="M8 6V4h8v2" /></svg>
                    </div>
                    <div className="op-proof-body">
                      <div className="op-proof-ttl">Every drop, photo-confirmed.</div>
                      <div className="op-proof-sub">Geotagged photo and signed ticket attached to the invoice the moment the truck tips.</div>
                    </div>
                    <div className="op-proof-tick">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
                    </div>
                  </div>
                </div>
                <div className="op-caption">
                  <span className="l"><span className="op-mark" />Sample view · illustrates delivery flow</span>
                  <a href="#how-it-works" className="link">How delivery works <span className="arr">→</span></a>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* MATERIALS */}
        <MaterialsSection />

        {/* MATERIAL SPECS */}
        <MaterialSpecSection />

        {/* HOW IT WORKS */}
        <HowItWorksSection />

        {/* QUANTITY HELPER */}
        <section className="section" id="sizing">
          <div className="max">
            <div style={{ marginBottom: 48 }}>
              <div className="eyebrow">Sizing</div>
              <h2 className="sec-title" style={{ maxWidth: 760 }}>How much you'll actually need.</h2>
              <p className="ink-2" style={{ marginTop: 16, fontSize: 18, maxWidth: 640 }}>Bulk material sells by the ton, not the bag. Enter your area, we'll size the load and pick the truck.</p>
            </div>

            <div className="truck-grid">
              <article className="truck-photo">
                <div className="bay">
                  <div className="stamp">DUMP TRAILER</div>
                  <div className="tons"><div className="n">5 ton</div></div>
                  <Image src="/assets/trucks/dump-trailer.png" alt="Pickup with dump trailer" width={1280} height={258} sizes="(min-width: 1024px) 280px, (min-width: 640px) 45vw, 90vw" />
                </div>
                <div className="meta">
                  <h3>Single-driveway scale</h3>
                  <p>Covers ~290 sq ft at 4″ deep. Fits tight access — narrow gates, low branches, one-car drives.</p>
                  <p className="text-xs text-stone-500 mt-2 leading-snug">22 ft long · 7 ft wide · fits any driveway</p>
                  <div className="foot"><span>4-wheel · bumper-pull</span></div>
                </div>
              </article>
              <article className="truck-photo">
                <div className="bay">
                  <div className="stamp">TANDEM DUMP</div>
                  <div className="tons"><div className="n">12 ton</div></div>
                  <Image src="/assets/trucks/tandem.png" alt="Tandem dump truck" width={1262} height={526} sizes="(min-width: 1024px) 280px, (min-width: 640px) 45vw, 90vw" />
                </div>
                <div className="meta">
                  <h3>Most common load</h3>
                  <p>Covers ~696 sq ft at 4″ deep. The right load for most residential and small commercial jobs.</p>
                  <p className="text-xs text-stone-500 mt-2 leading-snug">30 ft long · 8.5 ft wide · needs 14 ft gate</p>
                  <p className="text-xs text-stone-500 mt-1 leading-snug italic">↳ 17 ft overhead clearance to raise &amp; dump</p>
                  <div className="foot"><span>6-wheel · 2 rear axles</span></div>
                </div>
              </article>
              <article className="truck-photo">
                <div className="bay">
                  <div className="stamp">TRI-AXLE DUMP</div>
                  <div className="tons"><div className="n">18 ton</div></div>
                  <Image src="/assets/trucks/triaxle.png" alt="Tri-axle dump truck" width={1235} height={494} sizes="(min-width: 1024px) 280px, (min-width: 640px) 45vw, 90vw" />
                </div>
                <div className="meta">
                  <h3>Contractor scale</h3>
                  <p>Covers ~1,044 sq ft at 4″ deep. Sized for large fills, pad prep, and split deliveries.</p>
                  <p className="text-xs text-stone-500 mt-2 leading-snug">34 ft long · 8.5 ft wide · needs 14 ft gate</p>
                  <p className="text-xs text-stone-500 mt-1 leading-snug italic">↳ 22 ft overhead clearance to raise &amp; dump</p>
                  <div className="foot"><span>10-wheel · 3 rear axles</span></div>
                </div>
              </article>
              <article className="truck-photo">
                <div className="bay">
                  <div className="stamp">END-DUMP 18</div>
                  <div className="tons"><div className="n">24 ton</div></div>
                  <Image src="/assets/trucks/end-dump.png" alt="End-dump 18-wheeler" width={1352} height={519} sizes="(min-width: 1024px) 280px, (min-width: 640px) 45vw, 90vw" />
                </div>
                <div className="meta">
                  <h3>Full-yard fill</h3>
                  <p>Covers ~1,392 sq ft at 4″ deep. Open-site access only — large pad or commercial lot to maneuver.</p>
                  <p className="text-xs text-stone-500 mt-2 leading-snug">68 ft long · 8.5 ft wide · ~50 ft turning radius</p>
                  <p className="text-xs text-stone-500 mt-1 leading-snug italic">↳ 25 ft overhead clearance to raise &amp; dump</p>
                  <div className="foot"><span>18-wheel · semi + trailer</span></div>
                </div>
              </article>
            </div>

            <p className="text-xs italic text-stone-500 mt-3 text-center">
              Clearance figures are approximate. Confirm site overhead with your delivery dispatch.
            </p>

            <CoverageCalculator />
          </div>
        </section>


        {/* TRUST / CAPABILITIES */}
        <section className="section trust-band" id="trust" style={{ borderTop: 0 }}>
          <div className="max">
            <div style={{ marginBottom: 48 }}>
              <div className="eyebrow">What you get</div>
              <h2 className="sec-title" style={{ maxWidth: 820, color: '#FFFFFF' }}>Built for the way crews actually work.</h2>
              <p style={{ marginTop: 16, fontSize: 17, maxWidth: 640, color: '#FFFFFF' }}>What ships, what's earned. Each line below maps to a real product capability — not a marketing claim.</p>
            </div>

            <div className="cap-grid">
              <div className="cap">
                <div className="cap-eb">Photo-confirmed delivery</div>
                <div className="cap-ttl">Every drop, on file.</div>
                <div className="cap-body">Geotagged photo and signed ticket attached to every load, the moment the truck tips. No reconstructed timelines, no he-said-she-said.</div>
              </div>
              <div className="cap">
                <div className="cap-eb">Net-30 for contractors</div>
                <div className="cap-ttl">Pay on terms.</div>
                <div className="cap-body">Net-30 available to qualified contractors after a short underwriting review. Statements and open POs live in the contractor dashboard — same place as job sites and reorder history.</div>
              </div>
              <div className="cap">
                <div className="cap-eb">Yard-network verification</div>
                <div className="cap-ttl">Yards verified at the source.</div>
                <div className="cap-body">Every yard in the network passes entity-level checks — registration, insurance, business standing — through Groundcheck. Driver background checks route through Checkr.</div>
              </div>
              <div className="cap">
                <div className="cap-eb">Saved sites + history</div>
                <div className="cap-ttl">Job-site memory.</div>
                <div className="cap-body">Materials, tonnage, photos, and tickets stored per address — not per phone call. Reorder the same spec to the same site in one tap.</div>
              </div>
            </div>

            <div style={{ marginTop: 48, paddingTop: 32, borderTop: '1px solid var(--trust-line)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 13, color: 'var(--ink-3)' }}>Launching in <b style={{ color: 'var(--ink-2)' }}>Denver and Dallas–Fort Worth</b>, 2026. Expansion: Portland, Houston, Austin, Phoenix, Las Vegas, Atlanta, Orlando, Tampa, Charlotte.</span>
              <a href="#zipForm" className="link" style={{ fontSize: 14 }}>See if we're in your ZIP <span className="arr">→</span></a>
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section className="section" id="faq" style={{ background: 'var(--bg-2)', borderTop: '1px solid var(--line-strong)', borderBottom: '1px solid var(--line-strong)' }}>
          <div className="max" style={{ maxWidth: 1100 }}>
            <div className="faq-grid">
              <div>
                <div className="eyebrow">FAQ</div>
                <h2 className="sec-title" style={{ fontSize: 36 }}>Straight answers.</h2>
                <p className="ink-2" style={{ marginTop: 12, fontSize: 15 }}>The questions people ask before the first order. No fine print.</p>
              </div>
              <div>
                <details open>
                  <summary><span>How is the price calculated?</span><span className="chev"><ChevronDown /></span></summary>
                  <div>Three lines: material by the ton, delivery from the closest yard, and truck class. We quote against real yard pricing once you drop your ZIP. What you see is what you pay.</div>
                </details>
                <details>
                  <summary><span>How fast can you deliver?</span><span className="chev"><ChevronDown /></span></summary>
                  <div>Order before 10 AM in Denver or Dallas–Fort Worth and most loads ship same day. Order before 2 PM, get it next day. Contractor orders can be scheduled to a specific window.</div>
                </details>
                <details>
                  <summary><span>When are you in my city?</span><span className="chev"><ChevronDown /></span></summary>
                  <div>Denver and Dallas–Fort Worth in 2026. Expansion (in order): Portland, Houston, Austin, Phoenix, Las Vegas, Atlanta, Orlando, Tampa, Charlotte. Drop your ZIP in the quote form to get added to the notify list for your market.</div>
                </details>
                <details>
                  <summary><span>What if access to my site is tight?</span><span className="chev"><ChevronDown /></span></summary>
                  <div>Tell us when you order — driveway width, low branches, gate code, slope. We size the truck to fit and assign a driver who has worked sites like it.</div>
                </details>
                <details>
                  <summary><span>Where will the driver place the material?</span><span className="chev"><ChevronDown /></span></summary>
                  <div>Drop a pin where you want it. Optional: a photo of the spot. Your driver sees both before arrival, and photos the placement on the way out.</div>
                </details>
                <details>
                  <summary><span>How do I know how much to order?</span><span className="chev"><ChevronDown /></span></summary>
                  <div>Use the calculator above, or describe the project and we'll size it. If our estimate falls short, the follow-up delivery jumps the queue.</div>
                </details>
                <details>
                  <summary><span>Tons vs cubic yards — which should I use?</span><span className="chev"><ChevronDown /></span></summary>
                  <div>Most aggregate sells by the ton. Rough rule: a cubic yard of fill or base weighs about 1.4 tons. The calculator above handles the conversion.</div>
                </details>
                <details>
                  <summary><span>Do you serve contractors with net-30 terms?</span><span className="chev"><ChevronDown /></span></summary>
                  <div>Yes. Net-30 available to qualified contractors after a short underwriting review. Apply from your dashboard once the account is set up — most are approved within a business day.</div>
                </details>
                <details>
                  <summary><span>What happens if the wrong material shows up?</span><span className="chev"><ChevronDown /></span></summary>
                  <div>We replace it at our cost and re-deliver same or next day. The photo-confirmed drop on the original load is what settles it — no reconstruction, no argument.</div>
                </details>
              </div>
            </div>
          </div>
        </section>

        {/* FINAL CTA */}
        <section className="section">
          <div className="max">
            <div className="fcta">
              <div>
                <h2>First order, in under five minutes.</h2>
                <p>ZIP, material, drop-zone — that's your part. We handle yard match, dispatch, and the photo-confirmed drop.</p>
              </div>
              <div className="fcta-actions">
                <a href="#zipForm" className="btn btn-primary" style={{ height: 48, padding: '0 20px', fontSize: 15 }}>
                  Quote my ZIP <ArrowRight size={16} weight={2} />
                </a>
                <Link href="/material-match" className="btn" style={{ height: 48, padding: '0 20px', fontSize: 15, background: 'rgba(255,255,255,.10)', color: '#fff', border: '1px solid rgba(255,255,255,.18)' }}>
                  Find my material <ArrowRight size={14} />
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* FOOTER — em-evergreen reverse surface, brand sign-off */}
        <SiteFooter />
    </div>
  )
}

