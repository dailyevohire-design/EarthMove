import type { Config } from 'tailwindcss'

const config: Config = {
  darkMode: ['class'],
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-sans)', 'sans-serif'],
        mono: ['var(--font-mono)', 'monospace'],
        display: ['var(--font-bricolage)', 'Bricolage Grotesque', 'serif'],
        body: ['var(--font-geist)', 'Geist', 'ui-sans-serif', 'sans-serif'],
        fraunces: ['var(--font-fraunces)', 'Iowan Old Style', 'Georgia', 'serif'],
        inter:    ['var(--font-inter)', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
      },
      colors: {
        // shadcn-compat — primitives in commit 2 read these via bg-background etc.
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        // EarthMove canonical — direct utilities like bg-em-cream, text-em-ink
        commerce: {
          cream: 'var(--commerce-cream)',
          'cream-2': 'var(--commerce-cream-2)',
          'cream-3': 'var(--commerce-cream-3)',
          'cream-warm': 'var(--commerce-cream-warm)',
          'cream-trust': 'var(--commerce-cream-trust)',
          ink: 'var(--commerce-ink)',
          'ink-2': 'var(--commerce-ink-2)',
          'ink-3': 'var(--commerce-ink-3)',
          line: 'var(--commerce-line)',
          'line-strong': 'var(--commerce-line-strong)',
          'line-trust': 'var(--commerce-line-trust)',
          brand: 'var(--commerce-brand)',
          'brand-2': 'var(--commerce-brand-2)',
          'brand-3': 'var(--commerce-brand-3)',
          'brand-soft': 'var(--commerce-brand-soft)',
          action: 'var(--commerce-action)',
          'action-hover': 'var(--commerce-action-hover)',
          'action-soft': 'var(--commerce-action-soft)',
          'trust-mark': 'var(--commerce-trust-mark)',
          'trust-mark-soft': 'var(--commerce-trust-mark-soft)',
        },
      },
      borderRadius: {
        'commerce-sm': 'var(--commerce-r-sm)',
        'commerce-md': 'var(--commerce-r-md)',
        'commerce-lg': 'var(--commerce-r-lg)',
        'commerce-xl': 'var(--commerce-r-xl)',
        'commerce-2xl': 'var(--commerce-r-2xl)',
        'commerce-3xl': 'var(--commerce-r-3xl)',
        'commerce-4xl': 'var(--commerce-r-4xl)',
        'commerce-5xl': 'var(--commerce-r-5xl)',
      },
      boxShadow: {
        'commerce-flat': 'var(--commerce-shadow-flat)',
        'commerce-elevated': 'var(--commerce-shadow-elevated)',
        'commerce-floating': 'var(--commerce-shadow-floating)',
        'commerce-cta': 'var(--commerce-shadow-cta)',
        'commerce-ops': 'var(--commerce-shadow-ops)',
      },
      transitionTimingFunction: {
        'commerce-out': 'var(--commerce-ease-out)',
        'commerce-in-out': 'var(--commerce-ease-in-out)',
        'commerce-spring': 'var(--commerce-ease-spring)',
      },
      transitionDuration: {
        'commerce-fast': 'var(--commerce-dur-fast)',
        'commerce-base': 'var(--commerce-dur-base)',
        'commerce-slow': 'var(--commerce-dur-slow)',
      },
      zIndex: {
        'commerce-base': 'var(--commerce-z-base)',
        'commerce-elevated': 'var(--commerce-z-elevated)',
        'commerce-sticky': 'var(--commerce-z-sticky)',
        'commerce-overlay': 'var(--commerce-z-overlay)',
        'commerce-modal': 'var(--commerce-z-modal)',
      },
      keyframes: {
        'commerce-pulse': {
          '0%, 100%': { boxShadow: '0 0 0 0 rgba(40,199,111,.5)' },
          '50%': { boxShadow: '0 0 0 6px rgba(40,199,111,0)' },
        },
      },
      animation: {
        'commerce-pulse': 'commerce-pulse 1.8s ease-in-out infinite',
      },
    },
  },
  plugins: [
    require('@tailwindcss/typography'),
  ],
}

export default config
