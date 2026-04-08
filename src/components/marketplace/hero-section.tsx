'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowRight, Truck, CheckCircle2, ShieldCheck, Clock } from 'lucide-react'
import { HeroZipPicker } from './hero-zip-picker'

interface HeroProps {
  marketCount: number
  marketName: string | null
  marketState: string | null
}

export function HeroSection({ marketCount, marketName, marketState }: HeroProps) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  return (
    <section className="relative overflow-hidden min-h-[600px] md:min-h-[680px] flex flex-col justify-center">
      {/* === LAYER 1: Base gradient === */}
      <div
        className="absolute inset-0"
        style={{ background: 'linear-gradient(135deg, #0a1628 0%, #0d2137 50%, #091a0e 100%)' }}
      />

      {/* === LAYER 2: Color orbs === */}
      <div className="absolute inset-0" style={{
        background: 'radial-gradient(ellipse at 20% 50%, rgba(16,185,129,0.08) 0%, transparent 60%), radial-gradient(ellipse at 80% 20%, rgba(245,158,11,0.06) 0%, transparent 50%)'
      }} />

      {/* === LAYER 3: Grid lines (hidden mobile) === */}
      <div className="absolute inset-0 hidden md:block" style={{
        backgroundImage: 'linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)',
        backgroundSize: '60px 60px',
      }} />

      {/* === LAYER 4: Large glowing orb bottom-right === */}
      <div className="absolute bottom-[-200px] right-[-100px] w-[600px] h-[600px] rounded-full hidden md:block" style={{
        background: 'radial-gradient(circle, rgba(16,185,129,0.12) 0%, transparent 70%)',
        filter: 'blur(80px)',
      }} />

      {/* === LAYER 5: Top-right accent circles === */}
      <div className="absolute top-20 right-20 hidden lg:block">
        <div className="relative">
          <div className="w-32 h-32 rounded-full absolute" style={{ background: 'rgba(245,158,11,0.06)' }} />
          <div className="w-24 h-24 rounded-full absolute top-8 left-8" style={{ background: 'rgba(245,158,11,0.05)' }} />
          <div className="w-16 h-16 rounded-full absolute top-4 left-16" style={{ background: 'rgba(16,185,129,0.06)' }} />
        </div>
      </div>

      {/* === LAYER 6: Animated particles (hidden mobile) === */}
      {mounted && (
        <div className="absolute inset-0 hidden md:block motion-reduce:hidden">
          {PARTICLES.map((p, i) => (
            <div
              key={i}
              className="absolute rounded-full"
              style={{
                width: p.size,
                height: p.size,
                left: p.x,
                top: p.y,
                background: p.color,
                animation: `float-particle ${p.duration}s ease-in-out infinite ${p.delay}s`,
                opacity: 0.6,
              }}
            />
          ))}
        </div>
      )}

      {/* === CONTENT === */}
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
        {/* Ticker */}
        <div className="overflow-hidden mb-8 -mx-4 sm:-mx-6 lg:-mx-8">
          <div className="flex whitespace-nowrap animate-ticker">
            {[1, 2].map(n => (
              <div key={n} className="flex items-center gap-8 mr-8 text-emerald-400/80 text-sm font-medium">
                <span>⚡ Fill Dirt from $12/ton</span>
                <span className="text-white/20">·</span>
                <span>🚛 Same-day delivery</span>
                <span className="text-white/20">·</span>
                <span>🏗️ Flex Base from $24/ton</span>
                <span className="text-white/20">·</span>
                <span>✅ 7,000+ suppliers</span>
                <span className="text-white/20">·</span>
                <span>🌿 Topsoil from $45/yd</span>
                <span className="text-white/20">·</span>
                <span>📍 {marketCount} cities nationwide</span>
                <span className="text-white/20">·</span>
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-8">
          <div className="max-w-2xl">
            {/* ZIP picker (replaces static "Delivering to X" pill) */}
            <HeroZipPicker currentMarketName={marketName} currentMarketState={marketState} />

            {/* Green accent line */}
            <div className="w-20 h-0.5 mb-6" style={{ background: 'rgba(16,185,129,0.6)' }} />

            {/* Headline */}
            <h1 className="text-[48px] sm:text-[64px] md:text-[80px] font-black text-white leading-[1.05] tracking-tight">
              Order materials.
              <br />
              <span className="text-emerald-400" style={{ textShadow: '0 0 40px rgba(16,185,129,0.4)' }}>
                We deliver.
              </span>
            </h1>

            {/* Subtitle */}
            <p className="text-lg md:text-xl mt-6 max-w-lg leading-relaxed" style={{ color: 'rgba(255,255,255,0.7)' }}>
              Fill dirt, gravel, sand, topsoil, road base — ordered in minutes, delivered same-day to your job site.
            </p>

            {/* CTAs */}
            <div className="flex flex-col sm:flex-row gap-3 mt-8">
              <Link href="/browse" className="btn-primary btn-xl text-base shadow-2xl shadow-emerald-500/25">
                Browse Materials <ArrowRight size={18} />
              </Link>
              <Link href="/material-match" className="btn bg-white/[0.08] text-white border border-white/[0.15] hover:bg-white/[0.15] btn-xl text-base backdrop-blur-sm">
                Find My Material →
              </Link>
            </div>
          </div>

          {/* Floating delivery badge (hidden on small mobile) */}
          <div className="hidden sm:block lg:mb-4">
            <div className="bg-white rounded-2xl shadow-2xl p-4 animate-float-badge">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-emerald-50 flex items-center justify-center flex-shrink-0">
                  <Truck size={20} className="text-emerald-600" />
                </div>
                <div>
                  <div className="text-gray-500 text-xs font-medium">Next delivery</div>
                  <div className="text-emerald-600 text-lg font-extrabold leading-tight">Today by 5pm</div>
                </div>
                <div className="ml-2 flex-shrink-0">
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Stats bar */}
        <div className="mt-12 pt-6 flex flex-wrap gap-8 text-sm" style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}>
          <div className="flex items-center gap-2.5" style={{ color: 'rgba(255,255,255,0.6)' }}>
            <CheckCircle2 size={17} className="text-emerald-400" />
            <span className="font-medium">{marketCount} markets</span>
          </div>
          <div className="flex items-center gap-2.5" style={{ color: 'rgba(255,255,255,0.6)' }}>
            <Truck size={17} className="text-emerald-400" />
            <span className="font-medium">Same-day delivery</span>
          </div>
          <div className="flex items-center gap-2.5" style={{ color: 'rgba(255,255,255,0.6)' }}>
            <ShieldCheck size={17} className="text-emerald-400" />
            <span className="font-medium">Secure checkout</span>
          </div>
          <div className="flex items-center gap-2.5" style={{ color: 'rgba(255,255,255,0.6)' }}>
            <Clock size={17} className="text-emerald-400" />
            <span className="font-medium">Order in 5 min</span>
          </div>
        </div>
      </div>

      {/* Keyframes injected via style tag */}
      <style jsx>{`
        @keyframes float-particle {
          0%, 100% { transform: translate(0, 0); opacity: 0.4; }
          25% { transform: translate(10px, -15px); opacity: 0.7; }
          50% { transform: translate(-5px, -25px); opacity: 0.5; }
          75% { transform: translate(15px, -10px); opacity: 0.6; }
        }
        .animate-ticker {
          animation: ticker 30s linear infinite;
        }
        @keyframes ticker {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .animate-float-badge {
          animation: float-badge 4s ease-in-out infinite;
        }
        @keyframes float-badge {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-8px); }
        }
        @media (prefers-reduced-motion: reduce) {
          .animate-ticker, .animate-float-badge { animation: none; }
        }
      `}</style>
    </section>
  )
}

// 20 particles with random positions
const PARTICLES = Array.from({ length: 20 }, (_, i) => ({
  x: `${5 + (i * 4.7) % 90}%`,
  y: `${10 + ((i * 7.3 + 13) % 80)}%`,
  size: `${2 + (i % 3) * 2}px`,
  color: i % 3 === 0 ? 'rgba(245,158,11,0.4)' : 'rgba(16,185,129,0.5)',
  duration: 6 + (i % 4) * 2,
  delay: (i % 5) * 1.2,
}))
