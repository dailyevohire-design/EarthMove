import Link from 'next/link'
import { Logo } from '@/components/layout/logo'
import { LoginForm } from '@/components/auth/login-form'

export const metadata = { title: 'Sign In' }

interface Props { searchParams: Promise<{ redirectTo?: string }> }

export default async function LoginPage({ searchParams }: Props) {
  const { redirectTo } = await searchParams
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-16 bg-gray-50">
      <div className="w-full max-w-sm">
        <div className="flex justify-center mb-10">
          <Logo />
        </div>

        <div className="card p-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-1">Welcome back</h1>
          <p className="text-gray-500 text-sm mb-8">Sign in to your account</p>
          <LoginForm redirectTo={redirectTo} />
        </div>

        <p className="text-center text-gray-500 text-sm mt-6">
          Don't have an account?{' '}
          <Link href="/signup" className="text-emerald-600 hover:text-emerald-700 font-medium transition-colors">
            Create one free
          </Link>
        </p>
      </div>
    </div>
  )
}
