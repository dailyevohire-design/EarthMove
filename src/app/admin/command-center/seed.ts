import type {
  SeedTask, SeedGate, SeedRisk, SeedDecision, SeedPatent, DashboardState,
} from './types'

export const LAUNCH_DATE = new Date('2026-05-12T08:00:00-05:00')
export const SPRINT_START = new Date('2026-04-21T00:00:00')
export const SPRINT_END = new Date('2026-08-11T23:59:59')

export const SEED_TASKS: readonly SeedTask[] = [
  { id: 'w1-eng', week: 1, weekLabel: 'Week 1', weekRange: 'Apr 21–27', tMinus: 'T-21 → T-15', workstream: 'Engineering', owner: 'VPE', title: 'Close /api/trust 500; deploy Cloudflare Worker reps.earthmove.io; Sarah SMS PEWC capture live in staging', exit: '/api/trust returns HTTP 200 on load test; reps.earthmove.io resolves; PEWC capture logs to Supabase with a test send', kill: 'If Upstash Redis URL parse is not closed by April 24 the launch-blocker status escalates to the CEO call on April 27', spend: 2000, tier: 1 },
  { id: 'w1-pat', week: 1, weekLabel: 'Week 1', weekRange: 'Apr 21–27', tMinus: 'T-21 → T-15', workstream: 'Patent', owner: 'CPC', title: 'Confirm fourth provisional filing ($65 micro-entity)', exit: 'USPTO filing receipt in hand', kill: 'If not filed by April 22, PCT deadline moves to April 20, 2027 and claim set must be re-scoped', spend: 65, tier: 1 },
  { id: 'w1-sales', week: 1, weekLabel: 'Week 1', weekRange: 'Apr 21–27', tMinus: 'T-21 → T-15', workstream: 'Sales', owner: 'CRO / VPS', title: 'Hillwood warm-intro sent; Centurion American contract sent; Texas Mutual SIU exploratory scheduled', exit: 'Intro sent, contract out, call calendared', kill: '—', spend: 0, tier: 2 },
  { id: 'w1-field', week: 1, weekLabel: 'Week 1', weekRange: 'Apr 21–27', tMinus: 'T-21 → T-15', workstream: 'Field Ops', owner: 'VPO', title: '12/12 rep compliance audit; Micah offboarding; FD-0108 and FD-JOHN admin access audit', exit: 'Nine-rep roster cleaned to 4-6 compliant with documented decision on the 5 blocked', kill: 'Below 6 compliant by April 27, Denver launch capacity falls below floor', spend: 5000, tier: 1 },
  { id: 'w1-legal', week: 1, weekLabel: 'Week 1', weekRange: 'Apr 21–27', tMinus: 'T-21 → T-15', workstream: 'Legal/Compliance', owner: 'GC / CCO', title: 'TCPA PEWC reviewed; 10DLC confirmed; FCRA passthrough documented; TX data-broker registration filed', exit: 'Signed-off PEWC template in production; TX registration confirmation', kill: '—', spend: 4000, tier: 2 },
  { id: 'w1-gov', week: 1, weekLabel: 'Week 1', weekRange: 'Apr 21–27', tMinus: 'T-21 → T-15', workstream: 'Government Affairs', owner: 'VPGA', title: 'Dallas Code Compliance meeting scheduled (Sweckard/Kidd/Ramirez); Denver DOTI call scheduled', exit: 'Two meetings on calendar', kill: '—', spend: 0, tier: 3 },
  { id: 'w2-eng', week: 2, weekLabel: 'Week 2', weekRange: 'Apr 28–May 4', tMinus: 'T-14 → T-8', workstream: 'Engineering', owner: 'VPE', title: 'DumpSite.io controlled-release UX in prod; Stripe Connect payouts live with $1 test; GC enterprise-pilot UI for Texas Mutual', exit: '$1 Stripe test clears; UX passes regression; GC UI demo-able', kill: '—', spend: 4000, tier: 1 },
  { id: 'w2-pat', week: 2, weekLabel: 'Week 2', weekRange: 'Apr 28–May 4', tMinus: 'T-14 → T-8', workstream: 'Patent', owner: 'CPC', title: 'Track One non-provisional cluster j filed May 5', exit: 'USPTO receipt cluster j', kill: '—', spend: 5333, tier: 2 },
  { id: 'w2-sales', week: 2, weekLabel: 'Week 2', weekRange: 'Apr 28–May 4', tMinus: 'T-14 → T-8', workstream: 'Sales', owner: 'CRO / VPS', title: 'Hillwood first meeting held; Trammell Crow intro booked; McWhinney intro booked; Zurich cold-outreach started', exit: 'Hillwood meeting notes circulated', kill: '—', spend: 3000, tier: 2 },
  { id: 'w2-field', week: 2, weekLabel: 'Week 2', weekRange: 'Apr 28–May 4', tMinus: 'T-14 → T-8', workstream: 'Field Ops', owner: 'VPO', title: '2 DFW site operators + 2 Denver site operators signed; driver recruiting to 30', exit: 'Signed site-operator agreements; 30 drivers with 10DLC consent', kill: 'Fewer than 2 operators per metro forces supply-side delay', spend: 6000, tier: 1 },
  { id: 'w2-legal', week: 2, weekLabel: 'Week 2', weekRange: 'Apr 28–May 4', tMinus: 'T-14 → T-8', workstream: 'Legal', owner: 'GC / CCO', title: 'CA and OR data-broker registrations; DMCA Section 512(c) designated agent; Checkr or Certn passthrough contract signed', exit: 'Registrations filed; Checkr contract executed', kill: '—', spend: 5000, tier: 2 },
  { id: 'w2-hire', week: 2, weekLabel: 'Week 2', weekRange: 'Apr 28–May 4', tMinus: 'T-14 → T-8', workstream: 'Hire', owner: 'CEO / VPP', title: 'Head of Operations candidate interviewed by May 4 — #1 Week 2 action', exit: 'Named candidate with offer out by May 4', kill: 'No candidate by May 4 forces Option 1 fallback to Option 2 (full founder silence)', spend: 10000, tier: 1 },
  { id: 'w2-press', week: 2, weekLabel: 'Week 2', weekRange: 'Apr 28–May 4', tMinus: 'T-14 → T-8', workstream: 'Press', owner: 'CMO', title: 'Embargo outreach to 5-reporter list (Hethcock, Avery, Obando + 2; Slothower/Bach deferred)', exit: 'Three embargo verbals', kill: '—', spend: 0, tier: 2 },
  { id: 'w3-eng', week: 3, weekLabel: 'Week 3', weekRange: 'May 5–11', tMinus: 'T-7 → T-1', workstream: 'Engineering', owner: 'VPE', title: 'Full prod freeze May 9; final regression May 10; go-live checklist signed by VPE, COO, CEO', exit: 'Signed checklist in repo', kill: '—', spend: 2000, tier: 1 },
  { id: 'w3-pat1', week: 3, weekLabel: 'Week 3', weekRange: 'May 5–11', tMinus: 'T-7 → T-1', workstream: 'Patent', owner: 'CPC', title: 'Track One cluster d filed May 6', exit: 'USPTO receipt cluster d', kill: '—', spend: 5333, tier: 2 },
  { id: 'w3-sales', week: 3, weekLabel: 'Week 3', weekRange: 'May 5–11', tMinus: 'T-7 → T-1', workstream: 'Sales', owner: 'CRO / VPS', title: 'Centurion American contract signed; Hillwood verbal; Texas Mutual SIU paper out', exit: 'Centurion in Stripe; Hillwood email verbal', kill: '—', spend: 2000, tier: 2 },
  { id: 'w3-field', week: 3, weekLabel: 'Week 3', weekRange: 'May 5–11', tMinus: 'T-7 → T-1', workstream: 'Field Ops', owner: 'VPO', title: '12/12 reps compliant or cut; driver recruiting to 45', exit: 'Compliant-rep count >= 6 DFW and >= 4 Denver', kill: 'Below floor, DFW or Denver launch in that metro delays 30 days', spend: 6000, tier: 1 },
  { id: 'w3-ready', week: 3, weekLabel: 'Week 3', weekRange: 'May 5–11', tMinus: 'T-7 → T-1', workstream: 'Launch Readiness', owner: 'COO', title: 'Go/no-go gate review (Section 7) completed May 11', exit: 'Signed go/no-go memo from each of the 24 seats', kill: '—', spend: 0, tier: 1 },
  { id: 'w3-press', week: 3, weekLabel: 'Week 3', weekRange: 'May 5–11', tMinus: 'T-7 → T-1', workstream: 'Press', owner: 'CMO', title: 'Embargo lockup with >=3 of 5 reporters; press release final (Option 1 posture); HoO quote authored', exit: 'Embargo confirmations in writing', kill: '—', spend: 3000, tier: 2 },
  { id: 'w4-launch', week: 4, weekLabel: 'Week 4', weekRange: 'May 12–18', tMinus: 'LAUNCH', workstream: 'Launch Day', owner: 'CEO / COO', title: 'May 12: DumpSite.io / FillDirtNearMe.net / EarthMove.io live; press release 8 AM CT; GC trust-score endpoint demo-ready', exit: 'Three-surface up and monitored; press release on wire', kill: 'Sev-1 (payment failure, /api/trust outage, SMS compliance breach) forces rollback', spend: 20000, tier: 1 },
  { id: 'w4-press', week: 4, weekLabel: 'Week 4', weekRange: 'May 12–18', tMinus: 'LAUNCH', workstream: 'Press Follow-Through', owner: 'VPM / CMO', title: 'Press coverage aggregation; initial DumpSite.io transaction volume; first paid transaction cleared', exit: 'Three press hits; first paid transaction', kill: '—', spend: 0, tier: 2 },
  { id: 'w4-pat1', week: 4, weekLabel: 'Week 4', weekRange: 'May 12–18', tMinus: 'LAUNCH', workstream: 'Patent', owner: 'CPC', title: 'Track One cluster b filed May 13', exit: 'USPTO receipt cluster b', kill: '—', spend: 5333, tier: 2 },
  { id: 'w4-pat2', week: 4, weekLabel: 'Week 4', weekRange: 'May 12–18', tMinus: 'LAUNCH', workstream: 'Patent', owner: 'CPC', title: 'Track One cluster g filed May 15', exit: 'USPTO receipt cluster g', kill: '—', spend: 5333, tier: 2 },
  { id: 'w5-sales', week: 5, weekLabel: 'Weeks 5–6', weekRange: 'May 19–Jun 1', tMinus: 'POST', workstream: 'Sales', owner: 'CRO', title: 'Hillwood paper out; McWhinney first meeting; Trammell Crow first meeting; Texas Mutual SIU exploratory deepens', exit: 'Hillwood in redline; two new meetings held', kill: '—', spend: 0, tier: 2 },
  { id: 'w5-field', week: 5, weekLabel: 'Weeks 5–6', weekRange: 'May 19–Jun 1', tMinus: 'POST', workstream: 'Field Ops', owner: 'VPO', title: 'Driver recruiting to 60; site-operator count to 3 DFW / 3 Denver', exit: '60 drivers with PEWC on file', kill: '—', spend: 10000, tier: 2 },
  { id: 'w5-eng', week: 5, weekLabel: 'Weeks 5–6', weekRange: 'May 19–Jun 1', tMinus: 'POST', workstream: 'Engineering', owner: 'VPE', title: 'PlanetScope API contracting evaluated; SMS Commit 3 complete', exit: 'Go/no-go on PlanetScope', kill: '—', spend: 0, tier: 3 },
  { id: 'w5-gov', week: 5, weekLabel: 'Weeks 5–6', weekRange: 'May 19–Jun 1', tMinus: 'POST', workstream: 'Government Affairs', owner: 'VPGA', title: 'Dallas Code Compliance MOU draft circulated', exit: 'Draft in Sweckard review', kill: '—', spend: 0, tier: 3 },
  { id: 'w7-sales', week: 7, weekLabel: 'Weeks 7–8', weekRange: 'Jun 2–15', tMinus: 'POST', workstream: 'Sales', owner: 'CRO', title: 'Hillwood paper in; Trammell Crow pilot close; Brue Baukol opening; Zurich first call', exit: 'Two paid closes logged', kill: '—', spend: 0, tier: 2 },
  { id: 'w7-prod', week: 7, weekLabel: 'Weeks 7–8', weekRange: 'Jun 2–15', tMinus: 'POST', workstream: 'Product', owner: 'CPO', title: '90-day roadmap public (to customers, not press) — six additional satellite SKUs sequenced with named-pilot customers', exit: 'Six SKUs with LOI', kill: '—', spend: 0, tier: 2 },
  { id: 'w7-pat', week: 7, weekLabel: 'Weeks 7–8', weekRange: 'Jun 2–15', tMinus: 'POST', workstream: 'Patent', owner: 'CPC', title: 'Trade-secret audit on 4 forbidden categories (margin math, pricing transforms, Sarah prompts, cross-agent isolation)', exit: 'Audit memo dated and signed; claims scrubbed', kill: '—', spend: 0, tier: 2 },
  { id: 'w9-sales', week: 9, weekLabel: 'Weeks 9–10', weekRange: 'Jun 16–29', tMinus: 'POST', workstream: 'Sales', owner: 'CRO', title: 'McWhinney pilot close; Hines first meeting; East West Partners exploratory', exit: 'Three paid closes YTD', kill: '—', spend: 0, tier: 2 },
  { id: 'w9-ops', week: 9, weekLabel: 'Weeks 9–10', weekRange: 'Jun 16–29', tMinus: 'POST', workstream: 'Operations', owner: 'COO', title: 'DFW + Denver marketplace steady-state metrics published internally', exit: 'Metrics dashboard in production', kill: '—', spend: 0, tier: 3 },
  { id: 'w9-pdx', week: 9, weekLabel: 'Weeks 9–10', weekRange: 'Jun 16–29', tMinus: 'POST', workstream: 'Portland Prep', owner: 'VPO / VPGA', title: 'First Portland rep identified; Metro RID Patrol (Rawson) introductory call held', exit: 'Candidate rep in diligence; meeting held', kill: '—', spend: 5000, tier: 3 },
  { id: 'w11-sales', week: 11, weekLabel: 'Weeks 11–12', weekRange: 'Jun 30–Jul 13', tMinus: 'POST', workstream: 'Sales', owner: 'CRO', title: 'Hines Dallas pilot close; Centurion American expansion; Texas Mutual SIU paper out', exit: 'Five paid closes YTD', kill: '—', spend: 0, tier: 2 },
  { id: 'w11-gc', week: 11, weekLabel: 'Weeks 11–12', weekRange: 'Jun 30–Jul 13', tMinus: 'POST', workstream: 'Ground Check', owner: 'HoTS', title: 'Second carrier pilot engaged (Travelers or Nationwide Construction)', exit: 'Exploratory meeting held', kill: '—', spend: 0, tier: 3 },
  { id: 'w11-legal', week: 11, weekLabel: 'Weeks 11–12', weekRange: 'Jun 30–Jul 13', tMinus: 'POST', workstream: 'Legal', owner: 'GC', title: 'Mid-sprint risk review; CA/OR/TX regulatory changes reflected', exit: 'Reviewed memo circulated', kill: '—', spend: 0, tier: 3 },
  { id: 'w13-sales', week: 13, weekLabel: 'Weeks 13–14', weekRange: 'Jul 14–27', tMinus: 'POST', workstream: 'Sales', owner: 'CRO', title: 'East West Partners close; Zurich paper out; Brue Baukol expansion', exit: 'Seven paid closes YTD', kill: '—', spend: 0, tier: 2 },
  { id: 'w13-prod', week: 13, weekLabel: 'Weeks 13–14', weekRange: 'Jul 14–27', tMinus: 'POST', workstream: 'Product', owner: 'CPO', title: '90-day SKU set live in prod (six additional satellite SKUs)', exit: 'Six SKUs instrumented and billed', kill: '—', spend: 0, tier: 2 },
  { id: 'w13-press', week: 13, weekLabel: 'Weeks 13–14', weekRange: 'Jul 14–27', tMinus: 'POST', workstream: 'Press Wave 2', owner: 'CMO', title: 'Second press moment — Dirt Cost Index v1 (if CMO + GC clear framing)', exit: 'Dirt Cost Index v1 published', kill: '—', spend: 0, tier: 3 },
  { id: 'w15-sales', week: 15, weekLabel: 'Weeks 15–16', weekRange: 'Jul 28–Aug 10', tMinus: 'POST', workstream: 'Sales', owner: 'CRO', title: 'Texas Mutual SIU close; Zurich expansion; Hillwood expansion', exit: 'Ten closes or verbals — Section 2 list closed', kill: '—', spend: 0, tier: 2 },
  { id: 'w15-pdx', week: 15, weekLabel: 'Weeks 15–16', weekRange: 'Jul 28–Aug 10', tMinus: 'POST', workstream: 'Portland Go-Decision', owner: 'COO / CEO', title: 'Go/no-go on Portland September launch', exit: 'Decision memo', kill: '—', spend: 0, tier: 2 },
  { id: 'w15-pat', week: 15, weekLabel: 'Weeks 15–16', weekRange: 'Jul 28–Aug 10', tMinus: 'POST', workstream: 'Patent', owner: 'CPC', title: 'Continuation strategy for 4 provisionals drafted (PCT Apr 8/Apr 20, 2027)', exit: 'Draft PCT strategy', kill: '—', spend: 0, tier: 3 },
  { id: 'w16-retro', week: 16, weekLabel: 'Week 17', weekRange: 'Aug 11', tMinus: 'RETRO', workstream: 'Retrospective', owner: 'COO / CEO', title: '90-day retrospective; revised Year-1 plan; revised patent budget; revised customer list', exit: 'Retrospective memo; next-90 plan signed', kill: '—', spend: 0, tier: 2 },
]

