'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { formatCurrency, unitLabel } from '@/lib/pricing-engine'

export interface RelatedMaterial {
  slug: string
  name: string
  description: string | null
  default_unit: 'ton' | 'cubic_yard'
  categoryName: string | null
  imageUrl: string
}

interface Material {
  id: string
  slug: string
  name: string
  description: string | null
  density_tons_per_cuyd: number | null
  aliases: string[]
  category: { slug: string; name: string } | null
}

interface Props {
  state: 'A' | 'B'
  material: Material
  market: { name: string }
  displayName: string
  displayDescription: string | null
  unit: 'ton' | 'cubic_yard'
  imageUrl: string
  // State A
  displayPrice: number | null
  overridePrice: number | null
  minQty: number | null
  typicalLoad: number | null
  loadSizeLabel: string | null
  deliveryFeeBase: number | null
  deliveryFeePerMile: number | null
  maxDeliveryMiles: number | null
  supplierName: string | null
  yardName: string | null
  // State B
  unavailableReason: string | null
  // Related
  relatedMaterials: RelatedMaterial[]
}

const PDP_PAGE_CSS = `
.pdp-page {
  --paper:#F1ECE2; --paper-2:#E9E3D5; --card:#FFFFFF; --card-muted:#F6F2E8;
  --panel:#14322A; --panel-2:#0F2920; --panel-grid:rgba(255,255,255,0.045);
  --ink:#15201B; --ink-2:#2A332E; --ink-3:#5C645F;
  --ink-on-panel:#F1ECE2; --ink-on-panel-2:#A9B4AC;
  --orange:#E5701B; --orange-press:#C95F12;
  --emerald:#2DB37A; --emerald-soft:#1F8A5C; --amber:#E0A52A;
  --hair:#D8D2C4; --hair-strong:#C8C0AC;
  --pdp-display: var(--font-fraunces), 'Fraunces', serif;
  --pdp-sans: var(--font-inter), 'Inter', -apple-system, system-ui, sans-serif;
  --pdp-mono: var(--font-jetbrains-mono), 'JetBrains Mono', ui-monospace, monospace;

  background:var(--paper); color:var(--ink); font-family:var(--pdp-sans);
}
.pdp-page * { box-sizing:border-box; }
.pdp-page a { color:inherit; text-decoration:none; }
.pdp-page button { font-family:inherit; cursor:pointer; }

.pdp-page .pdp-wrap { max-width:1440px; margin:0 auto; padding:32px 40px 0; }

/* SECTION LABEL */
.pdp-page .pdp-section-label {
  font-family:var(--pdp-sans); font-weight:600; font-size:12px;
  letter-spacing:0.14em; text-transform:uppercase; color:var(--ink-2);
  display:inline-flex; align-items:center; gap:10px; white-space:nowrap;
}
.pdp-page .pdp-section-label::before {
  content:""; width:18px; height:1.5px; background:var(--ink-2); display:inline-block;
}

/* LOZENGE */
.pdp-page .pdp-lozenge {
  font-family:var(--pdp-mono); font-size:10.5px; font-weight:600;
  letter-spacing:0.08em; text-transform:uppercase;
  background:var(--card); color:var(--ink); border:1px solid var(--hair);
  border-radius:5px; padding:5px 9px; display:inline-flex; align-items:center; gap:6px;
}

/* BREADCRUMB */
.pdp-page .pdp-breadcrumb {
  display:flex; align-items:baseline; flex-wrap:wrap; gap:8px;
  font-family:var(--pdp-mono); font-size:11px; letter-spacing:0.10em;
  text-transform:uppercase; color:var(--ink-3); font-weight:600;
  margin-bottom:18px;
}
.pdp-page .pdp-breadcrumb a { color:var(--ink-2); }
.pdp-page .pdp-breadcrumb a:hover { color:var(--ink); }
.pdp-page .pdp-breadcrumb .sep {
  opacity:0.5; font-family:var(--pdp-display); font-weight:400; font-size:14px;
  letter-spacing:0; text-transform:none;
}
.pdp-page .pdp-breadcrumb .current {
  font-family:var(--pdp-display); font-style:italic; font-weight:500; font-size:18px;
  letter-spacing:-0.01em; text-transform:none; color:var(--ink); margin-left:2px;
}

/* HERO GRID */
.pdp-page .pdp-grid {
  display:grid; grid-template-columns:1.4fr 1fr; gap:48px; align-items:start;
  margin-bottom:32px;
}
.pdp-page .content-col { display:flex; flex-direction:column; gap:56px; min-width:0; }
.pdp-page .order-col { position:relative; }

/* HERO IMAGE */
.pdp-page .hero-image-wrap {
  position:relative; aspect-ratio:4 / 3; border-radius:18px; overflow:hidden;
  border:1px solid var(--hair); background:var(--card-muted);
}
.pdp-page .hero-image-wrap .hero-photo {
  position:absolute; inset:0; width:100%; height:100%; object-fit:cover; display:block;
}
.pdp-page .hero-image-wrap .lozenge-row {
  position:absolute; top:18px; left:18px;
  display:flex; flex-direction:column; gap:6px; z-index:1;
}

/* ORDER CARD */
.pdp-page .order-card {
  position:sticky; top:24px;
  background:var(--panel); color:var(--ink-on-panel);
  border-radius:24px; padding:28px;
  display:flex; flex-direction:column; gap:18px;
  background-image:linear-gradient(var(--panel-grid) 1px,transparent 1px),linear-gradient(90deg,var(--panel-grid) 1px,transparent 1px);
  background-size:28px 28px;
}
.pdp-page .order-card .eyebrow {
  font-family:var(--pdp-mono); font-size:10.5px; letter-spacing:0.10em;
  text-transform:uppercase; color:var(--ink-on-panel-2); font-weight:600;
  display:inline-flex; align-items:center; gap:8px;
}
.pdp-page .order-card .eyebrow .live {
  width:7px; height:7px; border-radius:999px; background:var(--emerald);
  box-shadow:0 0 0 4px rgba(45,179,122,0.18); flex:none;
}
.pdp-page .order-card .eyebrow .live.amber {
  background:var(--amber); box-shadow:0 0 0 4px rgba(224,165,42,0.20);
}
.pdp-page .order-card h1 {
  font-family:var(--pdp-display); font-weight:600; font-size:56px; line-height:0.96;
  letter-spacing:-0.025em; margin:0; color:#fff;
}
.pdp-page .order-card h1 em { font-style:italic; font-weight:500; color:var(--ink-on-panel); }

.pdp-page .order-card .price-block {
  display:flex; align-items:baseline; gap:10px; margin-top:-2px;
}
.pdp-page .order-card .price {
  font-family:var(--pdp-display); font-weight:700; font-size:60px; line-height:1;
  letter-spacing:-0.025em; color:#fff;
}
.pdp-page .order-card .price-strike {
  font-family:var(--pdp-display); font-size:20px; line-height:1; color:rgba(255,255,255,0.45);
  text-decoration:line-through;
}
.pdp-page .order-card .price-unit {
  font-family:var(--pdp-mono); font-size:13px; color:var(--ink-on-panel-2);
  letter-spacing:0.04em; font-weight:500;
}
.pdp-page .order-card .source {
  font-size:13.5px; line-height:1.55; color:var(--ink-on-panel); margin:0; text-wrap:pretty;
}
.pdp-page .order-card .source b { color:#fff; font-weight:600; }

.pdp-page .stepper {
  display:flex; align-items:center; gap:8px; padding:6px;
  background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.10); border-radius:12px;
}
.pdp-page .stepper button {
  width:40px; height:40px; border-radius:8px; background:rgba(255,255,255,0.08); border:0;
  color:#fff; font-size:18px; font-weight:600; line-height:1;
}
.pdp-page .stepper button:hover:not(:disabled) { background:rgba(255,255,255,0.14); }
.pdp-page .stepper button:disabled { opacity:0.35; cursor:not-allowed; }
.pdp-page .stepper input {
  background:transparent; border:0; outline:0; color:#fff;
  font-family:var(--pdp-display); font-size:24px; font-weight:600; text-align:center;
  width:64px; font-variant-numeric:tabular-nums;
}
.pdp-page .stepper .hint {
  font-family:var(--pdp-mono); font-size:11px; letter-spacing:0.04em;
  color:var(--ink-on-panel-2); margin-left:auto; padding-right:10px;
}

.pdp-page .subtotal-row {
  display:flex; align-items:baseline; justify-content:space-between; gap:14px;
  padding-top:14px; border-top:1px solid rgba(255,255,255,0.10);
}
.pdp-page .subtotal {
  font-family:var(--pdp-display); font-weight:700; font-size:38px; line-height:1;
  letter-spacing:-0.022em; color:#fff; font-variant-numeric:tabular-nums;
}
.pdp-page .subtotal-calc {
  font-family:var(--pdp-mono); font-size:11px; letter-spacing:0.04em;
  color:var(--ink-on-panel-2); text-align:right;
}

.pdp-page .delivery-line {
  font-family:var(--pdp-mono); font-size:11px; line-height:1.55; letter-spacing:0.02em;
  color:var(--ink-on-panel-2); margin:0; text-wrap:pretty;
}

.pdp-page .pdp-cta {
  display:inline-flex; align-items:center; justify-content:center; gap:8px;
  background:var(--orange); color:#fff; font-weight:600; font-size:16px;
  height:56px; padding:0 24px; border-radius:12px; width:100%;
  transition:background 0.15s;
}
.pdp-page .pdp-cta:hover { background:var(--orange-press); }
.pdp-page .pdp-cta-ghost {
  font-family:var(--pdp-mono); font-size:11px; letter-spacing:0.04em;
  color:var(--ink-on-panel-2); text-align:center;
}

/* WHAT IT'S FOR */
.pdp-page .what-block h2 {
  font-family:var(--pdp-display); font-weight:600; font-size:36px; line-height:1.06;
  letter-spacing:-0.02em; margin:10px 0 18px; color:var(--ink); max-width:30ch;
}
.pdp-page .what-block h2 em { font-style:italic; font-weight:500; }
.pdp-page .what-block p {
  font-size:15.5px; line-height:1.65; color:var(--ink-2); margin:0; max-width:65ch; text-wrap:pretty;
}
.pdp-page .what-block p + p { margin-top:14px; }

/* AKA */
.pdp-page .aka-block { display:flex; flex-direction:column; gap:14px; }
.pdp-page .aka-row { display:flex; flex-wrap:wrap; gap:8px; }
.pdp-page .aka-chip {
  font-family:var(--pdp-sans); font-size:13.5px; font-weight:500; color:var(--ink-2);
  background:var(--card); border:1px solid var(--hair); border-radius:999px; padding:7px 14px;
  transition:border-color 0.15s, color 0.15s;
}
.pdp-page .aka-chip:hover { border-color:var(--ink-3); color:var(--ink); }

/* SPEC STRIP — light cream cards (not dark) */
.pdp-page .spec-block { display:flex; flex-direction:column; gap:14px; }
.pdp-page .spec-strip { display:grid; grid-template-columns:repeat(4,1fr); gap:14px; }
.pdp-page .spec-card {
  background:var(--card-muted); border:1px solid var(--hair); border-radius:14px;
  padding:18px 20px; display:flex; flex-direction:column; gap:6px;
}
.pdp-page .spec-card .l {
  font-family:var(--pdp-mono); font-size:10px; letter-spacing:0.10em;
  text-transform:uppercase; color:var(--ink-3); font-weight:600;
}
.pdp-page .spec-card .v {
  font-family:var(--pdp-display); font-size:24px; font-weight:600; letter-spacing:-0.02em;
  color:var(--ink); line-height:1.1;
}
.pdp-page .spec-card .v small {
  font-family:var(--pdp-mono); font-size:11px; font-weight:500; color:var(--ink-3);
  margin-left:4px; letter-spacing:0.04em;
}

/* RELATED */
.pdp-page .related { margin-top:72px; }
.pdp-page .related .head {
  display:flex; justify-content:space-between; align-items:flex-end; gap:14px; margin-bottom:14px;
}
.pdp-page .related h3 {
  font-family:var(--pdp-display); font-size:32px; font-weight:600; letter-spacing:-0.02em;
  margin:0; line-height:1.1; color:var(--ink);
}
.pdp-page .related h3 em { font-style:italic; font-weight:500; }
.pdp-page .related .head .meta {
  font-family:var(--pdp-mono); font-size:11px; letter-spacing:0.04em; color:var(--ink-3);
}
.pdp-page .related .grid { display:grid; grid-template-columns:repeat(3,1fr); gap:18px; }

.pdp-page .pdp-tile {
  background:var(--card); border:1px solid var(--hair); border-radius:18px;
  overflow:hidden; display:flex; flex-direction:column; cursor:pointer;
  transition:transform 0.15s ease, box-shadow 0.15s ease, border-color 0.15s;
}
.pdp-page .pdp-tile:hover {
  transform:translateY(-2px); box-shadow:0 14px 32px rgba(20,32,27,0.10);
  border-color:var(--hair-strong);
}
.pdp-page .pdp-tile:hover .pdp-tile-img img { transform:scale(1.04); }
.pdp-page .pdp-tile:hover .pdp-tile-link { color:var(--orange); }
.pdp-page .pdp-tile-img {
  position:relative; aspect-ratio:16 / 11; overflow:hidden; background:var(--card-muted);
}
.pdp-page .pdp-tile-img img {
  position:absolute; inset:0; width:100%; height:100%; object-fit:cover;
  transition:transform 0.35s ease;
}
.pdp-page .pdp-tile-img .lozenge-row {
  position:absolute; top:14px; left:14px;
  display:flex; flex-direction:column; gap:6px; z-index:1;
}
.pdp-page .pdp-tile-img .pdp-lozenge { font-size:10px; }
.pdp-page .pdp-tile-body {
  padding:18px 20px 20px; display:flex; flex-direction:column; gap:8px; flex:1;
}
.pdp-page .pdp-tile-body h4 {
  font-family:var(--pdp-display); font-size:22px; font-weight:600; letter-spacing:-0.015em;
  margin:0; color:var(--ink); line-height:1.15;
}
.pdp-page .pdp-tile-body p {
  font-size:13.5px; color:var(--ink-2); line-height:1.55; margin:0; text-wrap:pretty;
  display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden;
}
.pdp-page .pdp-tile-foot {
  margin-top:auto; padding-top:14px; border-top:1px solid var(--hair);
  display:flex; justify-content:space-between; align-items:center; gap:14px;
}
.pdp-page .pdp-tile-foot .min {
  font-family:var(--pdp-mono); font-size:10.5px; letter-spacing:0.06em;
  text-transform:uppercase; color:var(--ink-3); font-weight:600;
}
.pdp-page .pdp-tile-foot .min b { color:var(--ink-2); }
.pdp-page .pdp-tile-link {
  font-family:var(--pdp-mono); font-size:11px; letter-spacing:0.06em;
  text-transform:uppercase; color:var(--ink-2); font-weight:600;
  display:inline-flex; align-items:center; gap:6px; transition:color 0.15s;
}

/* DRIVERS / CONTRACTORS FOOTER BAND */
.pdp-page .footer-band { margin-top:64px; padding:48px 0 64px; border-top:1px solid var(--hair); }
.pdp-page .footer-band .grid { display:grid; grid-template-columns:1fr 1fr; gap:18px; }
.pdp-page .footer-card {
  background:var(--card-muted); border:1px solid var(--hair); border-radius:24px;
  padding:32px; display:flex; flex-direction:column; gap:14px;
}
.pdp-page .footer-card h3 {
  font-family:var(--pdp-display); font-size:32px; font-weight:600; letter-spacing:-0.02em;
  margin:0; line-height:1.05; color:var(--ink); max-width:20ch;
}
.pdp-page .footer-card h3 em { font-style:italic; font-weight:500; }
.pdp-page .footer-card p {
  font-size:14px; color:var(--ink-2); line-height:1.55; margin:0; max-width:54ch; text-wrap:pretty;
}
.pdp-page .footer-card .row {
  margin-top:10px; display:flex; flex-wrap:wrap; gap:10px; align-items:center;
}
.pdp-page .pdp-btn {
  display:inline-flex; align-items:center; justify-content:center; gap:8px;
  border-radius:10px; font-weight:600; font-size:14px; padding:12px 18px;
  border:1px solid transparent;
}
.pdp-page .pdp-btn-primary { background:var(--orange); color:#fff; }
.pdp-page .pdp-btn-primary:hover { background:var(--orange-press); }
.pdp-page .pdp-btn-link {
  background:transparent; color:var(--ink-2); padding:0; font-weight:500; font-size:14px;
}
.pdp-page .pdp-btn-link:hover { color:var(--ink); }

/* RESPONSIVE — collapses grid, releases sticky */
/* ============================================================
   RESPONSIVE — tablet (≤1180) + mobile (≤760)
   ============================================================ */
@media (max-width:1180px) {
  /* tablet: hero collapses, sticky releases, spec strip already handled above */
  .pdp-page .pdp-grid { grid-template-columns: 1fr; gap: 32px; }
  .pdp-page .order-card { position: static; }
  .pdp-page .order-card h1 { font-size: clamp(28px, 6vw, 48px); }
  .pdp-page .order-card .price { font-size: 48px; }
  .pdp-page .spec-strip { grid-template-columns: repeat(2, 1fr); }
  .pdp-page .related .grid { grid-template-columns: repeat(2, 1fr); }
}
@media (max-width:760px) {
  /* mobile: tight padding, typography reduce, tap targets */
  .pdp-page .pdp-wrap { padding: 24px 20px 0; }
  .pdp-page .content-col { gap: 40px; }
  .pdp-page .pdp-breadcrumb { gap: 6px; margin-bottom: 12px; flex-wrap: wrap; }
  .pdp-page .pdp-breadcrumb .current { font-size: 16px; }

  /* hero image height contained */
  .pdp-page .hero-image-wrap { border-radius: 14px; }

  /* order card */
  .pdp-page .order-card { padding: 22px; gap: 16px; border-radius: 18px; }
  .pdp-page .order-card h1 { font-size: 32px; }
  .pdp-page .order-card .price { font-size: 40px; }
  .pdp-page .order-card .source { font-size: 13px; }

  /* stepper — touch targets ≥44px */
  .pdp-page .stepper { padding: 5px; gap: 6px; flex-wrap: wrap; }
  .pdp-page .stepper button { width: 44px; height: 44px; }
  .pdp-page .stepper input { width: 56px; font-size: 22px; }
  .pdp-page .stepper .hint { padding-right: 6px; font-size: 10.5px; margin-left: auto; }

  /* subtotal */
  .pdp-page .subtotal { font-size: 32px; }
  .pdp-page .pdp-cta { height: 52px; font-size: 15px; }

  /* what-it's-for */
  .pdp-page .what-block h2 { font-size: 26px; }
  .pdp-page .what-block p { font-size: 14.5px; }

  /* spec strip */
  .pdp-page .spec-strip { grid-template-columns: repeat(2, 1fr); gap: 10px; }
  .pdp-page .spec-card { padding: 14px 16px; border-radius: 12px; }
  .pdp-page .spec-card .v { font-size: 20px; }

  /* aka chips — touch friendly */
  .pdp-page .aka-chip { padding: 8px 14px; }

  /* related materials full-stack */
  .pdp-page .related { margin-top: 48px; }
  .pdp-page .related h3 { font-size: 24px; }
  .pdp-page .related .grid { grid-template-columns: 1fr; gap: 14px; }
  .pdp-page .pdp-tile-body { padding: 16px 18px 18px; }
  .pdp-page .pdp-tile-body h4 { font-size: 20px; }

  /* footer band */
  .pdp-page .footer-band { margin-top: 48px; padding: 36px 0 48px; }
  .pdp-page .footer-band .grid { grid-template-columns: 1fr; gap: 14px; }
  .pdp-page .footer-card { padding: 24px; border-radius: 18px; }
  .pdp-page .footer-card h3 { font-size: 24px; }
  .pdp-page .pdp-btn { min-height: 44px; padding: 12px 18px; }

  /* legal strip — only PDP doesn't have one explicit; reserved if added later */
}
@media (max-width:380px) {
  /* very narrow phones (iPhone SE etc.) — spec strip stacks fully */
  .pdp-page .spec-strip { grid-template-columns: 1fr; }
}
`

