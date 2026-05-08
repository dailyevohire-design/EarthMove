/* eslint-disable jsx-a11y/alt-text -- @react-pdf/renderer Image is not a DOM <img>; no screen-reader surface in PDFs */

/**
 * Premium PDF report layout per Juan's redesign spec (2026-05-07).
 *
 * Page geometry: US Letter, 36pt margins.
 *
 * Above-fold:
 *   - Header band: Groundcheck wordmark left, report metadata right
 *   - Subject block: contractor name, location, generated-on
 *   - Two-column body, 60/40 split with a 16pt gutter:
 *       LEFT  — risk card: trust score, risk pill, summary
 *       RIGHT — business profile + 4 verification chips + QR card
 *
 * Below-fold (full width):
 *   - Red flags section
 *   - Positive indicators section
 *   - Sources searched (mono list)
 *
 * Footer: FCRA disclaimer + producer + date.
 *
 * Conditional verified stamp: top-right corner overlay when trust_score >= 80.
 * Free-tier reports (job_id null) skip the QR card and the chain-verify
 * footer detail per existing rule (PR #17).
 */

import type { ReactElement } from 'react'
import {
  Document,
  Page,
  View,
  Text,
  Image,
  StyleSheet,
} from '@react-pdf/renderer'
import { Colors, Type, Spacing, Radius, colorsForRiskLevel, type RiskLevel } from './tokens'
import type { Chip } from './chip-state'

export interface TrustPdfReportInput {
  contractor_name: string
  city: string | null
  state_code: string
  trust_score: number | null
  risk_level: RiskLevel
  summary: string | null
  red_flags: string[] | null
  positive_indicators: string[] | null
  data_sources_searched: string[] | null
  created_at: string
  /** Null for free-tier sync reports (skip QR + chain footer). */
  job_id: string | null
  /** Business profile detail. */
  biz_entity_type: string | null
  biz_formation_date: string | null
  lic_license_number: string | null
  biz_status?: string | null
  lic_status?: string | null
  osha_status?: string | null
  bbb_rating?: string | null
  /** D2: confirmation banner inputs. searched_as drives the click-through
   *  case (amber banner + name-discrepancy callout). raw_report.business
   *  carries the canonical entity payload (entity_id, principal_address,
   *  registered_agent, source_url) projected by buildEvidenceDerivedReport. */
  searched_as?: string | null
  raw_report?: Record<string, unknown> | null
}

export interface TrustPdfDocumentProps {
  report: TrustPdfReportInput
  chips: Chip[]
  /** PNG bytes — wordmark for header. */
  wordmarkPng: Buffer | string
  /** PNG bytes — verified stamp. Rendered iff trust_score >= 80. */
  stampPng: Buffer | string
  /** PNG bytes for QR (target = /trust/verify/{reportId}). Null for free tier. */
  qrPng: Buffer | null
  /** Evidence row count for chain-verify footer. Null for free tier. */
  evidenceCount: number | null
  /** Report id printed in header metadata + used for filename. */
  reportId: string
}

