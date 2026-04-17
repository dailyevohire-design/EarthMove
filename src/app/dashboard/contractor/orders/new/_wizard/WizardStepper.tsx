const STEPS = ['Material', 'Quantity', 'Supplier', 'Delivery', 'Review'] as const

export function WizardStepper({ step }: { step: number }) {
  return (
    <div className="ec-stepper">
      {STEPS.map((label, i) => {
        const num = i + 1
        const cls = num < step ? 'done' : num === step ? 'current' : ''
        return (
          <div key={label} className={`ec-stepper__step ${cls}`}>
            <span className="ec-stepper__num">{num}</span>
            <span className="ec-stepper__label">{label}</span>
          </div>
        )
      })}
    </div>
  )
}