export function BrowseDetailClient(props: Props) {
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: PDP_PAGE_CSS }} />
      <div className="pdp-page">
        <div className="pdp-wrap">

          <PdpBreadcrumb material={props.material} />

          <section className="pdp-grid">
            <div className="content-col">
              <HeroImage
                imageUrl={props.imageUrl}
                materialName={props.displayName}
                categoryName={props.material.category?.name ?? null}
              />

              <section className="what-block">
                <span className="pdp-section-label">What it&apos;s for</span>
                <h2>
                  Bulk {props.material.name.toLowerCase()},{' '}
                  <em>delivered to your site</em>.
                </h2>
                <DescriptionBody description={props.displayDescription} fallbackName={props.material.name} />
              </section>

              {props.material.aliases.length > 0 && (
                <section className="aka-block">
                  <span className="pdp-section-label">Also known as</span>
                  <div className="aka-row">
                    {props.material.aliases.map((a) => (
                      <span key={a} className="aka-chip">{a}</span>
                    ))}
                  </div>
                </section>
              )}

              <section className="spec-block">
                <span className="pdp-section-label">Specs</span>
                <div className="spec-strip">
                  <SpecCard l="Sold by" v={unitLabel(props.unit, 2)} />
                  {props.material.density_tons_per_cuyd != null && (
                    <SpecCard
                      l="Density"
                      v={props.material.density_tons_per_cuyd.toFixed(2)}
                      unit="t/yd³"
                    />
                  )}
                  {props.material.category && (
                    <SpecCard l="Category" v={props.material.category.name} />
                  )}
                  <SpecCard l="Market" v={props.market.name} />
                </div>
              </section>
            </div>

            <aside className="order-col">
              {props.state === 'A' ? (
                <OrderCardStateA
                  materialId={props.material.id}
                  materialName={props.material.name}
                  materialSlug={props.material.slug}
                  displayName={props.displayName}
                  unit={props.unit}
                  displayPrice={props.displayPrice as number}
                  overridePrice={props.overridePrice}
                  minQty={props.minQty ?? 1}
                  typicalLoad={props.typicalLoad}
                  loadSizeLabel={props.loadSizeLabel}
                  deliveryFeeBase={props.deliveryFeeBase}
                  deliveryFeePerMile={props.deliveryFeePerMile}
                  maxDeliveryMiles={props.maxDeliveryMiles}
                  supplierName={props.supplierName}
                  yardName={props.yardName}
                  marketName={props.market.name}
                />
              ) : (
                <OrderCardStateB
                  materialSlug={props.material.slug}
                  displayName={props.displayName}
                  marketName={props.market.name}
                  unavailableReason={props.unavailableReason}
                />
              )}
            </aside>
          </section>

          {props.relatedMaterials.length > 0 && (
            <RelatedSection
              materials={props.relatedMaterials}
              categoryName={props.material.category?.name ?? 'Materials'}
            />
          )}

          <FooterBand marketName={props.market.name} />

        </div>
      </div>
    </>
  )
}

