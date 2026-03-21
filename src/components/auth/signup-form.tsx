'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Loader2 } from 'lucide-react'

export function SignupForm() {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [form, setForm] = useState({
    first_name: '', last_name: '', company_name: '', email: '', password: '',
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

      router.push('/browse')
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
        <label className="input-label">Company <span className="text-stone-600">(optional)</span></label>
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
        <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-sm text-red-400">{error}</div>
      )}

      <button type="submit" disabled={isPending} className="btn-primary btn-lg w-full mt-2">
        {isPending ? <><Loader2 size={16} className="animate-spin" /> Creating account…</> : 'Create Account'}
      </button>
      <p className="text-xs text-center text-stone-600">
        By signing up you agree to our Terms of Service and Privacy Policy.
      </p>
    </form>
  )
}
