// Deals data for /deals - sandbox-realistic DFW deals, no DB query yet.

export type DealReason = 'stockpile_clear' | 'quarry_overrun' | 'weekend_window';

export interface Deal {
  id: string;
  material: string;
  spec: string;
  yardName: string;
  yardCity: string;
  wasPerTon: number;
  nowPerTon: number;
  tonsLeft: number;
  tonsTotal: number;
  expiresAt: string;
  expiresLabel: string;
  expiresIn: string;
  reason: DealReason;
  reasonLabel: string;
}

export const DEALS: Deal[] = [
  {
    id: 'abc-flex-base-247',
    material: 'Flex Base - 3/4 inch minus',
    spec: 'TxDOT Item 247 - Type A Gr 1-2',
    yardName: 'ABC Stone',
    yardCity: 'Singleton Yard - Dallas',
    wasPerTon: 28,
    nowPerTon: 22,
    tonsLeft: 340,
    tonsTotal: 800,
    expiresAt: '2026-04-29T23:00:00-05:00',
    expiresLabel: 'Ends Wed 6:00 PM',
    expiresIn: '2d 8h',
    reason: 'stockpile_clear',
    reasonLabel: 'Stockpile clear',
  },
  {
    id: 'vulcan-57-stone',
    material: 'Crushed Stone - #57',
    spec: 'ASTM C33 - washed',
    yardName: 'Vulcan Materials',
    yardCity: 'Mountain Creek - Dallas',
    wasPerTon: 34,
    nowPerTon: 27,
    tonsLeft: 180,
    tonsTotal: 500,
    expiresAt: '2026-04-30T17:00:00-05:00',
    expiresLabel: 'Ends Thu 5:00 PM',
    expiresIn: '3d 2h',
    reason: 'quarry_overrun',
    reasonLabel: 'Quarry overrun',
  },
  {
    id: 'mm-beckley-rip-rap',
    material: 'Rip-rap - 12 inch minus',
    spec: 'TxDOT Type R - erosion control',
    yardName: 'Martin Marietta',
    yardCity: 'Beckley - Dallas',
    wasPerTon: 42,
    nowPerTon: 34,
    tonsLeft: 95,
    tonsTotal: 220,
    expiresAt: '2026-04-28T16:00:00-05:00',
    expiresLabel: 'Ends Tue 4:00 PM',
    expiresIn: '1d 1h',
    reason: 'stockpile_clear',
    reasonLabel: 'Stockpile clear',
  },
  {
    id: 'holcim-concrete-sand',
    material: 'Concrete sand',
    spec: 'ASTM C33 fine aggregate',
    yardName: 'Holcim',
    yardCity: 'Mountain Creek - Dallas',
    wasPerTon: 24,
    nowPerTon: 19,
    tonsLeft: 600,
    tonsTotal: 900,
    expiresAt: '2026-05-02T12:00:00-05:00',
    expiresLabel: 'Ends Sat 12:00 PM',
    expiresIn: '5d 21h',
    reason: 'weekend_window',
    reasonLabel: 'Weekend window',
  },
  {
    id: 'ti-recycled-base',
    material: 'Recycled aggregate',
    spec: 'RCA - 2 inch minus - road base',
    yardName: 'Texas Industries',
    yardCity: 'Midlothian - Dallas',
    wasPerTon: 18,
    nowPerTon: 13,
    tonsLeft: 1100,
    tonsTotal: 1500,
    expiresAt: '2026-05-01T18:00:00-05:00',
    expiresLabel: 'Ends Fri 6:00 PM',
    expiresIn: '4d 3h',
    reason: 'stockpile_clear',
    reasonLabel: 'Stockpile clear',
  },
  {
    id: 'living-earth-topsoil',
    material: 'Screened topsoil',
    spec: 'No. 30 screen - landscape grade',
    yardName: 'Living Earth',
    yardCity: 'Northwest - Dallas',
    wasPerTon: 32,
    nowPerTon: 26,
    tonsLeft: 240,
    tonsTotal: 400,
    expiresAt: '2026-05-02T12:00:00-05:00',
    expiresLabel: 'Ends Sat 12:00 PM',
    expiresIn: '5d 21h',
    reason: 'weekend_window',
    reasonLabel: 'Weekend window',
  },
];

export const REASON_EXPLAINERS: Record<DealReason, string> = {
  stockpile_clear:
    'A yard with full bins prices below book to move tons. Same spec, same supplier, lower price - they need the pad space more than the margin.',
  quarry_overrun:
    'A blast yielded more than scheduled production. The extra goes out at a discount before it ages or migrates between bins.',
  weekend_window:
    'Saturday loadouts to keep scale operators on their full shift. Inventory ships at a discount instead of sitting until Monday.',
};
