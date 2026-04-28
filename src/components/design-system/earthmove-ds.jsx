'use client';

// earthmove-ds.jsx
// EarthMove design system — primitives extracted from nine approved Design Claude surfaces:
// /, /browse, /browse/[slug], /deals, /collections/contractor-payment-kit,
// /orders/new (contractor + homeowner), /orders/[id] (contractor P3 + homeowner P5),
// /dashboard/gc/contractors.
//
// Single file, framework-agnostic React (no 'use client' baked in — add at page level).
// All visual styling lives in the scoped <style id="em-ds-styles"> block injected once.
// Class prefix: .em-* — collision-free with host app CSS.
//
// Export shape:
//   Tokens, useEmDesignSystem (idempotent style injection),
//   Wordmark, SectionLabel, DisplayH1,
//   Lozenge, StatusPill, HairlineConnector,
//   DarkPanel, OpsSignal, OpsSignalRow,
//   TruckClassPanel, CompositionBar.

import React, { useEffect } from 'react';

/* ============================================================
 * 1 · TOKENS — CSS custom properties exposed as JS object too,
 *   so consumers can read them in inline styles or runtime logic.
 *   These are the canonical values used across all nine surfaces.
 * ============================================================ */

export const Tokens = {
  // Surfaces
  paper: '#F1ECE2',
  paper2: '#E9E3D5',
  card: '#FFFFFF',
  cardMuted: '#F6F2E8',
  panel: '#14322A',
  panel2: '#0F2920',
  panel3: '#0A1F18',
  panelGrid: 'rgba(255,255,255,0.045)',

  // Ink
  ink: '#15201B',
  ink2: '#2A332E',
  ink3: '#5C645F',
  inkOnPanel: '#F1ECE2',
  inkOnPanel2: '#A9B4AC',

  // Accents
  orange: '#E5701B',
  orangePress: '#C95F12',
  emerald: '#2DB37A',
  emeraldSoft: '#1F8A5C',
  amber: '#E0A52A',
  amberSoft: '#9A6E12',

  // Hairlines
  hair: '#D8D2C4',
  hairStrong: '#C8C0AC',

  // Type
  display: "'Fraunces', serif",
  sans: "'Inter', -apple-system, system-ui, sans-serif",
  mono: "'JetBrains Mono', ui-monospace, monospace",

  // Radii
  radiusSm: '6px',
  radiusMd: '12px',
  radiusLg: '18px',
  radiusXl: '24px',
};

/* ============================================================
 * 2 · STYLE INJECTION — idempotent, runs once per page.
 *   Call useEmDesignSystem() from your app root, OR the primitives
 *   below call it on mount as a fallback. Hosting page must also
 *   <link> Fraunces, Inter, and JetBrains Mono from Google Fonts.
 * ============================================================ */

const STYLE_ID = 'em-ds-styles';

