/**
 * Hero images for /learn articles.
 *
 * Articles aren't migrated to a DB-backed image system (catalog photos are —
 * see material_images + material_catalog.image_url). Keeping a slug→URL map
 * here is fine until articles get a DB-backed gallery of their own.
 */

export const ARTICLE_IMAGES: Record<string, string> = {
  // ── V2 canonical slugs (current as of 2026-04 redesign) ──
  'driveway-gravel-complete-guide-2026': 'https://images.unsplash.com/photo-1699796553666-171dea76625b?w=1200&q=80',
  'best-materials-french-drains': 'https://images.unsplash.com/photo-1760774713181-7e74c20e6d75?w=1200&q=80',
  'aggregate-grades-explained-57-67-flex-base': 'https://images.unsplash.com/photo-1698220726355-62f370544733?w=1200&q=80',
  'cubic-yards-calculator': 'https://images.unsplash.com/photo-1699796553666-171dea76625b?w=1200&q=80',
  'three-thousand-dollar-mistake': 'https://images.unsplash.com/photo-1699032582554-7c1e6cfce1d1?w=1200&q=80',

  // ─── V2 article cover images (round 1, May 14 2026) ──────────────────────
  // 19 entries wiring previously-unmapped slugs to Supabase material-images
  // bucket. 5 gaps flagged inline — replace when better photos exist.
  // See followup #54.

  // DIY
  'raising-low-spots-fill-dirt-howto': 'https://gaawvpzzmotimblyesfp.supabase.co/storage/v1/object/public/material-images/filldirt.jpg',
  'decomposed-granite-patios-walkways': 'https://gaawvpzzmotimblyesfp.supabase.co/storage/v1/object/public/material-images/Decomposed-Granite-square-b2fb2288366387dde0d5e1429e0ffe50-.jpg',
  'pea-gravel-landscaping-sizing-depth-edging': 'https://gaawvpzzmotimblyesfp.supabase.co/storage/v1/object/public/material-images/pea%20gravel%20co.jpg',
  'river-rock-vs-crushed-stone-drainage': 'https://gaawvpzzmotimblyesfp.supabase.co/storage/v1/object/public/material-images/crushed%20rock%20bull%20rock%20co.jpg',
  // resolved duplicate (was filldirt.png — collided with raising-low-spots).
  // Brannan Select Fill stays in the soil-prep family without repeating the fill-dirt photo.
  'topsoil-new-lawns-depth-amendments': 'https://gaawvpzzmotimblyesfp.supabase.co/storage/v1/object/public/material-images/Select-Fill-1-square-11d63ea9f6e2b2e94b8fd726959f2989-.jpg',
  'gravel-shed-playset-bases': 'https://gaawvpzzmotimblyesfp.supabase.co/storage/v1/object/public/material-images/Colorado%2057%20stone.jpg',
  'riprap-erosion-control-residential': 'https://gaawvpzzmotimblyesfp.supabase.co/storage/v1/object/public/material-images/9-Inch-L-Rip-Rap-Pit-R-1.jpg',
  'mulch-alternatives-gravel-stone-dg': 'https://gaawvpzzmotimblyesfp.supabase.co/storage/v1/object/public/material-images/crusher%20fines%20co.jpg',

  // Contractor
  'road-base-specs-tx-co-dot': 'https://gaawvpzzmotimblyesfp.supabase.co/storage/v1/object/public/material-images/basecoursee.jpg',
  'recycled-concrete-aggregate-inspector-approval': 'https://gaawvpzzmotimblyesfp.supabase.co/storage/v1/object/public/material-images/recycled%20concrete%20co.jpg',
  // gap: aggregate stand-in; a real compaction/Proctor process shot would be ideal
  'compaction-standards-proctor-density': 'https://gaawvpzzmotimblyesfp.supabase.co/storage/v1/object/public/material-images/crusher-fines-pitR-min.jpg',
  'subgrade-prep-parking-lots': 'https://gaawvpzzmotimblyesfp.supabase.co/storage/v1/object/public/material-images/class6-abc-pitR-min.jpg',
  'drainage-stone-retention-ponds': 'https://gaawvpzzmotimblyesfp.supabase.co/storage/v1/object/public/material-images/56-67-crushed-riprap-pit25-min.jpg',
  'riprap-classes-d50-fdot-txdot': 'https://gaawvpzzmotimblyesfp.supabase.co/storage/v1/object/public/material-images/12-Inch-M-Rip-Rap-Pit-R-1.jpg',
  'concrete-sand-vs-mason-sand': 'https://gaawvpzzmotimblyesfp.supabase.co/storage/v1/object/public/material-images/concrete%20sand%20co.jpg',
  'trench-backfill-pipe-bedding-final-cover': 'https://gaawvpzzmotimblyesfp.supabase.co/storage/v1/object/public/material-images/bedding%20sand.jpg',
  // resolved duplicate (was class6-abc — collided with subgrade-prep). Structural-fill
  // photo is light-colored and avoids the gray-aggregate repetition. Still a proxy
  // until a real FL lime-rock/shell-rock photo arrives.
  'lime-rock-shell-rock-florida-spec': 'https://gaawvpzzmotimblyesfp.supabase.co/storage/v1/object/public/material-images/structural%20fill%20co.jpg',

  // Calculators
  // resolved duplicate (was Colorado 57 stone — collided with gravel-shed). Brannan
  // 3/8 minus concrete is a mid-grade aggregate that fits the tonnage-calculator
  // theme without repeating the 57 stone photo. Real calculator graphic still ideal.
  'tonnage-estimator-by-density': 'https://gaawvpzzmotimblyesfp.supabase.co/storage/v1/object/public/material-images/38-Minus-Concrete-square-c62a7dd10823b22ea64d0d6d3037d78e-.jpg',
  // gap: same
  'driveway-gravel-cost-estimator': 'https://gaawvpzzmotimblyesfp.supabase.co/storage/v1/object/public/material-images/Pea-Gravel-square-2823924938d635fbd7f920a874dabd7a-.jpg',

  // ── Legacy slugs (kept for SEO continuity) ──
  'driveway-gravel-guide': 'https://images.unsplash.com/photo-1699796553666-171dea76625b?w=1200&q=80',
  'fill-dirt-vs-topsoil': 'https://images.unsplash.com/photo-1726413280663-1b048191e88e?w=1200&q=80',
  'french-drain-materials': 'https://images.unsplash.com/photo-1760774713181-7e74c20e6d75?w=1200&q=80',
  'how-much-gravel-do-i-need': 'https://images.unsplash.com/photo-1698220726355-62f370544733?w=1200&q=80',
  'gravel-calculator': 'https://images.unsplash.com/photo-1699796553666-171dea76625b?w=1200&q=80',
  'material-grades-explained': 'https://images.unsplash.com/photo-1698220726355-62f370544733?w=1200&q=80',
  'ordering-wrong-material': 'https://images.unsplash.com/photo-1699032582554-7c1e6cfce1d1?w=1200&q=80',
}

export function getArticleImage(slug: string): string {
  return ARTICLE_IMAGES[slug] || ARTICLE_IMAGES['fill-dirt-vs-topsoil']
}
