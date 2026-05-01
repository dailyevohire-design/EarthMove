'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { formatCurrency } from '@/lib/pricing-engine'

export interface BrowseListItem {
  id: string
  slug: string
  name: string
  description: string | null
  defaultUnit: 'ton' | 'cubic_yard'
  densityTonsPerCuyd: number | null
  sortOrder: number | null
  categorySlug: string
  categoryName: string
  categorySortOrder: number | null
  minPriceTon: number | null
  minPriceCuyd: number | null
  minOrderQty: number | null
  imageUrl: string | null
  offeringCount: number
}

export interface CategoryGroup {
  slug: string
  name: string
  sortOrder: number
  materials: BrowseListItem[]
}

interface Props {
  market: { name: string; state: string }
  categoryGroups: CategoryGroup[]
  totalMaterials: number
}

const BROWSE_PAGE_CSS = `
.browse-page {
  --paper:#F1ECE2; --paper-2:#E9E3D5; --card:#FFFFFF; --card-muted:#F6F2E8;
  --panel:#14322A; --panel-2:#0F2920; --panel-grid:rgba(255,255,255,0.045);
  --ink:#15201B; --ink-2:#2A332E; --ink-3:#5C645F;
  --ink-on-panel:#F1ECE2; --ink-on-panel-2:#A9B4AC;
  --orange:#E5701B; --orange-press:#C95F12;
  --emerald:#2DB37A; --emerald-soft:#1F8A5C; --amber:#E0A52A;
  --hair:#D8D2C4; --hair-strong:#C8C0AC;
  --br-display: var(--font-fraunces), 'Fraunces', serif;
  --br-sans: var(--font-inter), 'Inter', -apple-system, system-ui, sans-serif;
  --br-mono: var(--font-jetbrains-mono), 'JetBrains Mono', ui-monospace, monospace;

  background:var(--paper); color:var(--ink); font-family:var(--br-sans);
  -webkit-font-smoothing:antialiased;
}
.browse-page * { box-sizing:border-box; }
.browse-page a { color:inherit; text-decoration:none; }
.browse-page button { font-family:inherit; cursor:pointer; }
.browse-page ul, .browse-page ol { margin:0; padding:0; list-style:none; }

.browse-page .br-page { max-width:1440px; margin:0 auto; padding:0 40px; }
.browse-page .br-section-label {
  font-family:var(--br-sans); font-weight:600; font-size:12px;
  letter-spacing:0.14em; text-transform:uppercase; color:var(--ink-2);
  display:inline-flex; align-items:center; gap:10px; white-space:nowrap;
}
.browse-page .br-section-label::before {
  content:""; width:18px; height:1.5px; background:var(--ink-2); display:inline-block;
}
.browse-page .br-lozenge {
  font-family:var(--br-mono); font-size:10.5px; font-weight:600;
  letter-spacing:0.08em; text-transform:uppercase;
  background:var(--card); color:var(--ink); border:1px solid var(--hair);
  border-radius:5px; padding:5px 9px; display:inline-flex; align-items:center; gap:6px; white-space:nowrap;
}
.browse-page .br-lozenge.solid-emerald {
  background:var(--emerald-soft); color:#fff; border-color:transparent;
}
.browse-page .br-lozenge.solid-emerald .d {
  width:5px; height:5px; border-radius:999px; background:var(--emerald);
}

/* HERO BAND */
.browse-page .hero-band {
  padding:40px 0 28px; display:grid; grid-template-columns:1.4fr 1fr; gap:48px; align-items:end;
}
.browse-page .hero-band h1 {
  font-family:var(--br-display); font-weight:600; font-size:62px; line-height:0.96;
  letter-spacing:-0.02em; margin:14px 0 18px; color:var(--ink); max-width:18ch;
}
.browse-page .hero-band h1 em { font-style:italic; font-weight:500; }
.browse-page .hero-band .lede {
  font-size:16px; color:var(--ink-2); line-height:1.55; margin:0 0 18px; max-width:52ch; text-wrap:pretty;
}
.browse-page .hero-band .lede b { color:var(--ink); font-weight:600; }
.browse-page .hero-band .lozenge-row { display:flex; flex-wrap:wrap; gap:6px; margin-top:8px; }
.browse-page .hero-band .ops-card {
  background:var(--card); border:1px solid var(--hair); border-radius:18px; padding:20px;
  display:grid; grid-template-columns:1fr 1fr; gap:14px 22px;
}
.browse-page .hero-band .ops-card .l {
  font-family:var(--br-mono); font-size:10px; letter-spacing:0.10em; text-transform:uppercase;
  color:var(--ink-3); font-weight:600;
}
.browse-page .hero-band .ops-card .v {
  font-family:var(--br-display); font-size:22px; font-weight:600; letter-spacing:-0.015em;
  color:var(--ink); line-height:1.15; margin-top:2px;
}
.browse-page .hero-band .ops-card .v small {
  font-family:var(--br-sans); font-size:11px; font-weight:500; color:var(--ink-3); margin-left:4px;
}
.browse-page .hero-band .ops-card .meta {
  font-family:var(--br-mono); font-size:10.5px; color:var(--ink-3); margin-top:1px; letter-spacing:0.04em;
}

/* STICKY CATEGORY FILTER */
.browse-page .filter-bar {
  position:sticky; top:0; background:var(--paper); border-bottom:1px solid var(--hair);
  z-index:4; margin:32px 0 0; padding:14px 0;
}
.browse-page .filter-row { display:flex; align-items:center; gap:8px; overflow-x:auto; padding-bottom:2px; }
.browse-page .filter-pill {
  background:transparent; border:1px solid var(--hair); border-radius:999px;
  padding:8px 14px; font-family:var(--br-sans); font-size:13px; font-weight:500; color:var(--ink-2);
  white-space:nowrap; display:inline-flex; align-items:center; gap:8px;
  text-decoration:none; transition:border-color 0.15s, color 0.15s;
}
.browse-page .filter-pill .count {
  font-family:var(--br-mono); font-size:11px; color:var(--ink-3); font-weight:600;
}
.browse-page .filter-pill.active { background:var(--ink); color:var(--paper); border-color:var(--ink); }
.browse-page .filter-pill.active .count { color:rgba(241,236,226,0.65); }
.browse-page .filter-pill:hover:not(.active) { border-color:var(--ink-3); color:var(--ink); }

/* CATEGORY GROUP */
.browse-page .cat-group { margin-top:36px; scroll-margin-top:80px; }
.browse-page .cat-group .group-head {
  display:flex; justify-content:space-between; align-items:flex-end; gap:14px; margin-bottom:14px;
}
.browse-page .cat-group .group-head .left { display:flex; flex-direction:column; gap:8px; }
.browse-page .cat-group h3 {
  font-family:var(--br-display); font-size:32px; font-weight:600; letter-spacing:-0.02em;
  margin:0; line-height:1.1; color:var(--ink);
}
.browse-page .cat-group h3 em { font-style:italic; font-weight:500; }
.browse-page .cat-group .group-head .meta {
  font-family:var(--br-mono); font-size:11px; letter-spacing:0.04em; color:var(--ink-3);
}
.browse-page .cat-group .grid { display:grid; grid-template-columns:repeat(3,1fr); gap:18px; }

/* TILE */
.browse-page .br-tile {
  background:var(--card); border:1px solid var(--hair); border-radius:18px;
  overflow:hidden; display:flex; flex-direction:column; cursor:pointer;
  transition:transform 0.15s ease, box-shadow 0.15s ease, border-color 0.15s;
}
.browse-page .br-tile:hover {
  transform:translateY(-2px); box-shadow:0 14px 32px rgba(20,32,27,0.10);
  border-color:var(--hair-strong);
}
.browse-page .br-tile:hover .br-tile-img img { transform:scale(1.04); }
.browse-page .br-tile:hover .br-tile-link { color:var(--orange); }
.browse-page .br-tile-img {
  position:relative; aspect-ratio:16 / 11; overflow:hidden; background:var(--card-muted);
}
.browse-page .br-tile-img img {
  position:absolute; inset:0; width:100%; height:100%; object-fit:cover; transition:transform 0.35s ease;
}
.browse-page .br-tile-img .lozenge-row {
  position:absolute; top:14px; left:14px;
  display:flex; flex-direction:column; align-items:flex-start; gap:6px; z-index:1;
}
.browse-page .br-tile-img .br-lozenge { font-size:10px; }
.browse-page .br-tile-body {
  padding:18px 20px 20px; display:flex; flex-direction:column; gap:8px; flex:1;
}
.browse-page .br-tile-body h4 {
  font-family:var(--br-display); font-size:22px; font-weight:600; letter-spacing:-0.015em;
  margin:0; color:var(--ink); line-height:1.15;
}
.browse-page .br-tile-body p {
  font-size:13.5px; color:var(--ink-2); line-height:1.55; margin:0; text-wrap:pretty;
  display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden;
}
.browse-page .br-tile-foot {
  margin-top:auto; padding-top:14px; border-top:1px solid var(--hair);
  display:flex; justify-content:space-between; align-items:center; gap:14px;
}
.browse-page .br-tile-foot .min {
  font-family:var(--br-mono); font-size:10.5px; letter-spacing:0.06em;
  text-transform:uppercase; color:var(--ink-3); font-weight:600;
}
.browse-page .br-tile-foot .min b { color:var(--ink-2); }
.browse-page .br-tile-link {
  font-family:var(--br-mono); font-size:11px; letter-spacing:0.06em;
  text-transform:uppercase; color:var(--ink-2); font-weight:600;
  display:inline-flex; align-items:center; gap:6px; transition:color 0.15s;
}

/* EMPTY STATE */
.browse-page .empty-state {
  margin-top:48px; padding:48px; border:1px dashed var(--hair-strong); border-radius:18px;
  background:var(--card-muted); text-align:center;
}
.browse-page .empty-state h3 {
  font-family:var(--br-display); font-size:28px; font-weight:600; letter-spacing:-0.02em;
  margin:0 0 8px; color:var(--ink);
}
.browse-page .empty-state p {
  font-size:14px; color:var(--ink-2); line-height:1.55; margin:0; max-width:48ch; margin:0 auto;
}

/* FOOTER BAND */
.browse-page .footer-band { margin-top:64px; padding:48px 0 64px; border-top:1px solid var(--hair); }
.browse-page .footer-band .grid { display:grid; grid-template-columns:1fr 1fr; gap:18px; }
.browse-page .footer-card {
  background:var(--card-muted); border:1px solid var(--hair); border-radius:24px;
  padding:32px; display:flex; flex-direction:column; gap:14px;
}
.browse-page .footer-card .br-section-label { margin-bottom:6px; }
.browse-page .footer-card h3 {
  font-family:var(--br-display); font-size:32px; font-weight:600; letter-spacing:-0.02em;
  margin:0; line-height:1.05; color:var(--ink); max-width:20ch;
}
.browse-page .footer-card h3 em { font-style:italic; font-weight:500; }
.browse-page .footer-card p {
  font-size:14px; color:var(--ink-2); line-height:1.55; margin:0; max-width:54ch; text-wrap:pretty;
}
.browse-page .footer-card .row {
  margin-top:10px; display:flex; flex-wrap:wrap; gap:10px; align-items:center;
}
.browse-page .br-btn {
  display:inline-flex; align-items:center; justify-content:center; gap:8px;
  border-radius:10px; font-weight:600; font-size:14px; padding:12px 18px;
  border:1px solid transparent;
}
.browse-page .br-btn-primary { background:var(--orange); color:#fff; }
.browse-page .br-btn-primary:hover { background:var(--orange-press); }
.browse-page .br-btn-link {
  background:transparent; color:var(--ink-2); padding:0; font-weight:500; font-size:14px;
}
.browse-page .br-btn-link:hover { color:var(--ink); }

/* LEGAL STRIP */
.browse-page .legal-strip {
  margin-top:32px; padding:18px 0 32px; border-top:1px solid var(--hair);
  display:flex; justify-content:space-between; align-items:center; gap:14px; flex-wrap:wrap;
  font-family:var(--br-mono); font-size:11px; letter-spacing:0.04em; color:var(--ink-3);
}
.browse-page .legal-strip ul { display:flex; gap:18px; }
.browse-page .legal-strip ul a:hover { color:var(--ink); }

/* RESPONSIVE */
/* ============================================================
   RESPONSIVE — tablet (≤1180) + mobile (≤760)
   ============================================================ */
@media (max-width:1180px) {
  /* tablet: hero collapses, ops card sits below copy, grid drops to 2-col */
  .browse-page .hero-band { grid-template-columns: 1fr; gap: 28px; align-items: stretch; }
  .browse-page .hero-band h1 { font-size: clamp(28px, 6vw, 56px); max-width: none; }
  .browse-page .hero-band .ops-card { gap: 12px 22px; }
  .browse-page .cat-group .grid { grid-template-columns: repeat(2, 1fr); }
}
@media (max-width:760px) {
  /* mobile: tighter padding, single-col grids, touch targets, typography reduce */
  .browse-page .br-page { padding: 0 20px; }
  .browse-page .hero-band { padding: 28px 0 22px; gap: 22px; }
  .browse-page .hero-band h1 { font-size: clamp(24px, 8.5vw, 44px); margin: 12px 0 14px; }
  .browse-page .hero-band .lede { font-size: 15.5px; }
  .browse-page .hero-band .ops-card { padding: 16px; gap: 12px 18px; border-radius: 14px; }
  .browse-page .hero-band .ops-card .v { font-size: 18px; }

  /* sticky filter — keep sticky but tighten size; horizontal-scroll handled by overflow-x already */
  .browse-page .filter-bar { padding: 10px 0; margin-top: 24px; }
  .browse-page .filter-pill { padding: 10px 14px; min-height: 40px; font-size: 13px; }

  /* category groups */
  .browse-page .cat-group { margin-top: 32px; }
  .browse-page .cat-group .group-head { flex-direction: column; align-items: flex-start; gap: 8px; }
  .browse-page .cat-group h3 { font-size: 24px; }
  .browse-page .cat-group .grid { grid-template-columns: 1fr; gap: 14px; }

  /* tile body tighter */
  .browse-page .br-tile-body { padding: 16px 18px 18px; }
  .browse-page .br-tile-body h4 { font-size: 20px; }

  /* footer band single-col */
  .browse-page .footer-band { margin-top: 48px; padding: 36px 0 48px; }
  .browse-page .footer-band .grid { grid-template-columns: 1fr; gap: 14px; }
  .browse-page .footer-card { padding: 24px; border-radius: 18px; }
  .browse-page .footer-card h3 { font-size: 24px; }

  /* legal strip stacks */
  .browse-page .legal-strip { flex-direction: column; align-items: flex-start; gap: 10px; padding: 16px 0 24px; }

  /* empty state tighter */
  .browse-page .empty-state { padding: 32px 24px; margin-top: 32px; }
  .browse-page .empty-state h3 { font-size: 24px; }

  /* CTA button minimum height for tap accessibility */
  .browse-page .br-btn { min-height: 44px; padding: 12px 18px; }
}
`

