'use client'

import { useState, useMemo } from 'react'
import { formatCurrency } from '@/lib/pricing-engine'
import { Calculator, ChevronDown, ArrowDown, Package } from 'lucide-react'

const PROJECT_TYPES = [
  'Driveway',
  'Backfill',
  'Foundation',
  'Landscaping',
  'Raised Bed',
  'Patio/Walkway',
  'Drainage',
  'Road/Parking',
  'Retaining Wall',
  'General Fill',
] as const

const DENSITY_MAP: Record<string, number> = {
  'fill-dirt': 1.1,
  'select-fill': 1.1,
  'topsoil': 1.0,
  'concrete-sand': 1.35,
  'masonry-sand': 1.35,
  'utility-sand': 1.35,
  'sand': 1.35,
  'pea-gravel': 1.4,
  'base-gravel-57': 1.4,
  'gravel': 1.4,
  'pea gravel': 1.4,
  'flex-base': 1.5,
  'road-base': 1.5,
  'road base': 1.5,
  'washed-river-rock': 1.35,
  'river-rock': 1.35,
  'river rock': 1.35,
  'limestone': 1.5,
  'rip-rap': 1.5,
  'crushed-concrete': 1.3,
  'crushed concrete': 1.3,
  'decomposed-granite': 1.4,
  'decomposed granite': 1.4,
}

interface CalculatorProps {
  materialName: string
  unit: string // 'ton' | 'cubic_yard'
  pricePerUnit: number
  densityTonsPerCY?: number
  orderUrl?: string
}

function getDensity(materialName: string, override?: number): number {
  if (override) return override
  const slug = materialName.toLowerCase().replace(/\s+/g, '-')
  return DENSITY_MAP[slug] ?? DENSITY_MAP[materialName.toLowerCase()] ?? 1.3
}

