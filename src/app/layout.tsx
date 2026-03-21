import type { Metadata } from 'next'
import { DM_Sans, DM_Mono } from 'next/font/google'
import './globals.css'
import { Toaster } from '@/components/ui/toaster'

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
    default: 'AggregateMarket — Order Bulk Materials Online',
    template: '%s | AggregateMarket',
  },
  description:
    'Order fill dirt, gravel, sand, road base, and more. Fast local delivery to your job site or home.',
  keywords: [
    'fill dirt delivery', 'gravel delivery', 'bulk aggregate materials',
    'topsoil delivery', 'road base', 'construction materials DFW',
  ],
  openGraph: {
    title: 'AggregateMarket — Bulk Construction Materials Delivered',
    description: 'Order fill dirt, gravel, sand, road base, and more. Delivered to your job site.',
    type: 'website',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${dmSans.variable} ${dmMono.variable}`}>
      <body className="bg-white text-gray-900 antialiased min-h-screen flex flex-col">
        {children}
        <Toaster />
      </body>
    </html>
  )
}
