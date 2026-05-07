/**
 * PDF design tokens — centralized so the document JSX never hardcodes hex,
 * pixel sizes, or font names. Aligned to the EarthMove `.gc-page` brand
 * system used on /trust and the marketing surface, with PDF-specific
 * derivations (chip backgrounds, risk-band tints) added below.
 *
 * Source of truth for hex values: marketing.css `:root` brand tokens at
 * src/app/marketing.css (--em-paper, --em-evergreen, --em-emerald-soft,
 * --em-safety, etc.). Do not redeclare here — when the brand evolves the
 * canonical source updates and PDFs follow at next regen.
 */

export const Colors = {
  // Surfaces
  paper: '#F1ECE2',
  paper2: '#E9E3D5',
  card: '#FFFFFF',
  cardMuted: '#F6F2E8',

  // Brand panel + accents
  evergreen: '#14322A',
  evergreen2: '#0F2920',
  emerald: '#2DB37A',
  emeraldSoft: '#1F8A5C',
  emeraldPale: '#E6F1E9',
  safety: '#E5701B',
  safetyPress: '#C95F12',

  // Risk-band fills (drives risk card backplate + score ring)
  riskLowFill: '#E6F1E9',
  riskLowText: '#0F5A3D',
  riskMediumFill: '#EEEAE0',
  riskMediumText: '#44403c',
  riskHighFill: '#FBE9E2',
  riskHighText: '#9E3617',
  riskCriticalFill: '#F4D5CB',
  riskCriticalText: '#7A2410',

  // Type ramp
  ink: '#15201B',
  ink2: '#2A332E',
  ink3: '#5C645F',
  inkMuted: '#8E8E89',

  // Hairlines
  hair: '#D8D2C4',
  hairStrong: '#C8C0AC',

  // Verification chip palette — four states per spec
  chipVerifiedBg: '#E6F1E9',
  chipVerifiedText: '#0F5A3D',
  chipVerifiedBorder: '#9BC9AE',
  chipMissingBg: '#F0EBE0',
  chipMissingText: '#5C645F',
  chipMissingBorder: '#D8D2C4',
  chipFlaggedBg: '#FBE9E2',
  chipFlaggedText: '#9E3617',
  chipFlaggedBorder: '#E5A98F',
  chipUnverifiedBg: '#EEEAE0',
  chipUnverifiedText: '#8E8E89',
  chipUnverifiedBorder: '#D8D2C4',

  // Dispatched-content tints for full-width detail sections
  redFlagFill: '#FBE9E2',
  redFlagText: '#9E3617',
  positiveFill: '#E6F1E9',
  positiveText: '#0F5A3D',
} as const

export const Type = {
  display: 'Fraunces',
  sans: 'Inter',
  mono: 'JetBrainsMono',

  // Sizes (pt — pdf-lib + react-pdf both use pt as default unit)
  hero: 32,
  h1: 20,
  h2: 14,
  h3: 11,
  body: 10,
  small: 9,
  micro: 8,
  scoreNumber: 56,
} as const

export const Spacing = {
  // Page geometry — US Letter 612 x 792 pt
  pageWidth: 612,
  pageHeight: 792,
  pageMargin: 36,

  // Header band
  headerHeight: 64,
  wordmarkHeight: 28,
  wordmarkWidth: 168,

  // Two-column body — 60/40 split with a 16pt gutter
  // contentWidth = 612 - 2*36 = 540
  // gutter = 16 → leftCol = 314, rightCol = 210
  twoColLeftWidth: 314,
  twoColGutter: 16,
  twoColRightWidth: 210,

  // Inner padding inside cards
  cardPad: 14,
  cardGap: 12,

  // Scale steps (use these everywhere, never raw numbers)
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 28,

  // Risk score ring
  scoreRingDiameter: 96,
  scoreRingStroke: 6,

  // QR card
  qrSize: 130,

  // Verified stamp (top-right corner, when score >= 80)
  stampSize: 120,
  stampMargin: 24,
} as const

export const Radius = {
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
  pill: 999,
} as const

export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' | 'AMBIGUOUS' | null

export function colorsForRiskLevel(level: RiskLevel) {
  switch (level) {
    case 'LOW':
      return { fill: Colors.riskLowFill, text: Colors.riskLowText }
    case 'HIGH':
      return { fill: Colors.riskHighFill, text: Colors.riskHighText }
    case 'CRITICAL':
      return { fill: Colors.riskCriticalFill, text: Colors.riskCriticalText }
    case 'MEDIUM':
    case 'AMBIGUOUS':
    case null:
    default:
      return { fill: Colors.riskMediumFill, text: Colors.riskMediumText }
  }
}