export function QuantityCalculator({
  materialName,
  unit,
  pricePerUnit,
  densityTonsPerCY,
  orderUrl,
}: CalculatorProps) {
  const [projectType, setProjectType] = useState('')
  const [length, setLength] = useState<string>('')
  const [width, setWidth] = useState<string>('')
  const [depth, setDepth] = useState<string>('')

  const density = getDensity(materialName, densityTonsPerCY)

  const calc = useMemo(() => {
    const l = parseFloat(length)
    const w = parseFloat(width)
    const d = parseFloat(depth)

    if (!l || !w || !d || l <= 0 || w <= 0 || d <= 0) return null

    const cubicFeet = l * w * (d / 12)
    const cubicYards = cubicFeet / 27
    const tons = cubicYards * density

    // Quantity in the material's selling unit
    const baseQuantity = unit === 'ton' ? tons : cubicYards
    const withOverage = baseQuantity * 1.1 // 10% overage
    const roundedQuantity = Math.ceil(withOverage * 10) / 10

    const estimatedCost = roundedQuantity * pricePerUnit

    return {
      cubicFeet: Math.round(cubicFeet * 10) / 10,
      cubicYards: Math.round(cubicYards * 10) / 10,
      tons: Math.round(tons * 10) / 10,
      baseQuantity: Math.round(baseQuantity * 10) / 10,
      withOverage: roundedQuantity,
      estimatedCost,
      unitLabel: unit === 'ton' ? 'tons' : 'cubic yards',
    }
  }, [length, width, depth, density, unit, pricePerUnit])

  const handleScrollToOrder = () => {
    if (orderUrl) {
      window.location.href = orderUrl
      return
    }
    const orderForm = document.getElementById('order-form')
    if (orderForm) {
      orderForm.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }

  return (
    <div
      className="relative bg-white rounded-2xl border border-gray-200/80 overflow-hidden"
      style={{
        boxShadow:
          '0 1px 0 0 rgba(255,255,255,0.9) inset, 0 1px 3px rgba(15,23,42,0.05), 0 20px 40px -20px rgba(15,23,42,0.15), 0 0 40px -12px rgba(16,185,129,0.12)',
      }}
    >
      {/* Header */}
      <div className="px-6 py-5 border-b border-gray-100 flex items-center gap-3">
        <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-emerald-50">
          <Calculator size={18} className="text-emerald-600" />
        </div>
        <div>
          <h3 className="font-extrabold text-gray-900">Quantity Calculator</h3>
          <p className="text-xs text-gray-500">Enter your project dimensions</p>
        </div>
      </div>

      {/* Inputs */}
      <div className="p-6 space-y-5">
        {/* Project Type */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1.5">
            Project Type
          </label>
          <div className="relative">
            <select
              value={projectType}
              onChange={(e) => setProjectType(e.target.value)}
              className="w-full appearance-none bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-900 font-medium text-sm focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 outline-none transition-all pr-10"
            >
              <option value="">Select project type...</option>
              {PROJECT_TYPES.map((type) => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
            <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          </div>
        </div>

        {/* Dimensions */}
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">
              Length <span className="font-normal text-gray-400">(ft)</span>
            </label>
            <input
              type="number"
              min="0"
              step="0.1"
              placeholder="0"
              value={length}
              onChange={(e) => setLength(e.target.value)}
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-900 font-medium text-sm focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 outline-none transition-all"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">
              Width <span className="font-normal text-gray-400">(ft)</span>
            </label>
            <input
              type="number"
              min="0"
              step="0.1"
              placeholder="0"
              value={width}
              onChange={(e) => setWidth(e.target.value)}
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-900 font-medium text-sm focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 outline-none transition-all"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">
              Depth <span className="font-normal text-gray-400">(in)</span>
            </label>
            <input
              type="number"
              min="0"
              step="0.5"
              placeholder="0"
              value={depth}
              onChange={(e) => setDepth(e.target.value)}
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-900 font-medium text-sm focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 outline-none transition-all"
            />
          </div>
        </div>

        {/* Results */}
        {calc && (
          <div className="mt-2 bg-emerald-50 border border-emerald-200 rounded-2xl p-5 space-y-4">
            <div className="flex items-center gap-2 mb-1">
              <Package size={16} className="text-emerald-600" />
              <span className="text-sm font-bold text-emerald-800">Estimated Amount Needed</span>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white rounded-xl p-3 text-center border border-emerald-100">
                <div className="text-2xl font-extrabold text-gray-900">{calc.cubicYards}</div>
                <div className="text-xs text-gray-500 font-medium mt-0.5">cubic yards</div>
              </div>
              <div className="bg-white rounded-xl p-3 text-center border border-emerald-100">
                <div className="text-2xl font-extrabold text-gray-900">{calc.tons}</div>
                <div className="text-xs text-gray-500 font-medium mt-0.5">tons</div>
              </div>
            </div>

            <div className="border-t border-emerald-200 pt-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-emerald-700">Volume</span>
                <span className="font-semibold text-gray-900">{calc.cubicFeet} cu ft ({calc.cubicYards} cu yd)</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-emerald-700">Base amount</span>
                <span className="font-semibold text-gray-900">{calc.baseQuantity} {calc.unitLabel}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-emerald-700">With 10% overage</span>
                <span className="font-bold text-emerald-700">{calc.withOverage} {calc.unitLabel}</span>
              </div>
            </div>

            <div className="border-t border-emerald-200 pt-4">
              <div className="flex justify-between items-baseline">
                <span className="text-sm font-medium text-emerald-700">Estimated material cost</span>
                <span className="text-2xl font-extrabold text-gray-900">{formatCurrency(calc.estimatedCost)}</span>
              </div>
              <p className="text-[11px] text-emerald-600 mt-1">
                Based on {formatCurrency(pricePerUnit)} per {unit === 'ton' ? 'ton' : 'cubic yard'} — delivery fee not included
              </p>
            </div>

            <button
              type="button"
              onClick={handleScrollToOrder}
              className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3.5 px-6 rounded-xl transition-all duration-200 shadow-lg shadow-emerald-600/20 mt-2"
            >
              <ArrowDown size={16} />
              Add to Order
            </button>
          </div>
        )}

        {/* Empty state hint */}
        {!calc && (
          <div className="text-center py-4 text-sm text-gray-400">
            Enter dimensions above to calculate the amount of {materialName.toLowerCase()} you need.
          </div>
        )}
      </div>
    </div>
  )
}
