export default function AdminLoading() {
  return (
    <div className="p-8 space-y-6">
      <div className="skeleton h-8 w-48 rounded-lg" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="card p-5 space-y-2">
            <div className="skeleton h-3 w-24 rounded" />
            <div className="skeleton h-7 w-32 rounded" />
            <div className="skeleton h-3 w-20 rounded" />
          </div>
        ))}
      </div>
      <div className="card">
        <div className="px-6 py-4 border-b border-gray-100">
          <div className="skeleton h-5 w-32 rounded" />
        </div>
        <div className="divide-y divide-gray-100">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 px-6 py-4">
              <div className="skeleton h-4 w-32 rounded" />
              <div className="skeleton h-4 w-24 rounded" />
              <div className="skeleton h-4 w-40 rounded flex-1" />
              <div className="skeleton h-5 w-20 rounded" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
