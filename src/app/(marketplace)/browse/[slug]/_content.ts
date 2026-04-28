export type IconName =
  | 'driveway' | 'equipment' | 'subbase'
  | 'drainage' | 'concrete' | 'landscape'
  | 'paver' | 'pipe' | 'lawn'
  | 'garden' | 'grading' | 'slope'
  | 'channel' | 'shoreline' | 'fill'
  | 'topdress' | 'mulch' | 'compost'

export type CategorySlug =
  | 'base' | 'gravel' | 'sand' | 'fill'
  | 'aggregate' | 'rock' | 'decorative'
  | 'organic' | 'recycled' | 'specialty'

export interface UseCase {
  iconName: IconName
  title: string
  body: string
}

export interface FAQ {
  question: string
  answer: string
}

export interface CategoryContent {
  useCases: UseCase[]
  faqs: FAQ[]
}

export interface TimelineStep {
  step: number
  title: string
  body: string
}

const CONTENT: Record<CategorySlug, CategoryContent> = {
  base: {
    useCases: [
      {
        iconName: 'driveway',
        title: 'Driveway base',
        body: 'Compacted 4–6" beneath asphalt or concrete, base gives the load-bearing layer that keeps a driveway from cracking under vehicle weight.',
      },
      {
        iconName: 'equipment',
        title: 'Equipment laydown',
        body: 'A 6"+ pad of compacted base under a skid-steer, mini-ex, or material stockpile prevents rutting and turns mud-season job sites into firm ground.',
      },
      {
        iconName: 'subbase',
        title: 'Sub-base under concrete',
        body: 'Spec-grade base passes compaction tests and gives concrete pours a uniform load-spreading layer — fewer slab cracks, longer service life.',
      },
    ],
    faqs: [
      {
        question: 'How thick should the base layer be?',
        answer: '4 inches for residential driveways. 6+ inches for heavy equipment pads, commercial parking, and anything that\'ll see truck traffic. Compacted, not loose-laid — count on losing about 20% of your loose depth to compaction.',
      },
      {
        question: 'Can I use this under pavers?',
        answer: 'Yes, but most paver applications use a 1" screening layer of concrete sand on top of the base for the final setting bed. Base gives the load-bearing layer; sand gives the level-and-set surface.',
      },
      {
        question: 'How do I know if I need crushed limestone vs recycled?',
        answer: 'Crushed limestone is the spec default for engineered work. Recycled base is spec-equivalent for residential driveways and most non-structural pads, at lower cost. Check your engineer\'s spec sheet first.',
      },
      {
        question: 'Will it pass a 95% Proctor compaction test?',
        answer: 'Yes — when laid in 4–6" lifts, watered to optimum moisture, and rolled with a vibratory drum compactor. Run two passes per lift; if your gauge reads under 92%, it\'s usually a moisture issue.',
      },
      {
        question: 'How long after delivery can I drive on it?',
        answer: 'Light vehicles immediately if compacted. Heavy trucks — wait until you\'ve finished compaction and the surface is uniform. Loose base moves under heavy load.',
      },
      {
        question: 'What if I order too much?',
        answer: 'Card is pre-authorized at order weight, charged at delivered weight. If we tonnage-out short, you only pay for what shows on the scale ticket. Excess on-site is yours to use or stockpile.',
      },
    ],
  },

  gravel: {
    useCases: [
      {
        iconName: 'drainage',
        title: 'Drainage layer',
        body: 'Around foundation walls, in french drains, beneath patio pavers — gravel lets water move freely while the bedding stays in place. The standard for any wet-zone substrate.',
      },
      {
        iconName: 'concrete',
        title: 'Concrete mix',
        body: 'Coarse aggregate spec for ready-mix and on-site concrete blends. Washed clean of fines means no dust to weaken the cement bond.',
      },
      {
        iconName: 'landscape',
        title: 'Decorative landscaping',
        body: 'Clean, uniform stone for path borders, dry creek beds, and ground cover around plantings. Looks engineered without looking industrial.',
      },
    ],
    faqs: [
      {
        question: 'How much #57 do I need for a french drain?',
        answer: 'Typical residential french drain: 12" wide × 18" deep, wrapped in fabric, with 4" of #57 below the perforated pipe and 4" above. Plug your trench dimensions into the calculator and round up 10% for settlement.',
      },
      {
        question: 'Why is it called #57?',
        answer: 'It\'s a gradation number from the AASHTO standard for coarse aggregate. #57 is the gradation for stones that pass a 1" sieve and are retained on a No. 4 sieve — a uniform 3/4"–1" range, with no fines.',
      },
      {
        question: 'Can I use #57 as a driveway base?',
        answer: 'Not by itself. #57 doesn\'t compact — the stones are uniform and round-ish, so they roll under load. Use a graded base like Crusher Run or Flex Base for compaction, then top-dress with #57 if you want a clean drainage layer.',
      },
      {
        question: 'What\'s the difference between #57 and #67?',
        answer: '#67 is slightly smaller (3/4" max vs. 1" max) and is more common in concrete mix specs. #57 is the more common landscaping and drainage size. Both are washed coarse aggregate; for most homeowner work the difference is invisible.',
      },
      {
        question: 'Will it hold up in heavy rain?',
        answer: 'Yes — that\'s what gravel is for. Open-graded gravel lets water through to the substrate below. Make sure the substrate itself drains; otherwise the gravel just buffers the puddle.',
      },
      {
        question: 'How is it priced?',
        answer: 'By the ton, delivered. Density is roughly 1.4 t/yd³, so a yard weighs about 2,800 lb. Use the calculator above to convert volume to tons before ordering.',
      },
    ],
  },

  sand: {
    useCases: [
      {
        iconName: 'concrete',
        title: 'Concrete & mortar',
        body: 'Washed sharp sand is the fine aggregate spec for ready-mix concrete, mortar, and stucco. The angular grain binds tight when mixed with cement.',
      },
      {
        iconName: 'paver',
        title: 'Paver bedding',
        body: '1" leveling layer beneath flagstone, pavers, or brick. The screed-and-set surface that holds every flat hardscape true to grade.',
      },
      {
        iconName: 'pipe',
        title: 'Pipe bedding',
        body: 'Loose, uniform sand around utility pipe runs prevents point loads on the pipe wall. Spec-required for water, sewer, and conduit installations.',
      },
    ],
    faqs: [
      {
        question: 'Concrete sand vs mason sand — what\'s the difference?',
        answer: 'Concrete sand is coarse and angular; mason sand is fine and washed. Concrete sand goes in slabs, footings, and bedding. Mason sand goes in mortar mixes and brick joints. They\'re not interchangeable.',
      },
      {
        question: 'Can I use this for a sandbox?',
        answer: 'No — concrete sand is too coarse and may have sharp grains. Use a play sand product, which is washed to a finer grade and screened for safety.',
      },
      {
        question: 'How much sand for a paver bedding layer?',
        answer: '1" leveling layer beneath pavers. Calculate area × 1/12 ft × 1.3 t/yd³ ÷ 27 to get tons. Plug your area into the calculator above.',
      },
      {
        question: 'Is this good for pipe bedding?',
        answer: 'Yes — concrete sand meets most municipal pipe-bedding specs (typically 4"-6" beneath water, sewer, or conduit pipe). Confirm with your local code; some jurisdictions require ASTM C-33 specifically.',
      },
      {
        question: 'Can I mix this with cement myself?',
        answer: 'Yes. Concrete sand is the fine-aggregate spec for ready-mix concrete and mortar. For DIY mixing: 1 part cement, 2 parts sand, 3 parts gravel by volume, with water as needed.',
      },
      {
        question: 'How wet will it arrive?',
        answer: 'Sand is sold by weight, so moisture is part of the load. Expect 4–8% moisture content from the yard. Cover the pile if you\'re storing it for more than a few days; rain adds weight without adding usable material.',
      },
    ],
  },

  fill: {
    useCases: [
      {
        iconName: 'grading',
        title: 'Site grading',
        body: 'Bulk material to bring a site up to design grade before final base goes down. Compacts in lifts; screened versions are clean enough to live close to plantings.',
      },
      {
        iconName: 'fill',
        title: 'Foundation backfill',
        body: 'Behind retaining walls and around foundations after waterproofing. Use clean fill — never fill with embedded debris next to a structural element.',
      },
      {
        iconName: 'lawn',
        title: 'Lawn establishment',
        body: 'Screened topsoil is the finish layer for new lawns and garden beds. Even tilth, no rocks, ready for seed or sod.',
      },
    ],
    faqs: [
      {
        question: 'What\'s the difference between fill dirt and topsoil?',
        answer: 'Fill dirt is bulk material used to bring a site up to grade — typically subsoil with no organic content. Topsoil is the surface layer with organic matter, used for lawns and beds. Fill compacts; topsoil doesn\'t.',
      },
      {
        question: 'Can I plant grass directly in screened topsoil?',
        answer: 'Yes. Screened topsoil is the finish layer for new lawns. Spread 4–6 inches, rake smooth, seed or sod, then water. No need for additional amendment unless your soil test calls for it.',
      },
      {
        question: 'How much settlement should I expect?',
        answer: 'Fill dirt compacts about 10–15% on its own over 6–12 months. If you\'re filling for a hardscape, mechanical compaction in 6" lifts is required — call your engineer for spec.',
      },
      {
        question: 'What\'s in the fill — any debris?',
        answer: 'Our standard fill is screened to remove rocks larger than 3" and any vegetable matter. If you need cleaner fill (e.g., behind a foundation), order screened topsoil instead. We don\'t sell unscreened debris-fill on this platform.',
      },
      {
        question: 'Can I fill near plantings or trees?',
        answer: 'Don\'t pile fill against tree trunks — it suffocates the root crown. Stay 2 feet back from any tree you want to keep. For new plantings, screened topsoil or a topsoil/compost blend is the right choice, not bulk fill.',
      },
      {
        question: 'How much per yard?',
        answer: 'Pricing varies by source and screening level. Use the calculator above to convert your project volume from cubic yards to tons, then check the price-per-unit on this page for your delivered quote.',
      },
    ],
  },

  aggregate: {
    useCases: [
      {
        iconName: 'drainage',
        title: 'Drainage stone',
        body: 'Open-graded aggregate around perimeter drains, leach fields, and behind retaining walls. Voids let water flow; size keeps the matrix from collapsing.',
      },
      {
        iconName: 'fill',
        title: 'Structural fill',
        body: 'Compacted aggregate where a load-bearing fill is spec\'d. Crushed aggregates lock together better than rounded river rock.',
      },
      {
        iconName: 'concrete',
        title: 'Concrete coarse spec',
        body: 'Aggregate sized to a specific gradation for batch-plant concrete. Confirm spec with your engineer or supplier before ordering.',
      },
    ],
    faqs: [
      {
        question: 'What does "aggregate" mean exactly?',
        answer: 'Construction aggregate is the umbrella term for crushed stone, gravel, and sand used in concrete, asphalt, and base layers. Each spec calls out the gradation it needs.',
      },
      {
        question: 'How is aggregate sized?',
        answer: 'By the AASHTO and ASTM gradation systems — #57, #67, #8, etc. Each number references the sieve range the stones pass through. Smaller numbers are larger stones.',
      },
      {
        question: 'Can I substitute one aggregate for another?',
        answer: 'Sometimes. If your spec calls for a specific gradation, sub only with engineer approval. For non-structural drainage and decorative use, similar-sized stones are usually interchangeable.',
      },
      {
        question: 'Is washed aggregate worth the upgrade?',
        answer: 'For concrete and visible decorative work, yes — washed aggregate has no fines that weaken cement bond or muddy up after rain. For buried drainage, unwashed is fine.',
      },
      {
        question: 'How much aggregate per cubic yard?',
        answer: 'Density varies by stone type — 1.3 to 1.5 tons per cubic yard for most crushed aggregates. Use the calculator above with the density on this page.',
      },
      {
        question: 'What\'s the lead time?',
        answer: 'Most aggregates ship same-day or next-day from yards we have a contract with. Specialty gradations may take 2-3 days. We\'ll confirm at order time.',
      },
    ],
  },

  rock: {
    useCases: [
      {
        iconName: 'slope',
        title: 'Slope protection',
        body: 'Heavy stone armoring on embankments, channel banks, and shorelines. Stops erosion where soil alone won\'t hold.',
      },
      {
        iconName: 'channel',
        title: 'Drainage channel lining',
        body: 'Rock-lined swales handle storm flow without scouring. Engineer-spec\'d D50 size for your design discharge.',
      },
      {
        iconName: 'shoreline',
        title: 'Decorative boulders',
        body: 'Statement stone for landscape design — entryways, water features, and grade transitions. Pricing is per ton; placement is per stone.',
      },
    ],
    faqs: [
      {
        question: 'What does D50 mean?',
        answer: 'D50 is the median stone diameter in a rip-rap gradation — half the stones are larger, half are smaller. Engineers spec D50 based on water velocity and slope. Don\'t substitute without approval.',
      },
      {
        question: 'How is rip-rap delivered?',
        answer: 'By the ton in a tri-axle dump truck or by the boulder for larger stones. We can spec the truck type at order; placement is on you (or your excavator operator) since rip-rap is dropped, not poured.',
      },
      {
        question: 'Do I need filter fabric under it?',
        answer: 'For most engineered applications, yes — non-woven geotextile prevents soil from migrating up through the rock matrix. Decorative-only installations sometimes skip it; check your spec.',
      },
      {
        question: 'Can I get smaller decorative rock?',
        answer: 'We have rip-rap by the gradation (typically 6"-24") and decorative stone in smaller sizes. Tell us the application and we\'ll route you to the right SKU.',
      },
      {
        question: 'What\'s the minimum order?',
        answer: 'Varies by yard. Most rip-rap orders are 10+ tons due to truck economics. Smaller decorative orders may have higher per-ton pricing.',
      },
      {
        question: 'How thick should the rip-rap layer be?',
        answer: 'Typically 1.5× the D50 for most slope and channel applications. Engineer\'s design controls; this is a starting point.',
      },
    ],
  },

  decorative: {
    useCases: [
      {
        iconName: 'landscape',
        title: 'Path borders',
        body: 'Clean, sized stone for walkway edges and bed borders. Reads designed without looking like a parking lot.',
      },
      {
        iconName: 'drainage',
        title: 'Dry creek beds',
        body: 'Variegated stone arranged to mimic a natural drainage. Functions for storm flow; reads as garden art.',
      },
      {
        iconName: 'mulch',
        title: 'Ground cover',
        body: 'Mulch alternative around plantings and beneath low-traffic pathways. No annual replacement, no fade.',
      },
    ],
    faqs: [
      {
        question: 'How much decorative stone per square foot?',
        answer: 'For 2" depth (typical), about 1 cubic foot per 6 sq ft of coverage. Use the calculator above with depth=2" and your area dimensions.',
      },
      {
        question: 'Will it stain or wash away?',
        answer: 'Stone doesn\'t stain. It can shift in heavy storm flow if your slope is steep — use larger sizes (1.5"+) or edge restraints in those areas.',
      },
      {
        question: 'Can I lay landscape fabric under it?',
        answer: 'Yes, and most installations do. Non-woven landscape fabric prevents weed growth and keeps stone from working into the soil. Slit the fabric only where you\'re planting.',
      },
      {
        question: 'What sizes look most natural?',
        answer: 'Mixed sizes within a range — like 1"-3" or 3"-6" — read more natural than uniform sizes. For formal applications, uniform sizing reads more designed.',
      },
      {
        question: 'How does it handle foot traffic?',
        answer: 'Pea gravel and small decorative stone work fine for foot traffic. Larger rounded stones can be uncomfortable; angular stones less so. Test with a sample if it\'s a primary walking surface.',
      },
      {
        question: 'Is it hard to remove later?',
        answer: 'Yes — stone doesn\'t decompose. Plan placements carefully; hauling decorative stone out of a mature landscape is its own demolition project.',
      },
    ],
  },

  organic: {
    useCases: [
      {
        iconName: 'garden',
        title: 'Garden soil',
        body: 'Blended organic substrate for raised beds, planters, and food gardens. Tilth and nutrient profile suited to vegetables and ornamentals.',
      },
      {
        iconName: 'topdress',
        title: 'Top-dressing',
        body: 'Thin layer over existing lawn or beds to refresh organic content. Apply 1/4–1/2" annually for ongoing improvement.',
      },
      {
        iconName: 'compost',
        title: 'Soil amendment',
        body: 'Compost-based blend for tilling into existing native soil. Improves drainage in clay, retention in sand.',
      },
    ],
    faqs: [
      {
        question: 'Is this OMRI certified?',
        answer: 'Some of our organic blends are OMRI listed; some aren\'t. If certification matters for your project, tell us at order time and we\'ll confirm before dispatch.',
      },
      {
        question: 'Can I plant in it directly?',
        answer: 'For raised beds and containers — yes, with our garden soil blend. For in-ground beds, mix 50/50 with your native soil so plants don\'t struggle when roots reach the boundary.',
      },
      {
        question: 'What\'s in the blend?',
        answer: 'Varies by product — typically a base of screened topsoil with composted organic matter, sometimes amended with sand or mineral content for drainage. Specifics on the product page or by request.',
      },
      {
        question: 'How much do I need for a raised bed?',
        answer: 'Bed length × width × depth in feet, divided by 27, equals cubic yards. A 4\'×8\' bed at 12" depth needs about 1.2 cubic yards.',
      },
      {
        question: 'Will it have weed seeds?',
        answer: 'Composted organics are heated above weed-seed viability temperature (>140°F), so quality blends are essentially weed-free. Cheaper bulk topsoil may not be — ask before ordering.',
      },
      {
        question: 'How long does it stay "fresh"?',
        answer: 'Organic content breaks down over time — annual top-dressing keeps soil productive. A new bed should be amended every 2-3 years for continued performance.',
      },
    ],
  },

  recycled: {
    useCases: [
      {
        iconName: 'driveway',
        title: 'Driveway base',
        body: 'Crushed recycled concrete or asphalt as a load-bearing layer. Spec-equivalent to virgin base at 30–40% lower cost.',
      },
      {
        iconName: 'fill',
        title: 'Site fill',
        body: 'Bulk recycled fill for non-structural grade-up. Same density as virgin material; check specs for any restrictions.',
      },
      {
        iconName: 'drainage',
        title: 'Drainage backfill',
        body: 'Crushed recycled aggregate behind walls and beneath slabs. Same drainage characteristics as virgin stone.',
      },
    ],
    faqs: [
      {
        question: 'Is recycled base really as good as virgin limestone?',
        answer: 'For most residential and light-commercial applications, yes — same compaction performance, same load-bearing characteristics. Engineered specs may require virgin material; check first.',
      },
      {
        question: 'Where does the recycled material come from?',
        answer: 'Demolition projects — broken concrete, asphalt millings, brick. We work with yards that crush, screen, and grade the material to base spec.',
      },
      {
        question: 'Are there pieces of rebar or trash in it?',
        answer: 'Properly processed recycled base is screened to remove metal and oversize debris. Quality varies by yard — we only contract with operations that screen consistently.',
      },
      {
        question: 'Can I use this near plantings?',
        answer: 'Yes for fill applications, but recycled material may have higher pH than virgin (concrete is alkaline). For acid-loving plants, use virgin fill instead.',
      },
      {
        question: 'Will it dust?',
        answer: 'Crushed recycled material has fines, same as virgin crushed stone. Compacted and watered, it doesn\'t dust. Loose-laid in dry weather, expect some dust until it\'s compacted.',
      },
      {
        question: 'How does pricing compare?',
        answer: 'Recycled base typically runs 30-40% lower than virgin per ton, delivered. The savings are real and the spec is equivalent for most applications.',
      },
    ],
  },

  specialty: {
    useCases: [
      {
        iconName: 'subbase',
        title: 'Specialty applications',
        body: 'This material has region- or project-specific uses. Contact us with your spec sheet for delivery and price confirmation.',
      },
      {
        iconName: 'equipment',
        title: 'Custom orders',
        body: 'Specialty materials may have minimum-order quantities or lead times that differ from our stock catalog. Quote-based ordering.',
      },
      {
        iconName: 'subbase',
        title: 'Engineer-spec materials',
        body: 'If your project spec calls out a material by gradation, certification, or source, we\'ll source it specifically for your job.',
      },
    ],
    faqs: [
      {
        question: 'How is specialty material priced?',
        answer: 'Quote-based. Contact us with your spec sheet, quantity, and drop ZIP. We\'ll come back with a delivered price within 24 hours, often same-day.',
      },
      {
        question: 'What\'s the lead time?',
        answer: 'Varies — same-day for materials we keep in regular rotation, 2-5 business days for harder-to-source specialty materials, longer for certified or imported product.',
      },
      {
        question: 'Do you handle out-of-state sourcing?',
        answer: 'Yes for materials we can\'t get from a local yard. Freight is added to the delivered price; we\'ll line-item it in the quote.',
      },
      {
        question: 'Can I get a sample first?',
        answer: 'Often yes — small samples can be picked up at the source yard or shipped depending on the material. Tell us what you need to evaluate.',
      },
      {
        question: 'Is there a minimum order?',
        answer: 'Varies by material and source. Most specialty materials have a tonnage minimum due to truck economics. We\'ll confirm at quote time.',
      },
      {
        question: 'Can I get certifications and test results?',
        answer: 'If the source yard provides them, yes. Tell us what certs you need (e.g., TxDOT, AASHTO, ASTM) and we\'ll confirm before dispatch.',
      },
    ],
  },
}

