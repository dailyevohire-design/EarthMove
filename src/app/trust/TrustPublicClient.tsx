'use client'

import { useState, type ReactNode } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { MobileNav } from '@/components/layout/mobile-nav'
import { telemetry } from '@/lib/telemetry'

const SIGNUP_HREF = '/signup?next=/trust&intent=trust-check'

const GC_PAGE_CSS = `
.gc-page {
  --paper:#F1ECE2; --paper-2:#E9E3D5; --card:#FFFFFF; --card-muted:#F6F2E8;
  --panel:#14322A; --panel-2:#0F2920; --panel-grid:rgba(255,255,255,0.04);
  --ink:#15201B; --ink-2:#2A332E; --ink-3:#5C645F;
  --ink-on-panel:#F1ECE2; --ink-on-panel-2:#A9B4AC;
  --orange:#E5701B; --orange-press:#C95F12;
  --emerald:#2DB37A; --emerald-soft:#1F8A5C; --emerald-pale:#E6F1E9;
  --amber:#E0A52A; --amber-pale:#FBEFD0;
  --red:#C24A2A; --red-pale:#F5DCD2;
  --hair:#D8D2C4; --hair-strong:#C8C0AC;
  --display: var(--font-fraunces), 'Fraunces', serif;
  --sans: var(--font-inter), 'Inter', -apple-system, system-ui, sans-serif;
  --mono: var(--font-jetbrains-mono), 'JetBrains Mono', ui-monospace, monospace;

  background:var(--paper); color:var(--ink); font-family:var(--sans);
  -webkit-font-smoothing:antialiased; text-rendering:optimizeLegibility;
  flex:1;
}
.gc-page * { box-sizing:border-box; }
.gc-page a { color:inherit; text-decoration:none; }
.gc-page button { font-family:inherit; cursor:pointer; border:0; background:transparent; color:inherit; }
.gc-page ul, .gc-page ol { margin:0; padding:0; list-style:none; }
.gc-page img, .gc-page svg { display:block; }

/* TOP NAV */
.gc-page .topnav { position:relative; z-index:5; border-bottom:1px solid var(--hair); background:var(--paper); }
.gc-page .topnav .wrap { max-width:1280px; margin:0 auto; padding:18px 32px; display:flex; align-items:center; justify-content:space-between; gap:24px; }
.gc-page .topnav .brand { display:flex; align-items:center; gap:10px; }
.gc-page .topnav .brand .logo { width:30px; height:30px; border-radius:7px; background:var(--panel); color:#fff; display:flex; align-items:center; justify-content:center; }
.gc-page .topnav .brand .name { font-family:var(--display); font-weight:700; font-size:18px; letter-spacing:-0.01em; line-height:1; }
.gc-page .topnav .brand .sub { font-family:var(--mono); font-size:9.5px; color:var(--ink-3); letter-spacing:0.14em; text-transform:uppercase; margin-top:3px; }
.gc-page .topnav nav.links { display:flex; gap:28px; align-items:center; }
.gc-page .topnav nav.links a { font-size:13.5px; color:var(--ink-2); font-weight:500; }
.gc-page .topnav nav.links a:hover { color:var(--ink); }
.gc-page .topnav .actions { display:flex; gap:12px; align-items:center; }
.gc-page .topnav .actions .signin { font-size:13.5px; color:var(--ink-2); font-weight:500; padding:9px 14px; }
.gc-page .topnav .actions .signup { background:var(--panel); color:#fff; padding:10px 16px; border-radius:8px; font-size:13.5px; font-weight:600; transition:background 0.15s; }
.gc-page .topnav .actions .signup:hover { background:var(--panel-2); }

/* SEARCH BAR */
.gc-page .search { background:var(--card); border:1px solid var(--hair); border-radius:18px; padding:8px; box-shadow:0 18px 48px -24px rgba(0,0,0,0.45), 0 1px 0 rgba(0,0,0,0.04); max-width:880px; }
.gc-page .search .row1 { display:flex; align-items:center; gap:0; padding:6px 8px; }
.gc-page .search .row1 .icon { width:38px; display:flex; justify-content:center; color:var(--ink-3); }
.gc-page .search .row1 input { flex:1; border:0; outline:0; background:transparent; color:var(--ink); font-family:var(--sans); font-size:22px; font-weight:500; letter-spacing:-0.01em; padding:14px 8px; }
.gc-page .search .row1 input::placeholder { color:#9DA39E; font-weight:400; }
.gc-page .search .row1 .caret { width:2px; height:26px; background:var(--orange); border-radius:1px; animation:gc-blink 1.05s steps(1) infinite; }
.gc-page .search .row1 input:not(:placeholder-shown) ~ .caret { display:none; }
.gc-page .search .divider { height:1px; background:var(--hair); margin:0 4px; }

.gc-page .geo { margin-left:auto; display:flex; align-items:center; gap:6px; font-family:var(--mono); font-size:11px; color:var(--ink-3); letter-spacing:0.04em; }
.gc-page .geo label { text-transform:uppercase; }
.gc-page .geo select, .gc-page .geo input { border:1px solid var(--hair); background:var(--card); color:var(--ink); padding:6px 8px; border-radius:6px; font-family:var(--mono); font-size:11px; outline:0; }
.gc-page .geo input { width:80px; }

.gc-page .search .submit-row { display:flex; align-items:center; justify-content:space-between; gap:16px; padding:6px 10px 8px; flex-wrap:wrap; }
.gc-page .search .submit-row .legal { font-size:11.5px; color:var(--ink-3); letter-spacing:0.01em; line-height:1.5; }
.gc-page .search .submit-row .legal a { color:var(--ink-2); text-decoration:underline; text-decoration-color:var(--hair-strong); text-underline-offset:3px; }

.gc-page .btn { display:inline-flex; align-items:center; gap:8px; padding:13px 20px; border-radius:10px; font-weight:600; font-size:14px; line-height:1; letter-spacing:-0.005em; transition:transform 0.08s ease, background 0.15s ease; }
.gc-page .btn:active { transform:translateY(1px); }
.gc-page .btn-primary { background:var(--orange); color:#fff; }
.gc-page .btn-primary:hover { background:var(--orange-press); }
.gc-page .btn-primary .arrow { font-family:var(--mono); font-weight:500; }

/* slim search variant */
.gc-page .search.slim .row2 { display:none; }
.gc-page .search.slim .submit-row { padding:14px 12px 10px; display:flex; align-items:center; gap:14px; flex-wrap:wrap; }
.gc-page .search.slim .row1 { padding:10px 8px; border-bottom:1px solid var(--hair); }
.gc-page .search.slim .submit-row .legal { display:inline-flex; align-items:center; gap:8px; }
.gc-page .search.slim .submit-row .legal .free-pill { background:var(--emerald-pale); color:var(--emerald-soft); font-family:var(--mono); font-size:10px; font-weight:700; letter-spacing:0.08em; text-transform:uppercase; padding:4px 8px; border-radius:6px; }
.gc-page .search.slim .submit-row .geo { margin-right:auto; margin-left:0; order:1; }
.gc-page .search.slim .submit-row .legal { order:2; flex:1; justify-content:flex-end; text-align:right; }
.gc-page .search.slim .submit-row .btn { order:3; }

/* OPS BAND */
.gc-page .ops-band { background:var(--paper); border-bottom:1px solid var(--hair); }
.gc-page .ops-band .wrap { max-width:1100px; margin:0 auto; padding:36px 32px; }
.gc-page .ops { display:grid; grid-template-columns:repeat(4,1fr); gap:0; border:1px solid var(--hair); border-radius:14px; overflow:hidden; background:var(--card); }
.gc-page .ops .cell { padding:20px 22px; border-right:1px solid var(--hair); display:flex; flex-direction:column; gap:6px; }
.gc-page .ops .cell:last-child { border-right:0; }
.gc-page .ops .cell .l { font-family:var(--mono); font-size:10.5px; letter-spacing:0.12em; text-transform:uppercase; color:var(--ink-3); }
.gc-page .ops .cell .v { font-family:var(--display); font-weight:600; font-size:24px; letter-spacing:-0.015em; line-height:1.05; color:var(--ink); }
.gc-page .ops .cell .v em { font-style:normal; color:var(--orange); font-weight:700; }
.gc-page .ops .cell .sub { font-size:11.5px; color:var(--ink-3); line-height:1.4; }

/* HOW IT WORKS */
.gc-page .how { padding:72px 32px; }
.gc-page .how .wrap { max-width:1100px; margin:0 auto; }
.gc-page .how .head { display:flex; align-items:flex-end; justify-content:space-between; gap:32px; margin-bottom:36px; flex-wrap:wrap; }
.gc-page .how .head .label { font-family:var(--mono); font-size:11px; letter-spacing:0.16em; text-transform:uppercase; color:var(--ink-2); display:inline-flex; align-items:center; gap:10px; }
.gc-page .how .head .label::before { content:""; width:18px; height:1.5px; background:var(--ink-2); }
.gc-page .how .head h2 { font-family:var(--display); font-weight:600; font-size:38px; line-height:1.05; letter-spacing:-0.02em; margin:10px 0 0; max-width:640px; }
.gc-page .how .head h2 em { font-style:italic; font-weight:500; }
.gc-page .how .steps { display:grid; grid-template-columns:repeat(3,1fr); gap:24px; }
.gc-page .how .step { background:var(--card); border:1px solid var(--hair); border-radius:16px; padding:28px; display:flex; flex-direction:column; gap:14px; }
.gc-page .how .step .num { font-family:var(--mono); font-size:11px; letter-spacing:0.14em; color:var(--ink-3); }
.gc-page .how .step .ico { width:44px; height:44px; border-radius:11px; background:var(--card-muted); border:1px solid var(--hair); display:flex; align-items:center; justify-content:center; color:var(--panel); }
.gc-page .how .step h3 { font-family:var(--display); font-weight:600; font-size:22px; letter-spacing:-0.01em; margin:0; line-height:1.1; }
.gc-page .how .step p { font-size:14px; line-height:1.55; color:var(--ink-2); margin:0; }

/* PROGRESS BAND */
.gc-page .progress-band { background:var(--panel); color:var(--ink-on-panel); padding:64px 32px; position:relative; overflow:hidden; }
.gc-page .progress-band::before { content:""; position:absolute; inset:0; background-image:linear-gradient(var(--panel-grid) 1px, transparent 1px), linear-gradient(90deg, var(--panel-grid) 1px, transparent 1px); background-size:64px 64px; pointer-events:none; }
.gc-page .progress-band .wrap { max-width:1100px; margin:0 auto; position:relative; display:grid; grid-template-columns:1fr 1.2fr; gap:48px; align-items:center; }
.gc-page .progress-band .left .label { font-family:var(--mono); font-size:11px; letter-spacing:0.16em; text-transform:uppercase; color:var(--ink-on-panel-2); display:inline-flex; align-items:center; gap:10px; }
.gc-page .progress-band .left .label::before { content:""; width:18px; height:1.5px; background:var(--ink-on-panel-2); }
.gc-page .progress-band .left h2 { font-family:var(--display); font-weight:600; font-size:40px; line-height:1.04; letter-spacing:-0.02em; margin:14px 0 16px; color:#fff; }
.gc-page .progress-band .left h2 em { font-style:italic; font-weight:500; color:var(--ink-on-panel); }
.gc-page .progress-band .left p { font-size:15px; color:var(--ink-on-panel-2); line-height:1.6; max-width:420px; margin:0; }

.gc-page .progress-card { background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.08); border-radius:14px; padding:28px; backdrop-filter:blur(4px); }
.gc-page .progress-card .target { font-family:var(--mono); font-size:12px; color:var(--ink-on-panel-2); letter-spacing:0.04em; padding-bottom:14px; border-bottom:1px solid rgba(255,255,255,0.08); margin-bottom:18px; display:flex; align-items:center; justify-content:space-between; }
.gc-page .progress-card .target b { color:#fff; font-weight:500; }
.gc-page .progress-card .target .timer { color:var(--emerald); font-family:var(--mono); }
.gc-page .progress-card .progress-list { display:flex; flex-direction:column; gap:13px; }
.gc-page .progress-card .pl-row { display:flex; align-items:center; gap:12px; font-family:var(--mono); font-size:13px; letter-spacing:0.01em; color:var(--ink-on-panel); }
.gc-page .progress-card .pl-row .dot { width:18px; height:18px; border-radius:50%; background:rgba(45,179,122,0.15); color:var(--emerald); display:flex; align-items:center; justify-content:center; flex-shrink:0; }
.gc-page .progress-card .pl-row.active { color:#fff; }
.gc-page .progress-card .pl-row.active .dot { background:rgba(229,112,27,0.18); color:var(--orange); animation:gc-spin 1.4s linear infinite; }
.gc-page .progress-card .pl-row.pending { color:var(--ink-on-panel-2); opacity:0.5; }
.gc-page .progress-card .pl-row.pending .dot { background:rgba(255,255,255,0.05); color:var(--ink-on-panel-2); }

/* RESULT — REPORT CARD */
.gc-page .result-band { padding:80px 32px; }
.gc-page .result-band .wrap { max-width:1100px; margin:0 auto; }
.gc-page .result-band .preface { font-family:var(--mono); font-size:11px; letter-spacing:0.16em; text-transform:uppercase; color:var(--ink-2); display:inline-flex; align-items:center; gap:10px; margin-bottom:8px; }
.gc-page .result-band .preface::before { content:""; width:18px; height:1.5px; background:var(--ink-2); }
.gc-page .result-band h2 { font-family:var(--display); font-weight:600; font-size:38px; line-height:1.05; letter-spacing:-0.02em; margin:0 0 8px; }
.gc-page .result-band h2 em { font-style:italic; font-weight:500; }
.gc-page .result-band .preamble-lede { font-size:15px; color:var(--ink-2); max-width:580px; margin:0 0 32px; line-height:1.55; }

.gc-page .report { background:var(--card); border:1px solid var(--hair); border-radius:20px; padding:0; overflow:hidden; box-shadow:0 1px 0 rgba(0,0,0,0.02); }
.gc-page .report .r-head { padding:36px 40px 32px; border-bottom:1px solid var(--hair); display:grid; grid-template-columns:1fr auto; gap:32px; align-items:start; }
.gc-page .report .r-head .left .stamp { font-family:var(--mono); font-size:10.5px; letter-spacing:0.14em; text-transform:uppercase; color:var(--emerald-soft); display:inline-flex; align-items:center; gap:6px; }
.gc-page .report .r-head .left .stamp .live { width:6px; height:6px; border-radius:50%; background:var(--emerald); animation:gc-pulse 1.6s ease-in-out infinite; }
.gc-page .report .r-head .left h3 { font-family:var(--display); font-weight:600; font-size:36px; line-height:1.05; letter-spacing:-0.02em; margin:8px 0 6px; }
.gc-page .report .r-head .left .meta { font-family:var(--mono); font-size:12px; color:var(--ink-3); letter-spacing:0.04em; display:flex; flex-wrap:wrap; gap:8px; align-items:center; }
.gc-page .report .r-head .left .meta .sep { opacity:0.4; }
.gc-page .report .r-head .left .verdict { font-family:var(--display); font-style:italic; font-weight:500; font-size:20px; line-height:1.4; margin:18px 0 0; color:var(--ink-2); max-width:540px; }

.gc-page .score-block { display:flex; align-items:center; gap:18px; background:var(--emerald-pale); border:1px solid rgba(45,179,122,0.22); border-radius:16px; padding:18px 22px 18px 24px; min-width:280px; }
.gc-page .score-num { font-family:var(--display); font-weight:700; font-size:84px; line-height:0.9; letter-spacing:-0.04em; color:var(--emerald-soft); position:relative; }
.gc-page .score-num::after { content:"/100"; font-family:var(--mono); font-size:13px; font-weight:500; color:var(--emerald-soft); letter-spacing:0.02em; margin-left:4px; vertical-align:top; position:relative; top:6px; }
.gc-page .score-meta { display:flex; flex-direction:column; gap:6px; }
.gc-page .score-meta .grade { font-family:var(--display); font-weight:600; font-size:32px; line-height:1; letter-spacing:-0.02em; color:var(--emerald-soft); }
.gc-page .score-meta .timestamp { font-family:var(--mono); font-size:10.5px; color:var(--ink-3); letter-spacing:0.04em; }
.gc-page .score-meta .cache { font-family:var(--mono); font-size:10.5px; letter-spacing:0.04em; color:var(--ink-2); }
.gc-page .score-meta .cache a { color:var(--orange); text-decoration:underline; text-underline-offset:2px; }

/* breakdown */
.gc-page .breakdown { padding:32px 40px 28px; border-bottom:1px solid var(--hair); }
.gc-page .breakdown .heading { font-family:var(--mono); font-size:10.5px; letter-spacing:0.14em; text-transform:uppercase; color:var(--ink-3); margin-bottom:18px; }
.gc-page .bd-row { display:grid; grid-template-columns:200px 70px 1fr 24px; gap:18px; align-items:center; padding:14px 0; border-top:1px solid var(--hair); }
.gc-page .bd-row:first-of-type { border-top:0; }
.gc-page .bd-row .name { font-weight:600; font-size:14px; color:var(--ink); letter-spacing:-0.005em; }
.gc-page .bd-row .num { font-family:var(--mono); font-size:13px; color:var(--ink-2); font-weight:500; }
.gc-page .bd-row .num em { font-style:normal; color:var(--ink-3); font-weight:400; }
.gc-page .bd-row .bar-wrap { display:flex; flex-direction:column; gap:6px; }
.gc-page .bd-row .bar { height:6px; background:rgba(20,32,27,0.06); border-radius:999px; overflow:hidden; }
.gc-page .bd-row .bar .fill { height:100%; border-radius:999px; }
.gc-page .bd-row .bar .fill.green { background:var(--emerald); }
.gc-page .bd-row .bar .fill.amber { background:var(--amber); }
.gc-page .bd-row .bar .fill.red { background:var(--red); }
.gc-page .bd-row .outcome { font-size:12.5px; color:var(--ink-3); line-height:1.45; }
.gc-page .bd-row .check { color:var(--emerald); width:18px; height:18px; display:flex; align-items:center; justify-content:center; }
.gc-page .bd-row .check.warn { color:var(--amber); }
.gc-page .bd-row .check.fail { color:var(--red); }

/* accordion */
.gc-page .accordion { padding:8px 40px 0; }
.gc-page .acc-item { border-top:1px solid var(--hair); padding:18px 0; }
.gc-page .acc-item:first-of-type { border-top:0; }
.gc-page .acc-item .acc-head { display:flex; align-items:center; justify-content:space-between; gap:16px; cursor:pointer; }
.gc-page .acc-item .acc-head .left { display:flex; align-items:center; gap:14px; }
.gc-page .acc-item .acc-head .icon { width:36px; height:36px; border-radius:9px; background:var(--card-muted); display:flex; align-items:center; justify-content:center; color:var(--panel); border:1px solid var(--hair); }
.gc-page .acc-item .acc-head h4 { font-family:var(--display); font-weight:600; font-size:18px; letter-spacing:-0.01em; margin:0; line-height:1.2; }
.gc-page .acc-item .acc-head .summary { font-size:12.5px; color:var(--ink-3); margin-top:2px; }
.gc-page .acc-item .acc-head .chev { color:var(--ink-3); transition:transform 0.2s; }
.gc-page .acc-item.open .acc-head .chev { transform:rotate(180deg); }
.gc-page .acc-item .acc-body { margin-top:14px; padding-left:50px; display:none; }
.gc-page .acc-item.open .acc-body { display:block; }
.gc-page .acc-item .acc-body ul { display:flex; flex-direction:column; gap:8px; }
.gc-page .acc-item .acc-body li { display:flex; align-items:flex-start; gap:10px; font-size:13.5px; color:var(--ink-2); line-height:1.5; }
.gc-page .acc-item .acc-body li .lic { color:var(--emerald); width:16px; height:16px; flex-shrink:0; margin-top:3px; }
.gc-page .acc-item .acc-body li .lic.warn { color:var(--amber); }
.gc-page .acc-item .acc-body li b { font-weight:600; color:var(--ink); }

/* paywall */
.gc-page .paywall { margin:18px 40px 32px; background:var(--card-muted); border:1px solid var(--hair); border-radius:14px; padding:24px 28px; display:grid; grid-template-columns:1fr auto; gap:24px; align-items:center; }
.gc-page .paywall .pw-text h4 { font-family:var(--display); font-weight:600; font-size:20px; line-height:1.2; letter-spacing:-0.01em; margin:0 0 6px; }
.gc-page .paywall .pw-text p { font-size:13px; color:var(--ink-2); line-height:1.55; margin:0; max-width:520px; }
.gc-page .paywall .pw-text p b { color:var(--ink); }
.gc-page .paywall .pw-actions { display:flex; flex-direction:column; align-items:flex-end; gap:8px; }
.gc-page .paywall .pw-link { font-size:12.5px; color:var(--ink-3); }
.gc-page .paywall .pw-link a { color:var(--ink-2); text-decoration:underline; text-underline-offset:3px; }

/* fcra disclaimer */
.gc-page .disclaimer { margin:0 40px 32px; padding-top:20px; border-top:1px solid var(--hair); font-size:11.5px; color:var(--ink-3); line-height:1.55; font-style:italic; }
.gc-page .disclaimer b { color:var(--ink-2); font-style:normal; font-weight:600; }

/* PRICING BAND */
.gc-page .pricing-band { background:var(--paper-2); padding:64px 32px 72px; }
.gc-page .pricing-band .wrap { max-width:1180px; margin:0 auto; }
.gc-page .pricing-band .head { display:flex; align-items:flex-end; justify-content:space-between; gap:32px; margin-bottom:40px; flex-wrap:wrap; }
.gc-page .pricing-band .head .left { max-width:640px; }
.gc-page .pricing-band .head .label { font-family:var(--mono); font-size:11px; letter-spacing:0.16em; text-transform:uppercase; color:var(--ink-2); display:inline-flex; align-items:center; gap:10px; }
.gc-page .pricing-band .head .label::before { content:""; width:18px; height:1.5px; background:var(--ink-2); }
.gc-page .pricing-band .head h2 { font-family:var(--display); font-weight:600; font-size:42px; line-height:1.05; letter-spacing:-0.02em; margin:14px 0 8px; }
.gc-page .pricing-band .head h2 em { font-style:italic; font-weight:500; }
.gc-page .pricing-band .head p { font-size:15px; color:var(--ink-2); line-height:1.55; margin:0; max-width:520px; }

.gc-page .toggle-wrap { display:flex; align-items:center; gap:12px; }
.gc-page .toggle { display:inline-flex; background:var(--card); border:1px solid var(--hair); border-radius:999px; padding:4px; position:relative; }
.gc-page .toggle button { padding:8px 18px; border-radius:999px; font-size:13px; font-weight:600; color:var(--ink-2); transition:all 0.18s; }
.gc-page .toggle button.active { background:var(--panel); color:#fff; }
.gc-page .save-pill { background:var(--orange); color:#fff; padding:5px 10px; border-radius:999px; font-family:var(--mono); font-size:10.5px; letter-spacing:0.06em; font-weight:600; }

.gc-page .tiers { display:grid; grid-template-columns:1fr 1.05fr 1fr 0.85fr; gap:18px; align-items:stretch; }
.gc-page .tier-card { background:var(--card); border:1px solid var(--hair); border-radius:18px; padding:32px 28px 28px; display:flex; flex-direction:column; gap:18px; position:relative; }
.gc-page .tier-card.featured { border:2px solid var(--emerald-soft); box-shadow:0 18px 48px -28px rgba(31,138,92,0.4); transform:translateY(-8px); background:linear-gradient(180deg, #fff 0%, var(--emerald-pale) 100%); }
.gc-page .tier-card.enterprise { background:var(--panel); color:var(--ink-on-panel); border-color:var(--panel); }
.gc-page .tier-card .badge { position:absolute; top:-13px; left:50%; transform:translateX(-50%); background:var(--emerald-soft); color:#fff; padding:6px 14px; border-radius:999px; font-family:var(--mono); font-size:10.5px; letter-spacing:0.1em; font-weight:600; text-transform:uppercase; }
.gc-page .tier-card .tier-name { font-family:var(--display); font-weight:600; font-size:24px; letter-spacing:-0.01em; line-height:1; }
.gc-page .tier-card.enterprise .tier-name { color:#fff; }
.gc-page .tier-card .tier-tagline { font-size:13px; color:var(--ink-3); line-height:1.5; }
.gc-page .tier-card.enterprise .tier-tagline { color:var(--ink-on-panel-2); }

.gc-page .tier-card .price-block { padding-bottom:18px; border-bottom:1px solid var(--hair); }
.gc-page .tier-card.featured .price-block { border-bottom-color:rgba(31,138,92,0.18); }
.gc-page .tier-card.enterprise .price-block { border-bottom-color:rgba(255,255,255,0.1); }
.gc-page .tier-card .price { display:flex; align-items:baseline; gap:6px; }
.gc-page .tier-card .price .num { font-family:var(--display); font-weight:700; font-size:48px; line-height:1; letter-spacing:-0.03em; color:var(--ink); }
.gc-page .tier-card.enterprise .price .num { color:#fff; font-size:32px; font-style:italic; font-weight:500; }
.gc-page .tier-card .price .unit { font-family:var(--mono); font-size:12px; color:var(--ink-3); letter-spacing:0.02em; }
.gc-page .tier-card.enterprise .price .unit { color:var(--ink-on-panel-2); }
.gc-page .tier-card .billed { font-family:var(--mono); font-size:11px; color:var(--ink-3); margin-top:6px; letter-spacing:0.02em; }
.gc-page .tier-card .billed b { color:var(--orange); font-weight:600; }

.gc-page .tier-card ul.feats { display:flex; flex-direction:column; gap:10px; flex:1; }
.gc-page .tier-card ul.feats li { display:flex; align-items:flex-start; gap:10px; font-size:13.5px; line-height:1.5; color:var(--ink-2); }
.gc-page .tier-card.enterprise ul.feats li { color:var(--ink-on-panel); }
.gc-page .tier-card ul.feats li svg { color:var(--emerald); width:16px; height:16px; flex-shrink:0; margin-top:3px; }

.gc-page .tier-card .cta { display:flex; align-items:center; justify-content:center; gap:8px; padding:13px 18px; border-radius:10px; font-weight:600; font-size:14px; line-height:1; transition:background 0.15s; }
.gc-page .tier-card .cta.secondary { background:var(--card-muted); color:var(--ink); border:1px solid var(--hair); }
.gc-page .tier-card .cta.secondary:hover { background:var(--paper-2); }
.gc-page .tier-card .cta.primary { background:var(--orange); color:#fff; }
.gc-page .tier-card .cta.primary:hover { background:var(--orange-press); }
.gc-page .tier-card .cta.dark { background:var(--panel); color:#fff; }
.gc-page .tier-card .cta.dark:hover { background:var(--panel-2); }
.gc-page .tier-card .cta.outline { background:transparent; color:#fff; border:1px solid rgba(255,255,255,0.3); }
.gc-page .tier-card .cta.outline:hover { background:rgba(255,255,255,0.08); }

.gc-page .anchor { margin-top:28px; text-align:center; font-style:italic; font-size:12.5px; color:var(--ink-3); letter-spacing:0.01em; }

/* "Or try it first" — merged into pricing-band */
.gc-page .pricing-band .try-it { margin-top:40px; padding-top:32px; border-top:1px dashed var(--hair-strong); }
.gc-page .pricing-band .try-it-head { display:flex; align-items:baseline; justify-content:flex-start; gap:18px; flex-wrap:wrap; margin-bottom:18px; }
.gc-page .pricing-band .try-it-head h3 { font-family:var(--display); font-weight:600; font-size:26px; letter-spacing:-0.02em; line-height:1.1; margin:0; }
.gc-page .pricing-band .try-it-head h3 em { font-style:italic; font-weight:500; }
.gc-page .pricing-band .try-it-head .sub { font-size:14px; color:var(--ink-2); line-height:1.5; }
.gc-page .pricing-band .try-it .search { box-shadow:0 14px 36px -22px rgba(20,32,27,0.16), 0 1px 0 rgba(20,32,27,0.04); max-width:none; }
.gc-page .pricing-band .try-it .reassure { margin-top:20px; display:flex; flex-wrap:wrap; gap:24px; font-size:12.5px; }
.gc-page .pricing-band .try-it .reassure .item { display:inline-flex; align-items:center; gap:8px; color:var(--ink-2); }
.gc-page .pricing-band .try-it .reassure svg { color:var(--emerald-soft); }

/* USE CASES */
.gc-page .use { padding:96px 32px; border-top:1px solid var(--hair); }
.gc-page .use .wrap { max-width:1100px; margin:0 auto; }
.gc-page .use .head { margin-bottom:40px; }
.gc-page .use .head .label { font-family:var(--mono); font-size:11px; letter-spacing:0.16em; text-transform:uppercase; color:var(--ink-2); display:inline-flex; align-items:center; gap:10px; }
.gc-page .use .head .label::before { content:""; width:18px; height:1.5px; background:var(--ink-2); }
.gc-page .use .head h2 { font-family:var(--display); font-weight:600; font-size:42px; line-height:1.05; letter-spacing:-0.02em; margin:14px 0 0; max-width:740px; }
.gc-page .use .head h2 em { font-style:italic; font-weight:500; }
.gc-page .use-cards { display:grid; grid-template-columns:1fr 1fr; gap:24px; }
.gc-page .use-card { background:var(--card); border:1px solid var(--hair); border-radius:18px; padding:36px 36px 32px; display:flex; flex-direction:column; gap:18px; }
.gc-page .use-card .ic { width:48px; height:48px; border-radius:12px; background:var(--card-muted); border:1px solid var(--hair); display:flex; align-items:center; justify-content:center; color:var(--panel); }
.gc-page .use-card .audience { font-family:var(--mono); font-size:11px; letter-spacing:0.14em; text-transform:uppercase; color:var(--ink-3); }
.gc-page .use-card h3 { font-family:var(--display); font-weight:600; font-size:26px; letter-spacing:-0.015em; line-height:1.1; margin:0; }
.gc-page .use-card h3 em { font-style:italic; font-weight:500; }
.gc-page .use-card p { font-size:14px; line-height:1.6; color:var(--ink-2); margin:0; }
.gc-page .use-card .stat { background:var(--card-muted); border:1px solid var(--hair); border-radius:10px; padding:14px 16px; font-size:13px; color:var(--ink-2); font-style:italic; line-height:1.45; }
.gc-page .use-card .stat b { font-style:normal; font-weight:600; color:var(--ink); font-family:var(--display); }
.gc-page .use-card .link { margin-top:auto; font-size:13px; font-weight:600; color:var(--orange); display:inline-flex; align-items:center; gap:6px; }

/* FAQ */
.gc-page .faq { padding:96px 32px; background:var(--paper-2); border-top:1px solid var(--hair); }
.gc-page .faq .wrap { max-width:880px; margin:0 auto; }
.gc-page .faq .head { text-align:left; margin-bottom:32px; }
.gc-page .faq .head .label { font-family:var(--mono); font-size:11px; letter-spacing:0.16em; text-transform:uppercase; color:var(--ink-2); display:inline-flex; align-items:center; gap:10px; }
.gc-page .faq .head .label::before { content:""; width:18px; height:1.5px; background:var(--ink-2); }
.gc-page .faq .head h2 { font-family:var(--display); font-weight:600; font-size:36px; line-height:1.05; letter-spacing:-0.02em; margin:14px 0 0; }
.gc-page .faq .head h2 em { font-style:italic; font-weight:500; }
.gc-page .faq-list { background:var(--card); border:1px solid var(--hair); border-radius:14px; overflow:hidden; }
.gc-page .faq-item { border-top:1px solid var(--hair); padding:20px 24px; }
.gc-page .faq-item:first-child { border-top:0; }
.gc-page .faq-item .q { display:flex; align-items:center; justify-content:space-between; gap:16px; cursor:pointer; font-weight:600; font-size:15px; letter-spacing:-0.005em; color:var(--ink); }
.gc-page .faq-item .q .chev { color:var(--ink-3); transition:transform 0.2s; }
.gc-page .faq-item.open .q .chev { transform:rotate(180deg); }
.gc-page .faq-item .a { display:none; margin-top:12px; font-size:13.5px; line-height:1.6; color:var(--ink-2); max-width:680px; }
.gc-page .faq-item.open .a { display:block; }
.gc-page .faq-item .a a { color:var(--orange); text-decoration:underline; text-underline-offset:3px; }

/* FOOTER */
.gc-page footer { background:var(--paper); border-top:1px solid var(--hair); padding:32px; }
.gc-page footer .wrap { max-width:1100px; margin:0 auto; display:flex; flex-wrap:wrap; align-items:center; justify-content:space-between; gap:18px; }
.gc-page footer .left { font-family:var(--mono); font-size:11px; color:var(--ink-3); letter-spacing:0.04em; }
.gc-page footer .right { display:flex; gap:20px; font-size:12.5px; color:var(--ink-3); }
.gc-page footer .right a:hover { color:var(--ink); }

/* KEYFRAMES (page-scoped via gc- prefix) */
@keyframes gc-blink { 50% { opacity:0; } }
@keyframes gc-spin { from { transform:rotate(0); } to { transform:rotate(360deg); } }
@keyframes gc-pulse { 0%, 100% { opacity:1; } 50% { opacity:0.4; } }

/* MOBILE */
/* ============================================================
   RESPONSIVE — tablet (≤1180) + mobile (≤760)
   ============================================================ */
@media (max-width:1180px) {
  /* tablet: 4-col tier grid → 2-col, stack hero info, single-col internals */
  .gc-page .pricing-band .head { flex-wrap:wrap; }
  .gc-page .tiers { grid-template-columns: repeat(2, 1fr); }
  .gc-page .tier-card.featured { transform: none; }
  .gc-page .progress-band .wrap { grid-template-columns: 1fr; gap: 32px; }
  .gc-page .report .r-head { grid-template-columns: 1fr; }
  .gc-page .use-cards { grid-template-columns: 1fr; }
  .gc-page .ops { grid-template-columns: repeat(2, 1fr); }
  .gc-page .ops .cell { border-right: 1px solid var(--hair); border-bottom: 1px solid var(--hair); }
  .gc-page .ops .cell:nth-child(2) { border-right: 0; }
  .gc-page .ops .cell:nth-child(3), .gc-page .ops .cell:nth-child(4) { border-bottom: 0; }
  .gc-page .ops .cell:nth-child(4) { border-right: 0; }
  .gc-page .how .head h2 { font-size: 32px; }
  .gc-page .pricing-band h2 { font-size: 36px; }
}
@media (max-width:760px) {
  /* mobile: full stack, page padding tight, typography reduce, touch targets ≥44px */
  .gc-page .topnav nav.links { display: none; }
  .gc-page .topnav .wrap { padding: 14px 20px; }

  /* page-section padding tighter */
  .gc-page .hero,
  .gc-page .ops-band,
  .gc-page .how,
  .gc-page .progress-band,
  .gc-page .result-band,
  .gc-page .pricing-band,
  .gc-page .use,
  .gc-page .faq { padding-left: 20px; padding-right: 20px; }
  .gc-page .hero { padding-top: 44px; padding-bottom: 56px; }
  .gc-page .pricing-band { padding-top: 44px; padding-bottom: 56px; }
  .gc-page .how, .gc-page .use, .gc-page .faq { padding-top: 56px; padding-bottom: 56px; }
  .gc-page .progress-band, .gc-page .result-band { padding-top: 48px; padding-bottom: 48px; }
  .gc-page .ops-band .wrap { padding: 28px 20px; }

  /* typography */
  .gc-page .hero h1 { font-size: clamp(24px, 9vw, 44px); }
  .gc-page .pricing-band h2 { font-size: 30px; line-height: 1.06; }
  .gc-page .how .head h2 { font-size: 28px; }
  .gc-page .progress-band .left h2 { font-size: 30px; }
  .gc-page .result-band h2 { font-size: 28px; }
  .gc-page .use .head h2 { font-size: 30px; }
  .gc-page .faq .head h2 { font-size: 26px; }
  .gc-page .pricing-band .head { flex-direction: column; align-items: flex-start; gap: 16px; }

  /* tiers full-stack */
  .gc-page .tiers { grid-template-columns: 1fr; gap: 14px; }
  .gc-page .tier-card { padding: 26px 24px 24px; }
  .gc-page .tier-card.featured { transform: none; }

  /* try-it search column-stack */
  .gc-page .pricing-band .try-it { margin-top: 32px; padding-top: 24px; }
  .gc-page .pricing-band .try-it-head { flex-direction: column; gap: 6px; }
  .gc-page .pricing-band .try-it-head h3 { font-size: 22px; }
  .gc-page .search.slim .submit-row { flex-direction: column; align-items: stretch; gap: 12px; padding: 12px 10px 10px; }
  .gc-page .search.slim .submit-row .geo,
  .gc-page .search.slim .submit-row .legal,
  .gc-page .search.slim .submit-row .btn { order: initial; text-align: left; justify-content: flex-start; margin: 0; flex: none; }
  .gc-page .search.slim .submit-row .btn { align-self: stretch; justify-content: center; min-height: 48px; }
  .gc-page .search.slim .submit-row .legal { flex-wrap: wrap; }
  .gc-page .search .row1 input { font-size: 18px; padding: 12px 8px; }

  /* ops cells stack 2x2 */
  .gc-page .ops { grid-template-columns: 1fr 1fr; }

  /* steps + progress */
  .gc-page .how .steps { grid-template-columns: 1fr; }
  .gc-page .how .step { padding: 24px; }
  .gc-page .progress-band .wrap { grid-template-columns: 1fr; gap: 28px; }
  .gc-page .progress-card { padding: 22px; }

  /* report card */
  .gc-page .report .r-head { grid-template-columns: 1fr; padding: 28px 24px; gap: 20px; }
  .gc-page .report .r-head .left h3 { font-size: 28px; }
  .gc-page .score-block { align-self: start; min-width: 0; padding: 16px 20px; }
  .gc-page .score-num { font-size: 64px; }
  .gc-page .score-meta .grade { font-size: 26px; }
  .gc-page .breakdown { padding: 24px; }
  .gc-page .accordion { padding: 4px 24px 0; }
  .gc-page .paywall { margin: 16px 24px 24px; padding: 20px; grid-template-columns: 1fr; }
  .gc-page .paywall .pw-actions { align-items: flex-start; }
  .gc-page .disclaimer { margin: 0 24px 24px; }
  .gc-page .bd-row { grid-template-columns: 1fr; gap: 8px; }
  .gc-page .bd-row .num { order: 2; }
  .gc-page .bd-row .bar-wrap { order: 3; }
  .gc-page .bd-row .check { order: 0; justify-self: flex-end; }

  /* use cards */
  .gc-page .use-cards { grid-template-columns: 1fr; }
  .gc-page .use-card { padding: 28px 24px 24px; }

  /* faq */
  .gc-page .faq-item { padding: 18px 20px; }

  /* touch targets ≥44px on mobile */
  .gc-page .toggle button { min-height: 44px; padding: 10px 18px; }
  .gc-page .geo select, .gc-page .geo input { min-height: 40px; padding: 8px 10px; font-size: 12px; }
  .gc-page .topnav .actions .signup { min-height: 40px; }
}

/* C-MOBILE-2: align inline-CTA hide with MobileNav's md:hidden (<768px). */
@media (max-width:767px) {
  .gc-page .topnav .actions .gc-desktop-only { display: none; }
  .gc-page .topnav .actions { gap: 0; }
}
`