function PdpBreadcrumb({ material }: { material: Material }) {
  return (
    <nav className="pdp-breadcrumb" aria-label="Breadcrumb">
      <Link href="/browse">Materials</Link>
      <span className="sep">›</span>
      {material.category ? (
        <>
          <Link href={`/browse?category=${material.category.slug}`}>{material.category.name}</Link>
          <span className="sep">›</span>
        </>
      ) : null}
      <span className="current">{material.name}</span>
    </nav>
  )
}

function HeroImage({
  imageUrl,
  materialName,
  categoryName,
}: {
  imageUrl: string
  materialName: string
  categoryName: string | null
}) {
  const [loadError, setLoadError] = useState(false)
  return (
    <div className="hero-image-wrap">
      {!loadError && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={imageUrl}
          alt={`${materialName} — bulk aggregate material available for delivery`}
          className="hero-photo"
          onError={() => setLoadError(true)}
        />
      )}
      {categoryName && (
        <div className="lozenge-row">
          <span className="pdp-lozenge">{categoryName}</span>
        </div>
      )}
    </div>
  )
}

function DescriptionBody({ description, fallbackName }: { description: string | null; fallbackName: string }) {
  if (description && description.trim().length > 0) {
    const paragraphs = description.split(/\n\s*\n/).filter((p) => p.trim().length > 0)
    return (
      <>
        {paragraphs.map((p, i) => (
          <p key={i}>{p}</p>
        ))}
      </>
    )
  }
  return (
    <p>
      Bulk {fallbackName.toLowerCase()} priced and delivered straight from the yard. Ordered by the load,
      pre-authorized at order, and finalized at delivered weight.
    </p>
  )
}

