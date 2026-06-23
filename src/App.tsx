import { useState, useRef } from 'react'
import Header from './components/layout/Header'
import TabBar, { type Tab } from './components/layout/TabBar'
import RecognizeTab from './components/recognize/RecognizeTab'
import BrowseTab from './components/browse/BrowseTab'
import FretboardTab from './components/fretboard/FretboardTab'
import ComposeTab from './components/compose/ComposeTab'
import ErrorBoundary from './components/ui/ErrorBoundary'

const TAB_KEY = 'guitar-chord-active-tab'
const VALID_TABS: Tab[] = ['recognize', 'browse', 'fretboard', 'compose']

function loadTab(): Tab {
  try {
    const s = localStorage.getItem(TAB_KEY)
    if (s && VALID_TABS.includes(s as Tab)) return s as Tab
  } catch { /* ignore */ }
  return 'browse'
}

export default function App() {
  const [tab,      setTab]      = useState<Tab>(loadTab)
  const [enterTab, setEnterTab] = useState<Tab | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  function changeTab(next: Tab) {
    if (next === tab) return
    if (timerRef.current) clearTimeout(timerRef.current)
    setTab(next)
    setEnterTab(next)
    try { localStorage.setItem(TAB_KEY, next) } catch { /* ignore */ }
    // Remove animation class after it finishes so it can replay on re-visit
    timerRef.current = setTimeout(() => setEnterTab(null), 300)
  }

  function cls(t: Tab, extra = '') {
    const visible = tab === t
    const anim    = enterTab === t ? 'tab-enter' : ''
    return `${visible ? extra : 'hidden'} ${anim}`.trim()
  }

  return (
    <div className="h-screen overflow-hidden bg-zinc-950 text-zinc-100 flex flex-col">
      <Header />
      <TabBar active={tab} onChange={changeTab} />
      <main className="flex-1 overflow-y-auto scrollbar-none">
        <div className={cls('recognize')}>
          <ErrorBoundary label="识别"><RecognizeTab /></ErrorBoundary>
        </div>
        <div className={cls('browse')}>
          <ErrorBoundary label="和弦"><BrowseTab /></ErrorBoundary>
        </div>
        <div className={cls('fretboard')}>
          <ErrorBoundary label="指板"><FretboardTab /></ErrorBoundary>
        </div>
        {/* ComposeTab uses h-full for sticky bottom bar */}
        <div className={cls('compose', 'h-full')}>
          <ErrorBoundary label="编曲台"><ComposeTab /></ErrorBoundary>
        </div>
      </main>
    </div>
  )
}