// Reusable inline icon for tier feature checkmarks (15+ instances).
function TierCheck() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M3 8 L6.5 11.5 L13 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function ChevronDown() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M4 6 L8 10 L12 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

interface AccordionItemData {
  id: string
  title: string
  summary: string
  iconPath: ReactNode
  body?: ReactNode
}

const ACCORDION_ITEMS: AccordionItemData[] = [
  {
    id: 'identity',
    title: 'Identity & legitimacy',
    summary: 'Subject confirmed · Long operating history · Status current',
    iconPath: (
      <>
        <rect x="3" y="3" width="12" height="12" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
        <path d="M3 7 L15 7" stroke="currentColor" strokeWidth="1.5" />
      </>
    ),
    body: (
      <ul>
        <li>
          <span className="lic">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
              <path d="M2 7 L6 11 L12 3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
          <span><b>Operating entity confirmed legitimate</b> · 12-year continuous operating history · No interruptions or status changes</span>
        </li>
        <li>
          <span className="lic">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
              <path d="M2 7 L6 11 L12 3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
          <span><b>Contact and operating presence verified</b> · Address and reachability confirmed across independent checks</span>
        </li>
        <li>
          <span className="lic">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
              <path d="M2 7 L6 11 L12 3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
          <span><b>Tax registration in good standing</b> · No flags raised on legitimacy of business operation</span>
        </li>
        <li>
          <span className="lic">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
              <path d="M2 7 L6 11 L12 3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
          <span><b>Ownership structure consistent</b> · Named principals match across all reviewed sources</span>
        </li>
      </ul>
    ),
  },
  {
    id: 'operating-fitness',
    title: 'Operating fitness',
    summary: 'Cleared on operational requirements · No flagged issues',
    iconPath: (
      <>
        <path d="M4 4 L14 4 L14 14 L4 14 Z" stroke="currentColor" strokeWidth="1.5" />
        <path d="M7 8 L11 8 M7 11 L10 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </>
    ),
  },
  {
    id: 'risk-posture',
    title: 'Risk posture',
    summary: 'Low-risk profile · No elevated indicators in recent activity',
    iconPath: (
      <path d="M9 2 L15 5 L15 10 C15 13 12 15 9 16 C6 15 3 13 3 10 L3 5 Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
    ),
  },
  {
    id: 'conflict-record',
    title: 'Conflict record',
    summary: 'Clean active record · One historical issue, resolved',
    iconPath: (
      <path d="M3 9 L9 3 L15 9 L9 15 Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
    ),
  },
  {
    id: 'market-reputation',
    title: 'Market reputation',
    summary: 'Strong positive signal across reviewed market sources',
    iconPath: (
      <path d="M9 2 L11 7 L16 7 L12 10.5 L13.5 16 L9 13 L4.5 16 L6 10.5 L2 7 L7 7 Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
    ),
  },
]

