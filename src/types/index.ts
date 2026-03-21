// src/types/index.ts — Final authoritative v3

// ── Enums ─────────────────────────────────────────────────────

export type UserRole = 'customer' | 'supplier' | 'admin'

export type OrderStatus =
  | 'pending_payment'
  | 'payment_failed'
  | 'confirmed'
  | 'dispatched'
  | 'delivered'
  | 'cancelled'
  | 'refunded'

export type DispatchStatus =
  | 'queued'
  | 'assigned'
  | 'confirmed'
  | 'en_route'
  | 'delivered'
  | 'failed'

export type DeliveryType = 'asap' | 'scheduled'
export type FulfillmentMethod = 'delivery' | 'pickup'
export type MaterialUnit = 'ton' | 'cubic_yard' | 'load' | 'each'
export type PromotionType = 'percentage' | 'flat_amount' | 'price_override'
export type SupplierStatus = 'pending' | 'active' | 'inactive' | 'suspended'
export type ImportStatus = 'pending_review' | 'approved' | 'rejected' | 'imported'
export type PriceDisplayMode = 'exact' | 'custom'

// ── DB Entities ───────────────────────────────────────────────

export interface Market {
  id: string
  name: string
  slug: string
  state: string
  is_active: boolean
  center_lat: number | null
  center_lng: number | null
  default_delivery_radius_miles: number
  timezone: string
  created_at: string
  updated_at: string
}

