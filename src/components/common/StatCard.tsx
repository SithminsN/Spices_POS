import './StatCard.css'

interface StatCardProps {
  label: string
  value: string
  tone?: 'default' | 'positive' | 'negative' | 'accent'
  hint?: string
}

/** Small presentation-only stat tile. Caller must pre-format value/hint (e.g. via formatCurrency). */
export function StatCard({ label, value, tone = 'default', hint }: StatCardProps) {
  return (
    <div className="card stat-card">
      <div className="stat-card-label">{label}</div>
      <div className={`stat-card-value stat-card-value-${tone} num`}>{value}</div>
      {hint && <div className="stat-card-hint num">{hint}</div>}
    </div>
  )
}