interface FaqItemData {
  id: string
  question: string
  answer: ReactNode
}

const FAQ_ITEMS: FaqItemData[] = [
  {
    id: 'methodology',
    question: "Why don't you publish your verification methodology?",
    answer: (
      <>
        Two reasons. First, our verification methodology is patent-pending intellectual property — publishing the source mix would invite imitation and dilute the value of the score. Second, transparency about specific sources can be gamed by entities trying to manage their result. What we do tell you: the categories we verified, the confidence level on each, and the recency of the underlying signal. What we don&rsquo;t tell you: the full source list. The score is the deliverable, and we stand behind it.
      </>
    ),
  },
  {
    id: 'pro-vs-premium',
    question: "What's the difference between Pro and Premium — why the price gap?",
    answer: (
      <>
        Pro and Premium both give you unlimited fresh lookups. The difference is depth and stakes. Pro is calibrated for typical hiring decisions — picking a contractor, vetting a sub, checking a supplier you&rsquo;re about to issue a PO to. Premium adds enhanced verification depth and priority processing, designed for higher-stakes vendor due diligence: major contracts, ongoing relationships, or decisions where the cost of being wrong meaningfully exceeds the cost of the report. We don&rsquo;t break out exactly what makes &ldquo;enhanced&rdquo; deeper — same reason we don&rsquo;t publish methodology.
      </>
    ),
  },
  {
    id: 'credit-or-background',
    question: 'Is this a credit check or background check?',
    answer: (
      <>
        No. Trust reports cover registered business entities only — LLCs, corporations, partnerships, and trusts. We do not pull personal credit, criminal history, SSN, or any consumer report data. For FCRA-regulated background checks on individual workers, we route through a licensed partner. <a href="#pricing">Learn about FCRA limits →</a>
      </>
    ),
  },
  {
    id: 'individual-contractor',
    question: 'Can I run a check on an individual contractor (not an LLC)?',
    answer: (
      <>
        Sole proprietors operating under a personal name fall outside our entity-only boundary. For individual checks, we partner with a licensed FCRA provider — same workflow, separate consent flow required by law. Most established contractors operate under an LLC or corporation; if you&rsquo;re not sure, ask them for their business legal name.
      </>
    ),
  },
  {
    id: 'freshness',
    question: 'How fresh is the information?',
    answer: (
      <>
        Cached reports show the most recent successful verification — typically within the last 30 days. Pro and Premium subscribers run fresh on-demand verifications that complete in roughly 30 seconds. Each report shows recency at the category level so you can see exactly what was last refreshed.
      </>
    ),
  },
  {
    id: 'states',
    question: 'What states do you cover today?',
    answer: (
      <>
        Eight launch states: Colorado, Texas, Arizona, Nevada, Georgia, Florida, North Carolina, and Oregon. We&rsquo;re expanding state by state — if your state isn&rsquo;t covered yet, sign up free and you&rsquo;ll be notified when it launches.
      </>
    ),
  },
  {
    id: 'export',
    question: 'Can I export reports or share with a team?',
    answer: (
      <>
        Pro: PDF export, email delivery, and shareable read-only links per report. Premium: all of that plus a multi-user team workspace with shared report history and API access for integrating Groundcheck into your own tooling.
      </>
    ),
  },
  {
    id: 'searches',
    question: 'What happens to my searches?',
    answer: (
      <>
        Reports are stored in your account and on our audit ledger for 7 years — that retention is required for compliance and useful for you when a vendor relationship goes sideways and you need to prove what was known when. Searches are private to your account; we don&rsquo;t sell or share your search history.
      </>
    ),
  },
]