export interface Profile {
  id: string
  role: UserRole
  first_name: string | null
  last_name: string | null
  company_name: string | null
  phone: string | null
  stripe_customer_id: string | null
  default_market_id: string | null
  supplier_id: string | null
  portal_enabled: boolean
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface MaterialCategory {
  id: string
  name: string
  slug: string
  description: string | null
  icon_name: string | null
  sort_order: number
  is_active: boolean
  created_at: string
}

export interface MaterialCatalog {
  id: string
  category_id: string
  name: string
  slug: string
  description: string | null
  default_unit: MaterialUnit
  icon_name: string | null
  sort_order: number
  is_active: boolean
  created_at: string
  // Joined
  category?: MaterialCategory
}

export interface Supplier {
  id: string
  name: string
  slug: string | null
  status: SupplierStatus
  primary_contact_name: string | null
  primary_contact_phone: string | null
  primary_contact_email: string | null
  website: string | null
  portal_enabled: boolean
  internal_notes: string | null
  data_source: string
  stripe_account_id: string | null
  created_at: string
  updated_at: string
  // Joined
  performance?: SupplierPerformance
  yards?: SupplyYard[]
}

export interface SupplyYard {
  id: string
  supplier_id: string
  market_id: string
  name: string
  address_line_1: string | null
  city: string | null
  state: string | null
  zip: string | null
  lat: number | null
  lng: number | null
  phone: string | null
  hours_of_operation: Record<string, string>
  delivery_radius_miles: number | null
  delivery_enabled: boolean
  pickup_enabled: boolean
  is_active: boolean
  internal_notes: string | null
  created_at: string
  updated_at: string
  // Joined
  supplier?: Supplier
  offerings?: SupplierOffering[]
}

export interface SupplierOffering {
  id: string
  supply_yard_id: string
  material_catalog_id: string
  supplier_material_name: string | null
  supplier_description: string | null
  unit: MaterialUnit
  price_per_unit: number
  minimum_order_quantity: number
  typical_load_size: number | null
  load_size_label: string | null
  is_available: boolean
  available_for_delivery: boolean
  available_for_pickup: boolean
  stock_notes: string | null
  delivery_fee_base: number | null
  delivery_fee_per_mile: number | null
  max_delivery_miles: number | null
  availability_confidence: number
  last_verified_at: string | null
  daily_capacity_estimate: number | null
  is_public: boolean
  image_url: string | null
  is_featured: boolean
  sort_order: number
  internal_notes: string | null
  data_source: string
  created_at: string
  updated_at: string
  // Joined
  supply_yard?: SupplyYard
  material?: MaterialCatalog
}

export interface SupplierPerformance {
  id: string
  supplier_id: string
  on_time_rate: number
  cancellation_rate: number
  avg_response_hours: number
  total_orders: number
  completed_orders: number
  cancelled_orders: number
  performance_score: number
  is_bootstrapped: boolean
  last_calculated_at: string
  created_at: string
  updated_at: string
}

export interface MarketMaterial {
  id: string
  market_id: string
  material_catalog_id: string
  display_name: string | null
  display_description: string | null
  display_image_url: string | null
  is_visible: boolean
  is_featured: boolean
  sort_order: number
  price_display_mode: PriceDisplayMode
  custom_display_price: number | null
  is_available: boolean
  unavailable_reason: string | null
  admin_notes: string | null
  last_reviewed_at: string | null
  created_at: string
  updated_at: string
  // Joined
  material?: MaterialCatalog
  market?: Market
  pool?: MarketSupplyPool[]
}

export interface MarketSupplyPool {
  id: string
  market_material_id: string
  offering_id: string
  is_active: boolean
  is_preferred: boolean
  is_fallback: boolean
  composite_score: number
  price_score: number
  distance_score: number
  reliability_score: number
  availability_score: number
  weight_price: number
  weight_distance: number
  weight_reliability: number
  weight_availability: number
  scores_calculated_at: string | null
  admin_override_score: number | null
  admin_notes: string | null
  created_at: string
  updated_at: string
  // Joined
  offering?: SupplierOffering
}

export interface Promotion {
  id: string
  created_by: string | null
  market_id: string | null
  supplier_id: string | null
  offering_id: string | null
  material_catalog_id: string | null
  title: string
  description: string | null
  badge_label: string | null
  is_deal_of_day: boolean
  promotion_type: PromotionType
  discount_value: number | null
  override_price: number | null
  min_order_amount: number | null
  max_uses: number | null
  current_uses: number
  starts_at: string
  ends_at: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface PricingRule {
  id: string
  market_id: string | null
  rule_type: string
  config: Record<string, unknown>
  is_active: boolean
  effective_from: string
  effective_to: string | null
  created_at: string
}

export interface Address {
  id: string
  profile_id: string
  label: string | null
  street_line_1: string
  street_line_2: string | null
  city: string
  state: string
  zip: string
  lat: number | null
  lng: number | null
  market_id: string | null
  delivery_notes: string | null
  is_default: boolean
  created_at: string
}

export interface Order {
  id: string
  // Parties
  customer_id: string
  market_id: string
  // Resolved fulfillment (immutable after creation)
  market_material_id: string | null
  resolved_offering_id: string | null
  supply_yard_id: string | null
  supplier_id: string | null
  material_catalog_id: string | null
  // Status
  status: OrderStatus
  fulfillment_method: FulfillmentMethod
  // Snapshots (immutable after payment)
  material_name_snapshot: string
  supplier_name_snapshot: string
  supply_yard_name_snapshot: string
  quantity: number
  unit: MaterialUnit
  // Delivery
  delivery_type: DeliveryType
  delivery_address_id: string | null
  delivery_address_snapshot: DeliveryAddressSnapshot | null
  requested_delivery_date: string | null
  requested_delivery_window: string | null
  delivery_notes: string | null
  // Pricing (immutable after payment)
  price_per_unit: number
  subtotal: number
  delivery_fee: number
  platform_fee: number
  promotion_discount: number
  tax_amount: number
  total_amount: number
  line_items_snapshot: QuoteLineItem[]
  promotion_id: string | null
  // Payment
  stripe_payment_intent_id: string | null
  stripe_checkout_session_id: string | null
  paid_at: string | null
  // Internal review
  needs_review: boolean
  review_reason: string | null
  // Fulfillment
  dispatched_at: string | null
  delivered_at: string | null
  dispatcher_id: string | null
  fulfillment_notes: string | null
  internal_notes: string | null
  created_at: string
  updated_at: string
  // Joined
  customer?: Profile
  market?: Market
  dispatch?: DispatchQueueRecord
}

export interface DispatchQueueRecord {
  id: string
  order_id: string
  // What was resolved at checkout
  original_offering_id: string | null
  original_yard_id: string | null
  original_supplier_id: string | null
  // What actually fulfills (may differ if admin overrides)
  assigned_offering_id: string | null
  assigned_yard_id: string | null
  assigned_supplier_id: string | null
  was_overridden: boolean
  status: DispatchStatus
  assigned_at: string | null
  supplier_confirmed_at: string | null
  en_route_at: string | null
  delivered_at: string | null
  failed_at: string | null
  failure_reason: string | null
  target_delivery_date: string | null
  target_window: string | null
  estimated_arrival: string | null
  dispatcher_id: string | null
  driver_name: string | null
  driver_phone: string | null
  truck_info: string | null
  ops_notes: string | null
  created_at: string
  updated_at: string
  // Joined
  assigned_yard?: SupplyYard
  assigned_supplier?: Supplier
}

export interface ImportBatch {
  id: string
  source: string
  source_url: string | null
  source_name: string | null
  market_id: string | null
  status: ImportStatus
  total_records: number
  imported_count: number
  rejected_count: number
  reviewed_by: string | null
  reviewed_at: string | null
  admin_notes: string | null
  raw_payload: unknown
  created_at: string
  records?: ImportRecord[]
}

export interface ImportRecord {
  id: string
  batch_id: string
  raw_supplier_name: string | null
  raw_yard_address: string | null
  raw_yard_city: string | null
  raw_yard_state: string | null
  raw_yard_zip: string | null
  raw_yard_phone: string | null
  raw_material_name: string | null
  raw_price: string | null
  raw_unit: string | null
  raw_min_order: string | null
  raw_notes: string | null
  raw_data: unknown
  status: ImportStatus
  rejection_reason: string | null
  resolved_supplier_id: string | null
  resolved_yard_id: string | null
  resolved_catalog_id: string | null
  resolved_offering_id: string | null
  parsed_price: number | null
  parsed_unit: MaterialUnit | null
  parsed_min_quantity: number | null
  reviewed_by: string | null
  reviewed_at: string | null
  admin_notes: string | null
  created_at: string
  updated_at: string
}

// ── Business Logic Types ──────────────────────────────────────

export interface DeliveryAddressSnapshot {
  street_line_1: string
  street_line_2?: string
  city: string
  state: string
  zip: string
  lat?: number
  lng?: number
  delivery_notes?: string
}

export interface ResolvedFulfillment {
  market_material: MarketMaterial
  pool_entry: MarketSupplyPool
  offering: SupplierOffering
  supply_yard: SupplyYard
  supplier: Supplier
}

export interface PriceQuote {
  market_material_id: string
  offering_id: string
  quantity: number
  unit: MaterialUnit
  price_per_unit: number
  subtotal: number
  delivery_fee: number
  platform_fee: number
  promotion_discount: number
  tax_amount: number
  total_amount: number
  promotion_id: string | null
  promotion_title: string | null
  fulfillment_method: FulfillmentMethod
  delivery_type: DeliveryType
  line_items: QuoteLineItem[]
}

export interface QuoteLineItem {
  label: string
  amount: number
  type: 'material' | 'delivery' | 'fee' | 'discount' | 'tax'
}

export interface OrderCreateInput {
  market_material_id: string
  quantity: number
  delivery_type: DeliveryType
  fulfillment_method: FulfillmentMethod
  delivery_address?: DeliveryAddressSnapshot
  saved_address_id?: string
  requested_delivery_date?: string | null
  requested_delivery_window?: string | null
  delivery_notes?: string | null
  distance_miles?: number
}

export type ApiResult<T> =
  | { success: true; data: T }
  | { success: false; error: string; code?: string }

// ── Display / View Types ──────────────────────────────────────

/** What the customer marketplace renders from. Computed server-side. */
export interface MarketMaterialCard {
  market_material_id: string
  material_catalog_id: string
  slug: string
  name: string
  description: string | null
  image_url: string | null
  category_name: string
  category_slug: string
  unit: MaterialUnit
  display_price: number
  price_display_mode: PriceDisplayMode
  minimum_order_quantity: number
  delivery_fee_base: number | null
  is_featured: boolean
  is_deal_of_day: boolean
  badge_label: string | null
  promotion_id: string | null
}

export interface OrderStatusConfig {
  label: string
  badgeClass: string
  description: string
}

export const ORDER_STATUS_CONFIG: Record<OrderStatus, OrderStatusConfig> = {
  pending_payment: { label: 'Awaiting Payment',  badgeClass: 'badge-stone',  description: 'Payment not yet received.' },
  payment_failed:  { label: 'Payment Failed',    badgeClass: 'badge-red',    description: 'Payment could not be processed.' },
  confirmed:       { label: 'Confirmed',          badgeClass: 'badge-amber',  description: 'Order confirmed. Being prepared for dispatch.' },
  dispatched:      { label: 'Out for Delivery',   badgeClass: 'badge-blue',   description: 'Your order is on its way.' },
  delivered:       { label: 'Delivered',          badgeClass: 'badge-green',  description: 'Delivery complete.' },
  cancelled:       { label: 'Cancelled',          badgeClass: 'badge-red',    description: 'Order was cancelled.' },
  refunded:        { label: 'Refunded',           badgeClass: 'badge-stone',  description: 'Refund has been issued.' },
}

export const DELIVERY_WINDOWS = [
  'Morning (7am–12pm)',
  'Afternoon (12pm–5pm)',
  'Anytime',
] as const

export type DeliveryWindow = typeof DELIVERY_WINDOWS[number]
