'use client'

import { createClient } from '@/lib/supabase/client'

export type UiPrefs = {
  glove_mode?: boolean
  dark_mode?: boolean
  offline_mode_shown?: boolean
  last_language?: string
  earnings_moment_seen_count?: number
}

const LS_KEY = 'em-driver-ui-prefs'

export function readLocal(): UiPrefs {
  if (typeof window === 'undefined') return {}
  try { return JSON.parse(localStorage.getItem(LS_KEY) || '{}') } catch { return {} }
}

export function writeLocal(p: UiPrefs) {
  if (typeof window === 'undefined') return
  localStorage.setItem(LS_KEY, JSON.stringify(p))
}

export async function loadFromDb(driverId: string): Promise<UiPrefs> {
  const db = createClient()
  const { data } = await db
    .from('driver_preferences')
    .select('ui_prefs').eq('driver_id', driverId).maybeSingle()
  const prefs = (data?.ui_prefs || {}) as UiPrefs
  writeLocal(prefs)
  return prefs
}

export async function saveToDb(driverId: string, patch: UiPrefs): Promise<UiPrefs> {
  const db = createClient()
  const current = { ...readLocal(), ...patch }
  writeLocal(current)
  await db
    .from('driver_preferences')
    .upsert({ driver_id: driverId, ui_prefs: current }, { onConflict: 'driver_id' })
  return current
}

export function applyBodyClasses(p: UiPrefs) {
  if (typeof document === 'undefined') return
  document.body.classList.toggle('glove', !!p.glove_mode)
  document.body.classList.toggle('dark',  !!p.dark_mode)
}
