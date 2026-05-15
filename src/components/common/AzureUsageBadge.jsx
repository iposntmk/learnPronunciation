import { getAzureUsageSummary } from '../../azureUsage.js'

export default function AzureUsageBadge() {
  const { used, total, pct, usedLabel } = getAzureUsageSummary()
  const color = pct >= 90 ? 'text-red-400' : pct >= 70 ? 'text-yellow-400' : 'text-emerald-400'
  const barColor = pct >= 90 ? 'bg-red-500' : pct >= 70 ? 'bg-yellow-500' : 'bg-emerald-500'

  return (
    <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-2xl px-3 py-1.5">
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-1.5">
          <span className="text-white/40 text-xs">Azure</span>
          <span className={`text-xs font-semibold ${color}`}>{usedLabel} đã dùng</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-white/30 text-[11px]">Tháng này</span>
          <span className="text-white/50 text-[11px]">{used.toFixed(2)}h / {total}h free</span>
        </div>
        <div className="w-24 h-1.5 bg-white/10 rounded-full overflow-hidden">
          <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${pct}%` }} />
        </div>
      </div>
    </div>
  )
}