const STYLESHEET = `
:root{
  --em-paper:${Tokens.paper}; --em-paper-2:${Tokens.paper2};
  --em-card:${Tokens.card}; --em-card-muted:${Tokens.cardMuted};
  --em-panel:${Tokens.panel}; --em-panel-2:${Tokens.panel2}; --em-panel-3:${Tokens.panel3};
  --em-panel-grid:${Tokens.panelGrid};
  --em-ink:${Tokens.ink}; --em-ink-2:${Tokens.ink2}; --em-ink-3:${Tokens.ink3};
  --em-ink-on-panel:${Tokens.inkOnPanel}; --em-ink-on-panel-2:${Tokens.inkOnPanel2};
  --em-orange:${Tokens.orange}; --em-orange-press:${Tokens.orangePress};
  --em-emerald:${Tokens.emerald}; --em-emerald-soft:${Tokens.emeraldSoft};
  --em-amber:${Tokens.amber}; --em-amber-soft:${Tokens.amberSoft};
  --em-hair:${Tokens.hair}; --em-hair-strong:${Tokens.hairStrong};
  --em-display:${Tokens.display}; --em-sans:${Tokens.sans}; --em-mono:${Tokens.mono};
}

/* ---------- Wordmark ---------- */
.em-wordmark{
  font-family:var(--em-display);font-weight:700;font-size:22px;letter-spacing:-0.01em;
  color:var(--em-ink);display:inline-flex;align-items:baseline;text-decoration:none;
}
.em-wordmark .em-wordmark__leaf{
  display:inline-block;width:10px;height:10px;border-radius:2px;
  background:var(--em-emerald-soft);margin-right:8px;transform:translateY(-1px);
}
.em-wordmark .em-wordmark__dot{color:var(--em-emerald-soft);}

/* ---------- Section label (hairline + caps) ---------- */
.em-section-label{
  font-family:var(--em-sans);font-weight:600;font-size:12px;letter-spacing:0.14em;
  text-transform:uppercase;color:var(--em-ink-2);
  display:inline-flex;align-items:center;gap:10px;white-space:nowrap;
}
.em-section-label::before{
  content:"";width:18px;height:1.5px;background:var(--em-ink-2);display:inline-block;
}
.em-section-label.em-section-label--muted{color:var(--em-ink-3);}
.em-section-label.em-section-label--muted::before{background:var(--em-ink-3);}

/* ---------- Display H1 (Fraunces, italic-emphasis) ---------- */
.em-display-h1{
  font-family:var(--em-display);font-weight:600;letter-spacing:-0.02em;line-height:1.0;
  color:var(--em-ink);margin:0;
}
.em-display-h1 em{font-style:italic;font-weight:500;}
.em-display-h1.em-display-h1--xl{font-size:64px;line-height:0.96;}
.em-display-h1.em-display-h1--lg{font-size:54px;line-height:0.96;}
.em-display-h1.em-display-h1--md{font-size:42px;line-height:1.05;}
.em-display-h1.em-display-h1--sm{font-size:32px;line-height:1.1;}

/* ---------- Lozenge (mono caps chip, on cream OR on panel) ---------- */
.em-lozenge{
  font-family:var(--em-mono);font-size:10.5px;font-weight:600;letter-spacing:0.08em;
  text-transform:uppercase;color:var(--em-ink);background:var(--em-card-muted);
  border:1px solid var(--em-hair);border-radius:5px;padding:4px 8px;
  display:inline-flex;align-items:center;gap:6px;white-space:nowrap;
}
.em-lozenge.em-lozenge--dark{
  background:rgba(20,50,42,0.78);color:var(--em-ink-on-panel);border-color:transparent;
}
.em-lozenge.em-lozenge--dark .em-lozenge__d{
  width:5px;height:5px;border-radius:999px;background:var(--em-emerald);
}
.em-lozenge.em-lozenge--solid-orange{background:var(--em-orange);color:#fff;border-color:transparent;}
.em-lozenge.em-lozenge--solid-emerald{background:var(--em-emerald-soft);color:#fff;border-color:transparent;}

/* ---------- Status pill (mono caps with colored dot) ---------- */
.em-status-pill{
  font-family:var(--em-mono);font-size:10.5px;font-weight:600;letter-spacing:0.08em;
  text-transform:uppercase;background:var(--em-card-muted);color:var(--em-ink-2);
  border:1px solid var(--em-hair);border-radius:6px;padding:5px 9px;
  display:inline-flex;align-items:center;gap:6px;white-space:nowrap;
}
.em-status-pill__d{width:5px;height:5px;border-radius:999px;background:var(--em-ink-3);flex:0 0 auto;}
.em-status-pill.em-status-pill--ok{
  background:rgba(31,138,92,0.10);border-color:rgba(31,138,92,0.30);color:var(--em-emerald-soft);
}
.em-status-pill.em-status-pill--ok .em-status-pill__d{background:var(--em-emerald-soft);}
.em-status-pill.em-status-pill--warn{
  background:rgba(224,165,42,0.10);border-color:rgba(224,165,42,0.35);color:var(--em-amber-soft);
}
.em-status-pill.em-status-pill--warn .em-status-pill__d{background:var(--em-amber);}
.em-status-pill.em-status-pill--live{
  background:var(--em-orange);border-color:transparent;color:#fff;
}
.em-status-pill.em-status-pill--live .em-status-pill__d{
  background:#fff;animation:em-soft-pulse 2s ease-in-out infinite;
}
@keyframes em-soft-pulse{0%,100%{opacity:1;}50%{opacity:0.4;}}

/* ---------- Hairline connector (1px line + dot, used between cards) ---------- */
.em-hairline-connector{
  display:flex;align-items:center;gap:8px;font-family:var(--em-mono);font-size:10.5px;
  letter-spacing:0.08em;text-transform:uppercase;color:var(--em-ink-3);font-weight:600;
}
.em-hairline-connector__line{flex:1;height:1px;background:var(--em-hair-strong);}
.em-hairline-connector__dot{
  width:6px;height:6px;border-radius:999px;background:var(--em-ink-3);flex:0 0 auto;
}
.em-hairline-connector.em-hairline-connector--orange .em-hairline-connector__dot{background:var(--em-orange);}
.em-hairline-connector.em-hairline-connector--orange .em-hairline-connector__line{background:var(--em-orange);opacity:0.4;}
.em-hairline-connector.em-hairline-connector--emerald .em-hairline-connector__dot{background:var(--em-emerald-soft);}

/* ---------- Dark commerce panel ---------- */
.em-dark-panel{
  background:var(--em-panel);color:var(--em-ink-on-panel);border-radius:18px;padding:24px;
  background-image:
    linear-gradient(var(--em-panel-grid) 1px,transparent 1px),
    linear-gradient(90deg,var(--em-panel-grid) 1px,transparent 1px);
  background-size:28px 28px;
}
.em-dark-panel.em-dark-panel--xl{border-radius:24px;padding:32px;}
.em-dark-panel.em-dark-panel--flat{background-image:none;}
.em-dark-panel .em-dark-panel__eyebrow{
  font-family:var(--em-mono);font-size:10.5px;color:var(--em-ink-on-panel-2);
  letter-spacing:0.10em;text-transform:uppercase;font-weight:600;
  display:inline-flex;align-items:center;gap:8px;
}
.em-dark-panel .em-dark-panel__eyebrow .em-dark-panel__num{
  background:rgba(255,255,255,0.10);border-radius:5px;padding:3px 7px;line-height:1;color:#fff;
}
.em-dark-panel h3{
  font-family:var(--em-display);font-weight:600;font-size:26px;letter-spacing:-0.02em;
  line-height:1.15;margin:10px 0 6px;color:#fff;
}
.em-dark-panel h3 em{font-style:italic;font-weight:500;color:var(--em-orange);}
.em-dark-panel p{font-size:14px;color:var(--em-ink-on-panel-2);line-height:1.55;margin:0 0 16px;}
.em-dark-panel p b{color:#fff;}

/* ---------- Ops signal cell (used in /dashboard/gc/contractors hero,
              /browse/[slug] yard-alternates, /orders/[id] live grid) ---------- */
.em-ops-signal-row{
  display:grid;grid-template-columns:repeat(var(--em-ops-cols,3),1fr);gap:14px;
}
.em-ops-signal{
  border-top:1px solid var(--em-hair);padding-top:12px;
  display:flex;flex-direction:column;gap:3px;min-width:0;
}
.em-ops-signal__l{
  font-family:var(--em-mono);font-size:10px;color:var(--em-ink-3);
  letter-spacing:0.10em;text-transform:uppercase;font-weight:600;
}
.em-ops-signal__v{
  font-family:var(--em-display);font-size:22px;font-weight:600;letter-spacing:-0.015em;
  color:var(--em-ink);line-height:1.1;
}
.em-ops-signal__v small{
  font-family:var(--em-sans);font-size:11px;font-weight:500;color:var(--em-ink-3);
  margin-left:4px;letter-spacing:0;
}
.em-ops-signal__meta{
  font-family:var(--em-mono);font-size:11px;color:var(--em-ink-2);
  margin-top:2px;letter-spacing:0.02em;
}
/* On dark panels */
.em-dark-panel .em-ops-signal{border-top-color:rgba(255,255,255,0.10);}
.em-dark-panel .em-ops-signal__l{color:var(--em-ink-on-panel-2);}
.em-dark-panel .em-ops-signal__v{color:#fff;}
.em-dark-panel .em-ops-signal__v small{color:var(--em-ink-on-panel-2);}
.em-dark-panel .em-ops-signal__meta{color:var(--em-ink-on-panel-2);}

/* ---------- Truck class three-card panel ----------
   Used on /browse/[slug] commerce panel, /orders/new sticky rail,
   /orders/[id] order details. Each card is a class (single/tandem/tri),
   parameterized so the homeowner version can hide it entirely or render
   only one card with the "right truck" lozenge. */
.em-truck-class-panel{
  display:grid;grid-template-columns:repeat(3,1fr);gap:10px;
  background:transparent;
}
.em-truck-class-panel.em-truck-class-panel--on-dark{gap:10px;}
.em-truck-card{
  background:var(--em-card);border:1px solid var(--em-hair);border-radius:14px;
  padding:14px 16px;display:flex;flex-direction:column;gap:6px;position:relative;
  cursor:pointer;transition:border-color .15s,background .15s;
}
.em-truck-card:hover{border-color:var(--em-ink-3);}
.em-truck-card.em-truck-card--selected{
  border-color:var(--em-ink);box-shadow:inset 0 0 0 1px var(--em-ink);background:var(--em-card-muted);
}
.em-truck-card.em-truck-card--disabled{opacity:0.45;cursor:not-allowed;}
.em-truck-card__head{
  display:flex;justify-content:space-between;align-items:baseline;
  font-family:var(--em-mono);font-size:10.5px;letter-spacing:0.08em;
  text-transform:uppercase;font-weight:600;color:var(--em-ink-3);
}
.em-truck-card__head b{color:var(--em-ink);font-weight:600;}
.em-truck-card__cap{
  font-family:var(--em-display);font-size:22px;font-weight:600;letter-spacing:-0.015em;
  color:var(--em-ink);line-height:1.1;
}
.em-truck-card__cap small{
  font-family:var(--em-sans);font-size:11px;font-weight:500;color:var(--em-ink-3);
  margin-left:4px;letter-spacing:0;
}
.em-truck-card__rate{font-family:var(--em-mono);font-size:11.5px;color:var(--em-ink-2);letter-spacing:0.02em;}
.em-truck-card__rate b{color:var(--em-ink);font-weight:600;}
.em-truck-card__lozenge{
  position:absolute;top:-9px;left:14px;
  font-family:var(--em-mono);font-size:9.5px;font-weight:600;letter-spacing:0.10em;
  text-transform:uppercase;background:var(--em-emerald-soft);color:#fff;
  border-radius:4px;padding:3px 7px;line-height:1;
}
.em-truck-card__lozenge.em-truck-card__lozenge--orange{background:var(--em-orange);}
/* On-dark variant — used inside .em-dark-panel */
.em-dark-panel .em-truck-card{
  background:rgba(255,255,255,0.06);border-color:rgba(255,255,255,0.14);
}
.em-dark-panel .em-truck-card:hover{border-color:rgba(255,255,255,0.40);}
.em-dark-panel .em-truck-card.em-truck-card--selected{
  background:rgba(255,255,255,0.12);border-color:#fff;box-shadow:inset 0 0 0 1px #fff;
}
.em-dark-panel .em-truck-card__head{color:var(--em-ink-on-panel-2);}
.em-dark-panel .em-truck-card__head b{color:#fff;}
.em-dark-panel .em-truck-card__cap{color:#fff;}
.em-dark-panel .em-truck-card__cap small{color:var(--em-ink-on-panel-2);}
.em-dark-panel .em-truck-card__rate{color:var(--em-ink-on-panel-2);}
.em-dark-panel .em-truck-card__rate b{color:#fff;}

/* ---------- 100-pt composition bar (Trust Lookup) ----------
   Stacked horizontal bar where each segment's flex-grow = its weight.
   Used on /dashboard/gc/contractors completed report. */
.em-composition-bar{
  display:flex;flex-direction:column;gap:10px;
  font-family:var(--em-sans);
}
.em-composition-bar__head{
  display:flex;justify-content:space-between;align-items:baseline;
  font-family:var(--em-mono);font-size:10.5px;color:var(--em-ink-3);
  letter-spacing:0.10em;text-transform:uppercase;font-weight:600;
}
.em-composition-bar__head b{color:var(--em-ink);font-weight:600;font-size:11.5px;}
.em-composition-bar__track{
  display:flex;height:14px;border-radius:5px;overflow:hidden;
  background:var(--em-card-muted);border:1px solid var(--em-hair);
}
.em-composition-bar__seg{
  height:100%;display:flex;align-items:center;justify-content:center;
  font-family:var(--em-mono);font-size:9px;font-weight:700;color:#fff;
  letter-spacing:0.04em;min-width:0;
  border-right:1px solid rgba(255,255,255,0.18);
}
.em-composition-bar__seg:last-child{border-right:0;}
.em-composition-bar__seg.em-composition-bar__seg--zero{
  background:repeating-linear-gradient(45deg,var(--em-card-muted),var(--em-card-muted) 4px,var(--em-hair) 4px,var(--em-hair) 5px) !important;
  color:var(--em-ink-3);
}
.em-composition-bar__legend{
  display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:8px 14px;
  font-family:var(--em-mono);font-size:11px;color:var(--em-ink-2);letter-spacing:0.02em;
}
.em-composition-bar__legend-row{display:flex;align-items:center;gap:8px;}
.em-composition-bar__legend-sw{width:10px;height:10px;border-radius:2px;flex:0 0 auto;}
.em-composition-bar__legend-row b{color:var(--em-ink);font-weight:600;font-family:var(--em-mono);}
/* On dark */
.em-dark-panel .em-composition-bar__head{color:var(--em-ink-on-panel-2);}
.em-dark-panel .em-composition-bar__head b{color:#fff;}
.em-dark-panel .em-composition-bar__track{background:rgba(255,255,255,0.08);border-color:rgba(255,255,255,0.14);}
.em-dark-panel .em-composition-bar__legend{color:var(--em-ink-on-panel-2);}
.em-dark-panel .em-composition-bar__legend-row b{color:#fff;}
`;

