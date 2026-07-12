import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'

const STEPS = ['Room selection', 'Your details & payment', 'Confirmation']

export function StepIndicator({ current }: { current: number }) {
  return (
    <ol className="flex items-center gap-2 overflow-x-auto text-sm">
      {STEPS.map((label, i) => {
        const step = i + 1
        const isActive = step === current
        const isDone = step < current
        return (
          <li key={label} className="flex shrink-0 items-center gap-2">
            <span
              className={cn(
                'flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold',
                isDone
                  ? 'bg-success text-white'
                  : isActive
                    ? 'bg-accent text-white'
                    : 'bg-border text-muted',
              )}
            >
              {isDone ? <Check className="h-3.5 w-3.5" /> : step}
            </span>
            <span
              className={cn(
                'whitespace-nowrap',
                isActive ? 'font-semibold text-ink' : 'text-muted',
              )}
            >
              {label}
            </span>
            {step < STEPS.length && (
              <span className="mx-1 h-px w-8 bg-border sm:w-16" />
            )}
          </li>
        )
      })}
    </ol>
  )
}
