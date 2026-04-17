type Props = {
  className?: string
  stroke?: string
  strokeWidth?: number
  viewBox?: string
  paths?: string[]
}

const DEFAULT_PATHS = [
  'M-20 180 Q 50 140 140 160 T 300 150 T 420 180',
  'M-20 200 Q 60 160 160 180 T 310 170 T 420 200',
  'M-20 220 Q 70 180 180 200 T 320 190 T 420 220',
  'M-20 240 Q 80 200 200 220 T 330 210 T 420 240',
  'M-20 150 Q 100 110 220 130 T 370 130 T 420 160',
  'M-20 120 Q 120 80 240 100 T 380 100 T 420 130',
  'M-20 90  Q 140 60 260 70  T 390 70  T 420 100',
]

export function TopoPattern({
  className,
  stroke = '#6BAA86',
  strokeWidth = 0.6,
  viewBox = '0 0 400 260',
  paths = DEFAULT_PATHS,
}: Props) {
  return (
    <svg className={className} viewBox={viewBox} preserveAspectRatio="xMidYMid slice" aria-hidden>
      <g stroke={stroke} strokeWidth={strokeWidth} fill="none">
        {paths.map((d, i) => <path key={i} d={d} />)}
      </g>
    </svg>
  )
}
