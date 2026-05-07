'use client'

import { useState } from 'react'
import Link from 'next/link'
import '@/app/marketing-v3.css'

const ROLES = [
  { id: 'homeowner', label: 'Homeowner' },
  { id: 'contractor', label: 'Contractor' },
  { id: 'driver', label: 'Driver / Hauler' },
  { id: 'supplier', label: 'Supplier / Yard' },
  { id: 'other', label: 'Other' },
] as const

type Role = (typeof ROLES)[number]['id']

export function ContactClient() {
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<Role>('contractor')
  const [subject, setSubject] = useState('')
  const [message, setMessage] = useState('')
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const valid =
    fullName.trim().length > 0 &&
    /\S+@\S+\.\S+/.test(email) &&
    subject.trim().length > 1 &&
    message.trim().length > 1

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!valid || status === 'sending') return
    setStatus('sending')
    setErrorMsg(null)
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fullName, email, role, subject, message }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        setStatus('error')
        setErrorMsg(json?.error ?? 'Something went wrong. Please try again.')
        return
      }
      setStatus('sent')
    } catch {
      setStatus('error')
      setErrorMsg('Network error. Please try again or email ops@earthmove.io directly.')
    }
  }

  return (
    <div className="marketing-v3">
      <div className="v3-contact-page">
        <header className="v3-contact-hdr">
          <Link href="/" className="v3-contact-brand" aria-label="Earthmove home">
            <svg width="146" height="22" viewBox="0 0 200 36" fill="none" aria-hidden>
              <rect x="0" y="6" width="22" height="3.4" fill="currentColor" />
              <rect x="0" y="16.3" width="18" height="3.4" fill="currentColor" />
              <rect x="0" y="26.6" width="22" height="3.4" fill="currentColor" />
              <text
                x="28"
                y="28"
                fontFamily='"Inter", system-ui, sans-serif'
                fontSize="26"
                fontWeight="600"
                letterSpacing="-0.02em"
                fill="currentColor"
              >
                arthmove
              </text>
            </svg>
          </Link>
          <Link href="/" className="v3-contact-back">← Back to home</Link>
        </header>

        <main className="v3-contact-main">
          <section className="v3-contact-intro">
            <div className="v3-contact-eyebrow">— CONTACT</div>
            <h1 className="v3-contact-h">
              Get in touch.<br />
              <em>We reply same-day.</em>
            </h1>
            <p className="v3-contact-lede">
              Pick the role that fits and tell us what you need. We route every
              message to the right operator — no auto-responders, no chatbots.
              For order-level questions, our ops team monitors the inbox
              Monday–Friday, 5a–8p Mountain / Central.
            </p>
            <div className="v3-contact-quick">
              <a href="mailto:ops@earthmove.io" className="v3-contact-quick-row">
                <span className="k">Ops &amp; dispatch</span>
                <span className="v">ops@earthmove.io</span>
              </a>
              <a href="mailto:support@earthmove.io" className="v3-contact-quick-row">
                <span className="k">Account &amp; orders</span>
                <span className="v">support@earthmove.io</span>
              </a>
              <a href="tel:+18885553478" className="v3-contact-quick-row">
                <span className="k">Phone (M–F · 5a–8p MT/CT)</span>
                <span className="v">(888) 555-DIRT</span>
              </a>
            </div>
          </section>

          <section className="v3-contact-form-wrap">
            {status === 'sent' ? (
              <div className="v3-contact-success">
                <div className="v3-contact-eyebrow">— SENT</div>
                <h2 className="v3-contact-h2">Message received.</h2>
                <p>
                  Thanks {fullName.split(' ')[0] || 'for reaching out'} — a real
                  human will reply to <b>{email}</b> within one business day.
                </p>
                <Link href="/" className="v3-cta">Back to home</Link>
              </div>
            ) : (
              <form className="v3-contact-form" onSubmit={onSubmit} noValidate>
                <div className="v3-contact-eyebrow">— SEND A MESSAGE</div>
                <h2 className="v3-contact-h2">Tell us about you.</h2>

                <div className="v3-contact-row">
                  <label className="v3-contact-field">
                    <span className="lbl">Full name</span>
                    <input
                      type="text"
                      autoComplete="name"
                      maxLength={120}
                      required
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="Jane Operator"
                    />
                  </label>
                  <label className="v3-contact-field">
                    <span className="lbl">Email</span>
                    <input
                      type="email"
                      autoComplete="email"
                      maxLength={160}
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@company.com"
                      inputMode="email"
                    />
                  </label>
                </div>

                <div className="v3-contact-field">
                  <span className="lbl">I am a…</span>
                  <div className="v3-contact-roles" role="radiogroup" aria-label="Role">
                    {ROLES.map((r) => (
                      <button
                        type="button"
                        key={r.id}
                        role="radio"
                        aria-checked={role === r.id}
                        className={'v3-contact-role' + (role === r.id ? ' on' : '')}
                        onClick={() => setRole(r.id)}
                      >
                        {r.label}
                      </button>
                    ))}
                  </div>
                </div>

                <label className="v3-contact-field">
                  <span className="lbl">Subject</span>
                  <input
                    type="text"
                    maxLength={180}
                    required
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder="Project pricing for a 200t fill order"
                  />
                </label>

                <label className="v3-contact-field">
                  <span className="lbl">Message</span>
                  <textarea
                    rows={6}
                    maxLength={4000}
                    required
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Tell us what you need — material, ZIP, tonnage, timing. Attach files later via reply."
                  />
                </label>

                {status === 'error' && errorMsg ? (
                  <div className="v3-contact-error" role="alert">{errorMsg}</div>
                ) : null}

                <div className="v3-contact-actions">
                  <button
                    type="submit"
                    className="v3-cta"
                    disabled={!valid || status === 'sending'}
                  >
                    {status === 'sending' ? 'Sending…' : 'Send message'}
                    <svg width="16" height="16" viewBox="0 0 18 18" fill="none">
                      <path d="M3 9h12M11 5l4 4-4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>
                  <span className="v3-contact-fineprint">
                    By sending, you agree to our <Link href="/terms">Terms</Link> and <Link href="/privacy">Privacy Policy</Link>.
                  </span>
                </div>
              </form>
            )}
          </section>
        </main>
      </div>
    </div>
  )
}
