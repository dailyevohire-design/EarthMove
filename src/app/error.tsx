'use client'

import { useEffect } from 'react'
import { AlertCircle } from 'lucide-react'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => { console.error(error) }, [error])

  return (
    <html lang="en">
      <body className="bg-white text-gray-900 min-h-screen flex flex-col items-center justify-center px-4 text-center">
        <div className="w-16 h-16 bg-red-50 rounded-2xl flex items-center justify-center mb-6">
          <AlertCircle size={28} className="text-red-500" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-3">Something went wrong</h2>
        <p className="text-gray-500 text-sm mb-8 max-w-sm">
          An unexpected error occurred. Our team has been notified.
        </p>
        <button onClick={reset} className="btn-primary btn-lg">Try again</button>
      </body>
    </html>
  )
}
