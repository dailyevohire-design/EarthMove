export default function BrowseLoading() {
  return (
    <div className="container-main py-8">
      <div className="mb-6">
        <div className="skeleton h-8 w-48 rounded-lg mb-2" />
        <div className="skeleton h-4 w-64 rounded" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="card">
            <div className="skeleton aspect-[16/11] rounded-t-xl" />
            <div className="p-4 space-y-3">
              <div className="skeleton h-3 w-16 rounded" />
              <div className="skeleton h-4 w-full rounded" />
              <div className="skeleton h-4 w-3/4 rounded" />
              <div className="skeleton h-5 w-24 rounded mt-2" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
