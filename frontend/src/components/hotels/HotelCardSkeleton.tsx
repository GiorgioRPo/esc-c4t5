import { Skeleton } from '@/components/ui/Skeleton'

export function HotelCardSkeleton() {
  return (
    <div className="flex flex-col overflow-hidden rounded-card border border-border bg-white sm:flex-row">
      <Skeleton className="h-56 w-full shrink-0 rounded-none sm:h-auto sm:w-72" />
      <div className="flex flex-1 flex-col gap-3 p-4 sm:p-5">
        <Skeleton className="h-5 w-2/3" />
        <Skeleton className="h-3.5 w-24" />
        <Skeleton className="h-3.5 w-40" />
        <Skeleton className="h-3.5 w-full" />
        <Skeleton className="h-3.5 w-5/6" />
        <div className="mt-auto flex items-end justify-between gap-4 border-t border-border pt-4">
          <Skeleton className="h-9 w-28" />
          <Skeleton className="h-12 w-32" />
        </div>
      </div>
    </div>
  )
}