interface TrustPublicClientProps {
  isLoggedIn?: boolean
  role?: string | null
}

export function TrustPublicClient({ isLoggedIn = false, role = null }: TrustPublicClientProps = {}) {
  const router = useRouter()
  const [billingPeriod, setBillingPeriod] = useState<'monthly' | 'annual'>('monthly')
  const [openFaqId, setOpenFaqId] = useState<string | null>(FAQ_ITEMS[0].id)
  const [openAccordionId, setOpenAccordionId] = useState<string | null>(ACCORDION_ITEMS[0].id)
  const [gcCompany, setGcCompany] = useState('')
  const [gcState, setGcState] = useState('CO')
  const [gcCity, setGcCity] = useState('Denver')

  function onRunCheck() {
    telemetry.emit('groundcheck.search', { company: gcCompany, state: gcState, city: gcCity })
    router.push(SIGNUP_HREF)
  }

  function toggleFaq(id: string) {
    setOpenFaqId((cur) => (cur === id ? null : id))
  }
  function toggleAccordion(id: string) {
    setOpenAccordionId((cur) => (cur === id ? null : id))
  }

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: GC_PAGE_CSS }} />
      <div className="gc-page">
        {/* TOP NAV */}
        <header className="topnav">
          <div className="wrap">
            <Link href="/" className="brand">
              <span className="logo">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                  <path d="M3 8 L7 12 L13 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
              <span>
                <span className="name">Groundcheck</span>
                <span className="sub">by EarthMove</span>
              </span>
            </Link>
            <nav className="links">
              <a href="#pricing">Trust lookup</a>
              <a href="#how">How it works</a>
              <a href="#pricing">Pricing</a>
              <a href="#use">For Contractors</a>
              <a href="#use">For Homeowners</a>
            </nav>
            <div className="actions">
              <Link href="/login" className="signin gc-desktop-only">Sign in</Link>
              <Link href="/signup" className="signup gc-desktop-only">Sign up free</Link>
              <MobileNav isLoggedIn={isLoggedIn} role={role} />
            </div>
          </div>
        </header>

        {/* PRICING-AS-HERO */}
        <section className="pricing-band" id="pricing">
          <div className="wrap">
            <div className="head">
              <div className="left">
                <span className="label">Trust lookup · know before you sign</span>
                <h2>Three tiers. Pick what <em>matches your risk.</em></h2>
                <p>Homeowner doing a one-off renovation? Free is enough. Running a GC business with 20 active subs? You want Pro. Vetting six-figure vendor relationships? Premium pays for itself in a week.</p>
              </div>
              <div className="toggle-wrap">
                <div className="toggle" role="tablist" aria-label="Billing period">
                  <button
                    type="button"
                    role="tab"
                    aria-selected={billingPeriod === 'monthly'}
                    className={billingPeriod === 'monthly' ? 'active' : ''}
                    onClick={() => setBillingPeriod('monthly')}
                  >
                    Monthly
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={billingPeriod === 'annual'}
                    className={billingPeriod === 'annual' ? 'active' : ''}
                    onClick={() => setBillingPeriod('annual')}
                  >
                    Annual
                  </button>
                </div>
                <span className="save-pill">Save 20% annual</span>
              </div>
            </div>

            <div className="tiers">
              {/* FREE */}
              <article className="tier-card">
                <div>
                  <h3 className="tier-name">Free</h3>
                  <p className="tier-tagline">Just kicking the tires. One-off check before signing a contract.</p>
                </div>
                <div className="price-block">
                  <div className="price">
                    <span className="num">$0</span>
                    <span className="unit">forever</span>
                  </div>
                  <div className="billed">No credit card required</div>
                </div>
                <ul className="feats">
                  <li><TierCheck /><span>1 lookup per month</span></li>
                  <li><TierCheck /><span>View existing cached reports</span></li>
                  <li><TierCheck /><span>Standard verification depth</span></li>
                  <li><TierCheck /><span>Personal use, single device</span></li>
                </ul>
                <Link href="/signup" className="cta secondary">Sign up free</Link>
              </article>

              {/* PRO */}
              <article className="tier-card featured">
                <span className="badge">Most popular</span>
                <div>
                  <h3 className="tier-name">Pro</h3>
                  <p className="tier-tagline">Standard hiring decisions. Typical residential, sub vetting, supplier checks.</p>
                </div>
                <div className="price-block">
                  <div className="price">
                    <span className="num">{billingPeriod === 'monthly' ? '$49.99' : '$39.99'}</span>
                    <span className="unit">/ month</span>
                  </div>
                  <div className="billed">
                    {billingPeriod === 'monthly' ? (
                      <>Annual: <b>$39.99/mo</b> · billed $479.88/yr · save $120</>
                    ) : (
                      <>Billed $479.88 / year · <b>$120 saved</b></>
                    )}
                  </div>
                </div>
                <ul className="feats">
                  <li><TierCheck /><span><b>Unlimited fresh lookups</b> on demand</span></li>
                  <li><TierCheck /><span>Standard verification depth</span></li>
                  <li><TierCheck /><span>7-year searchable history</span></li>
                  <li><TierCheck /><span>PDF + email export · shareable links</span></li>
                  <li><TierCheck /><span>Email support</span></li>
                </ul>
                <Link href="/signup?plan=pro" className="cta primary" onClick={() => telemetry.emit('groundcheck.upgrade_clicked', { from: 'tier-card', target: 'pro' })}>Start Pro <span className="arrow">→</span></Link>
              </article>

              {/* PREMIUM */}
              <article className="tier-card">
                <div>
                  <h3 className="tier-name">Premium</h3>
                  <p className="tier-tagline">High-stakes decisions. Major contracts, ongoing vendor due diligence.</p>
                </div>
                <div className="price-block">
                  <div className="price">
                    <span className="num">{billingPeriod === 'monthly' ? '$100' : '$80'}</span>
                    <span className="unit">/ month</span>
                  </div>
                  <div className="billed">
                    {billingPeriod === 'monthly' ? (
                      <>Annual: <b>$80/mo</b> · billed $960/yr · save $240</>
                    ) : (
                      <>Billed $960 / year · <b>$240 saved</b></>
                    )}
                  </div>
                </div>
                <ul className="feats">
                  <li><TierCheck /><span>Everything in Pro</span></li>
                  <li><TierCheck /><span><b>Enhanced verification depth</b></span></li>
                  <li><TierCheck /><span>Priority report generation</span></li>
                  <li><TierCheck /><span>Multi-user team workspace</span></li>
                  <li><TierCheck /><span>API access for integrations</span></li>
                  <li><TierCheck /><span>Priority support · 24-hour response</span></li>
                </ul>
                <Link href="/signup?plan=premium" className="cta dark" onClick={() => telemetry.emit('groundcheck.upgrade_clicked', { from: 'tier-card', target: 'premium' })}>Start Premium <span className="arrow">→</span></Link>
              </article>

              {/* ENTERPRISE */}
              <article className="tier-card enterprise">
                <div>
                  <h3 className="tier-name">Enterprise</h3>
                  <p className="tier-tagline">High-volume operations. Owner-developers, platform partners.</p>
                </div>
                <div className="price-block">
                  <div className="price">
                    <span className="num">Talk to us</span>
                  </div>
                  <div className="billed" style={{ color: 'var(--ink-on-panel-2)' }}>Volume + integrations</div>
                </div>
                <ul className="feats">
                  <li><TierCheck /><span>Volume pricing</span></li>
                  <li><TierCheck /><span>SSO + custom integrations</span></li>
                  <li><TierCheck /><span>Dedicated success manager</span></li>
                  <li><TierCheck /><span>Service-level agreement</span></li>
                </ul>
                <a href="mailto:enterprise@earthmove.io" className="cta outline">Contact sales <span className="arrow">→</span></a>
              </article>
            </div>

            <p className="anchor">Compare to industry-standard contractor verification at $1,700–$5,000 per subscriber per year.</p>

            {/* Try it first — search */}
            <div className="try-it">
              <div className="try-it-head">
                <h3>Or try it <em>first.</em></h3>
                {/* TODO C-Trust-2: revert this copy to "Test it on any contractor right now — your first lookup is free, no signup required." once anonymous lookups are wired up. */}
                <span className="sub">Sign up free to run your first check.</span>
              </div>

              <div className="search slim">
                <div className="row1">
                  <span className="icon">
                    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                      <circle cx="9" cy="9" r="6" stroke="currentColor" strokeWidth="1.6" />
                      <path d="M14 14l4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                    </svg>
                  </span>
                  <input type="text" placeholder="Type a company name or LLC…" autoFocus value={gcCompany} onChange={(e) => setGcCompany(e.target.value)} />
                  <span className="caret" />
                </div>
                <div className="submit-row">
                  <div className="geo">
                    <label htmlFor="gc-state">State</label>
                    <select id="gc-state" value={gcState} onChange={(e) => setGcState(e.target.value)}>
                      <option>CO</option><option>TX</option><option>AZ</option><option>NV</option>
                      <option>GA</option><option>FL</option><option>NC</option><option>OR</option>
                    </select>
                    <label htmlFor="gc-city" style={{ marginLeft: '6px' }}>City</label>
                    <input id="gc-city" type="text" value={gcCity} onChange={(e) => setGcCity(e.target.value)} />
                  </div>
                  <div className="legal">
                    {/* TODO C-Trust-2: revert pill + copy to "Free trial · Your first lookup is on us · No signup required" once anonymous lookups are wired up. */}
                    <span className="free-pill">Free</span>
                    <span>Sign up free to run your first check</span>
                  </div>
                  <button className="btn btn-primary" type="button" onClick={onRunCheck}>
                    Run trust check <span className="arrow">→</span>
                  </button>
                </div>
              </div>

              <div className="reassure">
                <span className="item"><TierCheck />Independent verification</span>
                <span className="item"><TierCheck />~30 second results</span>
                <span className="item"><TierCheck />7-year audit retention</span>
                <span className="item"><TierCheck />Patent-pending methodology</span>
              </div>
            </div>
          </div>
        </section>

        {/* OPS BAND */}
        <section className="ops-band">
          <div className="wrap">
            <div className="ops">
              <div className="cell">
                <span className="l">Average lookup</span>
                <span className="v"><em>~30</em> sec</span>
                <span className="sub">Independent verification</span>
              </div>
              <div className="cell">
                <span className="l">Coverage</span>
                <span className="v"><em>8</em> launch states</span>
                <span className="sub">CO · TX · AZ · NV · GA · FL · NC · OR</span>
              </div>
              <div className="cell">
                <span className="l">This month</span>
                <span className="v">1,247 lookups</span>
                <span className="sub">Across homeowners and contractors</span>
              </div>
              <div className="cell">
                <span className="l">Audit retention</span>
                <span className="v">7-year trail</span>
                <span className="sub">Reports stored, shareable, exportable</span>
              </div>
            </div>
          </div>
        </section>

        {/* HOW IT WORKS */}
        <section className="how" id="how">
          <div className="wrap">
            <div className="head">
              <div>
                <span className="label">How it works</span>
                <h2>Three minutes to avoid <em>a six-figure mistake.</em></h2>
              </div>
            </div>
            <div className="steps">
              <article className="step">
                <span className="num">01</span>
                <span className="ico">
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                    <circle cx="9" cy="9" r="6" stroke="currentColor" strokeWidth="1.6" />
                    <path d="M14 14l4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                  </svg>
                </span>
                <h3>Search</h3>
                <p>Type any contractor, supplier, or business entity. Legal name, DBA, or LLC works. State + city help disambiguate.</p>
              </article>
              <article className="step">
                <span className="num">02</span>
                <span className="ico">
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                    <path d="M3 10 L8 15 L17 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
                <h3>Verify</h3>
                <p>Independent verification across multiple categories of trust signal. Score generated in under a minute.</p>
              </article>
              <article className="step">
                <span className="num">03</span>
                <span className="ico">
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                    <path d="M10 3 L17 7 L17 12 C17 15 14 17 10 18 C6 17 3 15 3 12 L3 7 Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
                  </svg>
                </span>
                <h3>Decide</h3>
                <p>Trust score 0-100, plain-language verdict, full breakdown by category. Cached and shareable for 7 years.</p>
              </article>
            </div>
          </div>
        </section>

        {/* PROGRESS BAND */}
        <section className="progress-band">
          <div className="wrap">
            <div className="left">
              <span className="label">In progress</span>
              <h2>What you see <em>while it runs.</em></h2>
              <p>Live progress as each verification step completes. Most reports finish in under 30 seconds. If we already have a recent report cached, it returns instantly.</p>
            </div>
            <div className="progress-card">
              <div className="target">
                <span>Verifying <b>Bemas Construction · Denver, CO</b></span>
                <span className="timer">22.4s</span>
              </div>
              <ul className="progress-list">
                {[
                  'Located subject',
                  'Confirmed identity',
                  'Validated operating fitness',
                  'Assessed risk posture',
                ].map((label) => (
                  <li key={label} className="pl-row">
                    <span className="dot">
                      <svg width="10" height="10" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                        <path d="M2 6 L5 9 L10 3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </span>
                    {label}
                  </li>
                ))}
                <li className="pl-row active">
                  <span className="dot">
                    <svg width="10" height="10" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                      <circle cx="6" cy="6" r="4" stroke="currentColor" strokeWidth="1.6" strokeDasharray="3 2" />
                    </svg>
                  </span>
                  Reviewing conflict record…
                </li>
                <li className="pl-row pending">
                  <span className="dot" />
                  Aggregate market reputation
                </li>
                <li className="pl-row pending">
                  <span className="dot" />
                  Compute trust score
                </li>
              </ul>
            </div>
          </div>
        </section>

        {/* RESULT — REPORT CARD */}
        <section className="result-band">
          <div className="wrap">
            <span className="preface">Sample report</span>
            <h2>What a finished trust check <em>looks like.</em></h2>
            <p className="preamble-lede">Score, verdict, breakdown by category, and accordion detail. Cached reports are free for signed-in users; fresh on-demand reports are Pro and Premium.</p>

            <div className="report">
              <div className="r-head">
                <div className="left">
                  <span className="stamp"><span className="live" />Verified · Apr 29, 2026 · 7:42 PM MT</span>
                  <h3>Bemas Construction</h3>
                  <div className="meta">
                    <span>Denver, CO</span>
                    <span className="sep">·</span>
                    <span>Registered entity</span>
                    <span className="sep">·</span>
                    <span>12-year operating history</span>
                  </div>
                  <p className="verdict">&ldquo;Solid track record. No flags raised across primary verification categories. One minor profile inconsistency worth a phone call.&rdquo;</p>
                </div>
                <div className="score-block">
                  <span className="score-num">87</span>
                  <div className="score-meta">
                    <span className="grade">A−</span>
                    <span className="timestamp">Cached · 4 days old</span>
                    <span className="cache"><a href="#pricing">Refresh on Pro →</a></span>
                  </div>
                </div>
              </div>

              {/* breakdown */}
              <div className="breakdown">
                <div className="heading">Score breakdown · 87 of 100</div>

                <BreakdownRow name="Identity & legitimacy" num="25" denom="25" pct="100%" tone="green" outcome="Confirmed legitimate operating entity · Long continuous history · Status current" />
                <BreakdownRow name="Operating fitness" num="22" denom="25" pct="88%" tone="green" outcome="Cleared on operational requirements for state of operation · No flagged issues" />
                <BreakdownRow name="Risk posture" num="13" denom="15" pct="87%" tone="green" outcome="Low-risk profile · No elevated risk indicators in recent activity" />
                <BreakdownRow name="Market reputation" num="12" denom="15" pct="80%" tone="green" outcome="Strong positive reputation across reviewed market signals" />
                <BreakdownRow name="Conflict record" num="9" denom="10" pct="90%" tone="green" outcome="Clean active record · One historical issue, resolved" />
                <BreakdownRow name="Profile coherence" num="6" denom="10" pct="60%" tone="amber" outcome="Minor profile inconsistency detected · Verify direct contact before signing" warn />
              </div>

              {/* accordion */}
              <div className="accordion">
                {ACCORDION_ITEMS.map((item) => (
                  <AccordionItem
                    key={item.id}
                    item={item}
                    isOpen={openAccordionId === item.id}
                    onToggle={() => toggleAccordion(item.id)}
                  />
                ))}
              </div>

              {/* paywall */}
              <div className="paywall">
                <div className="pw-text">
                  <h4>Want a fresh on-demand report?</h4>
                  <p>This report is from cache (last updated <b>4 days ago</b>). Pro members run unlimited fresh reports with the latest data — and Premium adds enhanced entity verification for higher-stakes contracts.</p>
                </div>
                <div className="pw-actions">
                  <a href="#pricing" className="btn btn-primary" onClick={() => telemetry.emit('groundcheck.upgrade_clicked', { from: 'paywall', target: 'pro' })}>Upgrade to Pro · $49.99/mo →</a>
                  <span className="pw-link"><a href="#pricing">See all plans →</a></span>
                </div>
              </div>

              <p className="disclaimer">
                <b>Public-record only.</b> Trust reports do not include personal credit, criminal history, SSN, or any consumer report data. For FCRA-regulated background checks on individuals, we offer integrated screening through a licensed partner. Deep verification is restricted to registered business entities (LLC, corp, partnership, trust); sole proprietors operating under a personal name fall outside that boundary.
              </p>
            </div>
          </div>
        </section>

        {/* USE CASES */}
        <section className="use" id="use">
          <div className="wrap">
            <div className="head">
              <span className="label">Built for two audiences</span>
              <h2>The people who pay <em>when contractors fail.</em></h2>
            </div>
            <div className="use-cards">
              <article className="use-card">
                <span className="ic">
                  <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden="true">
                    <path d="M3 11 L11 3 L19 11 L19 19 L13 19 L13 13 L9 13 L9 19 L3 19 Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
                  </svg>
                </span>
                <span className="audience">For homeowners</span>
                <h3>Before you sign <em>that contract.</em></h3>
                <p>Hiring a contractor for a renovation, addition, or new build is a five- to seven-figure decision. Run a check in 30 seconds and find out if they&rsquo;re operationally sound and risk-clean — before your deposit is gone.</p>
                <div className="stat">
                  A meaningful percentage of contractors fail at least one verification category. The first lookup is on us — find out before you sign.
                </div>
                <a href="#pricing" className="link">See sample report →</a>
              </article>

              <article className="use-card">
                <span className="ic">
                  <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden="true">
                    <path d="M3 18 L19 18 M5 18 L5 8 L9 8 L9 18 M13 18 L13 4 L17 4 L17 18" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
                <span className="audience">For general contractors</span>
                <h3>Before you issue <em>that PO.</em></h3>
                <p>Subs slip on operational standing. Suppliers run out of capacity mid-job. Vendor relationships go sideways. Run a check before each new vendor commitment, store the audit trail, and protect your project margins.</p>
                <div className="stat">
                  Used by GCs across <b>8 launch states</b> to vet <b>1,247 vendors</b> this month.
                </div>
                <a href="#pricing" className="link">See sample report →</a>
              </article>
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section className="faq">
          <div className="wrap">
            <div className="head">
              <span className="label">FAQ</span>
              <h2>Common questions, <em>direct answers.</em></h2>
            </div>
            <div className="faq-list">
              {FAQ_ITEMS.map((item) => (
                <FaqItem
                  key={item.id}
                  item={item}
                  isOpen={openFaqId === item.id}
                  onToggle={() => toggleFaq(item.id)}
                />
              ))}
            </div>
          </div>
        </section>

        {/* FOOTER */}
        <footer>
          <div className="wrap">
            <div className="left">© 2026 EarthMove · Groundcheck</div>
            <nav className="right">
              <Link href="/legal/refunds">Refunds</Link>
              <Link href="/terms">Terms</Link>
              <Link href="/privacy">Privacy</Link>
              <a href="mailto:support@earthmove.io">Contact</a>
            </nav>
          </div>
        </footer>
      </div>
    </>
  )
}

