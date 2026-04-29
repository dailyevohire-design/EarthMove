// Single source of truth for the driver dashboard sidebar nav AND the stub
// route URLs. When a stub becomes a real page, only the page.tsx changes —
// nav stays put. Followup #40: replace stub flag per item as routes ship.

export type DriverNavItem = {
  label: string
  href: string
  isStub: boolean
}

export type DriverNavSection = {
  title: string
  items: DriverNavItem[]
}

export const DRIVER_NAV: DriverNavSection[] = [
  {
    title: 'Operations',
    items: [
      { label: "Today's runs", href: '/dashboard/driver', isStub: false },
      { label: 'Available loads', href: '/dashboard/driver/loads', isStub: true },
      { label: 'Schedule + preferences', href: '/dashboard/driver/schedule', isStub: true },
    ],
  },
  {
    title: 'Earnings',
    items: [
      { label: 'This week', href: '/dashboard/driver/earnings', isStub: true },
      { label: 'Settlements & pay stubs', href: '/dashboard/driver/settlements', isStub: true },
      { label: '1099 + tax archive', href: '/dashboard/driver/tax', isStub: true },
    ],
  },
  {
    title: 'Protection',
    items: [
      { label: 'Groundcheck a project', href: '/dashboard/driver/groundcheck', isStub: true },
      { label: 'Lien intent filings', href: '/dashboard/driver/liens', isStub: true },
      { label: 'Insurance certificates', href: '/dashboard/driver/insurance', isStub: true },
    ],
  },
  {
    title: 'Documents',
    items: [
      { label: 'My documents', href: '/dashboard/driver/documents', isStub: true },
      { label: 'Truck & company', href: '/dashboard/driver/truck', isStub: true },
    ],
  },
  {
    title: 'Account',
    items: [
      { label: 'Payment method', href: '/dashboard/driver/payment', isStub: true },
      { label: 'Notifications', href: '/dashboard/driver/notifications', isStub: true },
      { label: 'Help', href: '/dashboard/driver/help', isStub: true },
    ],
  },
]