function SpecCard({ l, v, unit }: { l: string; v: string; unit?: string }) {
  return (
    <div className="spec-card">
      <span className="l">{l}</span>
      <span className="v">
        {v}
        {unit && <small>{unit}</small>}
      </span>
    </div>
  )
}

interface OrderCardStateAProps {
  materialId: string
  materialName: string
  materialSlug: string
  displayName: string
  unit: 'ton' | 'cubic_yard'
  displayPrice: number
  overridePrice: number | null
  minQty: number
  typicalLoad: number | null
  loadSizeLabel: string | null
  deliveryFeeBase: number | null
  deliveryFeePerMile: number | null
  maxDeliveryMiles: number | null
  supplierName: string | null
  yardName: string | null
  marketName: string
}

function OrderCardStateA(p: OrderCardStateAProps) {
  const initialQty = Math.max(p.minQty || 1, p.typicalLoad ?? p.minQty ?? 1)
  const [qty, setQty] = useState<number>(initialQty)

  const base = useMemo(() => {
    const has = p.overridePrice != null && p.overridePrice < p.displayPrice
    return {
      effective: has ? (p.overridePrice as number) : p.displayPrice,
      original: has ? p.displayPrice : null,
    }
  }, [p.displayPrice, p.overridePrice])

  const safeQty = Math.max(qty, p.minQty || 1)
  const total = base.effective * safeQty
  const unitWord = p.unit === 'ton' ? 'ton' : 'yd³'

  // C-PDP-2: route to /checkout/start using the canonical param shape from
  // material-match/actions.ts (material_catalog_id uuid, material name, tons,
  // source). Replaces the legacy /contact?…&action=order link, which targeted
  // a route that does not exist in the app.
  const orderHref =
    `/checkout/start?material_catalog_id=${encodeURIComponent(p.materialId)}` +
    `&material=${encodeURIComponent(p.materialName)}` +
    `&tons=${qty}` +
    `&source=pdp`

  const yardTag = p.supplierName
    ? p.yardName ? `${p.supplierName} · ${p.yardName}` : p.supplierName
    : null
  const loadCopy =
    p.loadSizeLabel ??
    (p.typicalLoad != null ? `${p.typicalLoad} ${unitLabel(p.unit, p.typicalLoad)}` : null)

  const deliveryLine = (() => {
    const parts: string[] = [`Delivered to ${p.marketName}`]
    if (p.deliveryFeeBase != null) {
      const perMile = p.deliveryFeePerMile != null ? ` + ${formatCurrency(p.deliveryFeePerMile)}/mi` : ''
      parts.push(`base ${formatCurrency(p.deliveryFeeBase)}${perMile}`)
    }
    if (p.maxDeliveryMiles != null) parts.push(`max ${p.maxDeliveryMiles} mi from yard`)
    return `${parts.join(' · ')}. Estimate at checkout.`
  })()

  return (
    <div className="order-card">
      <span className="eyebrow">
        <span className="live" />
        Order this material · Same-day or next-day
      </span>

      <h1>
        {p.displayName} <em>delivered to your site</em>
      </h1>

      <div className="price-block">
        <span className="price">{formatCurrency(base.effective)}</span>
        {base.original != null && <span className="price-strike">{formatCurrency(base.original)}</span>}
        <span className="price-unit">/ {unitLabel(p.unit, 1)}</span>
      </div>

      <p className="source">
        {yardTag ? (
          <>Sourced from <b>{yardTag}</b> in {p.marketName}.</>
        ) : (
          <>Sourced locally for {p.marketName}.</>
        )}{' '}
        {loadCopy ? <>Typical load {loadCopy}. </> : null}
        Card pre-authorized at order; final charge at delivered weight.
      </p>

      <div className="stepper">
        <button
          type="button"
          aria-label="Decrease quantity"
          onClick={() => setQty((q) => Math.max(p.minQty || 1, q - 1))}
          disabled={qty <= (p.minQty || 1)}
        >−</button>
        <input
          type="number"
          min={p.minQty || 1}
          value={qty}
          onChange={(e) => {
            const n = parseInt(e.target.value, 10)
            setQty(Number.isFinite(n) ? Math.max(p.minQty || 1, n) : (p.minQty || 1))
          }}
        />
        <button
          type="button"
          aria-label="Increase quantity"
          onClick={() => setQty((q) => q + 1)}
        >+</button>
        <span className="hint">{unitLabel(p.unit, 2)} (min {p.minQty || 1})</span>
      </div>

      <div className="subtotal-row">
        <div className="subtotal">{formatCurrency(total)}</div>
        <div className="subtotal-calc">{safeQty} × {formatCurrency(base.effective)}/{unitWord}</div>
      </div>

      <p className="delivery-line">{deliveryLine}</p>

      <Link href={orderHref} className="pdp-cta">
        Place order →
      </Link>
    </div>
  )
}