function BreakdownRow({
  name,
  num,
  denom,
  pct,
  tone,
  outcome,
  warn = false,
}: {
  name: string
  num: string
  denom: string
  pct: string
  tone: 'green' | 'amber' | 'red'
  outcome: string
  warn?: boolean
}) {
  return (
    <div className="bd-row">
      <span className="name">{name}</span>
      <span className="num">{num} <em>/ {denom}</em></span>
      <div className="bar-wrap">
        <div className="bar"><div className={`fill ${tone}`} style={{ width: pct }} /></div>
        <span className="outcome">{outcome}</span>
      </div>
      <span className={`check${warn ? ' warn' : ''}`}>
        {warn ? (
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
            <path d="M9 3 L9 11 M9 14 L9 14.5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
            <circle cx="9" cy="9" r="7" stroke="currentColor" strokeWidth="1.6" />
          </svg>
        ) : (
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
            <path d="M3 9 L7 13 L15 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </span>
    </div>
  )
}

function AccordionItem({
  item,
  isOpen,
  onToggle,
}: {
  item: AccordionItemData
  isOpen: boolean
  onToggle: () => void
}) {
  function onKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      onToggle()
    }
  }
  return (
    <div className={`acc-item${isOpen ? ' open' : ''}`}>
      <div
        className="acc-head"
        role="button"
        tabIndex={0}
        aria-expanded={isOpen}
        onClick={onToggle}
        onKeyDown={onKeyDown}
      >
        <div className="left">
          <span className="icon">
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
              {item.iconPath}
            </svg>
          </span>
          <div>
            <h4>{item.title}</h4>
            <span className="summary">{item.summary}</span>
          </div>
        </div>
        <span className="chev"><ChevronDown /></span>
      </div>
      {item.body && <div className="acc-body">{item.body}</div>}
    </div>
  )
}

function FaqItem({
  item,
  isOpen,
  onToggle,
}: {
  item: FaqItemData
  isOpen: boolean
  onToggle: () => void
}) {
  function onKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      onToggle()
    }
  }
  return (
    <div className={`faq-item${isOpen ? ' open' : ''}`}>
      <div
        className="q"
        role="button"
        tabIndex={0}
        aria-expanded={isOpen}
        onClick={onToggle}
        onKeyDown={onKeyDown}
      >
        {item.question}
        <span className="chev"><ChevronDown /></span>
      </div>
      <div className="a">{item.answer}</div>
    </div>
  )
}
