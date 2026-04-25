'use client'

export function StaffingScreenOut() {
  return (
    <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
      <h3 className="text-base font-bold text-stone-900 mb-2">This is a wage claim, not a lien claim.</h3>
      <p className="text-sm text-stone-700 leading-relaxed">
        If a staffing agency or payroll company hasn&rsquo;t paid you, your recourse is a wage claim with your state&rsquo;s labor department, not a mechanic&rsquo;s lien.
      </p>
      <ul className="mt-3 space-y-2 text-sm text-stone-700">
        <li>
          <span className="font-semibold text-stone-900">Colorado:</span> Colorado Department of Labor and Employment, Division of Labor Standards and Statistics. File at{' '}
          <a href="https://cdle.colorado.gov" target="_blank" rel="noopener noreferrer" className="text-emerald-700 hover:text-emerald-800 underline">
            cdle.colorado.gov
          </a>.
        </li>
        <li>
          <span className="font-semibold text-stone-900">Texas:</span> Texas Workforce Commission Wage and Hour Department. File at{' '}
          <a href="https://twc.texas.gov" target="_blank" rel="noopener noreferrer" className="text-emerald-700 hover:text-emerald-800 underline">
            twc.texas.gov
          </a>.
        </li>
      </ul>
      <p className="text-sm text-stone-700 leading-relaxed mt-3">
        Wage claims are typically free to file and have shorter timelines than civil suits. We&rsquo;re not the right tool here.
      </p>
    </div>
  )
}
