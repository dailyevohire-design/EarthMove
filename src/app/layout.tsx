import type { Metadata } from 'next'
import { DM_Sans, DM_Mono } from 'next/font/google'
import './globals.css'
import { Toaster } from '@/components/ui/toaster'
import { SupportWidget } from '@/components/layout/chat-widget'
import { PromoBanner } from '@/components/layout/promo-banner'
import { organizationSchema, websiteSchema } from '@/lib/structured-data'

const dmSans = DM_Sans({
  subsets: ['latin'],
  variable: '--font-sans',
  weight: ['300', '400', '500', '600', '700', '800'],
  display: 'swap',
})

const dmMono = DM_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  weight: ['400', '500'],
  display: 'swap',
})

export const metadata: Metadata = {
  metadataBase: new URL('https://earthmove.io'),
  title: {
    default: 'EarthMove — Bulk Materials Delivered to Your Job Site',
    template: '%s | EarthMove',
  },
  description:
    'Order fill dirt, gravel, sand, road base, topsoil and more. Same-day delivery to your job site. Serving Dallas-Fort Worth, Denver, and 8 more markets.',
  keywords: [
    'fill dirt delivery', 'gravel delivery', 'bulk aggregate materials',
    'topsoil delivery', 'road base delivery', 'construction materials delivery',
    'sand delivery near me', 'bulk dirt delivery', 'crushed concrete delivery',
    'flex base delivery', 'pea gravel near me', 'decomposed granite delivery',
  ],
  openGraph: {
    title: 'EarthMove — Bulk Construction Materials Delivered',
    description: 'Order fill dirt, gravel, sand, road base, and more. Same-day delivery to your job site.',
    type: 'website',
    siteName: 'EarthMove',
    locale: 'en_US',
    url: 'https://earthmove.io',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'EarthMove — Bulk Construction Materials Delivered',
    description: 'Order fill dirt, gravel, sand, road base, and more. Same-day delivery to your job site.',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, 'max-snippet': -1, 'max-image-preview': 'large' },
  },
  alternates: { canonical: 'https://earthmove.io' },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${dmSans.variable} ${dmMono.variable}`}>
      <head>
        {/* Preconnect hints — saves ~100-300ms on TTFB for cross-origin fetches */}
        <link rel="preconnect" href="https://gaawvpzzmotimblyesfp.supabase.co" crossOrigin="" />
        <link rel="dns-prefetch" href="https://gaawvpzzmotimblyesfp.supabase.co" />
        <link rel="preconnect" href="https://images.unsplash.com" crossOrigin="" />
        <link rel="dns-prefetch" href="https://images.unsplash.com" />
        <link rel="preconnect" href="https://js.stripe.com" crossOrigin="" />
        <link rel="dns-prefetch" href="https://js.stripe.com" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema()) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteSchema()) }}
        />
      </head>
      <body className="bg-white text-gray-900 antialiased min-h-screen flex flex-col">
        <PromoBanner />
        {children}
        <Toaster />
        <SupportWidget />
      </body>
    </html>
  )
}
