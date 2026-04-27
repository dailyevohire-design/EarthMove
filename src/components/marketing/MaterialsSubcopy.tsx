'use client'

import { useAudience } from './audience-context'

export function MaterialsSubcopy() {
  const { audience } = useAudience()
  return (
    <p className="ink-2" id="matSub" style={{ marginTop: 16, fontSize: 18, maxWidth: 580 }}>
      {audience === 'contractor'
        ? 'Five families that match what crews actually build with. Truck-class fit shown on each card. Pricing confirmed against the closest yard once you drop your ZIP.'
        : 'Same outcome families on FillDirtNearMe.net, with delivery options sized for one-time projects.'}
    </p>
  )
}