const styles = StyleSheet.create({
  page: {
    paddingTop: 0,
    paddingBottom: 0,
    paddingHorizontal: 0,
    backgroundColor: Colors.paper,
    fontFamily: Type.sans,
    fontSize: Type.body,
    color: Colors.ink,
  },
  // ---------- Header ----------
  headerBand: {
    height: Spacing.headerHeight,
    backgroundColor: Colors.cardMuted,
    borderBottom: `0.5pt solid ${Colors.hair}`,
    paddingHorizontal: Spacing.pageMargin,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  wordmark: {
    height: Spacing.wordmarkHeight,
    width: Spacing.wordmarkWidth,
    objectFit: 'contain',
  },
  headerMeta: {
    flexDirection: 'column',
    alignItems: 'flex-end',
  },
  headerMetaLabel: {
    fontSize: Type.micro,
    fontFamily: Type.mono,
    color: Colors.ink3,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  headerMetaValue: {
    fontSize: Type.small,
    fontFamily: Type.mono,
    color: Colors.ink2,
    marginTop: 2,
  },
  // ---------- Subject ----------
  subjectBlock: {
    paddingHorizontal: Spacing.pageMargin,
    paddingTop: Spacing.xl,
    paddingBottom: Spacing.lg,
  },
  subjectName: {
    fontFamily: Type.display,
    fontWeight: 600,
    fontSize: Type.hero,
    color: Colors.ink,
    letterSpacing: -0.5,
    lineHeight: 1.05,
  },
  subjectLoc: {
    marginTop: Spacing.sm,
    fontSize: Type.h3,
    color: Colors.ink3,
  },
  subjectDate: {
    marginTop: Spacing.xs,
    fontSize: Type.small,
    color: Colors.inkMuted,
    fontFamily: Type.mono,
  },
  // ---------- Entity confirmation banner (D2) ----------
  confirmBanner: {
    marginHorizontal: Spacing.pageMargin,
    marginBottom: Spacing.lg,
    padding: Spacing.md,
    border: `0.5pt solid ${Colors.hair}`,
    borderTopWidth: 3,
    borderRadius: Radius.md,
    backgroundColor: Colors.card,
  },
  confirmKicker: {
    fontFamily: Type.mono,
    fontSize: Type.micro,
    color: Colors.ink3,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: Spacing.sm,
  },
  confirmEntityRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: Spacing.sm,
    flexWrap: 'wrap',
  },
  confirmEntityName: {
    fontFamily: Type.display,
    fontWeight: 600,
    fontSize: Type.h3,
    color: Colors.ink,
  },
  confirmStatusPill: {
    fontFamily: Type.sans,
    fontSize: Type.micro,
    fontWeight: 700,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: Radius.pill,
  },
  confirmDetails: {
    marginTop: Spacing.xs,
    fontFamily: Type.sans,
    fontSize: Type.small,
    color: Colors.ink2,
  },
  confirmDiscrepancy: {
    marginTop: Spacing.sm,
    padding: Spacing.sm,
    border: '0.5pt solid #F0B848',
    backgroundColor: '#FEF8E7',
    borderRadius: Radius.sm,
    fontFamily: Type.sans,
    fontSize: Type.micro,
    color: '#7A4F00',
  },
  confirmSource: {
    marginTop: Spacing.sm,
    paddingTop: Spacing.xs,
    borderTop: `0.5pt solid ${Colors.cardMuted}`,
    fontFamily: Type.mono,
    fontSize: Type.micro,
    color: Colors.ink3,
  },
  // ---------- Two-col body ----------
  body: {
    paddingHorizontal: Spacing.pageMargin,
    flexDirection: 'row',
    gap: Spacing.twoColGutter,
  },
  leftCol: {
    width: Spacing.twoColLeftWidth,
  },
  rightCol: {
    width: Spacing.twoColRightWidth,
    gap: Spacing.cardGap,
  },
  // ---------- Cards ----------
  card: {
    backgroundColor: Colors.card,
    border: `0.5pt solid ${Colors.hair}`,
    borderRadius: Radius.lg,
    padding: Spacing.cardPad,
  },
  cardKicker: {
    fontFamily: Type.mono,
    fontSize: Type.micro,
    color: Colors.ink3,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    marginBottom: Spacing.sm,
  },
  // ---------- Risk card ----------
  riskCard: {
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    border: `0.5pt solid ${Colors.hair}`,
    flexDirection: 'column',
    gap: Spacing.md,
  },
  riskTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.lg,
  },
  riskScore: {
    fontFamily: Type.display,
    fontWeight: 600,
    fontSize: Type.scoreNumber,
    color: Colors.ink,
    letterSpacing: -1.5,
    lineHeight: 1,
  },
  riskScoreSlash: {
    fontFamily: Type.display,
    fontWeight: 500,
    fontSize: Type.h2,
    color: Colors.inkMuted,
    marginLeft: 2,
  },
  riskMeta: {
    flexDirection: 'column',
    flex: 1,
  },
  riskKicker: {
    fontFamily: Type.mono,
    fontSize: Type.micro,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: Colors.ink3,
  },
  riskPill: {
    marginTop: Spacing.xs,
    alignSelf: 'flex-start',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: Radius.pill,
    fontSize: Type.micro,
    fontFamily: Type.sans,
    fontWeight: 700,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  riskSummary: {
    fontSize: Type.body,
    color: Colors.ink2,
    lineHeight: 1.5,
  },
  // ---------- Profile ----------
  profileRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 5,
    borderBottom: `0.5pt solid ${Colors.cardMuted}`,
  },
  profileRowLast: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 5,
  },
  profileKey: {
    fontSize: Type.micro,
    color: Colors.ink3,
    fontFamily: Type.sans,
    fontWeight: 500,
  },
  profileVal: {
    fontSize: Type.small,
    color: Colors.ink,
    fontFamily: Type.sans,
    fontWeight: 500,
    maxWidth: 140,
    textAlign: 'right',
  },
  // ---------- Chips ----------
  chipsCol: {
    flexDirection: 'column',
    gap: 6,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: Radius.md,
    border: `0.5pt solid ${Colors.hair}`,
  },
  chipLeft: {
    flexDirection: 'column',
  },
  chipLabel: {
    fontFamily: Type.mono,
    fontSize: Type.micro,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    fontWeight: 500,
  },
  chipDetail: {
    fontFamily: Type.sans,
    fontSize: Type.small,
    fontWeight: 500,
    marginTop: 1,
  },
  chipState: {
    fontFamily: Type.mono,
    fontSize: Type.micro,
    fontWeight: 500,
    letterSpacing: 1.2,
  },
  // ---------- QR card ----------
  qrCard: {
    backgroundColor: Colors.card,
    border: `0.5pt solid ${Colors.hair}`,
    borderRadius: Radius.lg,
    padding: Spacing.cardPad,
    alignItems: 'center',
  },
  qrImage: {
    width: Spacing.qrSize,
    height: Spacing.qrSize,
  },
  qrLabel: {
    fontFamily: Type.sans,
    fontSize: Type.micro,
    fontWeight: 600,
    color: Colors.ink,
    marginTop: Spacing.sm,
    textAlign: 'center',
  },
  qrSubLabel: {
    fontFamily: Type.mono,
    fontSize: Type.micro,
    color: Colors.ink3,
    marginTop: 2,
    textAlign: 'center',
    letterSpacing: 0.6,
  },
  // ---------- Free-tier note ----------
  freeNote: {
    backgroundColor: Colors.cardMuted,
    borderRadius: Radius.md,
    border: `0.5pt dashed ${Colors.hair}`,
    padding: Spacing.md,
    alignItems: 'center',
  },
  freeNoteText: {
    fontFamily: Type.sans,
    fontSize: Type.small,
    color: Colors.ink3,
    textAlign: 'center',
    lineHeight: 1.4,
  },
  // ---------- Detail sections ----------
  belowFold: {
    paddingHorizontal: Spacing.pageMargin,
    paddingTop: Spacing.xl,
    flexDirection: 'column',
    gap: Spacing.lg,
  },
  detailHeading: {
    fontFamily: Type.display,
    fontWeight: 600,
    fontSize: Type.h2,
    color: Colors.ink,
    letterSpacing: -0.2,
    marginBottom: Spacing.sm,
  },
  detailItem: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 4,
  },
  detailBullet: {
    fontFamily: Type.sans,
    fontSize: Type.body,
    fontWeight: 600,
    width: 8,
  },
  detailText: {
    fontFamily: Type.sans,
    fontSize: Type.body,
    flex: 1,
    lineHeight: 1.45,
  },
  detailEmpty: {
    fontFamily: Type.sans,
    fontSize: Type.small,
    color: Colors.inkMuted,
  },
  sourceList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  sourceTag: {
    fontFamily: Type.mono,
    fontSize: Type.micro,
    color: Colors.ink2,
    backgroundColor: Colors.cardMuted,
    border: `0.5pt solid ${Colors.hair}`,
    borderRadius: Radius.sm,
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
  // ---------- Footer ----------
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: Spacing.pageMargin,
    paddingVertical: Spacing.lg,
    borderTop: `0.5pt solid ${Colors.hair}`,
    backgroundColor: Colors.cardMuted,
  },
  disclaimer: {
    fontFamily: Type.sans,
    fontSize: Type.micro,
    color: Colors.ink3,
    lineHeight: 1.5,
    marginBottom: Spacing.sm,
  },
  footerMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    fontFamily: Type.mono,
    fontSize: Type.micro,
    color: Colors.inkMuted,
  },
  // ---------- Stamp ----------
  stamp: {
    position: 'absolute',
    top: Spacing.headerHeight + Spacing.stampMargin,
    right: Spacing.stampMargin,
    width: Spacing.stampSize,
    height: Spacing.stampSize,
    objectFit: 'contain',
  },
})

