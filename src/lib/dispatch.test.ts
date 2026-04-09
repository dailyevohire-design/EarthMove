// src/lib/dispatch.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock supabase admin client BEFORE importing the module under test
const inserts: Array<{ table: string; row: unknown }> = []
let insertError: unknown = null

vi.mock('@/lib/supabase/server', () => ({
  createAdminClient: () => ({
    from: (table: string) => ({
      insert: (row: unknown) => {
        inserts.push({ table, row })
        return Promise.resolve({ error: insertError })
      },
    }),
  }),
}))

// Avoid the real fulfillment-resolver pulling in db code
vi.mock('./fulfillment-resolver', () => ({
  computePerformanceScore: () => 100,
}))

import { enqueueOrder } from './dispatch'

const baseOrder = {
  id: 'order-1',
  resolved_offering_id: 'off-1',
  supply_yard_id: 'yard-1',
  supplier_id: 'sup-1',
  requested_delivery_date: '2026-04-10',
  requested_delivery_window: 'morning',
} as any

beforeEach(() => {
  inserts.length = 0
  insertError = null
})

describe('enqueueOrder', () => {
  it('inserts a dispatch_queue row snapshotting the order source', async () => {
    await enqueueOrder(baseOrder)

    const dq = inserts.find(i => i.table === 'dispatch_queue')
    expect(dq).toBeDefined()
    expect(dq!.row).toMatchObject({
      order_id: 'order-1',
      original_offering_id: 'off-1',
      assigned_offering_id: 'off-1',
      original_yard_id: 'yard-1',
      assigned_yard_id: 'yard-1',
      original_supplier_id: 'sup-1',
      assigned_supplier_id: 'sup-1',
      status: 'queued',
      target_delivery_date: '2026-04-10',
      target_window: 'morning',
    })
  })

  it('writes a dispatch.queued audit event after insert', async () => {
    await enqueueOrder(baseOrder)
    const audit = inserts.find(i => i.table === 'audit_events')
    expect(audit).toBeDefined()
    expect(audit!.row).toMatchObject({
      event_type: 'dispatch.queued',
      entity_type: 'orders',
      entity_id: 'order-1',
    })
  })

  it('throws when the dispatch_queue insert fails (webhook must observe it)', async () => {
    insertError = { message: 'db down' }
    await expect(enqueueOrder(baseOrder)).rejects.toThrow(
      'Failed to create dispatch queue entry.'
    )
  })

  it('does not write an audit event when the primary insert fails', async () => {
    insertError = { message: 'db down' }
    await expect(enqueueOrder(baseOrder)).rejects.toThrow()
    expect(inserts.find(i => i.table === 'audit_events')).toBeUndefined()
  })
})
