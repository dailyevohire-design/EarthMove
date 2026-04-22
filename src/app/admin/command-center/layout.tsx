import type { ReactNode } from 'react'
import { JetBrains_Mono, Fraunces } from 'next/font/google'
import './styles.css'

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
  variable: '--font-mono',
  display: 'swap',
})

const fraunces = Fraunces({
  subsets: ['latin'],
  axes: ['opsz', 'SOFT'],
  variable: '--font-fraunces',
  display: 'swap',
})

export default function CommandCenterLayout({ children }: { children: ReactNode }) {
  return (
    <div className={jetbrainsMono.variable + ' ' + fraunces.variable} style={{ minHeight: '100vh' }}>
      {children}
    </div>
  )
}