export function useEmDesignSystem() {
  useEffect(() => {
    if (typeof document === 'undefined') return;
    if (document.getElementById(STYLE_ID)) return;
    const el = document.createElement('style');
    el.id = STYLE_ID;
    el.textContent = STYLESHEET;
    document.head.appendChild(el);
  }, []);
}

// Internal hook used by every primitive — guarantees styles exist even if the
// host forgot to call useEmDesignSystem at the app root.
function useEnsure() { useEmDesignSystem(); }

/* ============================================================
 * 3 · ATOMIC PRIMITIVES
 * ============================================================ */

export function Wordmark({ href = '/', children = 'EarthMove', className = '', ...rest }) {
  useEnsure();
  return (
    <a href={href} className={`em-wordmark ${className}`} {...rest}>
      <span className="em-wordmark__leaf" aria-hidden />
      {children}
      <span className="em-wordmark__dot">.</span>
    </a>
  );
}

export function SectionLabel({ children, muted = false, className = '', ...rest }) {
  useEnsure();
  return (
    <span className={`em-section-label ${muted ? 'em-section-label--muted' : ''} ${className}`} {...rest}>
      {children}
    </span>
  );
}

/**
 * Display H1 — Fraunces, italic-emphasis via <em>.
 * Sizes: xl (64) · lg (54, default) · md (42) · sm (32).
 * Pass children as JSX; wrap emphasized phrases in <em>.
 */