export function BrowseListingClient({ market, categoryGroups, totalMaterials }: Props) {
  const [activeCat, setActiveCat] = useState<string>('all')

  const isEmpty = totalMaterials === 0

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: BROWSE_PAGE_CSS }} />
      <div className="browse-page">
        <main className="br-page">

          <HeroBand
            marketName={market.name}
            totalMaterials={totalMaterials}
            categoryCount={categoryGroups.length}
          />

          {/* Deals carousel intentionally omitted in C-Browse-1 — no deal-flag
              columns exist on supplier_offerings yet (#C-DEALS-1 followup). */}

          {!isEmpty && (
            <FilterBar
              total={totalMaterials}
              groups={categoryGroups}
              active={activeCat}
              onChange={setActiveCat}
            />
          )}

          {isEmpty ? (
            <EmptyState marketName={market.name} />
          ) : (
            <>
              {categoryGroups.map((g) => (
                <CategoryGroupSection key={g.slug} group={g} />
              ))}
            </>
          )}

          <FooterBand marketName={market.name} />

          <LegalStrip marketState={market.state} />

        </main>
      </div>
    </>
  )
}

function HeroBand({
  marketName,
  totalMaterials,
  categoryCount,
}: {
  marketName: string
  totalMaterials: number
  categoryCount: number
}) {
  return (
    <section className="hero-band">
      <div>
        <span className="br-section-label">Materials · {marketName}</span>
        <h1>
          Every aggregate, <em>priced and delivered</em> in {marketName}.
        </h1>
        <p className="lede">
          <b>{totalMaterials} stocked materials</b> across {categoryCount} categories. Same-day or next-day
          delivery from yards in your market.
        </p>
        <div className="lozenge-row">
          <span className="br-lozenge">{totalMaterials} MATERIALS</span>
          <span className="br-lozenge">{categoryCount} CATEGORIES</span>
          <span className="br-lozenge solid-emerald"><span className="d" />SAME-DAY DELIVERY</span>
        </div>
      </div>

      {/* #BROWSE-OPS-METRICS — values hardcoded; replace with live ops query. */}
      <div className="ops-card">
        <div>
          <span className="l">Coverage</span>
          <div className="v">50 mi <small>radius from yard</small></div>
          <div className="meta">Out-of-radius? Quote in 24h</div>
        </div>
        <div>
          <span className="l">Live yards</span>
          <div className="v">1 <small>active today</small></div>
          <div className="meta">Updated every 5 min</div>
        </div>
        <div>
          <span className="l">Drivers on shift</span>
          <div className="v">— <small>live count soon</small></div>
          <div className="meta">7am – 6pm Mon–Sat</div>
        </div>
        <div>
          <span className="l">Avg dispatch</span>
          <div className="v">— <small>live count soon</small></div>
          <div className="meta">Same-day, in-radius</div>
        </div>
      </div>
    </section>
  )
}

