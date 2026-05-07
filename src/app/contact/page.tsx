import type { Metadata } from 'next'
import { ContactClient } from './contact-client'

export const metadata: Metadata = {
  title: 'Contact · EarthMove',
  description:
    'Get in touch with EarthMove. Drivers, contractors, suppliers, and homeowners — pick a topic and we will route the message.',
  alternates: { canonical: '/contact' },
  openGraph: {
    title: 'Contact EarthMove',
    description: 'Get in touch with the team.',
    url: '/contact',
    type: 'website',
  },
}

export default function ContactPage() {
  return <ContactClient />
}