export function DisplayH1({ children, size = 'lg', className = '', ...rest }) {
  useEnsure();
  return (
    <h1 className={`em-display-h1 em-display-h1--${size} ${className}`} {...rest}>
      {children}
    </h1>
  );
}

/**
 * Lozenge — mono caps chip.
 * variant: 'default' (cream) · 'dark' · 'solid-orange' · 'solid-emerald'.
 * Add a <Lozenge.Dot/> inside dark variants for the green dot pattern.
 */
export function Lozenge({ children, variant = 'default', dot = false, className = '', ...rest }) {
  useEnsure();
  const cls = variant === 'default' ? '' : `em-lozenge--${variant}`;
  return (
    <span className={`em-lozenge ${cls} ${className}`} {...rest}>
      {dot && <span className="em-lozenge__d" aria-hidden />}
      {children}
    </span>
  );
}

/**
 * StatusPill — mono caps with colored dot.
 * variant: 'default' · 'ok' · 'warn' · 'live'.
 */
export function StatusPill({ children, variant = 'default', className = '', ...rest }) {
  useEnsure();
  const cls = variant === 'default' ? '' : `em-status-pill--${variant}`;
  return (
    <span className={`em-status-pill ${cls} ${className}`} {...rest}>
      <span className="em-status-pill__d" aria-hidden />
      {children}
    </span>
  );
}

