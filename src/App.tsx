import { useState, useRef } from 'react'
import Header from './components/layout/Header'
import TabBar, { type Tab } from './components/layout/TabBar'
import RecognizeTab from './components/recognize/RecognizeTab'
import BrowseTab from './components/browse/BrowseTab'
import FretboardTab from './components/fretboard/FretboardTab'
import ComposeTab from './components/compose/ComposeTab'
import ErrorBoundary from './components/ui/ErrorBoundary'

export default function App() {
  const [tab,    setTab]    = useState<Tab>('browse')
  const [fading, setFading] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  function changeTab(next: Tab) {
    if (next === tab) return
    if (timerRef.current) clearTimeout(timerRef.current)
    setFading(true)
    timerRef.current = setTimeout(() => {
      setTab(next)
      setFading(false)
    }, 150)
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col">
      <Header />
      <TabBar active={tab} onChange={changeTab} />
      <main className={`flex-1 overflow-y-auto transition-opacity duration-150 ${fading ? 'opacity-0' : 'opacity-100'}`}>
        <div className={tab === 'recognize' ? '' : 'hidden'}>
          <ErrorBoundary label="识别"><RecognizeTab /></ErrorBoundary>
        </div>
        <div className={tab === 'browse' ? '' : 'hidden'}>
          <ErrorBoundary label="和弦"><BrowseTab /></ErrorBoundary>
        </div>
        <div className={tab === 'fretboard' ? '' : 'hidden'}>
          <ErrorBoundary label="指板"><FretboardTab /></ErrorBoundary>
        </div>
        {/* ComposeTab uses h-full for sticky bottom bar */}
        <div className={tab === 'compose' ? 'h-full' : 'hidden'}>
          <ErrorBoundary label="编曲台"><ComposeTab /></ErrorBoundary>
        </div>
      </main>
    </div>
  )
}
