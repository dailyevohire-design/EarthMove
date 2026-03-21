import Link from 'next/link'
import { Mountain } from 'lucide-react'

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 text-center bg-stone-950">
      <div className="w-16 h-16 bg-stone-800 rounded-2xl flex items-center justify-center mb-6 border border-stone-700">
        <Mountain size={28} className="text-stone-500" />
      </div>
      <h1 className="text-5xl font-black text-stone-800 mb-4">404</h1>
      <p className="text-stone-400 font-medium mb-2">Page not found</p>
      <p className="text-stone-600 text-sm max-w-sm mb-8">
        This page doesn't exist. The material may have been removed or the link is incorrect.
      </p>
      <Link href="/browse" className="btn-primary btn-lg">Browse Materials</Link>
    </div>
  )
}