/**
 * HairlineConnector — 1px line + dot + caps label, used between
 * stacked cards (calculator → truck-class on /browse/[slug],
 * step → step on /orders/new). variant: 'default' · 'orange' · 'emerald'.
 */
export function HairlineConnector({ children, variant = 'default', className = '', ...rest }) {
  useEnsure();
  const cls = variant === 'default' ? '' : `em-hairline-connector--${variant}`;
  return (
    <div className={`em-hairline-connector ${cls} ${className}`} {...rest}>
      <span className="em-hairline-connector__line" aria-hidden />
      <span className="em-hairline-connector__dot" aria-hidden />
      {children && <span>{children}</span>}
      <span className="em-hairline-connector__dot" aria-hidden />
      <span className="em-hairline-connector__line" aria-hidden />
    </div>
  );
}

/* ============================================================
 * 4 · COMPOUND COMPONENTS
 * ============================================================ */

/**
 * DarkPanel — emerald-on-near-black commerce surface with subtle grid.
 * Variants: 'default' · 'xl' · 'flat' (no grid).
 * Children render with white-on-panel typography automatically.
 */
export function DarkPanel({
  children,
  eyebrow,
  eyebrowNum,
  variant = 'default',
  className = '',
  style,
  ...rest
}) {
  useEnsure();
  const cls = variant === 'default' ? '' : `em-dark-panel--${variant}`;
  return (
    <section className={`em-dark-panel ${cls} ${className}`} style={style} {...rest}>
      {(eyebrow || eyebrowNum) && (
        <span className="em-dark-panel__eyebrow">
          {eyebrowNum && <span className="em-dark-panel__num">{eyebrowNum}</span>}
          {eyebrow && <span>{eyebrow}</span>}
        </span>
      )}
      {children}
    </section>
  );
}

