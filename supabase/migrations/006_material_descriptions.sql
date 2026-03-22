-- 006_material_descriptions.sql
-- Rich descriptions for all material catalog entries.

UPDATE material_catalog SET description = 'Clean fill dirt is the go-to material for grading, leveling, and filling in low spots on your property. Made from natural subsoil with rocks and debris removed, it compacts well and provides a stable base for construction projects. Ideal for backfilling foundations, raising ground elevation, and preparing sites before landscaping or paving.' WHERE slug = 'fill-dirt';

UPDATE material_catalog SET description = 'Select fill is a premium screened fill material with controlled composition, meeting strict engineering specifications for compaction and load-bearing. It is commonly required by engineers for structural backfill behind retaining walls, under slabs, and around utility trenches. Select fill provides superior drainage and consistent compaction compared to regular fill dirt.' WHERE slug = 'select-fill';

UPDATE material_catalog SET description = 'Rich, nutrient-dense topsoil perfect for gardens, lawns, flower beds, and landscaping projects. Our screened topsoil is free of large rocks and debris, providing an ideal growing medium for grass seed, sod, plants, and trees. Delivered in bulk by the cubic yard — far more economical than bagged soil from hardware stores.' WHERE slug = 'topsoil';

UPDATE material_catalog SET description = 'Washed concrete sand (also called sharp sand or coarse sand) is essential for mixing concrete, mortar, and stucco. The angular grain shape provides excellent binding properties when mixed with cement. Also commonly used as a leveling base under pavers, flagstone, and brick — and as pipe bedding sand for utility installations.' WHERE slug = 'concrete-sand';

UPDATE material_catalog SET description = 'Masonry sand is a fine, uniformly graded sand used for mortar mixing, stucco application, and as a finishing sand for paver joints. Smoother and finer than concrete sand, it creates a workable mortar mix and fills joints evenly. Also popular for sandboxes, volleyball courts, and decorative landscaping applications.' WHERE slug = 'masonry-sand';

UPDATE material_catalog SET description = 'Utility sand (also called fill sand or cushion sand) is an unprocessed, general-purpose sand used for backfilling trenches, bedding pipes, and filling large voids. It is more affordable than washed sand varieties and works well for non-structural applications where drainage and fill volume are the primary requirements.' WHERE slug = 'utility-sand';

UPDATE material_catalog SET description = 'Smooth, rounded pea gravel in natural earth tones — a versatile decorative and functional stone. Sizes range from 1/4" to 1/2" diameter. Popular for walkways, patios, driveways, playgrounds, and French drain systems. Its rounded shape makes it comfortable to walk on and provides excellent drainage. Delivers a clean, polished look to any landscape.' WHERE slug = 'pea-gravel';

UPDATE material_catalog SET description = 'Base gravel #57 consists of 3/4" to 1" angular crushed stone, one of the most versatile aggregate products available. Used for drainage behind retaining walls, French drains, under concrete slabs, driveway base layers, and as a decorative landscape stone. The angular shape locks together for excellent stability.' WHERE slug = 'base-gravel-57';

UPDATE material_catalog SET description = 'Flex Base (Grade 1) is a precisely engineered road base material that meets TxDOT specifications for road construction. Composed of crushed limestone with controlled fines, it compacts to form an extremely hard, stable surface. The standard choice for driveways, parking areas, ranch roads, and building pads throughout Texas.' WHERE slug = 'flex-base';

UPDATE material_catalog SET description = 'Crushed limestone road base is a durable, compactable aggregate used to create stable foundations for roads, driveways, and parking lots. When properly compacted with water, it forms a hard surface that resists erosion and supports heavy vehicle traffic. More affordable than flex base while still providing excellent structural support.' WHERE slug = 'road-base';

UPDATE material_catalog SET description = 'Washed river rock features naturally smooth, rounded stones tumbled by water over thousands of years. Available in mixed natural colors — browns, tans, grays, and whites. Sizes typically range from 1" to 3". Perfect for dry creek beds, water features, garden borders, tree rings, and decorative ground cover. Low-maintenance and long-lasting.' WHERE slug = 'washed-river-rock';

UPDATE material_catalog SET description = 'Crushed limestone aggregate in various sizes, from screenings to 6" rip rap. Limestone is one of the most widely used construction materials in North America. Applications include driveway surfaces, drainage solutions, retaining wall backfill, and erosion control. Its light color brightens landscapes and reflects heat.' WHERE slug = 'limestone';

UPDATE material_catalog SET description = 'Large, heavy angular stone used for erosion control, shoreline stabilization, and slope protection. Rip rap ranges from 6" to 24" in diameter and is placed along waterways, drainage channels, and hillsides to prevent soil erosion from water flow. Also used decoratively in large-scale landscape features and retaining wall facing.' WHERE slug = 'rip-rap';

UPDATE material_catalog SET description = 'Recycled crushed concrete is an eco-friendly alternative to virgin aggregate products. Produced by crushing demolished concrete structures, it performs comparably to natural road base at a lower cost. Commonly used for driveway bases, temporary roads, parking lot subbase, and as fill material. Choosing recycled concrete keeps materials out of landfills.' WHERE slug = 'crushed-concrete';

UPDATE material_catalog SET description = 'Decomposed granite (DG) is a naturally weathered granite that has broken down into small particles and fine dust. Its warm, earthy tones of gold, tan, and brown create beautiful natural pathways, patios, and ground cover. When compacted, DG creates a firm but permeable surface. Popular for xeriscaping, rustic walkways, and low-water landscaping designs.' WHERE slug = 'decomposed-granite';
