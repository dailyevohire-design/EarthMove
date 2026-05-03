/**
 * Plain-text + HTML alert templates. Kept inline — no external template
 * engine. Each template is a thin formatter that takes a known-shape
 * payload and returns subject + bodies.
 *
 * Templates intentionally minimal; copywriting passes can refine post-
 * launch without touching the dispatch pipeline.
 */

export interface FindingTypeAlertPayload {
  contractor_id: string;
  contractor_name?: string | null;
  finding_type: string;
  finding_summary: string;
  source_key: string;
  trust_report_url?: string;
  evidence_id: string;
}

export interface ScoreDropAlertPayload {
  contractor_id: string;
  contractor_name?: string | null;
  prior_score: number;
  current_score: number;
  delta: number;
  trust_report_url?: string;
}

export interface RenderedAlert {
  subject: string;
  text: string;
  html: string;
}

const FINDING_TYPE_HUMAN: Record<string, string> = {
  license_revoked:               'License revoked',
  license_suspended:             'License suspended',
  license_disciplinary_action:   'Disciplinary action recorded',
  license_revoked_but_operating: 'Revoked-but-operating signal',
  civil_judgment_against:        'Civil judgment filed against the contractor',
  osha_willful_citation:         'OSHA willful citation',
  osha_repeat_citation:          'OSHA repeat citation',
  osha_fatality_finding:         'OSHA fatality finding',
  sanction_hit:                  'Federal sanction hit',
  phoenix_signal:                'Phoenix-pattern signal',
};

export function renderFindingTypeAlert(p: FindingTypeAlertPayload): RenderedAlert {
  const headline = FINDING_TYPE_HUMAN[p.finding_type] ?? p.finding_type;
  const name = p.contractor_name ?? 'a contractor on your watchlist';
  const subject = `Groundcheck alert: ${headline} — ${name}`;
  const url = p.trust_report_url ?? '';
  const text = [
    `New evidence on a contractor you're watching:`,
    ``,
    `${name}`,
    `${headline}: ${p.finding_summary}`,
    `Source: ${p.source_key}`,
    ``,
    url ? `Full report: ${url}` : '',
    `Evidence id: ${p.evidence_id}`,
  ].filter(Boolean).join('\n');
  const html =
    `<p>New evidence on a contractor you're watching:</p>` +
    `<p><strong>${escapeHtml(name)}</strong></p>` +
    `<p><strong>${escapeHtml(headline)}:</strong> ${escapeHtml(p.finding_summary)}<br/>` +
    `Source: <code>${escapeHtml(p.source_key)}</code></p>` +
    (url ? `<p><a href="${escapeHtml(url)}">Full report</a></p>` : '') +
    `<p style="font-size:11px;color:#666">Evidence id: ${escapeHtml(p.evidence_id)}</p>`;
  return { subject, text, html };
}

export function renderScoreDropAlert(p: ScoreDropAlertPayload): RenderedAlert {
  const name = p.contractor_name ?? 'a contractor on your watchlist';
  const subject = `Groundcheck alert: trust score dropped ${p.delta} — ${name}`;
  const url = p.trust_report_url ?? '';
  const text = [
    `Trust score change on a contractor you're watching:`,
    ``,
    `${name}`,
    `Score: ${p.prior_score} → ${p.current_score} (${p.delta >= 0 ? '+' : ''}${p.delta})`,
    ``,
    url ? `Full report: ${url}` : '',
  ].filter(Boolean).join('\n');
  const html =
    `<p>Trust score change on a contractor you're watching:</p>` +
    `<p><strong>${escapeHtml(name)}</strong></p>` +
    `<p>Score: <strong>${p.prior_score}</strong> → <strong>${p.current_score}</strong> ` +
    `(<span style="color:${p.delta < 0 ? '#b00' : '#080'}">${p.delta >= 0 ? '+' : ''}${p.delta}</span>)</p>` +
    (url ? `<p><a href="${escapeHtml(url)}">Full report</a></p>` : '');
  return { subject, text, html };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