/**
 * OpsSignal — single label/value/meta cell. Compose inside <OpsSignalRow/>
 * or any grid. Renders correctly on cream OR inside a <DarkPanel/>.
 *
 *   <OpsSignal label="Distance" value="6.4 mi" suffix="remaining" meta="7.6 mi total route" />
 */
export function OpsSignal({ label, value, suffix, meta, className = '', ...rest }) {
  useEnsure();
  return (
    <div className={`em-ops-signal ${className}`} {...rest}>
      <span className="em-ops-signal__l">{label}</span>
      <span className="em-ops-signal__v">
        {value}
        {suffix && <small>{suffix}</small>}
      </span>
      {meta && <span className="em-ops-signal__meta">{meta}</span>}
    </div>
  );
}

/** Grid wrapper — set `cols` (default 3) for the cell count. */
export function OpsSignalRow({ cols = 3, children, className = '', style, ...rest }) {
  useEnsure();
  return (
    <div
      className={`em-ops-signal-row ${className}`}
      style={{ ...(style || {}), '--em-ops-cols': cols }}
      {...rest}
    >
      {children}
    </div>
  );
}

/**
 * TruckClassPanel — three-card commerce panel parameterized for
 * /browse/[slug] (cream cards inside a dark panel), /orders/new
 * sticky rail, and /orders/[id] order details.
 *
 *   classes: [
 *     { id, name, capacity, capacityUnit, rate, rateUnit, lozenge?, lozengeVariant?, disabled? }
 *   ]
 *   selectedId, onSelect (controlled). Pass `onDark` true when
 *   nested inside a <DarkPanel/>; styles flip automatically.
 *
 *   To render "right truck" homeowner UX, pass a single class with
 *   lozenge="RIGHT TRUCK FOR YOUR LOAD" and disable the others, or
 *   pass classes={[singleClass]} for a 1-card layout.
 */
