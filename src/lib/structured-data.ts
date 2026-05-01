// src/lib/structured-data.ts
// JSON-LD structured data generators for SEO/AEO

const BASE_URL = 'https://earthmove.io'

/**
 * Safely serialize a JSON-LD object for inline <script> injection.
 * Escapes `<` so a user-supplied string containing `</script>` cannot
 * break out of the script tag (XSS). Use with dangerouslySetInnerHTML.
 */
export function jsonLd(value: unknown): string {
  return JSON.stringify(value).replace(/</g, '\\u003c')
}

export function organizationSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'EarthMove',
    url: BASE_URL,
    logo: `${BASE_URL}/logo.png`,
    description: 'Order fill dirt, gravel, sand, road base, topsoil and more. Same-day bulk material delivery to your job site.',
    contactPoint: {
      '@type': 'ContactPoint',
      telephone: '+1-888-555-3478',
      contactType: 'customer service',
      areaServed: 'US',
      availableLanguage: 'English',
    },
    sameAs: [],
  }
}

export function websiteSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'EarthMove',
    url: BASE_URL,
    potentialAction: {
      '@type': 'SearchAction',
      target: `${BASE_URL}/browse?q={search_term_string}`,
      'query-input': 'required name=search_term_string',
    },
  }
}

export function productSchema(material: {
  name: string
  slug: string
  description: string | null
  category?: string
  price?: number | null
  unit?: string
  image?: string
}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: material.name,
    description: material.description ?? `Bulk ${material.name.toLowerCase()} available for delivery.`,
    image: material.image,
    url: `${BASE_URL}/browse/${material.slug}`,
    category: material.category ?? 'Construction Materials',
    brand: { '@type': 'Brand', name: 'EarthMove' },
    ...(material.price != null && {
      offers: {
        '@type': 'Offer',
        price: material.price,
        priceCurrency: 'USD',
        priceValidUntil: new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
        availability: 'https://schema.org/InStock',
        seller: { '@type': 'Organization', name: 'EarthMove' },
        unitCode: material.unit === 'cubic_yard' ? 'YDQ' : 'TNE',
      },
    }),
  }
}

export function localBusinessSchema(market: {
  name: string
  state: string
  slug: string
  materialCount?: number
}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    name: `EarthMove ${market.name}`,
    description: `Bulk construction material delivery in ${market.name}, ${market.state}. Fill dirt, gravel, sand, topsoil, road base and more.`,
    url: `${BASE_URL}/${market.slug === 'dallas-fort-worth' ? 'dallas' : market.slug}`,
    telephone: '+1-888-555-3478',
    areaServed: {
      '@type': 'City',
      name: market.name,
      containedInPlace: { '@type': 'State', name: market.state },
    },
    priceRange: '$$',
    openingHoursSpecification: {
      '@type': 'OpeningHoursSpecification',
      dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
      opens: '06:00',
      closes: '18:00',
    },
    ...(market.materialCount && {
      hasOfferCatalog: {
        '@type': 'OfferCatalog',
        name: `Materials in ${market.name}`,
        numberOfItems: market.materialCount,
      },
    }),
  }
}

export function breadcrumbSchema(items: { name: string; url: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: item.name,
      item: item.url.startsWith('http') ? item.url : `${BASE_URL}${item.url}`,
    })),
  }
}

export function faqSchema(questions: { question: string; answer: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: questions.map(q => ({
      '@type': 'Question',
      name: q.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: q.answer,
      },
    })),
  }
}

export function articleSchema(article: {
  title: string
  description: string
  slug: string
  image: string
  readTime?: string
  audience?: string
  datePublished?: string
  dateModified?: string
}) {
  const published = article.datePublished ?? '2025-01-01'
  const modified = article.dateModified ?? new Date().toISOString().split('T')[0]
  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: article.title,
    description: article.description,
    image: article.image,
    url: `${BASE_URL}/learn/${article.slug}`,
    datePublished: published,
    dateModified: modified,
    author: {
      '@type': 'Organization',
      name: 'EarthMove',
      url: BASE_URL,
    },
    publisher: {
      '@type': 'Organization',
      name: 'EarthMove',
      logo: { '@type': 'ImageObject', url: `${BASE_URL}/logo.png` },
    },
    mainEntityOfPage: { '@type': 'WebPage', '@id': `${BASE_URL}/learn/${article.slug}` },
    ...(article.audience && { articleSection: article.audience }),
  }
}

export function collectionPageSchema(collection: {
  name: string
  description: string
  url: string
  itemCount?: number
}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: collection.name,
    description: collection.description,
    url: collection.url.startsWith('http') ? collection.url : `${BASE_URL}${collection.url}`,
    isPartOf: { '@type': 'WebSite', name: 'EarthMove', url: BASE_URL },
    ...(collection.itemCount != null && {
      mainEntity: {
        '@type': 'ItemList',
        numberOfItems: collection.itemCount,
      },
    }),
  }
}

export function itemListSchema(items: { name: string; url: string; image?: string; price?: number | null; unit?: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    numberOfItems: items.length,
    itemListElement: items.map((item, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      item: {
        '@type': 'Product',
        name: item.name,
        url: item.url.startsWith('http') ? item.url : `${BASE_URL}${item.url}`,
        ...(item.image && { image: item.image }),
        ...(item.price != null && {
          offers: {
            '@type': 'Offer',
            price: item.price,
            priceCurrency: 'USD',
            availability: 'https://schema.org/InStock',
          },
        }),
      },
    })),
  }
}

// Pre-built FAQ content for material pages
export function getMaterialFAQs(materialName: string, cityName?: string, price?: number, unit?: string): { question: string; answer: string }[] {
  const location = cityName ? ` in ${cityName}` : ''
  const priceInfo = price != null ? ` Starting at $${price} per ${unit === 'cubic_yard' ? 'cubic yard' : 'ton'}.` : ''

  return [
    {
      question: `How much does ${materialName.toLowerCase()} cost${location}?`,
      answer: `${materialName} is available for bulk delivery${location}.${priceInfo} Pricing includes material cost. Delivery fees are calculated based on distance from the nearest supply yard. Order online for an instant quote.`,
    },
    {
      question: `How do I order ${materialName.toLowerCase()} for delivery?`,
      answer: `Select your quantity, enter your delivery address, and checkout securely online. Same-day and scheduled delivery options are available. Most orders are delivered within 24 hours.`,
    },
    {
      question: `What is the minimum order for ${materialName.toLowerCase()}?`,
      answer: `Minimum orders vary by material and location, typically starting at 2-14 tons depending on the product. Visit the order page for exact minimums in your area.`,
    },
    {
      question: `Can I get same-day ${materialName.toLowerCase()} delivery${location}?`,
      answer: `Yes, same-day delivery is available for most materials${location}. Orders placed before noon are typically delivered the same day. You can also schedule delivery for a future date.`,
    },
  ]
}
