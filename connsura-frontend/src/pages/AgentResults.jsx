import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import AgentCard from '../components/agents/AgentCard'
import SearchBar from '../components/search/SearchBar'
import { useAgents } from '../context/AgentContext'
import Skeleton from '../components/ui/Skeleton'
import { useAuth } from '../context/AuthContext'
import { api } from '../services/api'
import toast from 'react-hot-toast'
import RateAgentModal from '../components/modals/RateAgentModal'

export default function AgentResults() {
  const { agents, loading, fetchAgents } = useAgents()
  const { user } = useAuth()
  const nav = useNavigate()
  const [params] = useSearchParams()
  const [rateOpen, setRateOpen] = useState(false)
  const [rateAgent, setRateAgent] = useState(null)
  const [savedAgentIds, setSavedAgentIds] = useState([])
  const viewLoggedRef = useRef(false)

  useEffect(() => {
    const query = Object.fromEntries(params.entries())
    if (Object.keys(query).length) fetchAgents(query)
  }, [params])

  useEffect(() => {
    if (!user?.customerId) return
    if (viewLoggedRef.current) return
    viewLoggedRef.current = true
    const logView = async () => {
      try {
        await api.post(`/customers/${user.customerId}/agent-search/view`)
      } catch (err) {
        console.warn('Unable to log agent search view', err)
      }
    }
    logView()
  }, [user?.customerId])

  useEffect(() => {
    if (!user?.customerId) {
      setSavedAgentIds([])
      return
    }
    let isActive = true
    const loadSavedAgents = async () => {
      try {
        const res = await api.get(`/customers/${user.customerId}/saved-agents`)
        if (!isActive) return
        const ids = (res.data.agents || []).map((agent) => agent.id)
        setSavedAgentIds(ids)
      } catch {
        if (!isActive) return
        setSavedAgentIds([])
      }
    }
    loadSavedAgents()
    return () => {
      isActive = false
    }
  }, [user?.customerId])

  const savedAgentIdSet = useMemo(() => new Set(savedAgentIds), [savedAgentIds])

  const handleMessage = (agent) => {
    if (!user) {
      toast.error('Login to send a message')
      return
    }
    if (user.role !== 'CUSTOMER') {
      toast.error('Only customers can message agents')
      return
    }
    nav(`/messages?agent=${agent.id}`)
  }

  const handleViewProfile = (agent) => {
    nav(`/agents/${agent.id}`)
  }

  const handleRate = (agent) => {
    if (!user) {
      toast.error('Login to rate an agent')
      return
    }
    if (user.role !== 'CUSTOMER') {
      toast.error('Only customers can rate agents')
      return
    }
    setRateAgent(agent)
    setRateOpen(true)
  }

  const handleSave = async (agent) => {
    if (!user) {
      toast.error('Login to save an agent')
      return
    }
    if (user.role !== 'CUSTOMER') {
      toast.error('Only customers can save agents')
      return
    }
    if (!user.customerId) {
      toast.error('Customer profile not found')
      return
    }
    if (savedAgentIdSet.has(agent.id)) {
      return
    }
    setSavedAgentIds((prev) => [...prev, agent.id])
    try {
      await api.post(`/customers/${user.customerId}/saved-agents`, { agentId: agent.id })
      toast.success('Agent saved')
    } catch (err) {
      setSavedAgentIds((prev) => prev.filter((id) => id !== agent.id))
      toast.error(err.response?.data?.error || 'Failed to save agent')
    }
  }

  const refreshResults = () => {
    const query = Object.fromEntries(params.entries())
    fetchAgents(query)
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
              onViewProfile={handleViewProfile}
              onMessage={handleMessage}
              onRate={handleRate}
              onSave={handleSave}
              saved={savedAgentIdSet.has(agent.id)}
            />
          ))}
        </div>
      )}
      <RateAgentModal
        open={rateOpen}
        agent={rateAgent}
        onClose={() => setRateOpen(false)}
        onSubmitted={refreshResults}
      />
    </main>
  )
}
