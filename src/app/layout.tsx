import type { Metadata } from 'next'
import { DM_Sans, DM_Mono } from 'next/font/google'
import './globals.css'
import { Toaster } from '@/components/ui/toaster'
import { ChatWidget } from '@/components/layout/chat-widget'
import { PromoBanner } from '@/components/layout/promo-banner'

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
  title: {
    default: 'EarthMove — Bulk Materials Delivered to Your Job Site',
    template: '%s | EarthMove',
  },
  description:
    'Order fill dirt, gravel, sand, road base, topsoil and more. Same-day delivery to your job site. Serving 10 markets nationwide.',
  keywords: [
    'fill dirt delivery', 'gravel delivery', 'bulk aggregate materials',
    'topsoil delivery', 'road base delivery', 'construction materials delivery',
    'sand delivery near me', 'bulk dirt delivery',
  ],
  openGraph: {
    title: 'EarthMove — Bulk Construction Materials Delivered',
    description: 'Order fill dirt, gravel, sand, road base, and more. Same-day delivery to your job site.',
    type: 'website',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${dmSans.variable} ${dmMono.variable}`}>
      <body className="bg-white text-gray-900 antialiased min-h-screen flex flex-col">
        <PromoBanner />
        {children}
        <Toaster />
        <ChatWidget />
      </body>
    </html>
  )
}