export const SEED_GATES: readonly SeedGate[] = [
  { id: 'g1',  title: '/api/trust returns HTTP 200 under load (Upstash Redis URL parse fixed)', owner: 'VPE', verify: 'Load-test log in the repo, dated May 10', category: 'Engineering' },
  { id: 'g2',  title: 'Fourth provisional filed with USPTO receipt in hand', owner: 'CPC', verify: 'USPTO receipt PDF — URGENT TODAY, NOT MAY 11', category: 'Patent' },
  { id: 'g3',  title: '60 drivers onboarded with PEWC on file', owner: 'VPO', verify: 'Supabase query showing 60 driver rows with PEWC timestamps and active 10DLC consent', category: 'Field Ops' },
  { id: 'g4',  title: '12/12 reps compliant or non-compliant terminated', owner: 'VPO', verify: 'Signed compliance audit memo (4/4 is floor)', category: 'Field Ops' },
  { id: 'g5',  title: 'TCPA PEWC capture working on every Sarah send, end-to-end', owner: 'CCO / VPE', verify: 'Production log of test sends with PEWC metadata', category: 'Legal' },
  { id: 'g6',  title: 'First 5 customers closed or verbally committed (Section 2 list)', owner: 'CRO', verify: 'Stripe records (closed) or signed email threads (verbal)', category: 'Sales' },
  { id: 'g7',  title: 'Minimum 3 municipal partnership conversations active', owner: 'VPGA', verify: 'Dallas Code Compliance + Denver DOTI + one third', category: 'Gov Affairs' },
  { id: 'g8',  title: 'Press embargo locked with ≥ 3 of 5 top reporters', owner: 'CMO', verify: 'Written embargo agreements (Hethcock, Avery, Obando + 2)', category: 'Press' },
  { id: 'g9',  title: 'Head of Operations named OR Option 2 founder-posture fallback ratified in writing', owner: 'CEO', verify: 'HoO offer-accepted email OR signed CEO memo', category: 'People' },
  { id: 'g10', title: 'Controlled-release DumpSite.io UX functional end-to-end', owner: 'CPO / VPE', verify: 'Signed regression report dated May 10', category: 'Engineering' },
  { id: 'g11', title: 'Stripe Connect supplier payouts live with $1 test clearing', owner: 'VPE', verify: 'Stripe dashboard showing cleared transaction', category: 'Engineering' },
  { id: 'g12', title: 'Cloudflare Worker reps.earthmove.io deployed to production', owner: 'VPE', verify: 'DNS and production URL live', category: 'Engineering' },
]

