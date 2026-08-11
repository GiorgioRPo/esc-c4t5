import { useEffect, useRef, useState } from 'react'
import { Check, Copy, Mail, X as CloseIcon } from 'lucide-react'
import type { ComponentType } from 'react'
import { cn } from '@/lib/utils'

interface Platform {
  id: string
  label: string
  icon: ComponentType<{ className?: string }>
  href: (url: string, title: string) => string
  external?: boolean
}

function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.876 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.626.712.226 1.36.194 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" />
      <path d="M12.001 2.003c-5.523 0-10 4.477-10 10 0 1.766.46 3.492 1.334 5.012L2 22l5.104-1.32a9.958 9.958 0 0 0 4.897 1.32h.004c5.522 0 9.999-4.477 9.999-10s-4.477-9.997-10.003-9.997zm.003 18.164h-.003a8.213 8.213 0 0 1-4.185-1.146l-.3-.178-3.03.784.808-2.951-.196-.303a8.185 8.185 0 0 1-1.257-4.373c0-4.527 3.685-8.211 8.216-8.211 2.194 0 4.256.856 5.808 2.409a8.153 8.153 0 0 1 2.406 5.809c-.002 4.527-3.686 8.16-8.267 8.16z" />
    </svg>
  )
}

function FacebookIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M22 12.06C22 6.505 17.523 2 12 2S2 6.505 2 12.06c0 5.02 3.657 9.184 8.438 9.94v-7.03H7.898v-2.91h2.54V9.845c0-2.507 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562v1.878h2.773l-.443 2.91h-2.33V22c4.78-.756 8.437-4.92 8.437-9.94z" />
    </svg>
  )
}

function XIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  )
}

function TelegramIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M21.944 3.542a1.5 1.5 0 0 0-1.53-.259L2.7 10.16a1.5 1.5 0 0 0 .075 2.81l4.65 1.63 1.79 5.61a1.5 1.5 0 0 0 2.6.51l2.5-2.99 4.61 3.4a1.5 1.5 0 0 0 2.37-.9l2.62-14.3a1.5 1.5 0 0 0-.972-1.688zM9.06 14.34l-3.6-1.26 12.06-6.87-9.6 8.13zm1.4 4.4-1.03-3.23 1.83 1.14-.8 2.09zm7.66-.66-4.6-3.39 6.06-8.6-1.46 12z" />
    </svg>
  )
}

const PLATFORMS: Array<Platform> = [
  {
    id: 'whatsapp',
    label: 'WhatsApp',
    icon: WhatsAppIcon,
    href: (url, title) =>
      `https://wa.me/?text=${encodeURIComponent(`${title} ${url}`)}`,
    external: true,
  },
  {
    id: 'facebook',
    label: 'Facebook',
    icon: FacebookIcon,
    href: (url) =>
      `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
    external: true,
  },
  {
    id: 'x',
    label: 'X',
    icon: XIcon,
    href: (url, title) =>
      `https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}&text=${encodeURIComponent(title)}`,
    external: true,
  },
  {
    id: 'telegram',
    label: 'Telegram',
    icon: TelegramIcon,
    href: (url, title) =>
      `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(title)}`,
    external: true,
  },
  {
    id: 'email',
    label: 'Email',
    icon: Mail,
    href: (url, title) =>
      `mailto:?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(url)}`,
  },
]

export function ShareDialog({
  open,
  onClose,
  title,
}: {
  open: boolean
  onClose: () => void
  title: string
}) {
  const [copied, setCopied] = useState(false)
  const closeButtonRef = useRef<HTMLButtonElement>(null)
  const canNativeShare =
    typeof navigator !== 'undefined' && 'share' in navigator

  useEffect(() => {
    if (!open) return
    closeButtonRef.current?.focus()

    function handleKeydown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKeydown)
    return () => document.removeEventListener('keydown', handleKeydown)
  }, [open, onClose])

  useEffect(() => {
    if (!copied) return
    const timer = setTimeout(() => setCopied(false), 2000)
    return () => clearTimeout(timer)
  }, [copied])

  if (!open) return null

  const url = window.location.href

  function handleCopy() {
    navigator.clipboard.writeText(url).then(
      () => setCopied(true),
      () => undefined,
    )
  }

  function handleNativeShare() {
    navigator.share({ title, url }).catch(() => undefined)
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="share-dialog-title"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-card border border-border bg-white p-5 shadow-lg"
      >
        <div className="flex items-center justify-between">
          <h2
            id="share-dialog-title"
            className="font-display text-lg font-bold text-ink"
          >
            Share this hotel
          </h2>
          <button
            ref={closeButtonRef}
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full text-muted hover:bg-surface"
          >
            <CloseIcon className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-5 grid grid-cols-5 gap-2">
          {PLATFORMS.map((platform) => {
            const Icon = platform.icon
            return (
              <a
                key={platform.id}
                href={platform.href(url, title)}
                target={platform.external ? '_blank' : undefined}
                rel={platform.external ? 'noopener noreferrer' : undefined}
                className="flex flex-col items-center gap-1.5 rounded-btn px-1 py-2 text-center text-muted hover:bg-surface"
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-surface text-ink">
                  <Icon className="h-4 w-4" />
                </span>
                <span className="text-xs">{platform.label}</span>
              </a>
            )
          })}
        </div>

        {canNativeShare && (
          <button
            type="button"
            onClick={handleNativeShare}
            className="mt-4 w-full rounded-btn border border-border py-2.5 text-sm font-semibold text-navy hover:bg-surface"
          >
            More options…
          </button>
        )}

        <div className="mt-5 flex items-center gap-2 rounded-btn border border-border bg-surface px-3 py-2.5">
          <p className="flex-1 truncate text-sm text-muted">{url}</p>
          <button
            type="button"
            onClick={handleCopy}
            className={cn(
              'flex shrink-0 items-center gap-1.5 rounded-btn px-2.5 py-1.5 text-xs font-semibold',
              copied
                ? 'text-success'
                : 'text-accent hover:bg-white',
            )}
          >
            {copied ? (
              <>
                <Check className="h-3.5 w-3.5" />
                Copied!
              </>
            ) : (
              <>
                <Copy className="h-3.5 w-3.5" />
                Copy
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
