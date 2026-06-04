import React from 'react'
import { History } from 'lucide-react'

function formatDate(value) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return date.toLocaleString()
}

function shortId(value) {
  return value ? String(value).slice(0, 8) : '-'
}

function testStatus(item) {
  if (!item.lastTestedAt) return '-'
  return `${item.lastTestOk ? 'ok' : 'failed'} / ${formatDate(item.lastTestedAt)}`
}

export default function SpeechSuperCredentialHistory({ history = [] }) {
  const rows = Array.isArray(history) ? history : []
  return (
    <section className="rounded-2xl border border-white/10 bg-white/5 p-3 sm:p-4">
      <h2 className="mb-3 flex items-center gap-2 text-base font-bold text-white">
        <History size={18} /> Key history
      </h2>

      {rows.length === 0 ? (
        <div className="rounded-xl border border-white/10 bg-gray-950/35 px-3 py-2 text-sm text-white/55">
          No database credential history yet.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-xs text-white/65">
            <thead className="text-[11px] uppercase text-white/35">
              <tr>
                <th className="py-2 pr-3 font-semibold">status</th>
                <th className="py-2 pr-3 font-semibold">mode</th>
                <th className="py-2 pr-3 font-semibold">user</th>
                <th className="py-2 pr-3 font-semibold">expiry</th>
                <th className="py-2 pr-3 font-semibold">last test</th>
                <th className="py-2 pr-3 font-semibold">created</th>
                <th className="py-2 pr-3 font-semibold">by</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {rows.map((item, index) => (
                <tr key={item.id || index}>
                  <td className="py-2 pr-3">
                    <span className={item.isActive ? 'font-semibold text-emerald-200' : 'text-white/45'}>
                      {item.isActive ? 'active' : 'inactive'}
                    </span>
                  </td>
                  <td className="py-2 pr-3">{item.scoringMode || '-'}</td>
                  <td className="py-2 pr-3">{item.userId || '-'}</td>
                  <td className="py-2 pr-3">{formatDate(item.expiresAt)}</td>
                  <td className="py-2 pr-3">{testStatus(item)}</td>
                  <td className="py-2 pr-3">{formatDate(item.createdAt)}</td>
                  <td className="py-2 pr-3">{shortId(item.createdBy || item.updatedBy)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