function FilterBar({
  total,
  groups,
  active,
  onChange,
}: {
  total: number
  groups: CategoryGroup[]
  active: string
  onChange: (slug: string) => void
}) {
  return (
    <nav className="filter-bar" aria-label="Category filter">
      <div className="filter-row">
        <a
          href="#top"
          className={`filter-pill${active === 'all' ? ' active' : ''}`}
          onClick={() => onChange('all')}
        >
          All <span className="count">{total}</span>
        </a>
        {groups.map((g) => (
          <a
            key={g.slug}
            href={`#cat-${g.slug}`}
            className={`filter-pill${active === g.slug ? ' active' : ''}`}
            onClick={() => onChange(g.slug)}
          >
            {g.name} <span className="count">{g.materials.length}</span>
          </a>
        ))}
      </div>
    </nav>
  )
}

function CategoryGroupSection({ group }: { group: CategoryGroup }) {
  const priceRange = useMemo(() => buildPriceRange(group.materials), [group.materials])
  return (
    <section className="cat-group" id={`cat-${group.slug}`}>
      <div className="group-head">
        <div className="left">
          <span className="br-section-label">{group.name} · {group.materials.length} {group.materials.length === 1 ? 'material' : 'materials'}</span>
          <h3>{categoryHeadline(group.slug, group.name)}</h3>
        </div>
        {priceRange && <span className="meta">{priceRange}</span>}
      </div>
      <div className="grid">
        {group.materials.map((m) => (
          <MaterialTile key={m.id} m={m} />
        ))}
      </div>
    </section>
  )
}

