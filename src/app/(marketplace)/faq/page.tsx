// src/app/(marketplace)/faq/page.tsx
//
// Standalone FAQ page. Server Component renders shell;
// FAQClient manages expand/collapse state.
// Covers ordering, delivery, billing, accounts, Groundcheck, drivers, suppliers.

import type { Metadata } from 'next';
import { FAQClient } from './FAQClient';

export const metadata: Metadata = {
  title: 'Frequently Asked Questions · EarthMove',
  description:
    'Common questions about ordering bulk materials, delivery, billing, Groundcheck verification, and EarthMove accounts.',
  alternates: { canonical: '/faq' },
  openGraph: {
    title: 'EarthMove FAQ',
    description: 'Direct answers to common questions about EarthMove.',
    url: '/faq',
    type: 'website',
  },
};

export default function FAQPage() {
  return <FAQClient />;
}
