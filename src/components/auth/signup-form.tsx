'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Loader2 } from 'lucide-react'

export function SignupForm({
  redirectTo,
  prefillEmail,
  prefillFirstName,
  prefillLastName,
}: {
  redirectTo?: string
  prefillEmail?: string
  prefillFirstName?: string
  prefillLastName?: string
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [form, setForm] = useState({
    first_name: prefillFirstName ?? '',
    last_name:  prefillLastName  ?? '',
    company_name: '',
    email:      prefillEmail     ?? '',
    password:   '',
  })
  const [error, setError] = useState<string | null>(null)

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(p => ({ ...p, [k]: e.target.value }))

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (form.password.length < 8) { setError('Password must be at least 8 characters.'); return }

    startTransition(async () => {
      const supabase = createClient()
      const { error: signUpError } = await supabase.auth.signUp({
        email: form.email,
        password: form.password,
        options: { data: { first_name: form.first_name, last_name: form.last_name } },
      })
      if (signUpError) { setError(signUpError.message); return }

      if (form.company_name) {
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
          await supabase.from('profiles').update({ company_name: form.company_name }).eq('id', user.id)
        }
      }

      // Honor the post-signup destination (e.g. back to the product page they
      // were trying to check out from). Falls back to /browse.
      router.push(redirectTo ?? '/dashboard')
      router.refresh()
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="input-label">First name</label>
          <input type="text" required className="input" placeholder="John" value={form.first_name} onChange={set('first_name')} />
        </div>
        <div>
          <label className="input-label">Last name</label>
          <input type="text" required className="input" placeholder="Smith" value={form.last_name} onChange={set('last_name')} />
        </div>
      </div>
      <div>
        <label className="input-label">Company <span className="text-gray-400">(optional)</span></label>
        <input type="text" className="input" placeholder="Smith Construction LLC" value={form.company_name} onChange={set('company_name')} />
      </div>
      <div>
        <label className="input-label">Email</label>
        <input type="email" required autoComplete="email" className="input" placeholder="you@example.com" value={form.email} onChange={set('email')} />
      </div>
      <div>
        <label className="input-label">Password</label>
        <input type="password" required minLength={8} autoComplete="new-password" className="input" placeholder="Min. 8 characters" value={form.password} onChange={set('password')} />
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">{error}</div>
      )}

      <button type="submit" disabled={isPending} className="btn-primary btn-lg w-full mt-2">
        {isPending ? <><Loader2 size={16} className="animate-spin" /> Creating account…</> : 'Create Account'}
      </button>
      <p className="text-xs text-center text-gray-400">
        By signing up you agree to our Terms of Service and Privacy Policy.
      </p>
    </form>
  )
}
