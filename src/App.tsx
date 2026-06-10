import { useState } from 'react'
import Header from './components/layout/Header'
import TabBar, { type Tab } from './components/layout/TabBar'
import RecognizeTab from './components/recognize/RecognizeTab'
import BrowseTab from './components/browse/BrowseTab'

export default function App() {
  const [tab, setTab] = useState<Tab>('browse')

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col">
      <Header />
      <TabBar active={tab} onChange={setTab} />
      <main className="flex-1 overflow-y-auto">
        {tab === 'recognize' ? <RecognizeTab /> : <BrowseTab />}
      </main>
    </div>
  )
}
