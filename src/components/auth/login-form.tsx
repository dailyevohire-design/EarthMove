'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Loader2, Eye, EyeOff } from 'lucide-react'

export function LoginForm({ redirectTo }: { redirectTo?: string }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    startTransition(async () => {
      const { error } = await createClient().auth.signInWithPassword({ email, password })
      if (error) {
        setError('Invalid email or password.')
        return
      }
      router.push(redirectTo ?? '/browse')
      router.refresh()
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <label htmlFor="email" className="input-label">Email</label>
        <input
          id="email" type="email" required autoComplete="email"
          className="input" placeholder="you@example.com"
          value={email} onChange={e => setEmail(e.target.value)}
        />
      </div>
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label htmlFor="password" className="input-label mb-0">Password</label>
          <Link href="/forgot-password" className="text-xs text-amber-400 hover:text-amber-300 transition-colors">Forgot?</Link>
        </div>
        <div className="relative">
          <input
            id="password" type={showPw ? 'text' : 'password'} required
            autoComplete="current-password" className="input pr-10"
            placeholder="••••••••"
            value={password} onChange={e => setPassword(e.target.value)}
          />
          <button
            type="button" onClick={() => setShowPw(v => !v)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-500 hover:text-stone-300 transition-colors"
          >
            {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
          </button>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-sm text-red-400">
          {error}
        </div>
      )}

      <button type="submit" disabled={isPending} className="btn-primary btn-lg w-full">
        {isPending ? <><Loader2 size={16} className="animate-spin" /> Signing in…</> : 'Sign In'}
      </button>
    </form>
  )
}

// tiny local import — avoids circular dep
import Link from 'next/link'
