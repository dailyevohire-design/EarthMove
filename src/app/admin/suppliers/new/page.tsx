import { NewSupplierForm } from '@/components/admin/new-supplier-form'
import Link from 'next/link'

export const metadata = { title: 'New Supplier — Admin' }

export default function NewSupplierPage() {
  return (
    <div className="p-8 max-w-2xl">
      <div className="flex items-center gap-2 mb-8 text-sm text-stone-500">
        <Link href="/admin/suppliers" className="hover:text-stone-300 transition-colors">Suppliers</Link>
        <span>/</span>
        <span className="text-stone-400">New</span>
      </div>
      <h1 className="text-2xl font-bold text-stone-100 mb-8">Add Supplier</h1>
      <NewSupplierForm />
    </div>
  )
}