function MaterialTile({ m }: { m: BrowseListItem }) {
  const priceLozenge = formatPriceLozenge(m)
  const minOrderUnit = m.defaultUnit === 'ton' ? 'tons' : 'yd³'
  return (
    <Link className="br-tile" href={`/browse/${m.slug}`}>
      <div className="br-tile-img">
        {m.imageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={m.imageUrl} alt={`${m.name} — bulk aggregate material available for delivery`} />
        )}
        <div className="lozenge-row">
          <span className="br-lozenge">{m.categoryName.toUpperCase()}</span>
          {priceLozenge && <span className="br-lozenge solid-emerald">{priceLozenge}</span>}
        </div>
      </div>
      <div className="br-tile-body">
        <h4>{m.name}</h4>
        {m.description && <p>{m.description}</p>}
        <div className="br-tile-foot">
          {m.minOrderQty != null ? (
            <span className="min">Min order · <b>{m.minOrderQty} {minOrderUnit}</b></span>
          ) : (
            <span className="min">Sold by · <b>{minOrderUnit}</b></span>
          )}
          <span className="br-tile-link">View details →</span>
        </div>
      </div>
    </Link>
  )
}

function EmptyState({ marketName }: { marketName: string }) {
  return (
    <section className="empty-state">
      <h3>No materials in {marketName} yet.</h3>
      <p>
        We&rsquo;re onboarding suppliers in your market. Open a contractor account to be notified
        the moment delivery starts, or browse a different market.
      </p>
    </section>
  )
}