interface OrderCardStateBProps {
  materialSlug: string
  displayName: string
  marketName: string
  unavailableReason: string | null
}

function OrderCardStateB(p: OrderCardStateBProps) {
  // C-PDP-2: route quote-only ("between contracts") to /material-match with
  // the slug pre-filled. material-match's wizard handles sourcing-required
  // leads via submitSourcingRequiredLead. Replaces the legacy /contact?…&action=quote
  // link, which targeted a route that does not exist in the app.
  const quoteHref = `/material-match?material=${encodeURIComponent(p.materialSlug)}`
  return (
    <div className="order-card">
      <span className="eyebrow">
        <span className="live amber" />
        Quote-only · between contracts
      </span>
      <h1>
        {p.displayName} <em>by quote</em>
      </h1>
      <p className="source">
        {p.unavailableReason ?? `We don't have an active supplier contract for this material in ${p.marketName} today.`}{' '}
        Send your spec sheet, quantity, and drop ZIP — we&rsquo;ll come back with a delivered quote within 24 hours, often same-day.
      </p>
      <Link href={quoteHref} className="pdp-cta">
        Request a quote →
      </Link>
      <p className="delivery-line">No obligation · response within 24 hours.</p>
    </div>
  )
}

function RelatedSection({
  materials,
  categoryName,
}: {
  materials: RelatedMaterial[]
  categoryName: string
}) {
  return (
    <section className="related">
      <div className="head">
        <div>
          <span className="pdp-section-label">Other materials in {categoryName}</span>
          <h3 style={{ marginTop: 8 }}>If you&rsquo;re ordering, <em>you&rsquo;ll likely need these too</em>.</h3>
        </div>
        <span className="meta">{materials.length} of {materials.length}</span>
      </div>
      <div className="grid">
        {materials.map((m) => (
          <Link key={m.slug} className="pdp-tile" href={`/browse/${m.slug}`}>
            <div className="pdp-tile-img">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={m.imageUrl} alt={`${m.name} — bulk aggregate material`} />
              {m.categoryName && (
                <div className="lozenge-row">
                  <span className="pdp-lozenge">{m.categoryName}</span>
                </div>
              )}
            </div>
            <div className="pdp-tile-body">
              <h4>{m.name}</h4>
              {m.description && <p>{m.description}</p>}
              <div className="pdp-tile-foot">
                <span className="min">Sold by · <b>{unitLabel(m.default_unit, 2)}</b></span>
                <span className="pdp-tile-link">View details →</span>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </section>
  )
}

function FooterBand({ marketName }: { marketName: string }) {
  return (
    <section className="footer-band">
      <div className="grid">
        <div className="footer-card">
          <span className="pdp-section-label">For drivers</span>
          <h3>Hauling for EarthMove pays <em>weekly</em>, not on net-30.</h3>
          <p>
            If you run a tri-axle, tandem, or end-dump in the {marketName} metro, we have steady runs from local yards.
            Settled at end of week. Real dispatch, no chasing checks.
          </p>
          <div className="row">
            <Link className="pdp-btn pdp-btn-primary" href="/drivers">Apply to drive</Link>
            <Link className="pdp-btn pdp-btn-link" href="/drivers#requirements">Requirements →</Link>
          </div>
        </div>

        <div className="footer-card">
          <span className="pdp-section-label">For contractors</span>
          <h3>Open a contractor account, <em>build a reorder list</em>.</h3>
          <p>
            Saved drop sites, billing on PO, FCRA-compliant trust reports for new subs, and one ticketing trail across
            every load you order. Free to open.
          </p>
          <div className="row">
            <Link className="pdp-btn pdp-btn-primary" href="/signup?role=contractor">Open an account</Link>
            <Link className="pdp-btn pdp-btn-link" href="/contractors">What&rsquo;s included →</Link>
          </div>
        </div>
      </div>
    </section>
  )
}