export const DELAY_TRIGGERS: readonly string[] = [
  'Any Tier-1 gate missed',
  'Fourth provisional unfiled by end-of-day April 22',
  'Rep compliance below 4/4 in DFW on May 11',
  'Ground Check /api/trust not green by May 10',
  'Reportable incident during Week 3 prod freeze (Sev-1 Stripe or SMS)',
  'Newly surfaced regulatory shock (CA or TX AG action; FCC TCPA rule change)',
]

export const PIVOT_TRIGGERS: readonly string[] = [
  'Soil Connect announces Series B with category-defining lead investor between April 21 and May 12',
  'Command Alkon acquires a second contractor-side target (already owns Digital Fleet since June 2025)',
  'Shovels.ai launches a marketplace surface',
  'Trimble-Procore announces a combined construction-tech platform',
]

export const SEED_RISKS: readonly SeedRisk[] = [
  { id: 'r1', name: 'Runway / burn-rate discipline',    severity: 4, likelihood: 3, roles: ['CFO', 'CEO', 'VPR'],         mitigation: 'Monthly burn sheet signed by CFO before May 1; patent budget reserve separated; PlanetScope contracting deferred to post-revenue signal.' },
  { id: 'r2', name: 'Fourth provisional unconfirmed',   severity: 5, likelihood: 4, roles: ['CPC', 'GC', 'CCO-IR'],       mitigation: 'CPC authorized to file tomorrow morning with drop-everything priority; $65 from patent budget; USPTO receipt confirms resolution.' },
  { id: 'r3', name: 'Head of Operations unfilled',       severity: 5, likelihood: 3, roles: ['COO', 'CoS', 'VPP'],         mitigation: 'April 28 drop-dead; fractional-first bridge acceptable; Option 2 is ratified fallback if no candidate by May 4.' },
  { id: 'r4', name: 'Purpose Trust unformed',            severity: 3, likelihood: 4, roles: ['CEO', 'VPR', 'CEO-Eth'],     mitigation: 'Flagged as Juan-level governance gap; acquirer-diligence surprise risk; deferred to post-launch legal workstream.' },
  { id: 'r5', name: 'Recentive patent exposure',         severity: 4, likelihood: 3, roles: ['CPC', 'GC', 'CPO'],          mitigation: 'Claim-language remediation in non-provisional drafting (May 5 clock); 4-6 claims identified for rewrite; invention (n) not filed.' },
  { id: 'r6', name: 'TCPA exposure',                     severity: 5, likelihood: 2, roles: ['GC', 'CCO', 'VPE'],          mitigation: 'PEWC capture live in prod by May 9; 10DLC registered; STOP-within-ten-business-days; 8 AM-9 PM local window enforced.' },
  { id: 'r7', name: 'Acquirer no-show / exit-window math', severity: 4, likelihood: 3, roles: ['VPR', 'CCO-IR'],           mitigation: 'Two-track thesis preserved; Track A optimizes for $75-200M; Track B preserves $1B option; acquirer relationship-building flagged as post-launch.' },
  { id: 'r8', name: 'Sarah persona reveal',              severity: 4, likelihood: 2, roles: ['HoTS', 'CMO'],               mitigation: 'No AI language in press (Option 1); Sarah framed as SMS channel, not named entity; preventive only — reveal is unmitigable.' },
]