function FooterBand({ marketName }: { marketName: string }) {
  return (
    <section className="footer-band">
      <div className="grid">
        <div className="footer-card">
          <span className="br-section-label">For drivers</span>
          <h3>Hauling for EarthMove pays <em>weekly</em>, not on net-30.</h3>
          <p>
            If you run a tri-axle, tandem, or end-dump in the {marketName} metro, we have steady runs
            from local yards. Settled at end of week. Real dispatch, no chasing checks.
          </p>
          <div className="row">
            <Link className="br-btn br-btn-primary" href="/drivers">Apply to drive</Link>
            <Link className="br-btn br-btn-link" href="/drivers#requirements">Requirements →</Link>
          </div>
        </div>
        <div className="footer-card">
          <span className="br-section-label">For contractors</span>
          <h3>Open a contractor account, <em>build a reorder list</em>.</h3>
          <p>
            Saved drop sites, billing on PO, FCRA-compliant trust reports for new subs, and one ticketing
            trail across every load you order. Free to open.
          </p>
          <div className="row">
            <Link className="br-btn br-btn-primary" href="/signup?role=contractor">Open an account</Link>
            <Link className="br-btn br-btn-link" href="/contractors">What&rsquo;s included →</Link>
          </div>
        </div>
      </div>
    </section>
  )
}

