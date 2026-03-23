import Link from 'next/link'

export default function HomePage() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-white">
      <div className="text-center px-4">
        <h1 className="text-5xl font-extrabold text-gray-900 mb-4">EarthMove</h1>
        <p className="text-gray-500 text-lg mb-8">Bulk materials, delivered to your job site.</p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link href="/browse" className="btn-primary btn-xl">Browse Materials</Link>
          <Link href="/learn" className="btn-secondary btn-xl">Learn</Link>
        </div>
      </div>
    </main>
  )
}
