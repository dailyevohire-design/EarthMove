/**
 * PreMarketHome — v6 marketing landing.
 *
 * Server component. Audience-dependent copy is wrapped in <AudienceProvider>;
 * interactive bits (ZIP form, calculator, nav scroll) are client islands.
 *
 * Source of truth for visual + copy: public/marketing/homepage_v6.html
 *
 * LAUNCH MARKETS: Denver + Dallas–Fort Worth (2026). Co-equal launch.
 * Portland moved to expansion pipeline 2026-04-27 — list it in expansion contexts only.
 * NEVER reintroduce Portland (or any expansion-pipeline city) as a launch-market claim
 * in this surface. Do not invent product metrics. Do not list synthetic pricing.
 */
import { AudienceProvider } from './audience-context'
import { NavScroll } from './NavScroll'
import { HeroLeftColumn } from './HeroLeftColumn'
import { MaterialsSubcopy } from './MaterialsSubcopy'
import { MaterialsCard6 } from './MaterialsCard6'
import { CoverageCalculator } from './CoverageCalculator'

const ChevronDown = ({ size = 18 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="m6 9 6 6 6-6" />
  </svg>
)

const ExternalArrow = ({ size = 11 }: { size?: number }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" width={size} height={size}>
    <path d="M7 17 17 7M7 7h10v10" />
  </svg>
)

const ArrowRight = ({ size = 16, weight = 2 }: { size?: number; weight?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={weight} strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 12h14" /><path d="m13 5 7 7-7 7" />
  </svg>
)

export function PreMarketHome() {
  return (
    <div className="marketing-v6">
      <AudienceProvider>
        <NavScroll>
          <div className="max nav-inner">
            <a href="#" className="nav-logo">EarthMove<span className="dot">.</span></a>
            <nav className="nav-links">
              <a href="#materials">Materials</a>
              <a href="#how">How it works</a>
              <a href="#trust">For contractors</a>
              <a href="https://filldirtnearme.net" target="_blank" rel="noopener" className="ext">Homeowner site<ExternalArrow /></a>
              <a href="#signin">Sign in</a>
            </nav>
            <a href="#zipForm" className="btn btn-primary" style={{ padding: '0 16px', height: 36, fontSize: 13.5 }}>Get a quote</a>
          </div>
        </NavScroll>

        {/* HERO */}
        <section className="hv-bg">
          <div className="max hv-wrap">
            <div className="hv-grid">
              <HeroLeftColumn />

              {/* RIGHT — Operations panel (feature-illustrative, demo-labeled) */}
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <div className="op" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
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
                  <a href="#how" className="link">How delivery works <span className="arr">→</span></a>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* MATERIALS */}
        <section className="section" id="materials" style={{ background: 'var(--bg-2)', borderTop: '1px solid var(--line-strong)' }}>
          <div className="max">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 24, justifyContent: 'space-between', marginBottom: 48 }}>
              <div style={{ maxWidth: 700 }}>
                <div className="eyebrow">Materials</div>
                <h2 className="sec-title">Pick by outcome. We handle the spec.</h2>
                <MaterialsSubcopy />
              </div>
            </div>

            <div className="mat-grid">
              {/* 1: Driveway base */}
              <article className="mat" style={{ ['--mc' as string]: 'var(--m-base)' } as React.CSSProperties}>
                <div className="mat-img">
                  <svg viewBox="0 0 200 160" preserveAspectRatio="xMidYMid slice">
                    <defs><linearGradient id="g1" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#A39A8A" /><stop offset="1" stopColor="#5C5446" /></linearGradient></defs>
                    <rect width="200" height="160" fill="url(#g1)" />
                    <g stroke="#2E281E" strokeWidth="0.5">
                      <polygon points="10,20 30,15 40,30 25,40 8,35" fill="#867D6E" />
                      <polygon points="50,10 70,5 80,22 65,30 48,25" fill="#A39A8A" />
                      <polygon points="90,15 115,10 125,28 110,38 88,32" fill="#7A7264" />
                      <polygon points="135,8 160,12 168,30 150,38 130,28" fill="#928979" />
                      <polygon points="175,18 195,22 192,42 175,45 168,30" fill="#6E665A" />
                      <polygon points="5,55 28,50 38,68 22,80 0,72" fill="#A39A8A" />
                      <polygon points="45,60 70,55 80,75 60,85 42,78" fill="#867D6E" />
                      <polygon points="90,65 115,62 122,80 105,90 88,82" fill="#7A7264" />
                      <polygon points="130,55 158,60 165,82 145,90 128,80" fill="#928979" />
                      <polygon points="172,62 195,68 198,90 180,95 168,82" fill="#A39A8A" />
                      <polygon points="8,100 32,95 42,118 25,128 4,118" fill="#7A7264" />
                      <polygon points="50,108 75,102 85,120 65,135 45,128" fill="#928979" />
                      <polygon points="92,110 120,108 128,130 108,140 88,132" fill="#867D6E" />
                      <polygon points="135,105 162,108 170,128 152,138 132,128" fill="#A39A8A" />
                      <polygon points="175,112 198,118 195,140 175,142 165,128" fill="#7A7264" />
                    </g>
                  </svg>
                  <span className="mat-tag">ABC · ¾″ minus</span>
                </div>
                <div className="mat-body">
                  <div className="mat-title">Driveway base</div>
                  <div className="mat-spec">Best for new driveways, parking pads, and base under concrete or pavers. Compacts hard, holds under load.</div>
                  <div className="mat-meta"><span className="mat-chip">Class 5</span><span className="mat-chip">¾″ minus</span><span className="mat-chip">Crushed</span></div>
                  <div className="mat-foot">
                    <div className="mat-trucks">Fits <b>standard / tri-axle</b></div>
                    <a className="mat-cta" href="#zipForm">Get a quote <ArrowRight size={14} weight={2.2} /></a>
                  </div>
                </div>
              </article>

              {/* 2: Drainage */}
              <article className="mat" style={{ ['--mc' as string]: 'var(--m-drain)' } as React.CSSProperties}>
                <div className="mat-img">
                  <svg viewBox="0 0 200 160" preserveAspectRatio="xMidYMid slice">
                    <rect width="200" height="160" fill="#3F3D37" />
                    <g stroke="#1F1D17" strokeWidth="0.6">
                      <ellipse cx="22" cy="22" rx="14" ry="11" fill="#C7C2B5" />
                      <ellipse cx="55" cy="28" rx="16" ry="12" fill="#A9A498" />
                      <ellipse cx="90" cy="20" rx="13" ry="10" fill="#BCB7AB" />
                      <ellipse cx="120" cy="32" rx="17" ry="13" fill="#9E9A8E" />
                      <ellipse cx="158" cy="22" rx="14" ry="11" fill="#C7C2B5" />
                      <ellipse cx="188" cy="32" rx="14" ry="11" fill="#A9A498" />
                      <ellipse cx="14" cy="60" rx="15" ry="12" fill="#B0AB9F" />
                      <ellipse cx="48" cy="62" rx="13" ry="10" fill="#C7C2B5" />
                      <ellipse cx="80" cy="58" rx="17" ry="13" fill="#9E9A8E" />
                      <ellipse cx="112" cy="62" rx="14" ry="11" fill="#BCB7AB" />
                      <ellipse cx="148" cy="60" rx="16" ry="12" fill="#A9A498" />
                      <ellipse cx="180" cy="62" rx="14" ry="11" fill="#C7C2B5" />
                      <ellipse cx="22" cy="95" rx="14" ry="11" fill="#9E9A8E" />
                      <ellipse cx="58" cy="98" rx="16" ry="12" fill="#BCB7AB" />
                      <ellipse cx="92" cy="92" rx="14" ry="11" fill="#A9A498" />
                      <ellipse cx="128" cy="98" rx="15" ry="12" fill="#C7C2B5" />
                      <ellipse cx="162" cy="95" rx="14" ry="11" fill="#9E9A8E" />
                      <ellipse cx="190" cy="98" rx="13" ry="10" fill="#B0AB9F" />
                      <ellipse cx="16" cy="130" rx="14" ry="11" fill="#BCB7AB" />
                      <ellipse cx="50" cy="128" rx="15" ry="12" fill="#A9A498" />
                      <ellipse cx="84" cy="132" rx="14" ry="11" fill="#C7C2B5" />
                      <ellipse cx="118" cy="128" rx="16" ry="12" fill="#9E9A8E" />
                      <ellipse cx="154" cy="130" rx="14" ry="11" fill="#BCB7AB" />
                      <ellipse cx="186" cy="132" rx="15" ry="12" fill="#A9A498" />
                    </g>
                    <g fill="#fff" opacity="0.3"><ellipse cx="20" cy="18" rx="4" ry="2" /><ellipse cx="86" cy="56" rx="5" ry="2.5" /><ellipse cx="148" cy="92" rx="4" ry="2" /></g>
                  </svg>
                  <span className="mat-tag">¾″ washed stone</span>
                </div>
                <div className="mat-body">
                  <div className="mat-title">Drainage</div>
                  <div className="mat-spec">Used for French drains, foundation perimeter, and gravel beds. Clean, washed, free-draining — water moves through, soil doesn't.</div>
                  <div className="mat-meta"><span className="mat-chip">¾″ washed</span><span className="mat-chip">Drain rock</span><span className="mat-chip">Round</span></div>
                  <div className="mat-foot">
                    <div className="mat-trucks">Fits <b>small / standard</b></div>
                    <a className="mat-cta" href="#zipForm">Get a quote <ArrowRight size={14} weight={2.2} /></a>
                  </div>
                </div>
              </article>

              {/* 3: Backfill / leveling */}
              <article className="mat" style={{ ['--mc' as string]: 'var(--m-fill)' } as React.CSSProperties}>
                <div className="mat-img">
                  <svg viewBox="0 0 200 160" preserveAspectRatio="xMidYMid slice">
                    <defs><radialGradient id="g3" cx="0.5" cy="0.4" r="0.85"><stop offset="0" stopColor="#7A5A3D" /><stop offset="1" stopColor="#2A1D10" /></radialGradient></defs>
                    <rect width="200" height="160" fill="url(#g3)" />
                    <g>
                      <ellipse cx="30" cy="40" rx="22" ry="14" fill="#4D3823" opacity="0.7" />
                      <ellipse cx="80" cy="30" rx="28" ry="16" fill="#5C4630" opacity="0.55" />
                      <ellipse cx="140" cy="42" rx="26" ry="14" fill="#6B5238" opacity="0.6" />
                      <ellipse cx="180" cy="32" rx="20" ry="12" fill="#4D3823" opacity="0.7" />
                      <ellipse cx="22" cy="90" rx="26" ry="16" fill="#5C4630" opacity="0.6" />
                      <ellipse cx="76" cy="98" rx="30" ry="18" fill="#6B5238" opacity="0.55" />
                      <ellipse cx="138" cy="92" rx="28" ry="16" fill="#4D3823" opacity="0.65" />
                      <ellipse cx="186" cy="100" rx="22" ry="14" fill="#5C4630" opacity="0.6" />
                      <circle cx="40" cy="62" r="2.4" fill="#A89479" /><circle cx="100" cy="70" r="3" fill="#876B4C" />
                      <circle cx="155" cy="68" r="2" fill="#A89479" /><circle cx="60" cy="115" r="2.6" fill="#876B4C" />
                      <circle cx="120" cy="120" r="2" fill="#A89479" /><circle cx="170" cy="125" r="2.8" fill="#876B4C" />
                    </g>
                  </svg>
                  <span className="mat-tag">Clean fill dirt</span>
                </div>
                <div className="mat-body">
                  <div className="mat-title">Backfill &amp; leveling</div>
                  <div className="mat-spec">Used to raise grade, backfill foundations, and close out holes. Screened, no debris, no clay clods.</div>
                  <div className="mat-meta"><span className="mat-chip">Screened</span><span className="mat-chip">Clean fill</span><span className="mat-chip">No debris</span></div>
                  <div className="mat-foot">
                    <div className="mat-trucks">Fits <b>standard / tri-axle</b></div>
                    <a className="mat-cta" href="#zipForm">Get a quote <ArrowRight size={14} weight={2.2} /></a>
                  </div>
                </div>
              </article>

              {/* 4: Garden / landscaping */}
              <article className="mat" style={{ ['--mc' as string]: 'var(--m-soil)' } as React.CSSProperties}>
                <div className="mat-img">
                  <svg viewBox="0 0 200 160" preserveAspectRatio="xMidYMid slice">
                    <defs><radialGradient id="g4" cx="0.4" cy="0.4" r="0.85"><stop offset="0" stopColor="#3A2A19" /><stop offset="1" stopColor="#0F0904" /></radialGradient></defs>
                    <rect width="200" height="160" fill="url(#g4)" />
                    <g>
                      <ellipse cx="35" cy="38" rx="25" ry="16" fill="#2C1F11" opacity="0.7" />
                      <ellipse cx="100" cy="30" rx="34" ry="18" fill="#231910" opacity="0.7" />
                      <ellipse cx="160" cy="42" rx="28" ry="16" fill="#2C1F11" opacity="0.6" />
                      <ellipse cx="40" cy="100" rx="32" ry="18" fill="#231910" opacity="0.65" />
                      <ellipse cx="120" cy="105" rx="36" ry="20" fill="#2C1F11" opacity="0.6" />
                      <path d="M50 60 q 6 -3 12 0 q -2 4 -12 0z" fill="#5B4220" opacity="0.7" />
                      <path d="M120 70 q 6 -2 12 1 q -3 4 -12 -1z" fill="#5B4220" opacity="0.7" />
                      <path d="M70 130 q 7 -2 14 1 q -4 4 -14 -1z" fill="#5B4220" opacity="0.6" />
                      <path d="M150 130 q 1 -8 4 -9 q 4 1 4 9" stroke="#2F6F4D" strokeWidth="1.4" fill="none" />
                      <path d="M158 130 q 1 -6 3 -7" stroke="#2F6F4D" strokeWidth="1.2" fill="none" />
                    </g>
                  </svg>
                  <span className="mat-tag">Screened topsoil</span>
                </div>
                <div className="mat-body">
                  <div className="mat-title">Garden &amp; landscaping</div>
                  <div className="mat-spec">Used for lawns, garden beds, and planting beds. Dark loam, screened to ½″ — what plants want.</div>
                  <div className="mat-meta"><span className="mat-chip">Screened</span><span className="mat-chip">High organic</span><span className="mat-chip">Planting mix</span></div>
                  <div className="mat-foot">
                    <div className="mat-trucks">Fits <b>small / standard</b></div>
                    <a className="mat-cta" href="#zipForm">Get a quote <ArrowRight size={14} weight={2.2} /></a>
                  </div>
                </div>
              </article>

              {/* 5: Concrete / structural */}
              <article className="mat" style={{ ['--mc' as string]: 'var(--m-struct)' } as React.CSSProperties}>
                <div className="mat-img">
                  <svg viewBox="0 0 200 160" preserveAspectRatio="xMidYMid slice">
                    <rect width="200" height="160" fill="#D7D2C2" />
                    <g fill="#9C9486" stroke="#3F3A2E" strokeWidth="0.3" opacity="0.95">
                      <circle cx="12" cy="12" r="5" /><circle cx="26" cy="20" r="6" /><circle cx="42" cy="14" r="5" /><circle cx="58" cy="22" r="6" /><circle cx="74" cy="14" r="5" /><circle cx="90" cy="22" r="5" /><circle cx="106" cy="14" r="6" /><circle cx="122" cy="22" r="5" /><circle cx="138" cy="14" r="5" /><circle cx="154" cy="22" r="6" /><circle cx="170" cy="14" r="5" /><circle cx="186" cy="22" r="5" />
                      <circle cx="20" cy="36" r="6" /><circle cx="36" cy="42" r="5" /><circle cx="52" cy="36" r="5" /><circle cx="68" cy="42" r="6" /><circle cx="84" cy="36" r="5" /><circle cx="100" cy="42" r="6" /><circle cx="116" cy="36" r="5" /><circle cx="132" cy="42" r="6" /><circle cx="148" cy="36" r="5" /><circle cx="164" cy="42" r="5" /><circle cx="180" cy="36" r="6" />
                      <circle cx="14" cy="58" r="5" /><circle cx="30" cy="64" r="6" /><circle cx="46" cy="58" r="5" /><circle cx="62" cy="64" r="6" /><circle cx="78" cy="58" r="5" /><circle cx="94" cy="64" r="5" /><circle cx="110" cy="58" r="6" /><circle cx="126" cy="64" r="5" /><circle cx="142" cy="58" r="6" /><circle cx="158" cy="64" r="5" /><circle cx="174" cy="58" r="5" /><circle cx="190" cy="64" r="6" />
                      <circle cx="22" cy="80" r="5" /><circle cx="38" cy="86" r="6" /><circle cx="54" cy="80" r="5" /><circle cx="70" cy="86" r="6" /><circle cx="86" cy="80" r="5" /><circle cx="102" cy="86" r="5" /><circle cx="118" cy="80" r="6" /><circle cx="134" cy="86" r="5" /><circle cx="150" cy="80" r="6" /><circle cx="166" cy="86" r="5" />
                      <circle cx="16" cy="104" r="6" /><circle cx="32" cy="110" r="5" /><circle cx="48" cy="104" r="6" /><circle cx="64" cy="110" r="5" /><circle cx="80" cy="104" r="5" /><circle cx="96" cy="110" r="6" /><circle cx="112" cy="104" r="5" /><circle cx="128" cy="110" r="6" /><circle cx="144" cy="104" r="5" /><circle cx="160" cy="110" r="5" /><circle cx="176" cy="104" r="6" />
                      <circle cx="24" cy="128" r="5" /><circle cx="40" cy="134" r="6" /><circle cx="56" cy="128" r="5" /><circle cx="72" cy="134" r="6" /><circle cx="88" cy="128" r="5" /><circle cx="104" cy="134" r="5" /><circle cx="120" cy="128" r="6" /><circle cx="136" cy="134" r="5" /><circle cx="152" cy="128" r="6" />
                    </g>
                    <g fill="#7A7264" stroke="#3F3A2E" strokeWidth="0.3"><circle cx="46" cy="20" r="4" /><circle cx="118" cy="40" r="5" /><circle cx="80" cy="62" r="4" /><circle cx="160" cy="84" r="4" /><circle cx="40" cy="108" r="5" /><circle cx="124" cy="132" r="4" /></g>
                  </svg>
                  <span className="mat-tag">Concrete sand · pea gravel</span>
                </div>
                <div className="mat-body">
                  <div className="mat-title">Concrete &amp; structural</div>
                  <div className="mat-spec">Used for concrete mix, paver base, and structural fill. Rounded, washed, ⅜″ aggregate that meets concrete spec.</div>
                  <div className="mat-meta"><span className="mat-chip">⅜″ rounded</span><span className="mat-chip">Concrete sand</span><span className="mat-chip">Pea gravel</span></div>
                  <div className="mat-foot">
                    <div className="mat-trucks">Fits <b>standard / tri-axle</b></div>
                    <a className="mat-cta" href="#zipForm">Get a quote <ArrowRight size={14} weight={2.2} /></a>
                  </div>
                </div>
              </article>

              {/* 6: Audience-aware brand CTA */}
              <MaterialsCard6 />
            </div>
          </div>
        </section>

        {/* QUANTITY HELPER */}
        <section className="section" id="sizing">
          <div className="max">
            <div style={{ marginBottom: 48 }}>
              <div className="eyebrow">Sizing</div>
              <h2 className="sec-title" style={{ maxWidth: 760 }}>How much you'll actually need.</h2>
              <p className="ink-2" style={{ marginTop: 16, fontSize: 18, maxWidth: 640 }}>Bulk material sells by the ton, not the bag. Enter your area, we'll size the load and pick the truck.</p>
            </div>

            <div className="truck-grid">
              <div className="card" style={{ padding: 20 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 12 }}>
                  <div style={{ fontSize: 13, color: 'var(--ink-2)' }}>Small dump</div>
                  <div className="num" style={{ fontSize: 16 }}>5 ton</div>
                </div>
                <div style={{ height: 110, display: 'flex', alignItems: 'flex-end' }}>
                  <svg viewBox="0 0 240 90" style={{ width: '80%' }}>
                    <path d="M70 40 L160 40 L170 65 L60 65 Z" fill="#0F1411" />
                    <path d="M75 40 Q 115 22 155 40 Z" fill="#B8472A" />
                    <path d="M160 40 L195 40 L195 65 L170 65 Z" fill="#0F1411" />
                    <rect x="170" y="44" width="20" height="12" fill="#FAFAF7" />
                    <circle cx="85" cy="68" r="9" fill="#0F1411" /><circle cx="85" cy="68" r="3" fill="#FAFAF7" />
                    <circle cx="155" cy="68" r="9" fill="#0F1411" /><circle cx="155" cy="68" r="3" fill="#FAFAF7" />
                    <circle cx="183" cy="68" r="9" fill="#0F1411" /><circle cx="183" cy="68" r="3" fill="#FAFAF7" />
                  </svg>
                </div>
                <div className="display" style={{ fontSize: 20, marginTop: 12 }}>Single-driveway scale</div>
                <p className="ink-2" style={{ fontSize: 14, marginTop: 4 }}>Covers ~50 sq ft at 4″ deep. Fits tight access — narrow gates, low branches, one-car drives.</p>
              </div>
              <div className="card" style={{ padding: 20 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 12 }}>
                  <div style={{ fontSize: 13, color: 'var(--ink-2)' }}>Standard dump</div>
                  <div className="num" style={{ fontSize: 16 }}>14 ton</div>
                </div>
                <div style={{ height: 110, display: 'flex', alignItems: 'flex-end' }}>
                  <svg viewBox="0 0 320 90" style={{ width: '90%' }}>
                    <path d="M50 35 L220 35 L235 65 L40 65 Z" fill="#0F1411" />
                    <path d="M58 35 Q 138 12 215 35 Z" fill="#B8472A" />
                    <path d="M220 35 L275 35 L275 65 L235 65 Z" fill="#0F1411" />
                    <rect x="232" y="40" width="32" height="14" fill="#FAFAF7" />
                    <circle cx="70" cy="68" r="11" fill="#0F1411" /><circle cx="70" cy="68" r="4" fill="#FAFAF7" />
                    <circle cx="160" cy="68" r="11" fill="#0F1411" /><circle cx="160" cy="68" r="4" fill="#FAFAF7" />
                    <circle cx="190" cy="68" r="11" fill="#0F1411" /><circle cx="190" cy="68" r="4" fill="#FAFAF7" />
                    <circle cx="255" cy="68" r="11" fill="#0F1411" /><circle cx="255" cy="68" r="4" fill="#FAFAF7" />
                  </svg>
                </div>
                <div className="display" style={{ fontSize: 20, marginTop: 12 }}>Most common load</div>
                <p className="ink-2" style={{ fontSize: 14, marginTop: 4 }}>Covers ~140 sq ft at 4″ deep. The right load for most residential and small commercial jobs.</p>
              </div>
              <div className="card" style={{ padding: 20 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 12 }}>
                  <div style={{ fontSize: 13, color: 'var(--ink-2)' }}>Tri-axle</div>
                  <div className="num" style={{ fontSize: 16 }}>25 ton</div>
                </div>
                <div style={{ height: 110, display: 'flex', alignItems: 'flex-end' }}>
                  <svg viewBox="0 0 400 90" style={{ width: '100%' }}>
                    <path d="M40 28 L260 28 L280 65 L30 65 Z" fill="#0F1411" />
                    <path d="M48 28 Q 150 4 255 28 Z" fill="#B8472A" />
                    <path d="M260 28 L340 28 L340 65 L280 65 Z" fill="#0F1411" />
                    <rect x="285" y="34" width="48" height="16" fill="#FAFAF7" />
                    <circle cx="68" cy="68" r="13" fill="#0F1411" /><circle cx="68" cy="68" r="4" fill="#FAFAF7" />
                    <circle cx="160" cy="68" r="13" fill="#0F1411" /><circle cx="160" cy="68" r="4" fill="#FAFAF7" />
                    <circle cx="195" cy="68" r="13" fill="#0F1411" /><circle cx="195" cy="68" r="4" fill="#FAFAF7" />
                    <circle cx="230" cy="68" r="13" fill="#0F1411" /><circle cx="230" cy="68" r="4" fill="#FAFAF7" />
                    <circle cx="318" cy="68" r="13" fill="#0F1411" /><circle cx="318" cy="68" r="4" fill="#FAFAF7" />
                  </svg>
                </div>
                <div className="display" style={{ fontSize: 20, marginTop: 12 }}>Contractor scale</div>
                <p className="ink-2" style={{ fontSize: 14, marginTop: 4 }}>Covers ~250 sq ft at 4″ deep. Sized for large fills, pad prep, and split deliveries.</p>
              </div>
            </div>

            <CoverageCalculator />
          </div>
        </section>

        {/* HOW IT WORKS */}
        <section className="section trust-band" id="how">
          <div className="max">
            <div style={{ marginBottom: 48 }}>
              <div className="eyebrow">How it works</div>
              <h2 className="sec-title" style={{ maxWidth: 820 }}>From ZIP to drop-zone in three steps.</h2>
              <p className="ink-2" style={{ marginTop: 16, fontSize: 17, maxWidth: 640 }}>No phone tag. No "we'll call you back." The full path, in your hands.</p>
            </div>
            <div className="steps-grid">
              <div className="step">
                <div className="step-num">01</div>
                <h3 className="display" style={{ fontSize: 22, marginTop: 20 }}>Quote your ZIP.</h3>
                <p className="ink-2" style={{ marginTop: 8, fontSize: 15 }}>Drop your ZIP to confirm we deliver. Pick the outcome — driveway base, drainage, fill, soil, or structural — and we match the spec from the closest yard.</p>
              </div>
              <div className="step">
                <div className="step-num">02</div>
                <h3 className="display" style={{ fontSize: 22, marginTop: 20 }}>Schedule the load.</h3>
                <p className="ink-2" style={{ marginTop: 8, fontSize: 15 }}>Pick the date and window. Drop a pin for placement. Add the gate code, the slope, the low branch — your driver reads it before the truck rolls.</p>
              </div>
              <div className="step">
                <div className="step-num">03</div>
                <h3 className="display" style={{ fontSize: 22, marginTop: 20 }}>Dispatch and drop.</h3>
                <p className="ink-2" style={{ marginTop: 8, fontSize: 15 }}>Driver assigned from the nearest yard. Live ETA. Photo and signed ticket attached the moment the truck tips. One-tap reorder for the next load.</p>
              </div>
            </div>
          </div>
        </section>

        {/* TRUST / CAPABILITIES */}
        <section className="section trust-band" id="trust" style={{ borderTop: 0 }}>
          <div className="max">
            <div style={{ marginBottom: 48 }}>
              <div className="eyebrow">What you get</div>
              <h2 className="sec-title" style={{ maxWidth: 820 }}>Built for the way crews actually work.</h2>
              <p className="ink-2" style={{ marginTop: 16, fontSize: 17, maxWidth: 640 }}>What ships, what's earned. Each line below maps to a real product capability — not a marketing claim.</p>
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
                  <summary><span>I'm a homeowner — can I order from here?</span><span className="chev"><ChevronDown /></span></summary>
                  <div>Homeowner ordering lives on our sister site, <a href="https://filldirtnearme.net" target="_blank" rel="noopener" className="link" style={{ fontSize: 'inherit' }}>FillDirtNearMe.net <span className="arr">→</span></a>. Same yards, same trucks, simpler flow for one-off jobs.</div>
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
                <a href="https://filldirtnearme.net" target="_blank" rel="noopener" className="btn" style={{ height: 48, padding: '0 20px', fontSize: 15, background: 'rgba(255,255,255,.10)', color: '#fff', border: '1px solid rgba(255,255,255,.18)' }}>
                  I'm a homeowner <ExternalArrow size={14} />
                </a>
              </div>
            </div>
          </div>
        </section>

        {/* FOOTER */}
        <footer>
          <div className="max">
            <div className="foot-grid">
              <div>
                <div className="foot-logo">EarthMove<span className="dot">.</span></div>
                <p className="ink-2" style={{ fontSize: 15, marginTop: 12, maxWidth: 360 }}>Bulk aggregate, delivered to the hour.</p>
                <div className="foot-pills">
                  <span className="foot-pill">Denver</span>
                  <span className="foot-pill">Dallas–Fort Worth</span>
                  <span className="foot-pill dashed">More cities soon</span>
                </div>
              </div>
              <div>
                <div className="foot-h">Product</div>
                <ul className="foot-list">
                  <li><a href="#trust">For contractors</a></li>
                  <li><a href="https://filldirtnearme.net" target="_blank" rel="noopener" className="ext">For homeowners <ExternalArrow /></a></li>
                  <li><a href="#suppliers">Suppliers · sell on EarthMove</a></li>
                  <li><a href="https://dumpsite.io" target="_blank" rel="noopener" className="ext">Drivers · dispatch <ExternalArrow /></a></li>
                  <li><a href="#faq">FAQ</a></li>
                </ul>
              </div>
              <div>
                <div className="foot-h">Company</div>
                <ul className="foot-list">
                  <li><a href="#about">About</a></li>
                  <li><a href="#careers">Careers</a></li>
                  <li><a href="#contact">Contact</a></li>
                  <li><a href="#press">Press</a></li>
                  <li><a href="#blog">Blog</a></li>
                </ul>
              </div>
            </div>
            <div className="foot-bottom">
              <div>© 2026 EarthMove, Inc.</div>
              <div className="right">
                <a href="#">Terms</a>
                <a href="#">Privacy</a>
                <a href="#" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><span className="live" /> Network online</a>
              </div>
            </div>
          </div>
        </footer>
      </AudienceProvider>
    </div>
  )
}
