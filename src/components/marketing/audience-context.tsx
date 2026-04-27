'use client'

import { createContext, useContext, useState, type ReactNode } from 'react'

export type Audience = 'contractor' | 'homeowner'

type AudienceCtx = {
  audience: Audience
  setAudience: (a: Audience) => void
}

const Ctx = createContext<AudienceCtx | null>(null)

export function AudienceProvider({ children }: { children: ReactNode }) {
  const [audience, setAudience] = useState<Audience>('contractor')
  return <Ctx.Provider value={{ audience, setAudience }}>{children}</Ctx.Provider>
}

export function useAudience(): AudienceCtx {
  const v = useContext(Ctx)
  if (!v) throw new Error('useAudience must be used inside <AudienceProvider>')
  return v
}