const FCRA_DISCLAIMER =
  'This report compiles publicly available business records and is not a consumer report under the Fair Credit Reporting Act, 15 U.S.C. § 1681 et seq. ' +
  'Findings are point-in-time observations sourced from cited public records and should be independently verified. ' +
  'Subjects may dispute the reflection of any cited record by contacting Earth Pro Connect LLC.'

// ----------------------------------------------------------------------------

export function TrustPdfDocument(props: TrustPdfDocumentProps) {
  const { report, chips, wordmarkPng, stampPng, qrPng, evidenceCount, reportId } = props
  const showStamp = (report.trust_score ?? 0) >= 80
  const riskColors = colorsForRiskLevel(report.risk_level)
  const reportDate = new Date(report.created_at).toISOString().slice(0, 10)
  const locLine = [report.city, report.state_code].filter(Boolean).join(', ')

  return (
    <Document
      title={`Groundcheck Report — ${report.contractor_name}`}
      author="Groundcheck (Earth Pro Connect LLC)"
      producer="Groundcheck"
      creator="earthmove.io/trust"
      subject="Public-records contractor verification"
    >
      <Page size="LETTER" style={styles.page}>
        {/* HEADER BAND */}
        <View style={styles.headerBand}>
          <Image src={wordmarkPng} style={styles.wordmark} />
          <View style={styles.headerMeta}>
            <Text style={styles.headerMetaLabel}>Report</Text>
            <Text style={styles.headerMetaValue}>{shortReportId(reportId)}</Text>
          </View>
        </View>

        {/* CONDITIONAL STAMP — only when trust_score >= 80 */}
        {showStamp && <Image src={stampPng} style={styles.stamp} />}

        {/* SUBJECT */}
        <View style={styles.subjectBlock}>
          <Text style={styles.subjectName}>{report.contractor_name}</Text>
          {locLine.length > 0 && <Text style={styles.subjectLoc}>{locLine}</Text>}
          <Text style={styles.subjectDate}>Generated {reportDate}</Text>
        </View>

        {/* ENTITY CONFIRMATION BANNER (D2) — print analog of the dashboard's
            EntityConfirmationBanner. Only renders when raw_report.business
            is present (i.e. status not entity_not_found / entity_disambiguation_required). */}
        {renderConfirmationBanner(report)}

        {/* TWO-COL BODY */}
        <View style={styles.body}>
          {/* LEFT — Risk card (60%) */}
          <View style={styles.leftCol}>
            <View style={[styles.riskCard, { backgroundColor: riskColors.fill }]}>
              <View style={styles.riskTopRow}>
                <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
                  <Text style={[styles.riskScore, { color: riskColors.text }]}>
                    {report.trust_score != null ? String(report.trust_score) : '—'}
                  </Text>
                  <Text style={styles.riskScoreSlash}>/100</Text>
                </View>
                <View style={styles.riskMeta}>
                  <Text style={styles.riskKicker}>Trust score</Text>
                  <Text
                    style={[
                      styles.riskPill,
                      { backgroundColor: riskColors.text, color: '#FFFFFF' },
                    ]}
                  >
                    {report.risk_level ?? 'UNKNOWN'} risk
                  </Text>
                </View>
              </View>
              <Text style={styles.riskSummary}>
                {report.summary ?? 'No summary available for this report.'}
              </Text>
            </View>
          </View>

          {/* RIGHT — Business profile + chips + QR (40%) */}
          <View style={styles.rightCol}>
            <View style={styles.card}>
              <Text style={styles.cardKicker}>Business profile</Text>
              <ProfileRow k="Entity" v={report.biz_entity_type ?? '—'} />
              <ProfileRow k="Formed" v={report.biz_formation_date ?? '—'} />
              <ProfileRow k="License #" v={report.lic_license_number ?? '—'} last />
            </View>

            <View style={styles.card}>
              <Text style={styles.cardKicker}>Verification</Text>
              <View style={styles.chipsCol}>
                {chips.map((chip) => (
                  <ChipRow key={chip.label} chip={chip} />
                ))}
              </View>
            </View>

            {qrPng && evidenceCount != null ? (
              <View style={styles.qrCard}>
                <Image src={qrPng} style={styles.qrImage} />
                <Text style={styles.qrLabel}>Scan to verify</Text>
                <Text style={styles.qrSubLabel}>{evidenceCount} evidence rows</Text>
              </View>
            ) : (
              <View style={styles.freeNote}>
                <Text style={styles.freeNoteText}>
                  Free-tier report{'\n'}Chain verification available on paid plans
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* BELOW-FOLD DETAIL SECTIONS */}
        <View style={styles.belowFold}>
          <DetailSection
            heading="Risk signals"
            items={report.red_flags ?? []}
            empty="No risk signals identified."
            tint={Colors.redFlagText}
          />
          <DetailSection
            heading="Positive indicators"
            items={report.positive_indicators ?? []}
            empty="No positive indicators noted."
            tint={Colors.positiveText}
          />
          <SourcesSection items={report.data_sources_searched ?? []} />
        </View>

        {/* FOOTER */}
        <View style={styles.footer}>
          <Text style={styles.disclaimer}>{FCRA_DISCLAIMER}</Text>
          <View style={styles.footerMeta}>
            <Text>Earth Pro Connect LLC · earthmove.io/trust</Text>
            <Text>{reportDate}</Text>
          </View>
        </View>
      </Page>
    </Document>
  )
}

// ---------- Sub-components ----------

function ProfileRow({ k, v, last }: { k: string; v: string; last?: boolean }) {
  return (
    <View style={last ? styles.profileRowLast : styles.profileRow}>
      <Text style={styles.profileKey}>{k}</Text>
      <Text style={styles.profileVal}>{v}</Text>
    </View>
  )
}

function ChipRow({ chip }: { chip: Chip }) {
  const palette = chipPalette(chip.state)
  return (
    <View
      style={[
        styles.chip,
        { backgroundColor: palette.bg, borderColor: palette.border },
      ]}
    >
      <View style={styles.chipLeft}>
        <Text style={[styles.chipLabel, { color: palette.text }]}>{chip.label}</Text>
        {chip.detail && (
          <Text style={[styles.chipDetail, { color: palette.text }]}>{chip.detail}</Text>
        )}
      </View>
      <Text style={[styles.chipState, { color: palette.text }]}>{chip.state}</Text>
    </View>
  )
}

function chipPalette(state: Chip['state']): { bg: string; text: string; border: string } {
  switch (state) {
    case 'VERIFIED':
      return { bg: Colors.chipVerifiedBg, text: Colors.chipVerifiedText, border: Colors.chipVerifiedBorder }
    case 'FLAGGED':
      return { bg: Colors.chipFlaggedBg, text: Colors.chipFlaggedText, border: Colors.chipFlaggedBorder }
    case 'UNVERIFIED':
      return { bg: Colors.chipUnverifiedBg, text: Colors.chipUnverifiedText, border: Colors.chipUnverifiedBorder }
    case 'MISSING':
    default:
      return { bg: Colors.chipMissingBg, text: Colors.chipMissingText, border: Colors.chipMissingBorder }
  }
}

function DetailSection({
  heading,
  items,
  empty,
  tint,
}: {
  heading: string
  items: string[]
  empty: string
  tint: string
}) {
  return (
    <View>
      <Text style={styles.detailHeading}>{heading}</Text>
      {items.length === 0 ? (
        <Text style={styles.detailEmpty}>{empty}</Text>
      ) : (
        items.map((item, i) => (
          <View key={i} style={styles.detailItem}>
            <Text style={[styles.detailBullet, { color: tint }]}>·</Text>
            <Text style={styles.detailText}>{item}</Text>
          </View>
        ))
      )}
    </View>
  )
}

function SourcesSection({ items }: { items: string[] }) {
  if (items.length === 0) return null
  return (
    <View>
      <Text style={styles.detailHeading}>Sources searched</Text>
      <View style={styles.sourceList}>
        {items.map((s, i) => (
          <Text key={i} style={styles.sourceTag}>{s}</Text>
        ))}
      </View>
    </View>
  )
}

function shortReportId(id: string): string {
  // First 8 chars + ellipsis. UUIDs are unwieldy in print.
  return id.length > 8 ? `${id.slice(0, 8)}…` : id
}

// D2: PDF analog of the dashboard's EntityConfirmationBanner. Returns null
// for entity_not_found / entity_disambiguation_required states (PDF for those
// states is a separate concern — TODO: a dedicated "no exact match" PDF).
// For exact-match + click-through cases, renders a compact bordered block
// with the canonical entity, status pill, source attribution.
function renderConfirmationBanner(report: TrustPdfReportInput): ReactElement | null {
  const raw = report.raw_report ?? null
  const business = (raw && (raw as { business?: Record<string, unknown> }).business) ?? null
  if (!business || typeof business !== 'object') return null

  const str = (k: string): string | null => {
    const v = (business as Record<string, unknown>)[k]
    return typeof v === 'string' && v.length > 0 ? v : null
  }
  const entityName = str('entity_name') ?? report.contractor_name
  const entityType = str('entity_type') ?? report.biz_entity_type
  const formationDate = str('formation_date') ?? report.biz_formation_date
  const status = str('status') ?? report.biz_status
  const principalAddress = str('principal_address')
  const registeredAgent = str('registered_agent')
  const entityId = str('entity_id')
  const sourceUrl = str('source_url')
  const jurisdiction = str('jurisdiction')

  const searched = report.searched_as ?? null
  const isClickThrough = !!searched && searched.trim().length > 0
    && searched.trim().toLowerCase() !== (report.contractor_name ?? '').trim().toLowerCase()
  const accentColor = isClickThrough ? '#F0B848' : '#10B981'
  const kicker = isClickThrough
    ? `Searched as "${searched}" — confirmed entity:`
    : 'Report matched to:'

  const statusColors = pdfStatusPillColors(status ?? null)
  const sourceLabel =
    jurisdiction === 'CO' ? 'Colorado Secretary of State' :
    jurisdiction === 'TX' ? 'Texas Comptroller of Public Accounts' :
    'state business registry'

  return (
    <View style={[styles.confirmBanner, { borderTopColor: accentColor }]}>
      <Text style={styles.confirmKicker}>{kicker}</Text>
      <View style={styles.confirmEntityRow}>
        <Text style={styles.confirmEntityName}>{entityName}</Text>
        {status && (
          <Text style={[styles.confirmStatusPill, { backgroundColor: statusColors.bg, color: statusColors.text }]}>
            {status}
          </Text>
        )}
      </View>
      <View style={styles.confirmDetails}>
        {entityType && <Text>{entityType}{formationDate ? ` · Formed ${formationDate}` : ''}</Text>}
        {principalAddress && <Text>{principalAddress}</Text>}
        {registeredAgent && <Text>Registered agent: {registeredAgent}</Text>}
        {entityId && <Text>Entity ID: {entityId}</Text>}
      </View>
      {isClickThrough && (
        <Text style={styles.confirmDiscrepancy}>
          Name discrepancy is itself a fraud indicator. Confirm directly with the contractor that this is their registered legal entity.
        </Text>
      )}
      <Text style={styles.confirmSource}>
        Source: {sourceLabel}
        {sourceUrl ? `  ·  ${sourceUrl}` : ''}
      </Text>
    </View>
  )
}

function pdfStatusPillColors(status: string | null): { bg: string; text: string } {
  const s = (status ?? '').trim().toLowerCase()
  if (s === 'good standing' || s === 'active' || s === 'a') return { bg: '#D1FAE5', text: '#047857' }
  if (s === 'delinquent' || s === 'inactive' || s === 'noncompliant') return { bg: '#FEF3C7', text: '#92400E' }
  if (
    s === 'voluntarily dissolved' || s === 'dissolved' || s === 'forfeited' ||
    s === 'cancelled' || s === 'canceled' || s === 'withdrawn' || s === 'merged' || s === 'converted'
  ) return { bg: '#FEE2E2', text: '#991B1B' }
  return { bg: '#F5F5F4', text: '#57534E' }
}
