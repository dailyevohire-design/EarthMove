'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { DashboardState } from './types'
import { buildInitial } from './seed'

const DEBOUNCE_MS = 400
const TABLE = 'dashboard_state'

type Updater = DashboardState | ((prev: DashboardState) => DashboardState)

export interface UseDashboardStateResult {
  data: DashboardState
  setData: (u: Updater) => void
  saving: boolean
  lastSaved: string | null
  error: string | null
}

export function useDashboardState(
  userId: string,
  initial: DashboardState,
  initialUpdatedAt: string | null,
): UseDashboardStateResult {
  const [data, setDataState] = useState<DashboardState>(initial)
  const [saving, setSaving] = useState(false)
  const [lastSaved, setLastSaved] = useState<string | null>(initialUpdatedAt)
  const [error, setError] = useState<string | null>(null)

  const supabaseRef = useRef<ReturnType<typeof createClient> | null>(null)
  if (supabaseRef.current === null) supabaseRef.current = createClient()

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const latestRef = useRef<DashboardState>(initial)
  const inFlightRef = useRef<Promise<void> | null>(null)
  const pendingRef = useRef<boolean>(false)
  const skipFirstFlush = useRef<boolean>(true)

  const flush = useCallback(async () => {
    const supabase = supabaseRef.current
    if (!supabase) return
    if (inFlightRef.current) { pendingRef.current = true; return }

    const snapshot = latestRef.current
    setSaving(true)
    setError(null)

    const promise = (async () => {
      const { error: upsertError } = await supabase
        .from(TABLE)
        .upsert({ user_id: userId, state: snapshot }, { onConflict: 'user_id' })
      if (upsertError) {
        setError(upsertError.message)
        return
      }
      setLastSaved(new Date().toISOString())
    })()

    inFlightRef.current = promise
    try {
      await promise
    } finally {
      inFlightRef.current = null
      setSaving(false)
      if (pendingRef.current) {
        pendingRef.current = false
        void flush()
      }
    }
  }, [userId])

  const scheduleFlush = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => { void flush() }, DEBOUNCE_MS)
  }, [flush])

  const setData = useCallback((u: Updater) => {
    setDataState(prev => {
      const next = typeof u === 'function' ? (u as (p: DashboardState) => DashboardState)(prev) : u
      latestRef.current = next
      return next
    })
    scheduleFlush()
  }, [scheduleFlush])

  // Ensure a row exists on first mount when the SSR fetch found nothing.
  // Use upsert (not insert) so a concurrent debounced flush can't lose the race.
  useEffect(() => {
    if (initialUpdatedAt !== null) { skipFirstFlush.current = false; return }
    const supabase = supabaseRef.current
    if (!supabase) return
    void (async () => {
      const seed = buildInitial()
      const { error: upsertError } = await supabase
        .from(TABLE)
        .upsert({ user_id: userId, state: seed }, { onConflict: 'user_id' })
      if (upsertError) {
        setError(upsertError.message)
        return
      }
      setLastSaved(new Date().toISOString())
      skipFirstFlush.current = false
    })()
  }, [initialUpdatedAt, userId])

  // Flush any pending timer on unmount.
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [])

  return { data, setData, saving, lastSaved, error }
}
