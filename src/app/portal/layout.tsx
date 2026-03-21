import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Mountain, Package, ShoppingCart, LogOut } from 'lucide-react'

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, portal_enabled, supplier_id, first_name')
    .eq('id', user.id)
    .single()

  if (!profile || profile.role !== 'supplier' || !profile.portal_enabled) {
    redirect('/')
  }

  const { data: supplier } = await supabase
    .from('suppliers')
    .select('name')
    .eq('id', profile.supplier_id)
    .single()

  return (
    <div className="min-h-screen flex bg-white">
      {/* Sidebar */}
      <aside className="w-56 flex-shrink-0 border-r border-gray-200 flex flex-col bg-gray-50 sticky top-0 h-screen">
        <div className="h-16 flex items-center px-5 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-emerald-600 rounded-md flex items-center justify-center">
              <Mountain size={13} className="text-white" />
            </div>
            <div>
              <div className="text-xs font-black text-gray-900 leading-tight truncate max-w-[130px]">
                {supplier?.name ?? 'Supplier Portal'}
              </div>
              <div className="text-[10px] text-emerald-600">Supplier Portal</div>
            </div>
          </div>
        </div>

        <nav className="flex-1 px-2.5 py-4 space-y-0.5">
          <PortalLink href="/portal" icon={<Package size={14} />} label="My Offerings" />
          <PortalLink href="/portal/orders" icon={<ShoppingCart size={14} />} label="My Orders" />
        </nav>

        <div className="px-2.5 py-4 border-t border-gray-200">
          <Link
            href="/"
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-gray-500 hover:bg-gray-100 hover:text-red-600 transition-colors"
          >
            <LogOut size={13} /> Sign out
          </Link>
        </div>
      </aside>

      <main className="flex-1 min-w-0 overflow-auto bg-gray-50/50">{children}</main>
    </div>
  )
}

function PortalLink({ href, icon, label }: { href: string; icon: React.ReactNode; label: string }) {
  return (
    <Link
      href={href}
      className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-500 hover:bg-gray-100 hover:text-gray-900 transition-all"
    >
      <span className="text-gray-400">{icon}</span>
      {label}
    </Link>
  )
}
