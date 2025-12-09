import Hero from '../components/hero/Hero'
import SearchBar from '../components/search/SearchBar'
import Badge from '../components/ui/Badge'
import { useAgents } from '../context/AgentContext'

export default function Home() {
  const { agents, loading, fetchAgents } = useAgents()

  return (
    <main className="page-shell py-8 space-y-10">
      <Hero />

      <section className="surface p-6 space-y-4 bg-[#f9f6f3]" aria-labelledby="search-agents">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div id="search-agents">
            <h2 className="text-2xl font-semibold">Search agents</h2>
            <p className="text-slate-600 text-sm">Filter by state, language, or name to start a conversation.</p>
          </div>
          <Badge label="Live filters" tone="blue" />
        </div>
        <SearchBar busy={loading} onSearch={fetchAgents} agents={agents} />
      </section>
    </main>
  )
}
