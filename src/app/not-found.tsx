import Link from 'next/link'
import { Logo } from '@/components/logo'

export default function NotFound() {
  return (
    <div className="em-surface min-h-screen flex flex-col items-center justify-center px-4 text-center">
      <div className="mb-8 opacity-40">
        <Logo variant="mark" size={36} />
      </div>
      <h1 className="text-5xl font-black text-gray-200 mb-4">404</h1>
      <p className="text-gray-600 font-medium mb-2">Page not found</p>
      <p className="text-gray-400 text-sm max-w-sm mb-8">
        This page doesn't exist. The material may have been removed or the link is incorrect.
      </p>
      <Link href="/browse" className="btn-primary btn-lg">Browse Materials</Link>
    </div>
  )
}
