import { useState } from 'react'
import Header from './components/layout/Header'
import TabBar, { type Tab } from './components/layout/TabBar'
import RecognizeTab from './components/recognize/RecognizeTab'
import BrowseTab from './components/browse/BrowseTab'
import FretboardTab from './components/fretboard/FretboardTab'
import ComposeTab from './components/compose/ComposeTab'
import GuitarBackground from './components/ui/GuitarBackground'

export default function App() {
  const [tab, setTab] = useState<Tab>('browse')

  return (
    <div className="min-h-screen text-stone-800 flex flex-col relative">
      <GuitarBackground />
      <Header />
      <TabBar active={tab} onChange={setTab} />
      <main className="flex-1 overflow-y-auto relative">
        {tab === 'recognize' ? <RecognizeTab />
          : tab === 'browse' ? <BrowseTab />
          : tab === 'fretboard' ? <FretboardTab />
          : <ComposeTab />}
      </main>
    </div>
  )
}
