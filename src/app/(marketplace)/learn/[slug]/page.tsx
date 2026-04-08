import { notFound } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { QuantityCalculator } from '@/components/marketplace/quantity-calculator'
import { getArticleImage } from '@/lib/material-images'
import { ArrowRight, CheckCircle2, AlertTriangle, BookOpen, Clock, ChevronRight } from 'lucide-react'
import { articleSchema, breadcrumbSchema } from '@/lib/structured-data'

interface Props { params: Promise<{ slug: string }> }

/* ──────────────────────────────────────────────────────────────────────────────
   ARTICLE CONTENT FUNCTIONS
   ────────────────────────────────────────────────────────────────────────────── */

function DrivewayGravelGuide() {
  return (
    <>
      <p className="text-gray-600 leading-relaxed mb-4">
        Your driveway is the first thing visitors see when they pull up to your home, and it takes a beating from
        weather, vehicles, and foot traffic every single day. Choosing the right gravel or aggregate material for
        your driveway is one of the most important decisions you will make as a homeowner — get it right, and
        you will have a surface that lasts 15 to 20 years with minimal maintenance. Get it wrong, and you could
        be looking at ruts, mud, washouts, and thousands of dollars in re-work within a couple of seasons.
      </p>
      <p className="text-gray-600 leading-relaxed mb-4">
        This guide covers everything: the five best driveway materials ranked by performance, climate-specific
        recommendations for different regions, a step-by-step installation process, cost breakdowns, and the
        most common mistakes homeowners make. Whether you are building a new driveway from scratch or
        resurfacing an existing one, this is the only resource you need.
      </p>

      <h2 className="text-2xl font-extrabold text-gray-900 mt-10 mb-4">The 5 Best Driveway Gravel Materials, Ranked</h2>

      <h3 className="text-xl font-bold text-gray-900 mt-8 mb-3">1. Crushed Limestone (#57 Stone)</h3>
      <p className="text-gray-600 leading-relaxed mb-4">
        Crushed limestone is the gold standard for residential driveways across most of the United States. The
        angular edges of each stone lock together under weight, creating a stable, well-draining surface that
        resists shifting and rutting. #57 stone — which measures roughly 3/4 inch to 1 inch — is the most popular
        grade for driveway top layers.
      </p>
      <ul className="space-y-2 mb-6">
        <li className="flex items-start gap-2 text-gray-600"><CheckCircle2 size={16} className="text-emerald-500 mt-1 flex-shrink-0" /><span>Excellent compaction and stability — angular edges interlock under traffic</span></li>
        <li className="flex items-start gap-2 text-gray-600"><CheckCircle2 size={16} className="text-emerald-500 mt-1 flex-shrink-0" /><span>Superior drainage prevents pooling and washout</span></li>
        <li className="flex items-start gap-2 text-gray-600"><CheckCircle2 size={16} className="text-emerald-500 mt-1 flex-shrink-0" /><span>Widely available and competitively priced ($18–$30 per ton)</span></li>
        <li className="flex items-start gap-2 text-gray-600"><AlertTriangle size={16} className="text-amber-500 mt-1 flex-shrink-0" /><span>Can be dusty in dry climates without a fine binder layer</span></li>
        <li className="flex items-start gap-2 text-gray-600"><AlertTriangle size={16} className="text-amber-500 mt-1 flex-shrink-0" /><span>Light color shows stains from oil or tire marks</span></li>
      </ul>

      <h3 className="text-xl font-bold text-gray-900 mt-8 mb-3">2. Flex Base (Grade 1)</h3>
      <p className="text-gray-600 leading-relaxed mb-4">
        Flex base is a blended aggregate of crushed stone, fines, and binding material that compacts into a
        near-solid surface. It is the same material used for road sub-bases by TxDOT and other state departments
        of transportation. For driveways that see heavy truck traffic or need to support equipment, flex base is
        the most durable option available.
      </p>
      <ul className="space-y-2 mb-6">
        <li className="flex items-start gap-2 text-gray-600"><CheckCircle2 size={16} className="text-emerald-500 mt-1 flex-shrink-0" /><span>Compacts to a near-solid surface that resists heavy loads</span></li>
        <li className="flex items-start gap-2 text-gray-600"><CheckCircle2 size={16} className="text-emerald-500 mt-1 flex-shrink-0" /><span>Self-binding — does not require additional stabilizers</span></li>
        <li className="flex items-start gap-2 text-gray-600"><AlertTriangle size={16} className="text-amber-500 mt-1 flex-shrink-0" /><span>Can become slippery when wet if over-compacted</span></li>
        <li className="flex items-start gap-2 text-gray-600"><AlertTriangle size={16} className="text-amber-500 mt-1 flex-shrink-0" /><span>Requires proper grading for drainage — water does not pass through easily</span></li>
      </ul>

      <h3 className="text-xl font-bold text-gray-900 mt-8 mb-3">3. Pea Gravel</h3>
      <p className="text-gray-600 leading-relaxed mb-4">
        Pea gravel is the most aesthetically pleasing driveway material, with its smooth, rounded stones available
        in warm earth tones. It works beautifully for cottage-style homes and low-traffic driveways. However, it
        does shift underfoot and under tires, so it needs containment edging and periodic raking.
      </p>
      <ul className="space-y-2 mb-6">
        <li className="flex items-start gap-2 text-gray-600"><CheckCircle2 size={16} className="text-emerald-500 mt-1 flex-shrink-0" /><span>Beautiful natural appearance with warm colors</span></li>
        <li className="flex items-start gap-2 text-gray-600"><CheckCircle2 size={16} className="text-emerald-500 mt-1 flex-shrink-0" /><span>Excellent drainage — water flows right through</span></li>
        <li className="flex items-start gap-2 text-gray-600"><AlertTriangle size={16} className="text-amber-500 mt-1 flex-shrink-0" /><span>Shifts and spreads — requires edging and periodic maintenance</span></li>
        <li className="flex items-start gap-2 text-gray-600"><AlertTriangle size={16} className="text-amber-500 mt-1 flex-shrink-0" /><span>Not suitable for steep grades or heavy vehicle traffic</span></li>
      </ul>

      <h3 className="text-xl font-bold text-gray-900 mt-8 mb-3">4. Crushed Concrete (Recycled)</h3>
      <p className="text-gray-600 leading-relaxed mb-4">
        Crushed concrete is the budget-friendly workhorse of driveway materials. Made from recycled concrete
        demolition, it compacts similarly to crushed limestone and is often 30 to 50 percent cheaper. It is an
        excellent choice for long rural driveways where you need to cover a large area without breaking the bank.
      </p>
      <ul className="space-y-2 mb-6">
        <li className="flex items-start gap-2 text-gray-600"><CheckCircle2 size={16} className="text-emerald-500 mt-1 flex-shrink-0" /><span>Most affordable option — often $12–$20 per ton</span></li>
        <li className="flex items-start gap-2 text-gray-600"><CheckCircle2 size={16} className="text-emerald-500 mt-1 flex-shrink-0" /><span>Environmentally friendly — keeps material out of landfills</span></li>
        <li className="flex items-start gap-2 text-gray-600"><AlertTriangle size={16} className="text-amber-500 mt-1 flex-shrink-0" /><span>Can contain rebar fragments if not properly processed</span></li>
        <li className="flex items-start gap-2 text-gray-600"><AlertTriangle size={16} className="text-amber-500 mt-1 flex-shrink-0" /><span>Less visually appealing — industrial gray appearance</span></li>
      </ul>

      <h3 className="text-xl font-bold text-gray-900 mt-8 mb-3">5. Decomposed Granite</h3>
      <p className="text-gray-600 leading-relaxed mb-4">
        Popular in the Southwest and Mediterranean-climate regions, decomposed granite (DG) creates a natural,
        earthy driveway surface. It compacts well when moistened and provides a firm, walkable surface. DG is
        especially popular in xeriscaped properties where it blends with the natural landscape.
      </p>
      <ul className="space-y-2 mb-6">
        <li className="flex items-start gap-2 text-gray-600"><CheckCircle2 size={16} className="text-emerald-500 mt-1 flex-shrink-0" /><span>Natural, rustic appearance that blends with landscaping</span></li>
        <li className="flex items-start gap-2 text-gray-600"><CheckCircle2 size={16} className="text-emerald-500 mt-1 flex-shrink-0" /><span>Compacts into a firm surface with proper installation</span></li>
        <li className="flex items-start gap-2 text-gray-600"><AlertTriangle size={16} className="text-amber-500 mt-1 flex-shrink-0" /><span>Washes away in heavy rain without a stabilizer</span></li>
        <li className="flex items-start gap-2 text-gray-600"><AlertTriangle size={16} className="text-amber-500 mt-1 flex-shrink-0" /><span>Tracks into the house easily — fine particles stick to shoes</span></li>
      </ul>

      <h2 className="text-2xl font-extrabold text-gray-900 mt-10 mb-4">Cost Per Square Foot Comparison</h2>
      <div className="overflow-x-auto mb-6">
        <table className="w-full text-sm border border-gray-200 rounded-xl overflow-hidden">
          <thead>
            <tr className="bg-gray-50">
              <th className="text-left p-3 font-bold text-gray-900">Material</th>
              <th className="text-left p-3 font-bold text-gray-900">Price/Ton</th>
              <th className="text-left p-3 font-bold text-gray-900">Cost/Sq Ft (4&quot; depth)</th>
              <th className="text-left p-3 font-bold text-gray-900">10x40 ft Driveway</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-t border-gray-100"><td className="p-3 text-gray-700">Crushed Limestone</td><td className="p-3 text-gray-700">$22–$30</td><td className="p-3 text-gray-700">$0.75–$1.00</td><td className="p-3 text-gray-700">$300–$400</td></tr>
            <tr className="border-t border-gray-100 bg-gray-50"><td className="p-3 text-gray-700">Flex Base</td><td className="p-3 text-gray-700">$20–$28</td><td className="p-3 text-gray-700">$0.70–$0.95</td><td className="p-3 text-gray-700">$280–$380</td></tr>
            <tr className="border-t border-gray-100"><td className="p-3 text-gray-700">Pea Gravel</td><td className="p-3 text-gray-700">$25–$40</td><td className="p-3 text-gray-700">$0.85–$1.35</td><td className="p-3 text-gray-700">$340–$540</td></tr>
            <tr className="border-t border-gray-100 bg-gray-50"><td className="p-3 text-gray-700">Crushed Concrete</td><td className="p-3 text-gray-700">$12–$20</td><td className="p-3 text-gray-700">$0.40–$0.70</td><td className="p-3 text-gray-700">$160–$280</td></tr>
            <tr className="border-t border-gray-100"><td className="p-3 text-gray-700">Decomposed Granite</td><td className="p-3 text-gray-700">$24–$35</td><td className="p-3 text-gray-700">$0.80–$1.20</td><td className="p-3 text-gray-700">$320–$480</td></tr>
          </tbody>
        </table>
      </div>

      <h2 className="text-2xl font-extrabold text-gray-900 mt-10 mb-4">Climate Recommendations by Region</h2>

      <h3 className="text-xl font-bold text-gray-900 mt-8 mb-3">Texas and the Sun Belt (Extreme Heat)</h3>
      <p className="text-gray-600 leading-relaxed mb-4">
        In Texas and other Sun Belt states, temperatures regularly exceed 100 degrees Fahrenheit during summer.
        Dark-colored materials absorb heat and can become uncomfortable to walk on. Light-colored crushed
        limestone or flex base perform best in these conditions. Decomposed granite is also excellent in
        drier areas of West Texas and Arizona. Avoid dark basalt or trap rock as driveway surfaces — they
        absorb and radiate heat intensely.
      </p>

      <h3 className="text-xl font-bold text-gray-900 mt-8 mb-3">Colorado and Northern States (Freeze-Thaw Cycles)</h3>
      <p className="text-gray-600 leading-relaxed mb-4">
        Freeze-thaw cycles are the number one enemy of gravel driveways in northern climates. Water seeps
        into the sub-base, freezes, expands, and heaves the surface material. The best defense is a thick
        sub-base layer (8 to 12 inches of #4 or road base material) topped with angular crushed stone
        that allows water to drain before it freezes. Avoid pea gravel in freeze-thaw zones — it heaves and
        displaces far more than angular stone.
      </p>

      <h3 className="text-xl font-bold text-gray-900 mt-8 mb-3">Florida and Gulf Coast (Heavy Rainfall)</h3>
      <p className="text-gray-600 leading-relaxed mb-4">
        Florida sees 50 to 60 inches of rain per year, and many Gulf Coast properties sit on flat, poorly
        draining clay soils. Drainage is everything. Use materials with high permeability like #57 crushed
        limestone or washed river rock. A geotextile fabric layer beneath the gravel prevents it from sinking
        into the soft ground. Grade the driveway with a minimum 2 percent crown to shed water to the sides.
      </p>

      <h2 className="text-2xl font-extrabold text-gray-900 mt-10 mb-4">Step-by-Step Installation Guide</h2>

      <div className="space-y-4 mb-6">
        <div className="flex gap-4">
          <div className="flex-shrink-0 w-8 h-8 bg-emerald-600 text-white rounded-full flex items-center justify-center font-bold text-sm">1</div>
          <div>
            <h4 className="font-bold text-gray-900 mb-1">Excavate and Grade</h4>
            <p className="text-gray-600 text-sm">Remove topsoil and organic material to a depth of 8 to 12 inches. Grade the subgrade with a 2 percent crown (higher in the center) so water flows to the edges. Compact the native soil with a plate compactor or roller.</p>
          </div>
        </div>
        <div className="flex gap-4">
          <div className="flex-shrink-0 w-8 h-8 bg-emerald-600 text-white rounded-full flex items-center justify-center font-bold text-sm">2</div>
          <div>
            <h4 className="font-bold text-gray-900 mb-1">Install Geotextile Fabric</h4>
            <p className="text-gray-600 text-sm">Lay non-woven geotextile fabric over the entire subgrade. This prevents the gravel from migrating into the soil and keeps the sub-base stable for years. Overlap seams by at least 12 inches.</p>
          </div>
        </div>
        <div className="flex gap-4">
          <div className="flex-shrink-0 w-8 h-8 bg-emerald-600 text-white rounded-full flex items-center justify-center font-bold text-sm">3</div>
          <div>
            <h4 className="font-bold text-gray-900 mb-1">Place the Sub-Base Layer (4&ndash;6 inches)</h4>
            <p className="text-gray-600 text-sm">Spread 4 to 6 inches of large, angular base stone (#4 stone or road base). This is the structural layer that supports vehicle weight. Compact thoroughly with a vibratory roller or plate compactor.</p>
          </div>
        </div>
        <div className="flex gap-4">
          <div className="flex-shrink-0 w-8 h-8 bg-emerald-600 text-white rounded-full flex items-center justify-center font-bold text-sm">4</div>
          <div>
            <h4 className="font-bold text-gray-900 mb-1">Add the Middle Layer (2&ndash;3 inches)</h4>
            <p className="text-gray-600 text-sm">Spread 2 to 3 inches of mid-sized aggregate (#67 stone or similar) over the compacted sub-base. This transitional layer fills voids and provides additional support. Compact again.</p>
          </div>
        </div>
        <div className="flex gap-4">
          <div className="flex-shrink-0 w-8 h-8 bg-emerald-600 text-white rounded-full flex items-center justify-center font-bold text-sm">5</div>
          <div>
            <h4 className="font-bold text-gray-900 mb-1">Install Edging</h4>
            <p className="text-gray-600 text-sm">Set steel, aluminum, or treated timber edging along both sides of the driveway. This prevents the surface gravel from migrating into your lawn and keeps clean, defined edges.</p>
          </div>
        </div>
        <div className="flex gap-4">
          <div className="flex-shrink-0 w-8 h-8 bg-emerald-600 text-white rounded-full flex items-center justify-center font-bold text-sm">6</div>
          <div>
            <h4 className="font-bold text-gray-900 mb-1">Spread the Surface Layer (2&ndash;3 inches)</h4>
            <p className="text-gray-600 text-sm">Spread your chosen finish material (#57 limestone, pea gravel, or DG) to a depth of 2 to 3 inches. Rake it smooth and maintain the crown profile for drainage.</p>
          </div>
        </div>
        <div className="flex gap-4">
          <div className="flex-shrink-0 w-8 h-8 bg-emerald-600 text-white rounded-full flex items-center justify-center font-bold text-sm">7</div>
          <div>
            <h4 className="font-bold text-gray-900 mb-1">Final Compaction and Watering</h4>
            <p className="text-gray-600 text-sm">Give the entire surface one final pass with a roller. Then spray it with water — this settles fines into the voids and accelerates the locking process. Allow 48 hours before regular vehicle traffic.</p>
          </div>
        </div>
      </div>

      <h2 className="text-2xl font-extrabold text-gray-900 mt-10 mb-4">5 Common Driveway Gravel Mistakes</h2>

      <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 my-6">
        <div className="flex items-start gap-2 mb-3">
          <AlertTriangle size={18} className="text-amber-600 mt-0.5" />
          <h4 className="font-bold text-amber-800">Mistakes that cost homeowners thousands every year</h4>
        </div>
        <ul className="space-y-2">
          <li className="flex items-start gap-2 text-amber-800"><span className="font-bold">1.</span><span><strong>Skipping the sub-base.</strong> Laying surface gravel directly on dirt is the single most common mistake. Without a structural sub-base, your driveway will develop ruts and potholes within one season.</span></li>
          <li className="flex items-start gap-2 text-amber-800"><span className="font-bold">2.</span><span><strong>Using the wrong size stone.</strong> Many homeowners order #8 stone (pea-sized) for the entire driveway. It rolls under tires, scatters everywhere, and never locks in place.</span></li>
          <li className="flex items-start gap-2 text-amber-800"><span className="font-bold">3.</span><span><strong>No edging.</strong> Without containment edging, gravel migrates into your lawn within weeks, thinning the driveway and creating a mowing hazard.</span></li>
          <li className="flex items-start gap-2 text-amber-800"><span className="font-bold">4.</span><span><strong>Under-ordering material.</strong> A driveway that is too thin wears through to dirt in high-traffic areas. Always order 10 percent extra to account for compaction and spreading.</span></li>
          <li className="flex items-start gap-2 text-amber-800"><span className="font-bold">5.</span><span><strong>Ignoring drainage.</strong> A flat driveway collects water. Water plus gravel equals washouts and mud. Always maintain a 2 percent crown.</span></li>
        </ul>
      </div>

      <h2 className="text-2xl font-extrabold text-gray-900 mt-10 mb-4">Calculate How Much You Need</h2>
      <p className="text-gray-600 leading-relaxed mb-4">
        Use our calculator to estimate the exact amount of material for your driveway project. Enter your driveway
        dimensions and we will calculate cubic yards, tons, and estimated cost including a 10 percent overage buffer.
      </p>
      <div className="my-6">
        <QuantityCalculator materialName="Gravel" unit="ton" pricePerUnit={22} densityTonsPerCY={1.4} orderUrl="/browse" />
      </div>

      <h2 className="text-2xl font-extrabold text-gray-900 mt-10 mb-4">Frequently Asked Questions</h2>

      <details className="border border-gray-200 rounded-xl p-4 mb-3">
        <summary className="font-semibold text-gray-900 cursor-pointer">How deep should driveway gravel be?</summary>
        <p className="text-gray-600 mt-3">A properly built gravel driveway should have a total depth of 8 to 12 inches: 4 to 6 inches of compacted sub-base, 2 to 3 inches of middle aggregate, and 2 to 3 inches of surface material. For light residential use, you can get away with 6 inches total, but we recommend the full depth for driveways that handle daily traffic.</p>
      </details>
      <details className="border border-gray-200 rounded-xl p-4 mb-3">
        <summary className="font-semibold text-gray-900 cursor-pointer">What is the cheapest gravel for a driveway?</summary>
        <p className="text-gray-600 mt-3">Crushed concrete is the most affordable driveway material, typically $12 to $20 per ton compared to $22 to $30 for crushed limestone. It performs nearly as well but has a more industrial appearance. For a 400-square-foot driveway at 4 inches deep, you could save $100 to $200 by choosing crushed concrete.</p>
      </details>
      <details className="border border-gray-200 rounded-xl p-4 mb-3">
        <summary className="font-semibold text-gray-900 cursor-pointer">How many tons of gravel do I need for a driveway?</summary>
        <p className="text-gray-600 mt-3">A standard single-car driveway (10 x 40 feet) at 4 inches deep requires approximately 5 to 7 tons of gravel. A two-car driveway (20 x 40 feet) needs 10 to 14 tons. Use our calculator above for an exact estimate based on your dimensions.</p>
      </details>
      <details className="border border-gray-200 rounded-xl p-4 mb-3">
        <summary className="font-semibold text-gray-900 cursor-pointer">Do I need landscape fabric under driveway gravel?</summary>
        <p className="text-gray-600 mt-3">Yes, geotextile fabric is strongly recommended. It prevents gravel from sinking into the soil, blocks weeds, and extends the life of your driveway by 5 to 10 years. The cost is minimal — about $0.10 to $0.25 per square foot — compared to the long-term benefit.</p>
      </details>
      <details className="border border-gray-200 rounded-xl p-4 mb-3">
        <summary className="font-semibold text-gray-900 cursor-pointer">How long does a gravel driveway last?</summary>
        <p className="text-gray-600 mt-3">A well-built gravel driveway with proper sub-base and drainage lasts 15 to 20 years before needing a significant refresh. You will need to top-dress the surface layer every 3 to 5 years with 1 to 2 inches of new material, which is a low-cost maintenance task.</p>
      </details>
      <details className="border border-gray-200 rounded-xl p-4 mb-3">
        <summary className="font-semibold text-gray-900 cursor-pointer">Can I put new gravel on top of old gravel?</summary>
        <p className="text-gray-600 mt-3">Yes, if the existing base is still solid and well-drained. Rake the old surface to break up compacted areas, fill any ruts with base material, and add 2 to 3 inches of fresh surface gravel. If the old driveway has significant potholes or drainage issues, it is better to excavate and rebuild properly.</p>
      </details>
      <details className="border border-gray-200 rounded-xl p-4 mb-3">
        <summary className="font-semibold text-gray-900 cursor-pointer">What is the best gravel for a steep driveway?</summary>
        <p className="text-gray-600 mt-3">Angular crushed limestone or flex base — never pea gravel. Round stones roll downhill with rain and traffic. Angular materials lock together and resist movement. For slopes greater than 8 percent, consider adding a stabilizer grid to hold the gravel in place.</p>
      </details>
      <details className="border border-gray-200 rounded-xl p-4 mb-3">
        <summary className="font-semibold text-gray-900 cursor-pointer">How do I keep weeds out of my gravel driveway?</summary>
        <p className="text-gray-600 mt-3">Start with geotextile fabric under the gravel — this is the most effective weed barrier. For existing driveways, apply a pre-emergent herbicide in early spring and fall. Maintain a full 3-inch depth of surface gravel — thin spots allow sunlight to reach the soil and encourage weed growth.</p>
      </details>
      <details className="border border-gray-200 rounded-xl p-4 mb-3">
        <summary className="font-semibold text-gray-900 cursor-pointer">Is a gravel driveway cheaper than concrete?</summary>
        <p className="text-gray-600 mt-3">Significantly. A gravel driveway costs $1.50 to $3.00 per square foot installed, compared to $6.00 to $12.00 per square foot for poured concrete. For a 400-square-foot driveway, that is $600 to $1,200 for gravel versus $2,400 to $4,800 for concrete — a savings of 50 to 75 percent.</p>
      </details>
      <details className="border border-gray-200 rounded-xl p-4 mb-3">
        <summary className="font-semibold text-gray-900 cursor-pointer">When is the best time to install a gravel driveway?</summary>
        <p className="text-gray-600 mt-3">Late spring through early fall when the ground is dry and firm. Avoid installing during rainy seasons or when the ground is frozen. In Texas and the South, year-round installation is feasible, but spring gives you the best pricing before summer demand peaks.</p>
      </details>
    </>
  )
}

function FillDirtVsTopsoil() {
  return (
    <>
      <p className="text-gray-600 leading-relaxed mb-4">
        Fill dirt and topsoil are two of the most commonly ordered materials on our platform — and they are also
        the two materials that get confused the most. Order the wrong one, and you could waste hundreds or
        even thousands of dollars. Worse, you might end up with a project that fails completely: a raised bed
        that will not grow anything, or a graded yard that settles and cracks your new patio.
      </p>
      <p className="text-gray-600 leading-relaxed mb-4">
        Here is the definitive guide to understanding the difference, knowing when to use each, and making
        the right call for your project.
      </p>

      <h2 className="text-2xl font-extrabold text-gray-900 mt-10 mb-4">What Is Fill Dirt?</h2>
      <p className="text-gray-600 leading-relaxed mb-4">
        Fill dirt is subsoil — the layer of earth that sits below the topsoil, typically starting 6 to 12 inches
        below the surface. It is composed primarily of clay, sand, and rock fragments with very little organic
        matter. This is actually its greatest strength: because fill dirt contains almost no organic material,
        it does not decompose, shift, or settle over time.
      </p>
      <p className="text-gray-600 leading-relaxed mb-4">
        Fill dirt is the structural material of the earthwork world. It is what builders use to raise grades,
        fill holes, build up areas behind retaining walls, and create level building pads. Think of it as the
        foundation layer — the material that needs to stay exactly where you put it for decades.
      </p>
      <ul className="space-y-2 mb-6">
        <li className="flex items-start gap-2 text-gray-600"><CheckCircle2 size={16} className="text-emerald-500 mt-1 flex-shrink-0" /><span>Does not decompose or settle — stable for structural applications</span></li>
        <li className="flex items-start gap-2 text-gray-600"><CheckCircle2 size={16} className="text-emerald-500 mt-1 flex-shrink-0" /><span>Compacts densely for building pads and foundations</span></li>
        <li className="flex items-start gap-2 text-gray-600"><CheckCircle2 size={16} className="text-emerald-500 mt-1 flex-shrink-0" /><span>Typically $8–$15 per cubic yard — very affordable</span></li>
        <li className="flex items-start gap-2 text-gray-600"><CheckCircle2 size={16} className="text-emerald-500 mt-1 flex-shrink-0" /><span>Will not attract pests or promote weed growth</span></li>
      </ul>

      <h2 className="text-2xl font-extrabold text-gray-900 mt-10 mb-4">What Is Topsoil?</h2>
      <p className="text-gray-600 leading-relaxed mb-4">
        Topsoil is the uppermost layer of earth — the dark, nutrient-rich layer that forms over centuries as
        organic matter (leaves, roots, organisms) decomposes and mixes with mineral soil. It contains the
        nitrogen, phosphorus, potassium, and microorganisms that plants need to grow. Good topsoil is a
        living ecosystem.
      </p>
      <p className="text-gray-600 leading-relaxed mb-4">
        Use topsoil any time you need things to grow: lawns, gardens, flower beds, and landscaping. It is
        the finishing layer, not the structural layer. Topsoil should be applied over compacted fill dirt or
        existing grade, typically 4 to 6 inches deep for lawns and 8 to 12 inches deep for garden beds.
      </p>
      <ul className="space-y-2 mb-6">
        <li className="flex items-start gap-2 text-gray-600"><CheckCircle2 size={16} className="text-emerald-500 mt-1 flex-shrink-0" /><span>Rich in nutrients and organic matter — essential for plant growth</span></li>
        <li className="flex items-start gap-2 text-gray-600"><CheckCircle2 size={16} className="text-emerald-500 mt-1 flex-shrink-0" /><span>Retains moisture while allowing drainage</span></li>
        <li className="flex items-start gap-2 text-gray-600"><CheckCircle2 size={16} className="text-emerald-500 mt-1 flex-shrink-0" /><span>Contains beneficial microorganisms for healthy soil biology</span></li>
        <li className="flex items-start gap-2 text-gray-600"><AlertTriangle size={16} className="text-amber-500 mt-1 flex-shrink-0" /><span>Decomposes and settles over time — never use as structural fill</span></li>
      </ul>

      <h2 className="text-2xl font-extrabold text-gray-900 mt-10 mb-4">The Expensive Mistake: Using the Wrong One</h2>
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 my-6">
        <div className="flex items-start gap-2 mb-3">
          <AlertTriangle size={18} className="text-amber-600 mt-0.5" />
          <h4 className="font-bold text-amber-800">This mistake costs homeowners $1,000 to $5,000 every year</h4>
        </div>
        <p className="text-amber-800 mb-3">
          <strong>Scenario 1: Topsoil as fill.</strong> A homeowner orders 20 cubic yards of topsoil to raise the
          grade behind a new retaining wall. Six months later, the topsoil has decomposed and settled 3 to 4
          inches, pulling away from the wall and creating a gap where water pools. The fix: excavate the topsoil,
          replace with fill dirt, and re-landscape. Cost of the mistake: $2,500+.
        </p>
        <p className="text-amber-800">
          <strong>Scenario 2: Fill dirt for a garden.</strong> A homeowner orders fill dirt to create raised garden
          beds. Nothing grows. The hard, clay-heavy soil has no nutrients, no organic matter, and poor drainage.
          The fix: remove the fill dirt, replace with topsoil/compost blend. Cost of the mistake: $400 to $800
          per bed.
        </p>
      </div>

      <h2 className="text-2xl font-extrabold text-gray-900 mt-10 mb-4">When to Use Each: Quick Reference</h2>
      <div className="overflow-x-auto mb-6">
        <table className="w-full text-sm border border-gray-200 rounded-xl overflow-hidden">
          <thead>
            <tr className="bg-gray-50">
              <th className="text-left p-3 font-bold text-gray-900">Project</th>
              <th className="text-left p-3 font-bold text-gray-900">Use Fill Dirt</th>
              <th className="text-left p-3 font-bold text-gray-900">Use Topsoil</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-t border-gray-100"><td className="p-3 text-gray-700">Filling a hole/depression</td><td className="p-3 text-emerald-600 font-bold">Yes</td><td className="p-3 text-gray-400">Top 4&quot; only</td></tr>
            <tr className="border-t border-gray-100 bg-gray-50"><td className="p-3 text-gray-700">Behind a retaining wall</td><td className="p-3 text-emerald-600 font-bold">Yes</td><td className="p-3 text-gray-400">No</td></tr>
            <tr className="border-t border-gray-100"><td className="p-3 text-gray-700">Raising yard grade</td><td className="p-3 text-emerald-600 font-bold">Bulk</td><td className="p-3 text-emerald-600 font-bold">Top layer</td></tr>
            <tr className="border-t border-gray-100 bg-gray-50"><td className="p-3 text-gray-700">New lawn installation</td><td className="p-3 text-gray-400">No</td><td className="p-3 text-emerald-600 font-bold">Yes</td></tr>
            <tr className="border-t border-gray-100"><td className="p-3 text-gray-700">Garden beds</td><td className="p-3 text-gray-400">No</td><td className="p-3 text-emerald-600 font-bold">Yes</td></tr>
            <tr className="border-t border-gray-100 bg-gray-50"><td className="p-3 text-gray-700">Foundation/building pad</td><td className="p-3 text-emerald-600 font-bold">Yes</td><td className="p-3 text-gray-400">Never</td></tr>
            <tr className="border-t border-gray-100"><td className="p-3 text-gray-700">Pipe/utility backfill</td><td className="p-3 text-emerald-600 font-bold">Yes</td><td className="p-3 text-gray-400">No</td></tr>
            <tr className="border-t border-gray-100 bg-gray-50"><td className="p-3 text-gray-700">Landscaping/flower beds</td><td className="p-3 text-gray-400">No</td><td className="p-3 text-emerald-600 font-bold">Yes</td></tr>
          </tbody>
        </table>
      </div>

      <h2 className="text-2xl font-extrabold text-gray-900 mt-10 mb-4">Price Comparison</h2>
      <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-5 my-6">
        <h4 className="font-bold text-emerald-800 mb-3">Typical Pricing (Material Only)</h4>
        <ul className="space-y-2">
          <li className="flex items-start gap-2 text-emerald-800"><CheckCircle2 size={16} className="text-emerald-600 mt-1 flex-shrink-0" /><span><strong>Fill Dirt:</strong> $8–$15 per cubic yard ($5–$12 per ton). Often the cheapest material available.</span></li>
          <li className="flex items-start gap-2 text-emerald-800"><CheckCircle2 size={16} className="text-emerald-600 mt-1 flex-shrink-0" /><span><strong>Screened Topsoil:</strong> $20–$35 per cubic yard ($15–$28 per ton). Screened to remove rocks and debris.</span></li>
          <li className="flex items-start gap-2 text-emerald-800"><CheckCircle2 size={16} className="text-emerald-600 mt-1 flex-shrink-0" /><span><strong>Premium Garden Blend:</strong> $35–$55 per cubic yard. Mixed with compost for garden beds.</span></li>
        </ul>
        <p className="text-emerald-700 text-sm mt-3">Delivery typically adds $50–$150 depending on distance and quantity. Many suppliers include delivery for orders over 10 cubic yards.</p>
      </div>

      <h2 className="text-2xl font-extrabold text-gray-900 mt-10 mb-4">The Pro Move: Use Both</h2>
      <p className="text-gray-600 leading-relaxed mb-4">
        For most yard projects, the smartest approach is to use both materials in layers. If you need to raise
        your yard grade by 12 inches, order fill dirt for the bottom 8 inches and topsoil for the top 4 inches.
        You get the structural stability of fill dirt where it matters and the growing capacity of topsoil on
        top where your grass and plants need it.
      </p>
      <p className="text-gray-600 leading-relaxed mb-4">
        This layered approach can save you 40 to 60 percent compared to using topsoil for the entire depth,
        and it actually performs better because the compacted fill dirt creates a more stable base.
      </p>

      <h2 className="text-2xl font-extrabold text-gray-900 mt-10 mb-4">Frequently Asked Questions</h2>

      <details className="border border-gray-200 rounded-xl p-4 mb-3">
        <summary className="font-semibold text-gray-900 cursor-pointer">Can I use fill dirt to grow grass?</summary>
        <p className="text-gray-600 mt-3">Not directly. Fill dirt has almost no nutrients and poor water retention. You need at least 4 inches of topsoil over the fill dirt for grass to establish. Without topsoil, grass seed will germinate but die within weeks from lack of nutrition.</p>
      </details>
      <details className="border border-gray-200 rounded-xl p-4 mb-3">
        <summary className="font-semibold text-gray-900 cursor-pointer">Is clean fill the same as fill dirt?</summary>
        <p className="text-gray-600 mt-3">Clean fill is a subset of fill dirt that has been tested to be free of contaminants, debris, and organic matter. It is required for projects near water sources or environmentally sensitive areas. Regular fill dirt may contain small amounts of construction debris or untested soil. Always ask your supplier about the source.</p>
      </details>
      <details className="border border-gray-200 rounded-xl p-4 mb-3">
        <summary className="font-semibold text-gray-900 cursor-pointer">How much does fill dirt settle after placement?</summary>
        <p className="text-gray-600 mt-3">Properly compacted fill dirt settles 5 to 10 percent. Without compaction, it can settle 15 to 25 percent. This is why compaction in 6-inch lifts is critical — and why you should order 10 percent extra to account for compaction loss.</p>
      </details>
      <details className="border border-gray-200 rounded-xl p-4 mb-3">
        <summary className="font-semibold text-gray-900 cursor-pointer">How thick should topsoil be for a new lawn?</summary>
        <p className="text-gray-600 mt-3">For sod, a minimum of 4 inches of topsoil is required, with 6 inches being ideal. For seed, 4 inches is sufficient. For garden beds, use 8 to 12 inches of topsoil for deep-rooted vegetables and perennials.</p>
      </details>
      <details className="border border-gray-200 rounded-xl p-4 mb-3">
        <summary className="font-semibold text-gray-900 cursor-pointer">Can I mix topsoil with fill dirt?</summary>
        <p className="text-gray-600 mt-3">You can, but it defeats the purpose of both materials. The organic matter in topsoil will cause settling in a structural application, and the clay in fill dirt will reduce the growing capacity for plants. Keep them in separate layers for the best results.</p>
      </details>
      <details className="border border-gray-200 rounded-xl p-4 mb-3">
        <summary className="font-semibold text-gray-900 cursor-pointer">What is select fill?</summary>
        <p className="text-gray-600 mt-3">Select fill is a higher grade of fill dirt that has been screened and tested to meet specific engineering standards for compaction and load-bearing capacity. It is used for structural projects like foundations, roadways, and commercial building pads where quality control is critical. It costs more than standard fill dirt, typically $12 to $20 per cubic yard.</p>
      </details>
      <details className="border border-gray-200 rounded-xl p-4 mb-3">
        <summary className="font-semibold text-gray-900 cursor-pointer">How do I know if I need screened vs unscreened topsoil?</summary>
        <p className="text-gray-600 mt-3">Screened topsoil has been passed through a mesh to remove rocks, roots, and clumps. Use screened topsoil for lawns and fine garden work. Unscreened is fine for rough grading and areas that will be heavily amended with compost anyway. Screened costs about $5 to $10 more per cubic yard.</p>
      </details>
      <details className="border border-gray-200 rounded-xl p-4 mb-3">
        <summary className="font-semibold text-gray-900 cursor-pointer">Should I get a soil test before ordering topsoil?</summary>
        <p className="text-gray-600 mt-3">For garden beds and large lawn projects, yes. A basic soil test from your county extension office costs $15 to $30 and tells you the pH, nutrient levels, and organic matter content. This helps you decide whether you need premium garden blend, standard topsoil, or topsoil with specific amendments.</p>
      </details>
    </>
  )
}

function FrenchDrainGuide() {
  return (
    <>
      <p className="text-gray-600 leading-relaxed mb-4">
        Water damage is the most expensive and preventable problem a homeowner can face. A soggy yard,
        standing water against your foundation, or a flooded basement can lead to tens of thousands of dollars
        in structural repairs, mold remediation, and landscaping restoration. A French drain is one of the most
        effective and affordable solutions to redirect water away from your home and yard.
      </p>
      <p className="text-gray-600 leading-relaxed mb-4">
        In this guide, we cover exactly what a French drain is, the materials you need to build one properly,
        the gravel sizes that work best, common mistakes to avoid, and when to hire a professional versus
        doing it yourself.
      </p>

      <h2 className="text-2xl font-extrabold text-gray-900 mt-10 mb-4">What Is a French Drain?</h2>
      <p className="text-gray-600 leading-relaxed mb-4">
        A French drain is a simple but effective drainage system: a trench filled with gravel and a perforated
        pipe that collects groundwater and surface water and redirects it to a safe discharge point (like a
        storm drain, dry well, or low area of your property). The gravel provides a path of least resistance
        for water, and the pipe collects and channels it away.
      </p>
      <p className="text-gray-600 leading-relaxed mb-4">
        French drains are named after Henry French, a Massachusetts farmer and judge who popularized the
        technique in his 1859 book on farm drainage. The basic principle has not changed in over 160 years
        because it works.
      </p>

      <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-5 my-6">
        <h4 className="font-bold text-emerald-800 mb-3">When You Need a French Drain</h4>
        <ul className="space-y-2">
          <li className="flex items-start gap-2 text-emerald-800"><CheckCircle2 size={16} className="text-emerald-600 mt-1 flex-shrink-0" /><span>Standing water in your yard after rain</span></li>
          <li className="flex items-start gap-2 text-emerald-800"><CheckCircle2 size={16} className="text-emerald-600 mt-1 flex-shrink-0" /><span>Water pooling against your foundation</span></li>
          <li className="flex items-start gap-2 text-emerald-800"><CheckCircle2 size={16} className="text-emerald-600 mt-1 flex-shrink-0" /><span>Soggy or marshy areas that never dry out</span></li>
          <li className="flex items-start gap-2 text-emerald-800"><CheckCircle2 size={16} className="text-emerald-600 mt-1 flex-shrink-0" /><span>Water seeping into your basement or crawl space</span></li>
          <li className="flex items-start gap-2 text-emerald-800"><CheckCircle2 size={16} className="text-emerald-600 mt-1 flex-shrink-0" /><span>Neighbor&apos;s property drains onto yours</span></li>
          <li className="flex items-start gap-2 text-emerald-800"><CheckCircle2 size={16} className="text-emerald-600 mt-1 flex-shrink-0" /><span>Retaining wall backfill needs drainage</span></li>
        </ul>
      </div>

      <h2 className="text-2xl font-extrabold text-gray-900 mt-10 mb-4">The 3 Essential Materials</h2>

      <h3 className="text-xl font-bold text-gray-900 mt-8 mb-3">1. Drainage Gravel (The Most Important Component)</h3>
      <p className="text-gray-600 leading-relaxed mb-4">
        Gravel is the backbone of your French drain. It serves three critical functions: it creates void space
        for water to flow through, it filters sediment to prevent pipe clogging, and it provides structural
        support for the trench. The type and size of gravel you choose will determine how well your drain
        performs and how long it lasts.
      </p>
      <p className="text-gray-600 leading-relaxed mb-4">
        You will need enough gravel to fill the entire trench around the pipe. For a typical residential French
        drain (12 inches wide, 18 inches deep, running 50 feet), you will need approximately 2.5 to 3 cubic
        yards of gravel — roughly 3.5 to 4.2 tons.
      </p>

      <h3 className="text-xl font-bold text-gray-900 mt-8 mb-3">2. Perforated Pipe</h3>
      <p className="text-gray-600 leading-relaxed mb-4">
        The perforated pipe sits inside the gravel-filled trench and collects water through small holes or
        slots along its length. Use rigid PVC perforated pipe (4-inch diameter) for the best performance
        and longevity. Flexible corrugated pipe is cheaper but crushes under soil weight, sags in the middle
        creating low spots, and clogs more easily. The performance difference is dramatic over a 10-year
        period.
      </p>

      <h3 className="text-xl font-bold text-gray-900 mt-8 mb-3">3. Filter Fabric (Geotextile)</h3>
      <p className="text-gray-600 leading-relaxed mb-4">
        Non-woven geotextile fabric wraps the entire gravel and pipe assembly, preventing fine soil particles
        from migrating into the gravel and clogging the system. Without filter fabric, a French drain in clay
        soil will clog within 3 to 5 years. With it, the system can function for 20 to 30 years.
      </p>

      <h2 className="text-2xl font-extrabold text-gray-900 mt-10 mb-4">Gravel Size Recommendations</h2>
      <p className="text-gray-600 leading-relaxed mb-4">
        Not all gravel is created equal when it comes to drainage. Here is what to use in each part of the
        French drain assembly:
      </p>
      <div className="overflow-x-auto mb-6">
        <table className="w-full text-sm border border-gray-200 rounded-xl overflow-hidden">
          <thead>
            <tr className="bg-gray-50">
              <th className="text-left p-3 font-bold text-gray-900">Location</th>
              <th className="text-left p-3 font-bold text-gray-900">Recommended Gravel</th>
              <th className="text-left p-3 font-bold text-gray-900">Size</th>
              <th className="text-left p-3 font-bold text-gray-900">Why</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-t border-gray-100"><td className="p-3 text-gray-700">Bottom of trench</td><td className="p-3 text-gray-700">#57 Crushed Stone</td><td className="p-3 text-gray-700">3/4&quot; – 1&quot;</td><td className="p-3 text-gray-700">Large voids for water flow</td></tr>
            <tr className="border-t border-gray-100 bg-gray-50"><td className="p-3 text-gray-700">Around pipe</td><td className="p-3 text-gray-700">#57 Crushed Stone</td><td className="p-3 text-gray-700">3/4&quot; – 1&quot;</td><td className="p-3 text-gray-700">Supports pipe and channels water</td></tr>
            <tr className="border-t border-gray-100"><td className="p-3 text-gray-700">Top layer (if exposed)</td><td className="p-3 text-gray-700">Pea Gravel or River Rock</td><td className="p-3 text-gray-700">3/8&quot; – 3/4&quot;</td><td className="p-3 text-gray-700">Aesthetic finish, still drains well</td></tr>
          </tbody>
        </table>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 my-6">
        <div className="flex items-start gap-2 mb-3">
          <AlertTriangle size={18} className="text-amber-600 mt-0.5" />
          <h4 className="font-bold text-amber-800">Never Use These in a French Drain</h4>
        </div>
        <ul className="space-y-2">
          <li className="flex items-start gap-2 text-amber-800"><span className="font-bold">Limestone screenings or crusher run:</span><span>The fine particles compact and seal, blocking water flow entirely. This defeats the purpose of the drain.</span></li>
          <li className="flex items-start gap-2 text-amber-800"><span className="font-bold">Rounded river rock larger than 1.5 inches:</span><span>Too few contact points, too much shifting. The pipe can displace and sag.</span></li>
          <li className="flex items-start gap-2 text-amber-800"><span className="font-bold">Recycled concrete:</span><span>Can contain calcium carbonate that leaches out and cements the gravel together over time, reducing drainage.</span></li>
        </ul>
      </div>

      <h2 className="text-2xl font-extrabold text-gray-900 mt-10 mb-4">Common French Drain Mistakes</h2>
      <ul className="space-y-2 mb-6">
        <li className="flex items-start gap-2 text-gray-600"><AlertTriangle size={16} className="text-amber-500 mt-1 flex-shrink-0" /><span><strong>Insufficient slope:</strong> A French drain needs a minimum slope of 1 percent (1 inch per 8 feet). Without it, water sits in the pipe instead of flowing to the outlet.</span></li>
        <li className="flex items-start gap-2 text-gray-600"><AlertTriangle size={16} className="text-amber-500 mt-1 flex-shrink-0" /><span><strong>No outlet:</strong> A French drain must discharge somewhere. Ending a drain in a dead-end is like building a bathtub — it fills up and overflows.</span></li>
        <li className="flex items-start gap-2 text-gray-600"><AlertTriangle size={16} className="text-amber-500 mt-1 flex-shrink-0" /><span><strong>Using the wrong gravel:</strong> Fine-grained aggregates compact and seal, turning your drain into a dam. Always use clean, washed stone with no fines.</span></li>
        <li className="flex items-start gap-2 text-gray-600"><AlertTriangle size={16} className="text-amber-500 mt-1 flex-shrink-0" /><span><strong>Skipping filter fabric:</strong> Without geotextile, clay soil migrates into the gravel and clogs the system within a few years.</span></li>
        <li className="flex items-start gap-2 text-gray-600"><AlertTriangle size={16} className="text-amber-500 mt-1 flex-shrink-0" /><span><strong>Placing the drain too shallow:</strong> A drain needs to be at least 12 inches deep to intercept groundwater effectively. Deeper is better for foundation drainage (18 to 24 inches).</span></li>
        <li className="flex items-start gap-2 text-gray-600"><AlertTriangle size={16} className="text-amber-500 mt-1 flex-shrink-0" /><span><strong>Using corrugated pipe:</strong> Flexible corrugated pipe sags, crushes, and collects sediment in its ridges. Rigid PVC costs slightly more but lasts decades longer.</span></li>
      </ul>

      <h2 className="text-2xl font-extrabold text-gray-900 mt-10 mb-4">DIY vs. Hiring a Professional</h2>
      <div className="grid md:grid-cols-2 gap-4 mb-6">
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-5">
          <h4 className="font-bold text-emerald-800 mb-3">DIY Is a Good Fit If:</h4>
          <ul className="space-y-2">
            <li className="flex items-start gap-2 text-emerald-800"><CheckCircle2 size={16} className="text-emerald-600 mt-1 flex-shrink-0" /><span>Your drain is less than 75 feet long</span></li>
            <li className="flex items-start gap-2 text-emerald-800"><CheckCircle2 size={16} className="text-emerald-600 mt-1 flex-shrink-0" /><span>The trench is in soft, rock-free soil</span></li>
            <li className="flex items-start gap-2 text-emerald-800"><CheckCircle2 size={16} className="text-emerald-600 mt-1 flex-shrink-0" /><span>No utilities are buried in the path</span></li>
            <li className="flex items-start gap-2 text-emerald-800"><CheckCircle2 size={16} className="text-emerald-600 mt-1 flex-shrink-0" /><span>You have a clear discharge point downhill</span></li>
            <li className="flex items-start gap-2 text-emerald-800"><CheckCircle2 size={16} className="text-emerald-600 mt-1 flex-shrink-0" /><span>DIY cost: $500–$1,500 in materials</span></li>
          </ul>
        </div>
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-5">
          <h4 className="font-bold text-gray-800 mb-3">Hire a Pro If:</h4>
          <ul className="space-y-2">
            <li className="flex items-start gap-2 text-gray-700"><ChevronRight size={16} className="text-gray-400 mt-1 flex-shrink-0" /><span>The drain is near your foundation (depth and placement are critical)</span></li>
            <li className="flex items-start gap-2 text-gray-700"><ChevronRight size={16} className="text-gray-400 mt-1 flex-shrink-0" /><span>You have rocky or extremely hard clay soil</span></li>
            <li className="flex items-start gap-2 text-gray-700"><ChevronRight size={16} className="text-gray-400 mt-1 flex-shrink-0" /><span>The drain needs to tie into a municipal storm system</span></li>
            <li className="flex items-start gap-2 text-gray-700"><ChevronRight size={16} className="text-gray-400 mt-1 flex-shrink-0" /><span>Your property has complex grading</span></li>
            <li className="flex items-start gap-2 text-gray-700"><ChevronRight size={16} className="text-gray-400 mt-1 flex-shrink-0" /><span>Pro cost: $2,000–$6,000 installed</span></li>
          </ul>
        </div>
      </div>

      <h2 className="text-2xl font-extrabold text-gray-900 mt-10 mb-4">Frequently Asked Questions</h2>

      <details className="border border-gray-200 rounded-xl p-4 mb-3">
        <summary className="font-semibold text-gray-900 cursor-pointer">How much gravel do I need for a French drain?</summary>
        <p className="text-gray-600 mt-3">For a typical residential French drain (12 inches wide, 18 inches deep), plan on approximately 0.5 cubic yards of gravel per 10 linear feet. A 50-foot drain needs about 2.5 to 3 cubic yards (3.5 to 4 tons). Use our calculator to get an exact number based on your dimensions.</p>
      </details>
      <details className="border border-gray-200 rounded-xl p-4 mb-3">
        <summary className="font-semibold text-gray-900 cursor-pointer">What size gravel is best for a French drain?</summary>
        <p className="text-gray-600 mt-3">#57 stone (3/4 inch to 1 inch) is the industry standard for French drains. It is large enough to create void space for water flow, small enough to support the pipe, and angular enough to lock in place. Avoid anything with fines — it must be clean, washed stone.</p>
      </details>
      <details className="border border-gray-200 rounded-xl p-4 mb-3">
        <summary className="font-semibold text-gray-900 cursor-pointer">How long do French drains last?</summary>
        <p className="text-gray-600 mt-3">A properly installed French drain with filter fabric, rigid PVC pipe, and clean washed gravel can last 20 to 30 years or more. Drains without filter fabric in clay soils may clog in 3 to 7 years. Drains with corrugated pipe typically need replacement in 8 to 12 years.</p>
      </details>
      <details className="border border-gray-200 rounded-xl p-4 mb-3">
        <summary className="font-semibold text-gray-900 cursor-pointer">Can I use pea gravel for a French drain?</summary>
        <p className="text-gray-600 mt-3">Pea gravel can work as a top layer for aesthetics, but it is not ideal as the primary drainage stone. Its round shape creates less void space than angular crushed stone, reducing water flow capacity by 15 to 20 percent. If you use it, keep it as a surface layer only.</p>
      </details>
      <details className="border border-gray-200 rounded-xl p-4 mb-3">
        <summary className="font-semibold text-gray-900 cursor-pointer">Do French drains need maintenance?</summary>
        <p className="text-gray-600 mt-3">Minimal maintenance. Once or twice a year, check that the outlet is clear and not blocked by debris. If you have a cleanout access point, flush the pipe with a garden hose to remove any sediment. Watch for any settling over the drain line — this indicates a potential clog or pipe issue.</p>
      </details>
      <details className="border border-gray-200 rounded-xl p-4 mb-3">
        <summary className="font-semibold text-gray-900 cursor-pointer">Should the perforated pipe holes face up or down?</summary>
        <p className="text-gray-600 mt-3">Holes should face down. This is counterintuitive, but water rises from below — the pipe collects water as it rises to the level of the holes. With holes facing up, surface sediment can enter the pipe directly and cause clogging.</p>
      </details>
      <details className="border border-gray-200 rounded-xl p-4 mb-3">
        <summary className="font-semibold text-gray-900 cursor-pointer">How deep should a French drain be?</summary>
        <p className="text-gray-600 mt-3">At minimum 12 inches deep. For foundation drainage, 18 to 24 inches deep and placed right at the footer level. For yard drainage intercepting surface water, 12 to 18 inches is sufficient. The key is maintaining a consistent downward slope toward the outlet.</p>
      </details>
      <details className="border border-gray-200 rounded-xl p-4 mb-3">
        <summary className="font-semibold text-gray-900 cursor-pointer">Can a French drain handle heavy rain?</summary>
        <p className="text-gray-600 mt-3">A single 4-inch French drain can handle moderate to heavy rainfall for most residential properties. For properties with severe drainage issues or heavy clay soil, a dual-pipe system or larger 6-inch pipe may be needed. In flood-prone areas, French drains should be part of a larger drainage plan that includes surface grading and downspout management.</p>
      </details>
    </>
  )
}

function HowMuchGravelGuide() {
  return (
    <>
      <p className="text-gray-600 leading-relaxed mb-4">
        Ordering gravel is not like ordering pizza — you cannot just call and say &quot;a large, please.&quot; Order
        too little and your project grinds to a halt while you wait for a second delivery. Order too much
        and you are paying for material that sits in a pile in your yard. Getting the quantity right is one
        of the most important parts of any aggregate project, and it is simpler than you think once you
        understand the formula.
      </p>

      <h2 className="text-2xl font-extrabold text-gray-900 mt-10 mb-4">The Formula, Explained Simply</h2>
      <p className="text-gray-600 leading-relaxed mb-4">
        Every gravel calculation comes down to three numbers: length, width, and depth. Here is the formula
        in plain English:
      </p>

      <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-5 my-6">
        <h4 className="font-bold text-emerald-800 mb-3">The Gravel Formula</h4>
        <p className="text-emerald-800 font-mono text-lg mb-3">
          Length (ft) x Width (ft) x Depth (in) / 12 = Cubic Feet
        </p>
        <p className="text-emerald-800 font-mono text-lg mb-3">
          Cubic Feet / 27 = Cubic Yards
        </p>
        <p className="text-emerald-800 font-mono text-lg mb-3">
          Cubic Yards x 1.4 = Tons (for most gravel)
        </p>
        <p className="text-emerald-700 text-sm mt-3">
          The 1.4 multiplier is the average density of gravel in tons per cubic yard. This varies by material — see the coverage chart below for specific densities.
        </p>
      </div>

      <h3 className="text-xl font-bold text-gray-900 mt-8 mb-3">Let&apos;s Walk Through an Example</h3>
      <p className="text-gray-600 leading-relaxed mb-4">
        Say you need to cover a 20-foot by 30-foot patio area with 3 inches of pea gravel:
      </p>
      <ul className="space-y-2 mb-6">
        <li className="flex items-start gap-2 text-gray-600"><CheckCircle2 size={16} className="text-emerald-500 mt-1 flex-shrink-0" /><span><strong>Step 1:</strong> 20 x 30 x (3/12) = 150 cubic feet</span></li>
        <li className="flex items-start gap-2 text-gray-600"><CheckCircle2 size={16} className="text-emerald-500 mt-1 flex-shrink-0" /><span><strong>Step 2:</strong> 150 / 27 = 5.56 cubic yards</span></li>
        <li className="flex items-start gap-2 text-gray-600"><CheckCircle2 size={16} className="text-emerald-500 mt-1 flex-shrink-0" /><span><strong>Step 3:</strong> 5.56 x 1.4 = 7.78 tons</span></li>
        <li className="flex items-start gap-2 text-gray-600"><CheckCircle2 size={16} className="text-emerald-500 mt-1 flex-shrink-0" /><span><strong>Step 4:</strong> Add 10% overage: 7.78 x 1.1 = 8.56 tons. Round up to <strong>8.6 tons</strong>.</span></li>
      </ul>

      <h2 className="text-2xl font-extrabold text-gray-900 mt-10 mb-4">Quick Reference Chart for Common Projects</h2>
      <div className="overflow-x-auto mb-6">
        <table className="w-full text-sm border border-gray-200 rounded-xl overflow-hidden">
          <thead>
            <tr className="bg-gray-50">
              <th className="text-left p-3 font-bold text-gray-900">Project</th>
              <th className="text-left p-3 font-bold text-gray-900">Typical Dimensions</th>
              <th className="text-left p-3 font-bold text-gray-900">Depth</th>
              <th className="text-left p-3 font-bold text-gray-900">Cubic Yards</th>
              <th className="text-left p-3 font-bold text-gray-900">Tons</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-t border-gray-100"><td className="p-3 text-gray-700">Single-car driveway</td><td className="p-3 text-gray-700">10 x 40 ft</td><td className="p-3 text-gray-700">4&quot;</td><td className="p-3 text-gray-700">4.9</td><td className="p-3 text-gray-700">6.9</td></tr>
            <tr className="border-t border-gray-100 bg-gray-50"><td className="p-3 text-gray-700">Two-car driveway</td><td className="p-3 text-gray-700">20 x 40 ft</td><td className="p-3 text-gray-700">4&quot;</td><td className="p-3 text-gray-700">9.9</td><td className="p-3 text-gray-700">13.8</td></tr>
            <tr className="border-t border-gray-100"><td className="p-3 text-gray-700">Patio</td><td className="p-3 text-gray-700">12 x 12 ft</td><td className="p-3 text-gray-700">3&quot;</td><td className="p-3 text-gray-700">1.3</td><td className="p-3 text-gray-700">1.9</td></tr>
            <tr className="border-t border-gray-100 bg-gray-50"><td className="p-3 text-gray-700">Walkway</td><td className="p-3 text-gray-700">3 x 30 ft</td><td className="p-3 text-gray-700">3&quot;</td><td className="p-3 text-gray-700">0.8</td><td className="p-3 text-gray-700">1.2</td></tr>
            <tr className="border-t border-gray-100"><td className="p-3 text-gray-700">French drain (50 ft)</td><td className="p-3 text-gray-700">1 x 50 ft</td><td className="p-3 text-gray-700">18&quot;</td><td className="p-3 text-gray-700">2.8</td><td className="p-3 text-gray-700">3.9</td></tr>
            <tr className="border-t border-gray-100 bg-gray-50"><td className="p-3 text-gray-700">Small parking area</td><td className="p-3 text-gray-700">20 x 20 ft</td><td className="p-3 text-gray-700">6&quot;</td><td className="p-3 text-gray-700">7.4</td><td className="p-3 text-gray-700">10.4</td></tr>
          </tbody>
        </table>
      </div>

      <h2 className="text-2xl font-extrabold text-gray-900 mt-10 mb-4">Why You Should Always Order 10% Extra</h2>
      <p className="text-gray-600 leading-relaxed mb-4">
        We recommend ordering 10 percent more material than your calculated amount. Here is why:
      </p>
      <ul className="space-y-2 mb-6">
        <li className="flex items-start gap-2 text-gray-600"><CheckCircle2 size={16} className="text-emerald-500 mt-1 flex-shrink-0" /><span><strong>Compaction loss:</strong> Gravel compacts 5 to 10 percent when you run a plate compactor or roller over it. What looked like 4 inches of material becomes 3.5 inches.</span></li>
        <li className="flex items-start gap-2 text-gray-600"><CheckCircle2 size={16} className="text-emerald-500 mt-1 flex-shrink-0" /><span><strong>Uneven subgrade:</strong> Even if you grade your subgrade carefully, there are always low spots and dips that eat up extra material.</span></li>
        <li className="flex items-start gap-2 text-gray-600"><CheckCircle2 size={16} className="text-emerald-500 mt-1 flex-shrink-0" /><span><strong>Spreading loss:</strong> Some material migrates beyond your project boundaries during installation, especially on edges without containment.</span></li>
        <li className="flex items-start gap-2 text-gray-600"><CheckCircle2 size={16} className="text-emerald-500 mt-1 flex-shrink-0" /><span><strong>Second delivery costs:</strong> If you run short, a second delivery typically costs as much as the first in delivery fees — often $75 to $150 for a small top-up load.</span></li>
      </ul>

      <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 my-6">
        <div className="flex items-start gap-2">
          <AlertTriangle size={18} className="text-amber-600 mt-0.5 flex-shrink-0" />
          <p className="text-amber-800"><strong>Pro tip:</strong> Running short is always more expensive than having a small pile left over. A leftover half-ton of gravel is useful for future fill-ins and maintenance. A half-ton shortfall means a $150 delivery for $30 worth of material.</p>
        </div>
      </div>

      <h2 className="text-2xl font-extrabold text-gray-900 mt-10 mb-4">Coverage by Material Type</h2>
      <p className="text-gray-600 leading-relaxed mb-4">
        Different materials have different densities, which means 1 cubic yard of each material weighs a
        different amount in tons. Here is a reference chart for common materials:
      </p>
      <div className="overflow-x-auto mb-6">
        <table className="w-full text-sm border border-gray-200 rounded-xl overflow-hidden">
          <thead>
            <tr className="bg-gray-50">
              <th className="text-left p-3 font-bold text-gray-900">Material</th>
              <th className="text-left p-3 font-bold text-gray-900">Tons per Cubic Yard</th>
              <th className="text-left p-3 font-bold text-gray-900">Sq Ft per Ton at 2&quot;</th>
              <th className="text-left p-3 font-bold text-gray-900">Sq Ft per Ton at 4&quot;</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-t border-gray-100"><td className="p-3 text-gray-700">Crushed Limestone</td><td className="p-3 text-gray-700">1.5</td><td className="p-3 text-gray-700">108</td><td className="p-3 text-gray-700">54</td></tr>
            <tr className="border-t border-gray-100 bg-gray-50"><td className="p-3 text-gray-700">Pea Gravel</td><td className="p-3 text-gray-700">1.4</td><td className="p-3 text-gray-700">116</td><td className="p-3 text-gray-700">58</td></tr>
            <tr className="border-t border-gray-100"><td className="p-3 text-gray-700">Flex Base</td><td className="p-3 text-gray-700">1.5</td><td className="p-3 text-gray-700">108</td><td className="p-3 text-gray-700">54</td></tr>
            <tr className="border-t border-gray-100 bg-gray-50"><td className="p-3 text-gray-700">River Rock</td><td className="p-3 text-gray-700">1.35</td><td className="p-3 text-gray-700">120</td><td className="p-3 text-gray-700">60</td></tr>
            <tr className="border-t border-gray-100"><td className="p-3 text-gray-700">Decomposed Granite</td><td className="p-3 text-gray-700">1.4</td><td className="p-3 text-gray-700">116</td><td className="p-3 text-gray-700">58</td></tr>
            <tr className="border-t border-gray-100 bg-gray-50"><td className="p-3 text-gray-700">Fill Dirt</td><td className="p-3 text-gray-700">1.1</td><td className="p-3 text-gray-700">147</td><td className="p-3 text-gray-700">74</td></tr>
            <tr className="border-t border-gray-100"><td className="p-3 text-gray-700">Sand</td><td className="p-3 text-gray-700">1.35</td><td className="p-3 text-gray-700">120</td><td className="p-3 text-gray-700">60</td></tr>
            <tr className="border-t border-gray-100 bg-gray-50"><td className="p-3 text-gray-700">Crushed Concrete</td><td className="p-3 text-gray-700">1.3</td><td className="p-3 text-gray-700">125</td><td className="p-3 text-gray-700">62</td></tr>
          </tbody>
        </table>
      </div>

      <h2 className="text-2xl font-extrabold text-gray-900 mt-10 mb-4">Calculate Your Project Now</h2>
      <p className="text-gray-600 leading-relaxed mb-4">
        Enter your project dimensions below and our calculator will do the math for you — including the 10
        percent overage buffer and estimated cost.
      </p>
      <div className="my-6">
        <QuantityCalculator materialName="Gravel" unit="ton" pricePerUnit={22} densityTonsPerCY={1.4} orderUrl="/browse" />
      </div>

      <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-5 my-6">
        <h4 className="font-bold text-emerald-800 mb-3">Calculating for Irregular Shapes</h4>
        <p className="text-emerald-800 mb-2">If your project area is not a simple rectangle, break it into rectangles and calculate each section separately. For example, an L-shaped driveway can be split into two rectangles. Add the cubic yards together for your total order.</p>
        <p className="text-emerald-800">For circular areas (like a fire pit surround), use: radius x radius x 3.14 x depth (in feet) / 27 = cubic yards.</p>
      </div>
    </>
  )
}

function SpringProjectGuide() {
  return (
    <>
      <p className="text-gray-600 leading-relaxed mb-4">
        Spring is the most popular time of year for outdoor projects, and for good reason — the ground has
        thawed, the weather is cooperative, and you have the full summer ahead to enjoy your improvements.
        But spring is also when material prices start climbing, lead times increase, and contractors get
        booked out for weeks. The homeowners who plan ahead in February and March save significantly
        compared to those who wait until May.
      </p>
      <p className="text-gray-600 leading-relaxed mb-4">
        This guide covers the top spring projects by region, when to order for the best pricing, and how to
        avoid the supply crunch that hits every year like clockwork.
      </p>

      <h2 className="text-2xl font-extrabold text-gray-900 mt-10 mb-4">Why Spring Is the Best Time for Outdoor Projects</h2>
      <ul className="space-y-2 mb-6">
        <li className="flex items-start gap-2 text-gray-600"><CheckCircle2 size={16} className="text-emerald-500 mt-1 flex-shrink-0" /><span><strong>Ground conditions are ideal.</strong> The soil is moist but not saturated, making excavation and grading easier than mid-summer when the ground bakes hard.</span></li>
        <li className="flex items-start gap-2 text-gray-600"><CheckCircle2 size={16} className="text-emerald-500 mt-1 flex-shrink-0" /><span><strong>Moderate temperatures.</strong> Working in 65 to 80 degrees is dramatically easier than in 95-degree heat. Materials compact better, concrete cures more evenly, and plants establish faster.</span></li>
        <li className="flex items-start gap-2 text-gray-600"><CheckCircle2 size={16} className="text-emerald-500 mt-1 flex-shrink-0" /><span><strong>Full growing season ahead.</strong> Grass seed planted in spring has 6 months of growing weather to establish before winter dormancy.</span></li>
        <li className="flex items-start gap-2 text-gray-600"><CheckCircle2 size={16} className="text-emerald-500 mt-1 flex-shrink-0" /><span><strong>Enjoy it all summer.</strong> A patio built in April gives you 5 months of use this year. One built in September gives you 5 weeks.</span></li>
      </ul>

      <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 my-6">
        <div className="flex items-start gap-2 mb-3">
          <AlertTriangle size={18} className="text-amber-600 mt-0.5" />
          <h4 className="font-bold text-amber-800">2025 Price Trend Warning</h4>
        </div>
        <p className="text-amber-800 mb-2">
          Aggregate material prices typically increase 12 to 18 percent between March and June as demand
          surges. Diesel fuel costs (which directly impact delivery fees) historically peak in late spring.
          In 2024, we saw an average 15 percent price increase on crushed stone products between February
          and May across our markets.
        </p>
        <p className="text-amber-800 font-bold">
          Ordering in March or April versus waiting until June can save you $200 to $500 on a typical
          residential project — material cost plus delivery fees.
        </p>
      </div>

      <h2 className="text-2xl font-extrabold text-gray-900 mt-10 mb-4">Top 8 Spring Projects by Region</h2>

      <h3 className="text-xl font-bold text-gray-900 mt-8 mb-3">1. Driveway Repair and Resurfacing (All Regions)</h3>
      <p className="text-gray-600 leading-relaxed mb-4">
        Winter takes a toll on gravel driveways. Freeze-thaw cycles heave material, snowplows scrape away
        the surface layer, and spring rains wash fines into low spots. Most gravel driveways need 1 to 2
        inches of fresh surface material every 2 to 3 years. Spring is the time to fill ruts, re-grade the
        crown, and add a fresh top layer. Order 1 to 3 tons for a typical resurfacing job.
      </p>

      <h3 className="text-xl font-bold text-gray-900 mt-8 mb-3">2. New Patio Installation (South and West)</h3>
      <p className="text-gray-600 leading-relaxed mb-4">
        A gravel or paver patio is one of the highest-value improvements you can make to your outdoor living
        space. In southern states, start as early as March to avoid the summer heat. You will need a compacted
        base layer (flex base or crushed limestone, 4 to 6 inches) plus your surface material. Most patios
        require 3 to 8 tons of material total.
      </p>

      <h3 className="text-xl font-bold text-gray-900 mt-8 mb-3">3. French Drain Installation (Gulf Coast and Southeast)</h3>
      <p className="text-gray-600 leading-relaxed mb-4">
        If your yard flooded during winter rains, now is the time to install a French drain before spring
        storms make the problem worse. Order clean #57 stone — typically 3 to 5 tons for a 50-foot
        residential drain. Complete this project before the heavy spring rains arrive.
      </p>

      <h3 className="text-xl font-bold text-gray-900 mt-8 mb-3">4. Raised Garden Beds (All Regions)</h3>
      <p className="text-gray-600 leading-relaxed mb-4">
        The gardening season kicks off in spring, and raised beds need quality topsoil or garden blend.
        A standard 4 x 8 foot raised bed, 12 inches deep, needs about 1 cubic yard of topsoil. If you
        are building multiple beds, order in bulk — you will save 30 to 50 percent per yard compared to
        bagged soil from a home center.
      </p>

      <h3 className="text-xl font-bold text-gray-900 mt-8 mb-3">5. Walkway and Path Construction (All Regions)</h3>
      <p className="text-gray-600 leading-relaxed mb-4">
        Pea gravel or decomposed granite walkways are affordable and attractive. A 3-foot-wide, 50-foot-long
        path at 3 inches deep requires about 1.4 cubic yards (roughly 2 tons). Add steel edging to keep the
        material contained and the path looking crisp for years.
      </p>

      <h3 className="text-xl font-bold text-gray-900 mt-8 mb-3">6. Yard Grading and Drainage Correction (All Regions)</h3>
      <p className="text-gray-600 leading-relaxed mb-4">
        If water pools near your foundation, spring is the season to re-grade your yard before the problem
        causes structural damage. Most grading projects need fill dirt as the base material, then topsoil
        for the growing surface. Plan on 5 to 20 cubic yards depending on the severity.
      </p>

      <h3 className="text-xl font-bold text-gray-900 mt-8 mb-3">7. New Lawn Installation (North and Midwest)</h3>
      <p className="text-gray-600 leading-relaxed mb-4">
        In northern states, late April through May is the prime window for seeding cool-season grasses.
        You need quality screened topsoil — 4 to 6 inches deep — for grass to establish strong roots.
        For a typical 2,000-square-foot lawn area, that is 12 to 18 cubic yards of topsoil.
      </p>

      <h3 className="text-xl font-bold text-gray-900 mt-8 mb-3">8. Erosion Control (Mountain and Hill Country)</h3>
      <p className="text-gray-600 leading-relaxed mb-4">
        Spring rains on bare slopes cause significant erosion. Rip rap (large angular stone, 4 to 12 inches)
        stabilizes slopes and channels. For smaller areas, crushed limestone or flex base at the base of
        slopes redirects water. Address erosion early — it only gets worse with each rain event.
      </p>

      <h2 className="text-2xl font-extrabold text-gray-900 mt-10 mb-4">Your Spring Project Timeline</h2>
      <div className="space-y-3 mb-6">
        <div className="flex gap-4 items-start">
          <div className="flex-shrink-0 w-20 text-xs font-bold text-emerald-600 bg-emerald-50 rounded-lg px-2 py-1.5 text-center">FEB–MAR</div>
          <p className="text-gray-600 text-sm"><strong>Plan and quote.</strong> Measure your project, calculate materials, and get pricing. This is when availability is best and prices are lowest.</p>
        </div>
        <div className="flex gap-4 items-start">
          <div className="flex-shrink-0 w-20 text-xs font-bold text-emerald-600 bg-emerald-50 rounded-lg px-2 py-1.5 text-center">MAR–APR</div>
          <p className="text-gray-600 text-sm"><strong>Order and schedule delivery.</strong> Lock in pricing and get on the delivery schedule before the spring rush. Book any rental equipment (plate compactor, mini excavator) now.</p>
        </div>
        <div className="flex gap-4 items-start">
          <div className="flex-shrink-0 w-20 text-xs font-bold text-emerald-600 bg-emerald-50 rounded-lg px-2 py-1.5 text-center">APR–MAY</div>
          <p className="text-gray-600 text-sm"><strong>Build.</strong> Execute your project during the prime weather window. Ground conditions are perfect and you have long daylight hours to work.</p>
        </div>
        <div className="flex gap-4 items-start">
          <div className="flex-shrink-0 w-20 text-xs font-bold text-emerald-600 bg-emerald-50 rounded-lg px-2 py-1.5 text-center">JUN+</div>
          <p className="text-gray-600 text-sm"><strong>Enjoy.</strong> Your project is done before the peak heat, and you have the whole summer to use it.</p>
        </div>
      </div>

      <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-5 my-6">
        <h4 className="font-bold text-emerald-800 mb-3">Order Smart, Save Big</h4>
        <p className="text-emerald-800">On EarthMove, you can browse materials, see real-time pricing for your area, and schedule delivery on your timeline. Order early in the season to lock in the best rates and guarantee availability. Our suppliers prioritize orders placed in advance over last-minute requests.</p>
      </div>
    </>
  )
}

function GravelCalculatorPage() {
  return (
    <>
      <p className="text-gray-600 leading-relaxed mb-4">
        Use our free calculator to determine exactly how much gravel, stone, sand, or fill material your
        project requires. Enter your project dimensions below and we will calculate cubic yards, tons, and
        an estimated cost — including a 10 percent overage buffer to make sure you never run short.
      </p>

      <div className="my-6">
        <QuantityCalculator materialName="Gravel" unit="ton" pricePerUnit={22} densityTonsPerCY={1.4} orderUrl="/browse" />
      </div>

      <h2 className="text-2xl font-extrabold text-gray-900 mt-10 mb-4">How to Use This Calculator</h2>
      <ul className="space-y-2 mb-6">
        <li className="flex items-start gap-2 text-gray-600"><CheckCircle2 size={16} className="text-emerald-500 mt-1 flex-shrink-0" /><span><strong>Select your project type</strong> from the dropdown to help us recommend the right material depth.</span></li>
        <li className="flex items-start gap-2 text-gray-600"><CheckCircle2 size={16} className="text-emerald-500 mt-1 flex-shrink-0" /><span><strong>Enter the length and width</strong> of your project area in feet. For irregular shapes, break the area into rectangles and calculate each one separately.</span></li>
        <li className="flex items-start gap-2 text-gray-600"><CheckCircle2 size={16} className="text-emerald-500 mt-1 flex-shrink-0" /><span><strong>Enter the depth</strong> in inches. Common depths: 2&ndash;3 inches for walkways, 3&ndash;4 inches for patios, 4&ndash;6 inches for driveways, 12&ndash;18 inches for French drains.</span></li>
        <li className="flex items-start gap-2 text-gray-600"><CheckCircle2 size={16} className="text-emerald-500 mt-1 flex-shrink-0" /><span><strong>Review the results</strong> — the calculator shows cubic yards, tons, and estimated cost with a 10% overage built in.</span></li>
      </ul>

      <h2 className="text-2xl font-extrabold text-gray-900 mt-10 mb-4">Coverage Chart: How Far Does a Ton Go?</h2>
      <p className="text-gray-600 leading-relaxed mb-4">
        The number of square feet one ton of material covers depends on the density of the material and
        the depth you apply it. Here is a quick reference:
      </p>
      <div className="overflow-x-auto mb-6">
        <table className="w-full text-sm border border-gray-200 rounded-xl overflow-hidden">
          <thead>
            <tr className="bg-gray-50">
              <th className="text-left p-3 font-bold text-gray-900">Material</th>
              <th className="text-left p-3 font-bold text-gray-900">1 Ton Covers (2&quot; deep)</th>
              <th className="text-left p-3 font-bold text-gray-900">1 Ton Covers (3&quot; deep)</th>
              <th className="text-left p-3 font-bold text-gray-900">1 Ton Covers (4&quot; deep)</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-t border-gray-100"><td className="p-3 text-gray-700">Crushed Limestone (#57)</td><td className="p-3 text-gray-700">108 sq ft</td><td className="p-3 text-gray-700">72 sq ft</td><td className="p-3 text-gray-700">54 sq ft</td></tr>
            <tr className="border-t border-gray-100 bg-gray-50"><td className="p-3 text-gray-700">Pea Gravel</td><td className="p-3 text-gray-700">116 sq ft</td><td className="p-3 text-gray-700">77 sq ft</td><td className="p-3 text-gray-700">58 sq ft</td></tr>
            <tr className="border-t border-gray-100"><td className="p-3 text-gray-700">Flex Base</td><td className="p-3 text-gray-700">108 sq ft</td><td className="p-3 text-gray-700">72 sq ft</td><td className="p-3 text-gray-700">54 sq ft</td></tr>
            <tr className="border-t border-gray-100 bg-gray-50"><td className="p-3 text-gray-700">River Rock</td><td className="p-3 text-gray-700">120 sq ft</td><td className="p-3 text-gray-700">80 sq ft</td><td className="p-3 text-gray-700">60 sq ft</td></tr>
            <tr className="border-t border-gray-100"><td className="p-3 text-gray-700">Sand</td><td className="p-3 text-gray-700">120 sq ft</td><td className="p-3 text-gray-700">80 sq ft</td><td className="p-3 text-gray-700">60 sq ft</td></tr>
            <tr className="border-t border-gray-100 bg-gray-50"><td className="p-3 text-gray-700">Fill Dirt</td><td className="p-3 text-gray-700">147 sq ft</td><td className="p-3 text-gray-700">98 sq ft</td><td className="p-3 text-gray-700">74 sq ft</td></tr>
            <tr className="border-t border-gray-100"><td className="p-3 text-gray-700">Topsoil</td><td className="p-3 text-gray-700">162 sq ft</td><td className="p-3 text-gray-700">108 sq ft</td><td className="p-3 text-gray-700">81 sq ft</td></tr>
            <tr className="border-t border-gray-100 bg-gray-50"><td className="p-3 text-gray-700">Decomposed Granite</td><td className="p-3 text-gray-700">116 sq ft</td><td className="p-3 text-gray-700">77 sq ft</td><td className="p-3 text-gray-700">58 sq ft</td></tr>
          </tbody>
        </table>
      </div>

      <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-5 my-6">
        <h4 className="font-bold text-emerald-800 mb-3">Why We Include 10% Overage</h4>
        <p className="text-emerald-800 mb-2">
          Our calculator automatically adds a 10 percent overage to your order. This accounts for compaction loss,
          uneven subgrade, and minor spreading beyond your project boundaries. In our experience, running short
          is far more expensive than having a small surplus — a second delivery can cost $100 to $150 in fees
          for just a small top-up load.
        </p>
        <p className="text-emerald-800">
          If you have leftover material, it is always useful for future maintenance, filling low spots, or
          sharing with a neighbor.
        </p>
      </div>

      <h2 className="text-2xl font-extrabold text-gray-900 mt-10 mb-4">Recommended Depths by Project</h2>
      <ul className="space-y-2 mb-6">
        <li className="flex items-start gap-2 text-gray-600"><CheckCircle2 size={16} className="text-emerald-500 mt-1 flex-shrink-0" /><span><strong>Decorative landscaping:</strong> 2&ndash;3 inches</span></li>
        <li className="flex items-start gap-2 text-gray-600"><CheckCircle2 size={16} className="text-emerald-500 mt-1 flex-shrink-0" /><span><strong>Walkways and paths:</strong> 2&ndash;3 inches</span></li>
        <li className="flex items-start gap-2 text-gray-600"><CheckCircle2 size={16} className="text-emerald-500 mt-1 flex-shrink-0" /><span><strong>Patios:</strong> 3&ndash;4 inches (plus 4&ndash;6 inch base layer)</span></li>
        <li className="flex items-start gap-2 text-gray-600"><CheckCircle2 size={16} className="text-emerald-500 mt-1 flex-shrink-0" /><span><strong>Driveways:</strong> 4&ndash;6 inches surface (plus 4&ndash;6 inch sub-base)</span></li>
        <li className="flex items-start gap-2 text-gray-600"><CheckCircle2 size={16} className="text-emerald-500 mt-1 flex-shrink-0" /><span><strong>French drains:</strong> 12&ndash;18 inches</span></li>
        <li className="flex items-start gap-2 text-gray-600"><CheckCircle2 size={16} className="text-emerald-500 mt-1 flex-shrink-0" /><span><strong>Parking areas:</strong> 6&ndash;8 inches</span></li>
        <li className="flex items-start gap-2 text-gray-600"><CheckCircle2 size={16} className="text-emerald-500 mt-1 flex-shrink-0" /><span><strong>Road base:</strong> 6&ndash;12 inches</span></li>
      </ul>
    </>
  )
}

function MaterialGradesGuide() {
  return (
    <>
      <p className="text-gray-600 leading-relaxed mb-4">
        Walk onto any job site and you will hear contractors throwing around numbers and abbreviations:
        &quot;We need 15 tons of 57 stone,&quot; &quot;Spec calls for Grade 1 flex base,&quot; &quot;Get me some Class A fill
        for the backfill.&quot; If you are new to the construction industry — or a homeowner trying to
        understand what your contractor is ordering — these codes can be confusing.
      </p>
      <p className="text-gray-600 leading-relaxed mb-4">
        This guide demystifies the most common aggregate grades and classifications used in the United
        States. You will learn what each number means, how the stones are sized, and exactly which
        applications call for each grade.
      </p>

      <h2 className="text-2xl font-extrabold text-gray-900 mt-10 mb-4">Understanding the Numbering System</h2>
      <p className="text-gray-600 leading-relaxed mb-4">
        The numbers assigned to aggregate grades (like #57, #67, #8) come from the American Society for
        Testing and Materials (ASTM) standard C33 and the American Association of State Highway and
        Transportation Officials (AASHTO). The numbers refer to the size of the sieve screens used to
        sort the stone. Lower numbers generally mean larger stones.
      </p>

      <h2 className="text-2xl font-extrabold text-gray-900 mt-10 mb-4">Common Stone Grades Explained</h2>

      <h3 className="text-xl font-bold text-gray-900 mt-8 mb-3">#57 Stone</h3>
      <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-5 my-6">
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <p className="text-emerald-800 font-bold mb-1">Size:</p>
            <p className="text-emerald-800 mb-3">3/4 inch to 1 inch</p>
            <p className="text-emerald-800 font-bold mb-1">Shape:</p>
            <p className="text-emerald-800 mb-3">Angular, crushed</p>
          </div>
          <div>
            <p className="text-emerald-800 font-bold mb-1">Weight:</p>
            <p className="text-emerald-800 mb-3">~1.4 tons per cubic yard</p>
            <p className="text-emerald-800 font-bold mb-1">Price Range:</p>
            <p className="text-emerald-800">$20–$30 per ton</p>
          </div>
        </div>
      </div>
      <p className="text-gray-600 leading-relaxed mb-4">
        #57 stone is the most widely used aggregate grade in the construction industry. It is the workhorse —
        versatile enough for dozens of applications and available from virtually every quarry and supplier in
        the country. The angular edges interlock under compaction, creating a stable, well-draining surface.
      </p>
      <p className="text-gray-600 leading-relaxed mb-4"><strong>Best uses:</strong></p>
      <ul className="space-y-2 mb-6">
        <li className="flex items-start gap-2 text-gray-600"><CheckCircle2 size={16} className="text-emerald-500 mt-1 flex-shrink-0" /><span>Driveway surface layers</span></li>
        <li className="flex items-start gap-2 text-gray-600"><CheckCircle2 size={16} className="text-emerald-500 mt-1 flex-shrink-0" /><span>French drain fill</span></li>
        <li className="flex items-start gap-2 text-gray-600"><CheckCircle2 size={16} className="text-emerald-500 mt-1 flex-shrink-0" /><span>Concrete mix aggregate</span></li>
        <li className="flex items-start gap-2 text-gray-600"><CheckCircle2 size={16} className="text-emerald-500 mt-1 flex-shrink-0" /><span>Pipe bedding</span></li>
        <li className="flex items-start gap-2 text-gray-600"><CheckCircle2 size={16} className="text-emerald-500 mt-1 flex-shrink-0" /><span>Backfill around foundations</span></li>
      </ul>

      <h3 className="text-xl font-bold text-gray-900 mt-8 mb-3">#67 Stone</h3>
      <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-5 my-6">
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <p className="text-emerald-800 font-bold mb-1">Size:</p>
            <p className="text-emerald-800 mb-3">1/2 inch to 3/4 inch</p>
            <p className="text-emerald-800 font-bold mb-1">Shape:</p>
            <p className="text-emerald-800 mb-3">Angular, crushed</p>
          </div>
          <div>
            <p className="text-emerald-800 font-bold mb-1">Weight:</p>
            <p className="text-emerald-800 mb-3">~1.4 tons per cubic yard</p>
            <p className="text-emerald-800 font-bold mb-1">Price Range:</p>
            <p className="text-emerald-800">$22–$32 per ton</p>
          </div>
        </div>
      </div>
      <p className="text-gray-600 leading-relaxed mb-4">
        #67 stone is slightly smaller than #57 and is often used as a transitional layer in multi-layer
        driveway construction. It nests between the larger base stone and the surface layer, filling voids
        and adding stability. It is also commonly specified for concrete mix designs and as backfill around
        drainage structures.
      </p>
      <p className="text-gray-600 leading-relaxed mb-4"><strong>Best uses:</strong></p>
      <ul className="space-y-2 mb-6">
        <li className="flex items-start gap-2 text-gray-600"><CheckCircle2 size={16} className="text-emerald-500 mt-1 flex-shrink-0" /><span>Driveway middle layer between base and surface</span></li>
        <li className="flex items-start gap-2 text-gray-600"><CheckCircle2 size={16} className="text-emerald-500 mt-1 flex-shrink-0" /><span>Concrete aggregate for structural pours</span></li>
        <li className="flex items-start gap-2 text-gray-600"><CheckCircle2 size={16} className="text-emerald-500 mt-1 flex-shrink-0" /><span>Drainage backfill behind retaining walls</span></li>
        <li className="flex items-start gap-2 text-gray-600"><CheckCircle2 size={16} className="text-emerald-500 mt-1 flex-shrink-0" /><span>Walkway base preparation</span></li>
      </ul>

      <h3 className="text-xl font-bold text-gray-900 mt-8 mb-3">#8 Stone (Pea-Sized)</h3>
      <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-5 my-6">
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <p className="text-emerald-800 font-bold mb-1">Size:</p>
            <p className="text-emerald-800 mb-3">3/8 inch</p>
            <p className="text-emerald-800 font-bold mb-1">Shape:</p>
            <p className="text-emerald-800 mb-3">Angular or rounded</p>
          </div>
          <div>
            <p className="text-emerald-800 font-bold mb-1">Weight:</p>
            <p className="text-emerald-800 mb-3">~1.35 tons per cubic yard</p>
            <p className="text-emerald-800 font-bold mb-1">Price Range:</p>
            <p className="text-emerald-800">$25–$35 per ton</p>
          </div>
        </div>
      </div>
      <p className="text-gray-600 leading-relaxed mb-4">
        #8 stone is small, angular aggregate about the size of a pea. It is used in asphalt mix, as a
        top-dressing for flat roofs, and in specialty drainage applications. Do not confuse #8 stone
        with pea gravel — #8 is angular (crushed), while pea gravel is round (naturally tumbled). The
        angular edges of #8 interlock better than rounded pea gravel.
      </p>
      <p className="text-gray-600 leading-relaxed mb-4"><strong>Best uses:</strong></p>
      <ul className="space-y-2 mb-6">
        <li className="flex items-start gap-2 text-gray-600"><CheckCircle2 size={16} className="text-emerald-500 mt-1 flex-shrink-0" /><span>Asphalt mix aggregate</span></li>
        <li className="flex items-start gap-2 text-gray-600"><CheckCircle2 size={16} className="text-emerald-500 mt-1 flex-shrink-0" /><span>Flat roof ballast</span></li>
        <li className="flex items-start gap-2 text-gray-600"><CheckCircle2 size={16} className="text-emerald-500 mt-1 flex-shrink-0" /><span>Pipe zone bedding for small utilities</span></li>
        <li className="flex items-start gap-2 text-gray-600"><CheckCircle2 size={16} className="text-emerald-500 mt-1 flex-shrink-0" /><span>Decorative ground cover in tight spaces</span></li>
      </ul>

      <h2 className="text-2xl font-extrabold text-gray-900 mt-10 mb-4">Base and Fill Classifications</h2>

      <h3 className="text-xl font-bold text-gray-900 mt-8 mb-3">Grade 1 Flex Base</h3>
      <p className="text-gray-600 leading-relaxed mb-4">
        Grade 1 flex base is a blended aggregate that meets state Department of Transportation specifications
        for road construction. In Texas, it meets TxDOT Item 247 standards. &quot;Grade 1&quot; means it has the
        highest level of plasticity index control — the fines content is carefully managed to ensure proper
        compaction and load-bearing capacity.
      </p>
      <p className="text-gray-600 leading-relaxed mb-4">
        Flex base contains a mix of crushed stone, stone dust, and natural binding fines that compact into
        a near-solid surface. It is used for road sub-bases, parking lots, construction entrances, and
        heavy-use driveways. When properly compacted with moisture, it achieves 95 to 100 percent proctor
        density.
      </p>
      <ul className="space-y-2 mb-6">
        <li className="flex items-start gap-2 text-gray-600"><CheckCircle2 size={16} className="text-emerald-500 mt-1 flex-shrink-0" /><span>Road and driveway sub-base construction</span></li>
        <li className="flex items-start gap-2 text-gray-600"><CheckCircle2 size={16} className="text-emerald-500 mt-1 flex-shrink-0" /><span>Parking lot base layers</span></li>
        <li className="flex items-start gap-2 text-gray-600"><CheckCircle2 size={16} className="text-emerald-500 mt-1 flex-shrink-0" /><span>Construction site stabilization</span></li>
        <li className="flex items-start gap-2 text-gray-600"><CheckCircle2 size={16} className="text-emerald-500 mt-1 flex-shrink-0" /><span>Equipment pad foundations</span></li>
      </ul>

      <h3 className="text-xl font-bold text-gray-900 mt-8 mb-3">Class A Fill (Select Fill)</h3>
      <p className="text-gray-600 leading-relaxed mb-4">
        Class A fill — also called select fill — is screened, tested fill dirt that meets engineering
        specifications for structural applications. Unlike standard fill dirt (which may contain unknown
        material), Class A fill has been tested for particle size distribution, plasticity, and organic
        content. It is specified by engineers for foundation backfill, structural earth fill, and any
        application where settlement must be minimized.
      </p>
      <ul className="space-y-2 mb-6">
        <li className="flex items-start gap-2 text-gray-600"><CheckCircle2 size={16} className="text-emerald-500 mt-1 flex-shrink-0" /><span>Foundation backfill for commercial structures</span></li>
        <li className="flex items-start gap-2 text-gray-600"><CheckCircle2 size={16} className="text-emerald-500 mt-1 flex-shrink-0" /><span>Structural earth fill for embankments</span></li>
        <li className="flex items-start gap-2 text-gray-600"><CheckCircle2 size={16} className="text-emerald-500 mt-1 flex-shrink-0" /><span>Utility trench backfill where compaction testing is required</span></li>
        <li className="flex items-start gap-2 text-gray-600"><CheckCircle2 size={16} className="text-emerald-500 mt-1 flex-shrink-0" /><span>Any fill application specified by a geotechnical engineer</span></li>
      </ul>

      <h2 className="text-2xl font-extrabold text-gray-900 mt-10 mb-4">Quick Reference: Which Grade for Which Job?</h2>
      <div className="overflow-x-auto mb-6">
        <table className="w-full text-sm border border-gray-200 rounded-xl overflow-hidden">
          <thead>
            <tr className="bg-gray-50">
              <th className="text-left p-3 font-bold text-gray-900">Application</th>
              <th className="text-left p-3 font-bold text-gray-900">Recommended Grade</th>
              <th className="text-left p-3 font-bold text-gray-900">Why</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-t border-gray-100"><td className="p-3 text-gray-700">Driveway surface</td><td className="p-3 text-gray-700 font-bold">#57</td><td className="p-3 text-gray-700">Locks together, great drainage</td></tr>
            <tr className="border-t border-gray-100 bg-gray-50"><td className="p-3 text-gray-700">Driveway sub-base</td><td className="p-3 text-gray-700 font-bold">Flex Base or #4</td><td className="p-3 text-gray-700">Maximum load-bearing capacity</td></tr>
            <tr className="border-t border-gray-100"><td className="p-3 text-gray-700">French drain</td><td className="p-3 text-gray-700 font-bold">#57 (clean/washed)</td><td className="p-3 text-gray-700">Large voids, no fines to clog</td></tr>
            <tr className="border-t border-gray-100 bg-gray-50"><td className="p-3 text-gray-700">Concrete mix</td><td className="p-3 text-gray-700 font-bold">#57 or #67</td><td className="p-3 text-gray-700">Meets ASTM C33 aggregate specs</td></tr>
            <tr className="border-t border-gray-100"><td className="p-3 text-gray-700">Pipe bedding</td><td className="p-3 text-gray-700 font-bold">#8 or #57</td><td className="p-3 text-gray-700">Cushions pipe, allows drainage</td></tr>
            <tr className="border-t border-gray-100 bg-gray-50"><td className="p-3 text-gray-700">Retaining wall backfill</td><td className="p-3 text-gray-700 font-bold">#57</td><td className="p-3 text-gray-700">Drains water away from wall</td></tr>
            <tr className="border-t border-gray-100"><td className="p-3 text-gray-700">Parking lot base</td><td className="p-3 text-gray-700 font-bold">Grade 1 Flex Base</td><td className="p-3 text-gray-700">Compacts to DOT standards</td></tr>
            <tr className="border-t border-gray-100 bg-gray-50"><td className="p-3 text-gray-700">Foundation backfill</td><td className="p-3 text-gray-700 font-bold">Class A Select Fill</td><td className="p-3 text-gray-700">Engineered, tested, minimal settlement</td></tr>
          </tbody>
        </table>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 my-6">
        <div className="flex items-start gap-2">
          <AlertTriangle size={18} className="text-amber-600 mt-0.5 flex-shrink-0" />
          <div>
            <h4 className="font-bold text-amber-800 mb-2">Regional Naming Variations</h4>
            <p className="text-amber-800">Aggregate grade names vary by region. What Texas calls &quot;flex base,&quot; Colorado might call &quot;road base&quot; or &quot;Class 6.&quot; What the Southeast calls &quot;#57 stone,&quot; the West might call &quot;3/4-inch minus.&quot; When ordering, always confirm the actual stone size and specification with your supplier, not just the local nickname.</p>
          </div>
        </div>
      </div>
    </>
  )
}

function WrongMaterialStory() {
  return (
    <>
      <p className="text-gray-600 leading-relaxed mb-4">
        In the aggregate industry, ordering the wrong material is not like ordering the wrong item on Amazon.
        You cannot just put it back in a box and return it. Twenty tons of the wrong stone sitting in your
        driveway means paying to have it removed, paying again for the correct material, and paying for delivery
        twice. We have seen these mistakes add $1,000 to $5,000 to project costs, and they happen more
        often than you would think.
      </p>
      <p className="text-gray-600 leading-relaxed mb-4">
        Here are four real-world scenarios we have witnessed — the mistakes, the consequences, and what
        should have been ordered instead.
      </p>

      <h2 className="text-2xl font-extrabold text-gray-900 mt-10 mb-4">Story 1: The Sinking Patio</h2>
      <div className="bg-gray-50 border border-gray-200 rounded-xl p-5 my-6">
        <h4 className="font-bold text-gray-900 mb-3">The Setup</h4>
        <p className="text-gray-600 mb-4">
          A homeowner in Austin, Texas was building a flagstone patio in their backyard. They needed a compacted
          base to set the flagstones on. They went to a landscape supply yard and asked for &quot;some gravel for
          a patio base.&quot; The yard sold them 6 tons of pea gravel — smooth, round, decorative pea gravel.
        </p>
        <h4 className="font-bold text-gray-900 mb-3">What Went Wrong</h4>
        <p className="text-gray-600 mb-4">
          Pea gravel does not compact. The round stones slide past each other like marbles. The homeowner
          spread 4 inches of pea gravel, placed their flagstones on top, and within two weeks every stone
          was rocking, shifting, and sinking unevenly. Chairs tipped over. Drinks spilled. The patio was
          unusable for entertaining.
        </p>
        <h4 className="font-bold text-red-700 mb-3">The Cost of the Mistake</h4>
        <ul className="space-y-1 text-gray-600 mb-4">
          <li>- Pea gravel (wasted): $240</li>
          <li>- Removal of pea gravel: $350</li>
          <li>- Correct material (flex base): $210</li>
          <li>- Second delivery fee: $125</li>
          <li>- Re-setting flagstones (labor): $600</li>
          <li className="font-bold text-red-700">- Total mistake cost: ~$1,525</li>
        </ul>
        <h4 className="font-bold text-emerald-700 mb-2">What They Should Have Ordered</h4>
        <p className="text-gray-600">Grade 1 flex base or crushed limestone (#57 with fines). These angular materials compact into a solid, stable surface that holds flagstones firmly in place.</p>
      </div>

      <h2 className="text-2xl font-extrabold text-gray-900 mt-10 mb-4">Story 2: The French Drain That Made Things Worse</h2>
      <div className="bg-gray-50 border border-gray-200 rounded-xl p-5 my-6">
        <h4 className="font-bold text-gray-900 mb-3">The Setup</h4>
        <p className="text-gray-600 mb-4">
          A homeowner in Houston was experiencing water pooling against their foundation after every rain.
          They hired a handyman who said he could install a French drain. The handyman ordered &quot;crusher run&quot;
          — a blend of crushed stone and fine dust — to fill the drain trench. It was cheaper than clean
          washed stone.
        </p>
        <h4 className="font-bold text-gray-900 mb-3">What Went Wrong</h4>
        <p className="text-gray-600 mb-4">
          Crusher run contains fine particles that compact into a nearly impervious layer when wet. Instead
          of allowing water to flow through to the perforated pipe, the crusher run acted like a dam. Water
          pooled on top of the &quot;drain&quot; and actually directed more water toward the foundation than before.
          Within six months, the homeowner noticed new cracks in their foundation walls.
        </p>
        <h4 className="font-bold text-red-700 mb-3">The Cost of the Mistake</h4>
        <ul className="space-y-1 text-gray-600 mb-4">
          <li>- Original drain installation (wasted): $1,800</li>
          <li>- Excavation and removal: $600</li>
          <li>- Correct installation with #57 washed stone: $2,400</li>
          <li>- Foundation crack repair: $1,200</li>
          <li className="font-bold text-red-700">- Total mistake cost: ~$6,000</li>
        </ul>
        <h4 className="font-bold text-emerald-700 mb-2">What They Should Have Ordered</h4>
        <p className="text-gray-600">Clean, washed #57 stone — angular crushed stone with no fines. The void space between the clean stones allows water to flow freely to the perforated pipe.</p>
      </div>

      <h2 className="text-2xl font-extrabold text-gray-900 mt-10 mb-4">Story 3: The Garden That Would Not Grow</h2>
      <div className="bg-gray-50 border border-gray-200 rounded-xl p-5 my-6">
        <h4 className="font-bold text-gray-900 mb-3">The Setup</h4>
        <p className="text-gray-600 mb-4">
          A couple in Denver built six raised garden beds — beautiful cedar frames, 12 inches deep, ready
          for a productive vegetable garden. They ordered &quot;dirt&quot; from a local supplier without specifying
          topsoil. The supplier delivered select fill — clean, tested fill dirt with almost zero organic
          content.
        </p>
        <h4 className="font-bold text-gray-900 mb-3">What Went Wrong</h4>
        <p className="text-gray-600 mb-4">
          The couple planted tomatoes, peppers, herbs, and squash. Seeds germinated but the plants were
          stunted, yellow, and produced almost no fruit. The fill dirt had a clay content of 40 percent,
          no nitrogen, no phosphorus, and a pH of 8.2 — far too alkaline for vegetables. After an entire
          growing season of failure, they had the soil tested and discovered the problem.
        </p>
        <h4 className="font-bold text-red-700 mb-3">The Cost of the Mistake</h4>
        <ul className="space-y-1 text-gray-600 mb-4">
          <li>- Fill dirt (wasted in beds): $180</li>
          <li>- Seeds, starts, and amendments (wasted season): $250</li>
          <li>- Removal of fill dirt from beds: $200</li>
          <li>- Correct topsoil/compost blend: $420</li>
          <li>- Lost growing season: Priceless frustration</li>
          <li className="font-bold text-red-700">- Total mistake cost: ~$1,050</li>
        </ul>
        <h4 className="font-bold text-emerald-700 mb-2">What They Should Have Ordered</h4>
        <p className="text-gray-600">Screened topsoil blended with compost (often called &quot;garden mix&quot; or &quot;raised bed blend&quot;). This has the organic matter, nutrients, and pH that vegetables need to thrive.</p>
      </div>

      <h2 className="text-2xl font-extrabold text-gray-900 mt-10 mb-4">Story 4: The Driveway That Washed Away</h2>
      <div className="bg-gray-50 border border-gray-200 rounded-xl p-5 my-6">
        <h4 className="font-bold text-gray-900 mb-3">The Setup</h4>
        <p className="text-gray-600 mb-4">
          A rural property owner in East Texas needed to resurface their 200-foot-long gravel driveway.
          A neighbor recommended decomposed granite because it &quot;looked nice.&quot; The property owner ordered
          15 tons of DG and spread it over the entire driveway at 2 inches deep, without any stabilizer
          or binder.
        </p>
        <h4 className="font-bold text-gray-900 mb-3">What Went Wrong</h4>
        <p className="text-gray-600 mb-4">
          East Texas gets 45 to 55 inches of rain per year. The first heavy rainstorm washed the DG into
          channels and gullies. The fine particles turned into mud and coated the remaining stone. After
          three storms, the driveway looked worse than before — rutted, muddy channels with washed-out
          piles of material on the sides. The DG that remained turned into a slippery, muddy mess every
          time it rained.
        </p>
        <h4 className="font-bold text-red-700 mb-3">The Cost of the Mistake</h4>
        <ul className="space-y-1 text-gray-600 mb-4">
          <li>- Decomposed granite (wasted): $525</li>
          <li>- Delivery: $150</li>
          <li>- Correct material (crushed limestone): $480</li>
          <li>- Second delivery: $150</li>
          <li>- Re-grading driveway (equipment rental): $300</li>
          <li className="font-bold text-red-700">- Total mistake cost: ~$1,605</li>
        </ul>
        <h4 className="font-bold text-emerald-700 mb-2">What They Should Have Ordered</h4>
        <p className="text-gray-600">Crushed limestone (#57) or flex base — angular materials that lock together and resist washout. In high-rainfall areas, DG is only suitable for walkways and patios with proper stabilizer, never for driveways.</p>
      </div>

      <h2 className="text-2xl font-extrabold text-gray-900 mt-10 mb-4">Lessons Learned</h2>
      <ul className="space-y-2 mb-6">
        <li className="flex items-start gap-2 text-gray-600"><CheckCircle2 size={16} className="text-emerald-500 mt-1 flex-shrink-0" /><span><strong>Describe your project, not just the material.</strong> Tell your supplier what you are building, not just what you think you need. A good supplier will recommend the right material for the application.</span></li>
        <li className="flex items-start gap-2 text-gray-600"><CheckCircle2 size={16} className="text-emerald-500 mt-1 flex-shrink-0" /><span><strong>Understand your climate.</strong> Materials that work in Arizona do not work in Houston. Rainfall, freeze-thaw cycles, and soil conditions all dictate which materials perform best.</span></li>
        <li className="flex items-start gap-2 text-gray-600"><CheckCircle2 size={16} className="text-emerald-500 mt-1 flex-shrink-0" /><span><strong>&quot;Cheap&quot; is expensive.</strong> Saving $100 on material but getting the wrong product can cost $1,000 to $5,000 in rework. Always prioritize getting the right material the first time.</span></li>
        <li className="flex items-start gap-2 text-gray-600"><CheckCircle2 size={16} className="text-emerald-500 mt-1 flex-shrink-0" /><span><strong>Know the difference between structural and decorative.</strong> Angular, crushed stone is structural. Round, smooth stone is decorative. Using decorative stone in a structural application is the root cause of most of these mistakes.</span></li>
      </ul>

      <h2 className="text-2xl font-extrabold text-gray-900 mt-10 mb-4">How EarthMove Prevents These Mistakes</h2>
      <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-5 my-6">
        <h4 className="font-bold text-emerald-800 mb-3">Built-In Safeguards</h4>
        <ul className="space-y-2">
          <li className="flex items-start gap-2 text-emerald-800"><CheckCircle2 size={16} className="text-emerald-600 mt-1 flex-shrink-0" /><span><strong>Material Match tool:</strong> Tell us your project and we recommend the right material. No guesswork, no &quot;I think I need pea gravel.&quot;</span></li>
          <li className="flex items-start gap-2 text-emerald-800"><CheckCircle2 size={16} className="text-emerald-600 mt-1 flex-shrink-0" /><span><strong>Detailed product descriptions:</strong> Every material listing includes recommended uses, sizes, and warnings about applications where it should not be used.</span></li>
          <li className="flex items-start gap-2 text-emerald-800"><CheckCircle2 size={16} className="text-emerald-600 mt-1 flex-shrink-0" /><span><strong>Quantity calculator:</strong> Our built-in calculator ensures you order the right amount with a 10 percent overage buffer — no more $150 second deliveries for a half-ton shortfall.</span></li>
          <li className="flex items-start gap-2 text-emerald-800"><CheckCircle2 size={16} className="text-emerald-600 mt-1 flex-shrink-0" /><span><strong>Verified suppliers:</strong> Every supplier on our platform is vetted for material quality. You are getting exactly what is listed — no mystery piles from unknown sources.</span></li>
          <li className="flex items-start gap-2 text-emerald-800"><CheckCircle2 size={16} className="text-emerald-600 mt-1 flex-shrink-0" /><span><strong>Educational resources:</strong> Guides like this one help you understand the differences before you order, so you can ask informed questions and make confident decisions.</span></li>
        </ul>
      </div>
    </>
  )
}

/* ──────────────────────────────────────────────────────────────────────────────
   ARTICLES REGISTRY
   ────────────────────────────────────────────────────────────────────────────── */

const ARTICLES: Record<string, {
  title: string
  description: string
  image: string
  readTime: string
  category: string
  content: () => React.ReactNode
}> = {
  'driveway-gravel-guide': {
    title: 'The Complete Guide to Driveway Gravel in 2025',
    description: 'Everything you need to know about choosing, calculating, and installing the right driveway material.',
    image: 'https://images.unsplash.com/photo-1558618047-3c37c2d3b4b0?w=1200&q=80&fit=crop',
    readTime: '12 min read',
    category: 'Homeowner',
    content: DrivewayGravelGuide,
  },
  'fill-dirt-vs-topsoil': {
    title: 'Fill Dirt vs Topsoil: Which One Do You Actually Need?',
    description: 'The difference could save you thousands. Here\'s how to choose the right material for your project.',
    image: 'https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=1200&q=80',
    readTime: '8 min read',
    category: 'Homeowner',
    content: FillDirtVsTopsoil,
  },
  'french-drain-materials': {
    title: 'Best Materials for French Drains and Drainage Projects',
    description: 'Stop water damage before it starts. The complete guide to drainage materials.',
    image: 'https://images.unsplash.com/photo-1574943320219-553eb213f72d?w=1200&q=80&fit=crop',
    readTime: '10 min read',
    category: 'Homeowner',
    content: FrenchDrainGuide,
  },
  'how-much-gravel-do-i-need': {
    title: 'How Much Gravel Do I Need? The Ultimate Calculator Guide',
    description: 'Never over-order or under-order again. Calculate exactly what your project needs.',
    image: 'https://images.unsplash.com/photo-1587293852726-70cdb56c2866?w=1200&q=80&fit=crop',
    readTime: '6 min read',
    category: 'Calculator',
    content: HowMuchGravelGuide,
  },
  'spring-project-guide-2025': {
    title: '2025 Spring Project Guide: What to Order and When',
    description: 'Beat the price increases. Your seasonal planning guide for spring projects.',
    image: 'https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=1200&q=80&fit=crop',
    readTime: '9 min read',
    category: 'Seasonal',
    content: SpringProjectGuide,
  },
  'gravel-calculator': {
    title: 'Free Gravel and Aggregate Calculator',
    description: 'Calculate cubic yards, tons, and truckloads for any project. Free tool.',
    image: 'https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=1200&q=80&fit=crop',
    readTime: '2 min',
    category: 'Calculator',
    content: GravelCalculatorPage,
  },
  'material-grades-explained': {
    title: 'Understanding Aggregate Grades: A Contractor\'s Guide',
    description: '#57 stone, #67 stone, Grade 1 flex base — what do these numbers actually mean?',
    image: 'https://images.unsplash.com/photo-1568283096533-078a24bde253?w=1200&q=80&fit=crop',
    readTime: '7 min read',
    category: 'Contractor',
    content: MaterialGradesGuide,
  },
  'ordering-wrong-material': {
    title: 'The $3,000 Mistake: What Happens When You Order the Wrong Material',
    description: 'Real stories of costly material mistakes — and how to avoid them.',
    image: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=1200&q=80&fit=crop',
    readTime: '8 min read',
    category: 'Homeowner',
    content: WrongMaterialStory,
  },
}

/* ──────────────────────────────────────────────────────────────────────────────
   PAGE COMPONENT & METADATA
   ────────────────────────────────────────────────────────────────────────────── */

export async function generateMetadata({ params }: Props) {
  const { slug } = await params
  const article = ARTICLES[slug]
  if (!article) return { title: 'Not Found' }
  return {
    title: article.title,
    description: article.description,
    alternates: { canonical: `/learn/${slug}` },
    openGraph: {
      title: article.title,
      description: article.description,
      type: 'article',
      images: [article.image],
    },
  }
}

export default async function LearnArticlePage({ params }: Props) {
  const { slug } = await params
  const article = ARTICLES[slug]
  if (!article) notFound()

  const Content = article.content
  const schema = articleSchema({
    title: article.title,
    description: article.description,
    slug,
    image: article.image,
    category: article.category,
    readTime: article.readTime,
  })
  const crumbs = breadcrumbSchema([
    { name: 'Home', url: '/' },
    { name: 'Learn', url: '/learn' },
    { name: article.title, url: `/learn/${slug}` },
  ])

  return (
    <article className="bg-white">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(crumbs) }} />
      {/* Hero */}
      <div className="relative h-[300px] md:h-[400px] overflow-hidden">
        <img src={getArticleImage(slug)} alt={article.title} className="absolute inset-0 w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent" />
        <div className="absolute bottom-0 inset-x-0 p-6 md:p-10 max-w-4xl mx-auto">
          <div className="flex items-center gap-3 mb-3">
            <span className="px-3 py-1 rounded-full bg-emerald-500 text-white text-xs font-bold">{article.category}</span>
            <span className="text-white/70 text-xs flex items-center gap-1"><Clock size={11} /> {article.readTime}</span>
          </div>
          <h1 className="text-3xl md:text-4xl font-extrabold text-white leading-tight">{article.title}</h1>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10 md:py-14">
        <Content />

        {/* CTA */}
        <div className="mt-12 bg-emerald-600 rounded-2xl p-8 text-center">
          <h3 className="text-2xl font-extrabold text-white mb-3">Ready to order?</h3>
          <p className="text-emerald-100 mb-6">Browse materials and get a price for your city.</p>
          <Link href="/browse" className="btn bg-white text-emerald-700 hover:bg-emerald-50 btn-xl font-bold shadow-xl inline-flex items-center gap-2 px-6 py-3 rounded-xl">
            Browse Materials <ArrowRight size={16} />
          </Link>
        </div>
      </div>
    </article>
  )
}
