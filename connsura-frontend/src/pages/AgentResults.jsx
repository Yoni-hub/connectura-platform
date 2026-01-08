import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import AgentCard from '../components/agents/AgentCard'
import SearchBar from '../components/search/SearchBar'
import { useAgents } from '../context/AgentContext'
import Skeleton from '../components/ui/Skeleton'
import { useAuth } from '../context/AuthContext'
import toast from 'react-hot-toast'
import MessageAgentModal from '../components/modals/MessageAgentModal'

export default function AgentResults() {
  const { agents, loading, fetchAgents } = useAgents()
  const { user } = useAuth()
  const nav = useNavigate()
  const [params] = useSearchParams()
  const [messageOpen, setMessageOpen] = useState(false)
  const [messageAgent, setMessageAgent] = useState(null)

  useEffect(() => {
    const query = Object.fromEntries(params.entries())
    if (Object.keys(query).length) fetchAgents(query)
  }, [params])

  const handleMessage = (agent) => {
    if (!user) {
      toast.error('Login to send a message')
      return
    }
    if (user.role !== 'CUSTOMER') {
      toast.error('Only customers can message agents')
      return
    }
    setMessageAgent(agent)
    setMessageOpen(true)
  }

  return (
    <main className="page-shell py-8 space-y-6">
      <div className="surface p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="text-2xl font-semibold">Find agents</h1>
          <div className="text-sm text-slate-500">{agents.length} results</div>
        </div>
        <div className="mt-4">
          <SearchBar busy={loading} onSearch={fetchAgents} />
        </div>
      </div>
      {loading ? (
        <div className="space-y-3">
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
        </div>
      ) : (
        <div className="space-y-3">
          {agents.map((agent) => (
            <AgentCard
              key={agent.id}
              agent={agent}
              onVoice={() => nav(`/call/voice/${agent.id}`)}
              onVideo={() => nav(`/call/video/${agent.id}`)}
              onMessage={handleMessage}
            />
          ))}
        </div>
      )}
      <MessageAgentModal open={messageOpen} agent={messageAgent} onClose={() => setMessageOpen(false)} />
    </main>
  )
}
