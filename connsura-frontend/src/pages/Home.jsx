import Hero from '../components/hero/Hero'
import SearchBar from '../components/search/SearchBar'
import Badge from '../components/ui/Badge'
import { useAgents } from '../context/AgentContext'

export default function Home() {
  const { agents, loading, fetchAgents } = useAgents()

  return (
    <main className="space-y-0 bg-white">
      <Hero />

      <section className="space-y-4 px-4 py-10 sm:px-8 lg:px-16" aria-labelledby="search-agents">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div id="search-agents">
            <h2 className="text-2xl font-semibold">Search agents</h2>
            <p className="text-sm text-slate-600">Filter by state, language, or name to start a conversation.</p>
          </div>
          <Badge label="Live filters" tone="blue" />
        </div>
        <SearchBar busy={loading} onSearch={fetchAgents} agents={agents} variant="minimal" />
      </section>
    </main>
  )
}
