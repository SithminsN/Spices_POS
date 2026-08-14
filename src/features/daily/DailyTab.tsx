import { useMemo, useState } from 'react'
import { useAppData } from '../../context/AppDataContext'
import { computeDayGroups } from '../../lib/calculations'
import { DayCard } from './DayCard'
import './DailyTab.css'

export default function DailyTab() {
  const { transactions, cashEntries } = useAppData()
  const dayGroups = useMemo(() => computeDayGroups(transactions, cashEntries), [transactions, cashEntries])

  // Most recent day starts expanded; everything else starts collapsed.
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set(dayGroups[0] ? [dayGroups[0].dateKey] : []))

  function toggleDay(dateKey: string) {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(dateKey)) next.delete(dateKey)
      else next.add(dateKey)
      return next
    })
  }

  if (dayGroups.length === 0) {
    return (
      <div className="empty-state">
        <p>No entries yet. Sales, purchases, and cash entries will show up here grouped by day.</p>
      </div>
    )
  }

  return (
    <div className="stack daily-tab">
      {dayGroups.map((group) => (
        <DayCard
          key={group.dateKey}
          group={group}
          expanded={expanded.has(group.dateKey)}
          onToggle={() => toggleDay(group.dateKey)}
        />
      ))}
    </div>
  )
}