export const SEED_DECISIONS: readonly SeedDecision[] = [
  {
    id: 'd1', question: 'Founder Posture', urgency: 'by May 4',
    context: 'Moving Dirt says Juan is visible vessel. Launch Playbook v2 says founder invisible. Blueprint names Juan in press release. Cannot all be true.',
    options: [
      { key: 'A', label: 'Option 1 — Hybrid', recommended: true, detail: 'HoO fronts local-metro press and municipal; Juan fronts enterprise, capital, patent. Requires HoO named by May 4.' },
      { key: 'B', label: 'Option 2 — Full Launch Playbook v2', detail: 'Founder invisible 180 days. Lowest legal exposure. Cleanest municipal posture. Forfeits Dirt Week and LinkedIn compounding.' },
      { key: 'C', label: 'Option 3 — Full Moving Dirt', detail: 'Juan visible everywhere. Maximum narrative compounding. Maximum exposure under Recentive and TCPA.' },
    ],
  },
  {
    id: 'd2', question: 'Launch Markets', urgency: 'by Apr 27',
    context: 'Execution Brief says DFW + Denver. Launch Playbook v2 adds Portland. Memory shows zero reps or site operators in Portland.',
    options: [
      { key: 'A', label: 'Option 1 — DFW + Denver only', recommended: true, detail: 'Portland deferred to September 2026. Preserves Metro RID Patrol. Saves $180–220K. 6 roles vs 2 vs 1.' },
      { key: 'B', label: 'Option 2 — DFW + Denver + Portland soft launch July', detail: 'Middle path. Soft launch with named reporter list creates PR ambiguity.' },
      { key: 'C', label: 'Option 3 — All three simultaneously', detail: 'Requires 30-60 day delay or cold Portland launch. Both unacceptable to VPO.' },
    ],
  },
  {
    id: 'd3', question: 'Press Posture on Patents, AI, Tech Stack', urgency: 'by May 8',
    context: 'Execution Brief suggests LinkedIn posts on patents. Launch Playbook v2 says silence. Blueprint names 52 patents and AI-native.',
    options: [
      { key: 'A', label: 'Option 1 — Launch Playbook v2 silence', recommended: true, detail: 'No patents, no AI, no tech stack, no margin in press. 7 roles back this.' },
      { key: 'B', label: 'Option 2 — Patent-pending infrastructure', detail: 'Single phrase, no numbers. Unobjectionable under USPTO marking rules but invites Recentive follow-up.' },
      { key: 'C', label: 'Option 3 — Blueprint posture', detail: 'Name 52 patents, AI-native. No one in room endorses after CPC framing of Section 102(b) and Alice exposure.' },
    ],
  },
]

