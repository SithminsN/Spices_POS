import { useState } from 'react'
import type { ComponentType } from 'react'
import { TabBar } from './components/layout/TabBar'
import { ConnectionStatus } from './components/layout/ConnectionStatus'
import { ToastHost } from './components/common/ToastHost'
import { ToastProvider } from './context/ToastContext'
import { AppDataProvider, useAppData } from './context/AppDataContext'
import { LAST_TAB_STORAGE_KEY } from './lib/constants'
import type { TabId } from './lib/constants'
import EntryTab from './features/entry/EntryTab'
import StockTab from './features/stock/StockTab'
import LedgerTab from './features/ledger/LedgerTab'
import CashTab from './features/cash/CashTab'
import DailyTab from './features/daily/DailyTab'
import ReportTab from './features/report/ReportTab'
import './App.css'

const TAB_COMPONENTS: Record<TabId, ComponentType> = {
  entry: EntryTab,
  stock: StockTab,
  ledger: LedgerTab,
  cash: CashTab,
  daily: DailyTab,
  report: ReportTab,
}

function loadLastTab(): TabId {
  const stored = localStorage.getItem(LAST_TAB_STORAGE_KEY)
  return stored && stored in TAB_COMPONENTS ? (stored as TabId) : 'entry'
}

export default function App() {
  return (
    <ToastProvider>
      <AppDataProvider>
        <AppShell />
        <ToastHost />
      </AppDataProvider>
    </ToastProvider>
  )
}

function AppShell() {
  const { isSyncing, syncError } = useAppData()
  const [activeTab, setActiveTab] = useState<TabId>(loadLastTab)

  const handleChangeTab = (tab: TabId) => {
    setActiveTab(tab)
    localStorage.setItem(LAST_TAB_STORAGE_KEY, tab)
  }

  const ActiveTabComponent = TAB_COMPONENTS[activeTab]

  return (
    <div className="app-shell">
      <TabBar activeTab={activeTab} onChange={handleChangeTab} />
      <main className="app-content page">
        {syncError ? (
          <div className="app-error">
            <strong>Couldn't connect to the database.</strong>
            <span>{syncError}</span>
            <span>Check your .env values and Firebase project setup, then reload.</span>
          </div>
        ) : isSyncing ? (
          <div className="app-loading">Connecting…</div>
        ) : (
          <>
            <ConnectionStatus />
            <ActiveTabComponent />
          </>
        )}
      </main>
    </div>
  )
}
