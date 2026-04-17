import { z } from 'zod'

export const Step1Schema = z.object({
  material_catalog_id: z.string().uuid(),
  material_name: z.string().optional(),
  material_slug: z.string().optional(),
  default_unit: z.enum(['ton', 'cuyd']).optional(),
})

export const Step2Schema = z.object({
  quantity: z.number().positive(),
  unit: z.enum(['ton', 'cuyd']),
})

export const Step3Schema = z.object({
  supplier_offering_id: z.string().uuid(),
  supply_yard_id: z.string().uuid(),
  supplier_id: z.string().uuid(),
  supplier_name: z.string(),
  yard_name: z.string().optional().nullable(),
  price_per_unit: z.number().nonnegative(),
  delivery_fee: z.number().nonnegative().optional().nullable(),
})

export const Step4Schema = z.object({
  delivery_address_id: z.string().uuid(),
  project_id: z.string().uuid().optional().nullable(),
  requested_delivery_date: z.string().optional().nullable(),   // YYYY-MM-DD
  delivery_notes: z.string().max(1000).optional().nullable(),
})

export const Step5Schema = z.object({
  total_amount_preview: z.number().nonnegative().optional(),
  acknowledged: z.boolean().default(false),
})

export const OrderDraftPayloadSchema = z.object({
  step1: Step1Schema.optional(),
  step2: Step2Schema.optional(),
  step3: Step3Schema.optional(),
  step4: Step4Schema.optional(),
  step5: Step5Schema.optional(),
}).strict()

export type OrderDraftPayload = z.infer<typeof OrderDraftPayloadSchema>

export function highestCompleteStep(p: OrderDraftPayload): 1 | 2 | 3 | 4 | 5 {
  if (p.step5?.acknowledged) return 5
  if (p.step4?.delivery_address_id) return 5
  if (p.step3?.supplier_offering_id) return 4
  if (p.step2?.quantity && p.step2.quantity > 0) return 3
  if (p.step1?.material_catalog_id) return 2
  return 1
}

export function canAdvance(p: OrderDraftPayload, fromStep: number): boolean {
  switch (fromStep) {
    case 1: return Step1Schema.safeParse(p.step1).success
    case 2: return Step2Schema.safeParse(p.step2).success
    case 3: return Step3Schema.safeParse(p.step3).success
    case 4: return Step4Schema.safeParse(p.step4).success
    case 5: return !!p.step5?.acknowledged
    default: return false
  }
}