export const SEED_PATENTS: readonly SeedPatent[] = [
  { id: 'p0',     title: 'Fourth Provisional',                        cost: '$65 micro-entity', type: 'Provisional',              dueDate: '2026-04-22', notes: '6 inventions / 15 claims. Drafted April 15. URGENT — single most time-urgent item.' },
  { id: 'p-j',    title: 'Track One — Cluster j',                     cost: '$5,333',           type: 'Non-Provisional (Track One)', dueDate: '2026-05-05', notes: 'Track One expedited examination.' },
  { id: 'p-d',    title: 'Track One — Cluster d',                     cost: '$5,333',           type: 'Non-Provisional (Track One)', dueDate: '2026-05-06', notes: 'Track One expedited examination.' },
  { id: 'p-b',    title: 'Track One — Cluster b',                     cost: '$5,333',           type: 'Non-Provisional (Track One)', dueDate: '2026-05-13', notes: 'Filed during launch week.' },
  { id: 'p-g',    title: 'Track One — Cluster g',                     cost: '$5,333',           type: 'Non-Provisional (Track One)', dueDate: '2026-05-15', notes: 'Fourth and final Track One.' },
  { id: 'p-pct1', title: 'PCT Consolidated (Provisionals 1–3)',       cost: '~$4k filing',      type: 'PCT',                       dueDate: '2027-04-08', notes: '12-month PCT bar for the three provisionals filed April 10–12, 2026.' },
  { id: 'p-pct4', title: 'PCT (Fourth Provisional)',                  cost: '~$4k filing',      type: 'PCT',                       dueDate: '2027-04-20', notes: '12-month PCT bar for the fourth provisional.' },
]

