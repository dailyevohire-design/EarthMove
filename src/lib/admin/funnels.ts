export type FunnelStep = {
  step_name: string
  uniq_count: number
  drop_pct: number
}

export type FunnelDef = {
  id: string
  rpc_name: 'funnel_marketplace_gmv' | 'funnel_groundcheck_free' | 'funnel_groundcheck_paid' | 'funnel_signup_to_first_order' | 'funnel_wizard_completion'
  title: string
  subtitle: string
  default_window_hours: number
  step_labels: Record<string, string>  // maps SQL step_name -> human label
}

export const FUNNELS: FunnelDef[] = [
  {
    id: 'marketplace_gmv',
    rpc_name: 'funnel_marketplace_gmv',
    title: 'Marketplace GMV',
    subtitle: 'Homepage to paid order',
    default_window_hours: 24,
    step_labels: {
      landed_home: 'Landed on homepage',
      added_to_cart: 'Added material to cart',
      advanced_wizard: 'Advanced past wizard step 3',
      paid: 'Order paid',
    },
  },
  {
    id: 'groundcheck_free',
    rpc_name: 'funnel_groundcheck_free',
    title: 'Groundcheck — free tier',
    subtitle: 'Trust page visit to report view',
    default_window_hours: 24,
    step_labels: {
      visited_trust: 'Visited /trust',
      ran_search: 'Ran a search',
      viewed_report: 'Viewed a report',
    },
  },
  {
    id: 'groundcheck_paid',
    rpc_name: 'funnel_groundcheck_paid',
    title: 'Groundcheck — paid conversion',
    subtitle: 'Report view to upgrade click (subscription activation pending instrumentation)',
    default_window_hours: 168,
    step_labels: {
      viewed_report: 'Viewed a report',
      clicked_upgrade: 'Clicked upgrade CTA',
    },
  },
  {
    id: 'signup_to_first_order',
    rpc_name: 'funnel_signup_to_first_order',
    title: 'Signup → first order',
    subtitle: 'New signup activation',
    default_window_hours: 168,
    step_labels: {
      signed_up: 'Completed signup',
      added_to_cart: 'Added material to cart',
      placed_order: 'Placed first order',
    },
  },
  {
    id: 'wizard_completion',
    rpc_name: 'funnel_wizard_completion',
    title: 'Wizard completion',
    subtitle: 'Place-order wizard step-through',
    default_window_hours: 168,
    step_labels: {
      opened_wizard: 'Opened wizard',
      past_step_1: 'Past step 1',
      past_step_2: 'Past step 2',
      past_step_3: 'Past step 3',
      completed_order: 'Completed order',
    },
  },
]