function LegalStrip({ marketState }: { marketState: string }) {
  return (
    <div className="legal-strip">
      <span>EarthMove, Inc. · Operating in {marketState}</span>
      <ul>
        <li><Link href="/about">About</Link></li>
        <li><a href="mailto:support@earthmove.io">Contact</a></li>
        <li><Link href="/terms">Terms</Link></li>
        <li><Link href="/privacy">Privacy</Link></li>
      </ul>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatPriceLozenge(m: BrowseListItem): string | null {
  if (m.defaultUnit === 'ton' && m.minPriceTon != null) {
    return `${formatCurrencyShort(m.minPriceTon)} / TON`
  }
  if (m.defaultUnit === 'cubic_yard' && m.minPriceCuyd != null) {
    return `${formatCurrencyShort(m.minPriceCuyd)} / YD³`
  }
  if (m.minPriceTon != null) return `${formatCurrencyShort(m.minPriceTon)} / TON`
  if (m.minPriceCuyd != null) return `${formatCurrencyShort(m.minPriceCuyd)} / YD³`
  return null
}

function formatCurrencyShort(amount: number): string {
  // $24 not $24.00 for the lozenge.
  if (Number.isInteger(amount)) return `$${amount}`
  return formatCurrency(amount)
}

function buildPriceRange(materials: BrowseListItem[]): string | null {
  if (materials.length === 0) return null
  const allTon = materials.every((m) => m.defaultUnit === 'ton')
  const allYd = materials.every((m) => m.defaultUnit === 'cubic_yard')
  const prices: number[] = []
  for (const m of materials) {
    const p = m.defaultUnit === 'ton' ? m.minPriceTon : m.minPriceCuyd
    const fallback = m.minPriceTon ?? m.minPriceCuyd
    const v = p ?? fallback
    if (v != null) prices.push(v)
  }
  if (prices.length === 0) return null
  const lo = Math.min(...prices)
  const hi = Math.max(...prices)
  const unit = allTon ? '/ ton' : allYd ? '/ yd³' : '/ unit'
  return lo === hi
    ? `${formatCurrencyShort(lo)} ${unit}`
    : `${formatCurrencyShort(lo)} – ${formatCurrencyShort(hi)} ${unit}`
}

function categoryHeadline(slug: string, name: string): React.ReactNode {
  // Editorial italic em phrase per artboard. Slugs come from material_categories.
  switch (slug) {
    case 'base':
      return <>Compaction-grade <em>load-bearing layers</em>.</>
    case 'fill':
      return <>Bulk fill, topsoil, and <em>cover material</em>.</>
    case 'sand':
      return <>Concrete, mason, and <em>bedding sand</em>.</>
    case 'gravel':
      return <>Drainage rock and <em>concrete aggregate</em>.</>
    case 'rock':
      return <>Armor stone for <em>slope and shoreline</em>.</>
    case 'decorative':
      return <>Finish-grade stone for <em>visible surfaces</em>.</>
    case 'recycled':
      return <>Crushed concrete, <em>graded for spec</em>.</>
    default:
      return <>{name} — <em>delivered to your site</em>.</>
  }
}
