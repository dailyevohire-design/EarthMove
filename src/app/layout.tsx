import type { Metadata } from 'next'
import { DM_Sans, DM_Mono, Bricolage_Grotesque, Geist, Fraunces, Inter, JetBrains_Mono } from 'next/font/google'
import './globals.css'
import { Toaster } from '@/components/ui/toaster'
import { SupportWidget } from '@/components/layout/chat-widget'
import { PromoBanner } from '@/components/layout/promo-banner'
import { organizationSchema, websiteSchema, jsonLd } from '@/lib/structured-data'
import { EmDsInit } from './_em-ds-init'

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

// Marketing page (v6) fonts — exposed as CSS vars; only applied inside .marketing-v6.
const bricolage = Bricolage_Grotesque({
  subsets: ['latin'],
  variable: '--font-bricolage',
  weight: ['500', '600', '700'],
  display: 'swap',
})

const geist = Geist({
  subsets: ['latin'],
  variable: '--font-geist',
  weight: ['400', '500', '600'],
  display: 'swap',
})

// EarthMove design-system primitives fonts.
const fraunces = Fraunces({
  subsets: ['latin'],
  variable: '--font-fraunces',
  weight: ['400', '500', '600', '700'],
  style: ['normal', 'italic'],
  display: 'swap',
})

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  weight: ['400', '500', '600', '700'],
  display: 'swap',
})

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-jetbrains-mono',
  weight: ['400', '500', '600'],
  display: 'swap',
})

export const metadata: Metadata = {
  metadataBase: new URL('https://earthmove.io'),
  title: {
    default: 'EarthMove — Bulk Materials Delivered to Your Job Site',
    template: '%s | EarthMove',
  },
  description:
    'Order fill dirt, gravel, sand, road base, topsoil and more. Same-day delivery to your job site. Launching in Denver and Dallas–Fort Worth, 2026.',
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
    <html lang="en" className={`${dmSans.variable} ${dmMono.variable} ${bricolage.variable} ${geist.variable} ${fraunces.variable} ${inter.variable} ${jetbrainsMono.variable}`}>
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
          dangerouslySetInnerHTML={{ __html: jsonLd(organizationSchema()) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: jsonLd(websiteSchema()) }}
        />
      </head>
      <body className="bg-white text-gray-900 antialiased min-h-screen flex flex-col">
        <EmDsInit />
        <PromoBanner />
        {children}
        <Toaster />
        <SupportWidget />
      </body>
    </html>
  )
}
