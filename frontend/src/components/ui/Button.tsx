import { forwardRef } from 'react'
import type { ButtonHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

export type ButtonVariant =
  | 'primary'
  | 'secondary'
  | 'outline'
  | 'ghost'
  | 'outline-white'
export type ButtonSize = 'sm' | 'md' | 'lg'

interface ButtonVariantOpts {
  variant?: ButtonVariant
  size?: ButtonSize
  className?: string
}

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary: 'bg-accent text-white hover:bg-accent-dark',
  secondary: 'bg-white text-navy border border-border hover:bg-surface',
  outline:
    'bg-transparent text-accent border border-accent hover:bg-accent-light',
  ghost: 'bg-transparent text-navy hover:bg-surface',
  'outline-white':
    'bg-transparent text-white border border-white/40 hover:bg-white/10',
}

const SIZE_CLASSES: Record<ButtonSize, string> = {
  sm: 'h-9 px-3 text-sm',
  md: 'h-11 px-5 text-sm',
  lg: 'h-12 px-6 text-base',
}

export function buttonVariants({
  variant = 'primary',
  size = 'md',
  className,
}: ButtonVariantOpts = {}): string {
  return cn(
    'inline-flex shrink-0 items-center justify-center gap-2 rounded-btn font-semibold transition-colors disabled:opacity-50 disabled:pointer-events-none',
    VARIANT_CLASSES[variant],
    SIZE_CLASSES[size],
    className,
  )
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  function ButtonImpl({ variant, size, className, ...props }, ref) {
    return (
      <button
        ref={ref}
        className={buttonVariants({ variant, size, className })}
        {...props}
      />
    )
  },
)
