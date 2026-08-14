import { TAB_IDS, TAB_LABELS } from '../../lib/constants'
import type { TabId } from '../../lib/constants'
import './TabBar.css'

interface TabBarProps {
  activeTab: TabId
  onChange: (tab: TabId) => void
}

/**
 * A single nav that renders as a horizontally-scrollable top bar on mobile
 * and flips into a left sidebar on desktop (>=1024px) — see TabBar.css.
 */
export function TabBar({ activeTab, onChange }: TabBarProps) {
  return (
    <nav className="tab-bar" aria-label="Sections">
      <div className="tab-bar-brand">
        <span className="tab-bar-brand-mark">🌿</span>
        <span className="tab-bar-brand-name">Spice POS</span>
      </div>
      <div className="tab-bar-items">
        {TAB_IDS.map((tab) => (
          <button
            key={tab}
            type="button"
            className={`tab-bar-item ${activeTab === tab ? 'is-active' : ''}`}
            onClick={() => onChange(tab)}
            aria-current={activeTab === tab ? 'page' : undefined}
          >
            {TAB_LABELS[tab]}
          </button>
        ))}
      </div>
    </nav>
  )
}