export function getCategoryContent(slug: string | null | undefined): CategoryContent {
  if (slug && slug in CONTENT) return CONTENT[slug as CategorySlug]
  return CONTENT.specialty
}

export function getTimelineSteps(state: 'A' | 'B', supplierName: string | null): TimelineStep[] {
  const supplier = supplierName ?? 'Your supplier'
  if (state === 'B') {
    return [
      { step: 1, title: 'Order locks',  body: 'Card pre-auth held when supply opens up — no charge until a yard confirms.' },
      { step: 2, title: 'Loaded',       body: 'A contracted yard loads the truck and weighs out at their scale.' },
      { step: 3, title: 'Arrived',      body: 'Driver arrives at your drop ZIP within the requested window.' },
      { step: 4, title: 'Dropped & ticketed', body: 'Material drops on grade. Final charge runs against the scale ticket weight.' },
    ]
  }
  return [
    { step: 1, title: 'Order locks',  body: `${supplier} confirms ticket and assigns the next available truck.` },
    { step: 2, title: 'Loaded',       body: 'Truck loads at the yard scale — your tonnage is the ticket weight.' },
    { step: 3, title: 'Arrived',      body: 'Driver arrives at your drop ZIP within the requested window.' },
    { step: 4, title: 'Dropped & ticketed', body: 'Material drops on grade. Card is finalized against the scale ticket.' },
  ]
}
