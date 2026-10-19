export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse bg-slate-200 dark:bg-slate-800 rounded-xl ${className}`} />
}

export function SkeletonList({ label }: { label: string }) {
  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-400">{label}</p>
      {[1, 2, 3].map((i) => (
        <Skeleton key={i} className="h-16 w-full" />
      ))}
    </div>
  )
}