export function TruckClassPanel({
  classes = [],
  selectedId,
  onSelect,
  onDark = false,
  className = '',
  ...rest
}) {
  useEnsure();
  const colsStyle = { gridTemplateColumns: `repeat(${classes.length || 3},1fr)` };
  return (
    <div
      className={`em-truck-class-panel ${onDark ? 'em-truck-class-panel--on-dark' : ''} ${className}`}
      style={colsStyle}
      {...rest}
    >
      {classes.map((c) => {
        const isSelected = c.id === selectedId;
        return (
          <button
            key={c.id}
            type="button"
            disabled={c.disabled}
            onClick={() => !c.disabled && onSelect && onSelect(c.id)}
            className={[
              'em-truck-card',
              isSelected && 'em-truck-card--selected',
              c.disabled && 'em-truck-card--disabled',
            ].filter(Boolean).join(' ')}
            style={{ textAlign: 'left', font: 'inherit' }}
          >
            {c.lozenge && (
              <span className={`em-truck-card__lozenge ${c.lozengeVariant === 'orange' ? 'em-truck-card__lozenge--orange' : ''}`}>
                {c.lozenge}
              </span>
            )}
            <span className="em-truck-card__head">
              <b>{c.name}</b>
              {c.headRight && <span>{c.headRight}</span>}
            </span>
            <span className="em-truck-card__cap">
              {c.capacity}
              {c.capacityUnit && <small>{c.capacityUnit}</small>}
            </span>
            {c.rate && (
              <span className="em-truck-card__rate">
                <b>{c.rate}</b>
                {c.rateUnit && <> {c.rateUnit}</>}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/**
 * CompositionBar — 100-point stacked composition bar from Trust Lookup.
 *
 *   segments: [
 *     { id, label, weight, score, color }   // weight sums to 100; score 0..weight
 *   ]
 *
 * Each segment's flex-grow = its weight. Segments with score = 0 render as a
 * cross-hatched "zero" pattern so a missing-data segment is visually distinct
 * from a low-but-nonzero one. Renders on cream OR inside a <DarkPanel/>.
 */
export function CompositionBar({ segments = [], total = 100, className = '', ...rest }) {
  useEnsure();
  const earned = segments.reduce((acc, s) => acc + (s.score || 0), 0);
  return (
    <div className={`em-composition-bar ${className}`} {...rest}>
      <div className="em-composition-bar__head">
        <span>Composition · 100-pt scale</span>
        <span><b>{earned}</b>&nbsp;/ {total}</span>
      </div>
      <div className="em-composition-bar__track" role="img" aria-label={`Trust score ${earned} of ${total}`}>
        {segments.map((s) => {
          const isZero = !s.score || s.score === 0;
          return (
            <div
              key={s.id}
              className={`em-composition-bar__seg ${isZero ? 'em-composition-bar__seg--zero' : ''}`}
              style={{ flexGrow: s.weight, background: s.color }}
              title={`${s.label}: ${s.score || 0}/${s.weight}`}
            >
              {!isZero && s.weight >= 8 ? `${s.score}` : ''}
            </div>
          );
        })}
      </div>
      <div className="em-composition-bar__legend">
        {segments.map((s) => (
          <div key={s.id} className="em-composition-bar__legend-row">
            <span className="em-composition-bar__legend-sw" style={{ background: s.color }} aria-hidden />
            <span>{s.label} · <b>{s.score || 0}/{s.weight}</b></span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ============================================================
 * 5 · DEFAULT EXPORT — convenience namespace.
 * ============================================================ */

const EarthMoveDS = {
  Tokens,
  useEmDesignSystem,
  Wordmark,
  SectionLabel,
  DisplayH1,
  Lozenge,
  StatusPill,
  HairlineConnector,
  DarkPanel,
  OpsSignal,
  OpsSignalRow,
  TruckClassPanel,
  CompositionBar,
};

export default EarthMoveDS;
