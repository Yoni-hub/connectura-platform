import { useNavigate } from 'react-router-dom'
import Hero from '../components/hero/Hero'
import SearchBar from '../components/search/SearchBar'
import Badge from '../components/ui/Badge'
import { useAgents } from '../context/AgentContext'

export default function Home() {
  const { agents, loading, fetchAgents } = useAgents()
  const nav = useNavigate()

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
        <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-2">
          <h3 className="text-lg font-semibold text-slate-900">Talk to agents who speak your language</h3>
          <ul className="text-slate-700 text-sm space-y-1">
            <li>- No more filling forms again and again</li>
            <li>- Create your insurance profile once — reuse anytime</li>
            <li>- Video call any agent instantly</li>
            <li>- 100% free for customers</li>
          </ul>
          <div className="pt-2">
            <button onClick={() => nav('/agents')} className="pill-btn-primary">
              Browse agents
            </button>
          </div>
        </div>
      </section>
    </main>
  )
}