export const SIGNOFF_SEATS: readonly string[] = [
  'CEO','COO','CFO','CPO','CRO','CMO','CCO','GC','CPC','VPE','VPO','VPS','VPP','VPM','VPGA','VPR','HoTS','CoS','CEO-Eth','CCO-IR','BoardChair','LeadInvestor','AdvPatent','AdvGTM',
]

export function buildInitial(): DashboardState {
  return {
    tasks: Object.fromEntries(SEED_TASKS.map(t => [t.id, { status: 'Not Started' as const, notes: '', updatedAt: null }])),
    gates: Object.fromEntries(SEED_GATES.map(g => [g.id, { status: 'Red' as const, notes: '' }])),
    risks: Object.fromEntries(SEED_RISKS.map(r => [r.id, { status: 'Open' as const, changeMyMind: '', owner: r.roles[0] ?? '' }])),
    decisions: Object.fromEntries(SEED_DECISIONS.map(d => [d.id, { choice: '' as const, resolvedAt: null }])),
    provisional: { filed: false, receipt: '', filedDate: '' },
    patents: Object.fromEntries(SEED_PATENTS.map(p => [p.id, { status: 'Pending' as const, serial: '', counsel: '', notes: '' }])),
    signoffs: Object.fromEntries(SIGNOFF_SEATS.map(s => [s, false])),
  }
}

/**
 * Merge a partial state (from DB) with a fresh initial to ensure every seed
 * id/seat has a shape even when seeds were added after the row was written.
 */
export function mergeWithInitial(partial: Partial<DashboardState> | null | undefined): DashboardState {
  const init = buildInitial()
  if (!partial) return init
  return {
    tasks:       { ...init.tasks,       ...(partial.tasks       ?? {}) },
    gates:       { ...init.gates,       ...(partial.gates       ?? {}) },
    risks:       { ...init.risks,       ...(partial.risks       ?? {}) },
    decisions:   { ...init.decisions,   ...(partial.decisions   ?? {}) },
    patents:     { ...init.patents,     ...(partial.patents     ?? {}) },
    provisional: { ...init.provisional, ...(partial.provisional ?? {}) },
    signoffs:    { ...init.signoffs,    ...(partial.signoffs    ?? {}) },
  }
}
