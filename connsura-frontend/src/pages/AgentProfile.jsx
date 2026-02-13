import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAgents } from '../context/AgentContext'
import Badge from '../components/ui/Badge'
import Skeleton from '../components/ui/Skeleton'
import { api } from '../services/api'
import { useAuth } from '../context/AuthContext'
import toast from 'react-hot-toast'
import RateAgentModal from '../components/modals/RateAgentModal'

export default function AgentProfile() {
  const { id } = useParams()
  const { getAgent } = useAgents()
  const [agent, setAgent] = useState(null)
  const [loading, setLoading] = useState(true)
  const [rateOpen, setRateOpen] = useState(false)
  const [agentSaved, setAgentSaved] = useState(false)
  const [savingAgent, setSavingAgent] = useState(false)
  const profileViewRef = useRef('')
  const { user } = useAuth()
  const nav = useNavigate()

  useEffect(() => {
    async function load() {
      setLoading(true)
      const data = await getAgent(id)
      setAgent(data)
      setLoading(false)
    }
    load()
  }, [id])

  useEffect(() => {
    if (!user?.customerId || !agent?.id) {
      setAgentSaved(false)
      return
    }
    let isActive = true
    const loadSaved = async () => {
      try {
        const res = await api.get(`/customers/${user.customerId}/saved-agents`)
        if (!isActive) return
        const ids = (res.data.agents || []).map((item) => item.id)
        setAgentSaved(ids.includes(agent.id))
      } catch {
        if (!isActive) return
        setAgentSaved(false)
      }
    }
    loadSaved()
    return () => {
      isActive = false
    }
  }, [user?.customerId, agent?.id])

  useEffect(() => {
    if (!user?.customerId || !agent?.id) return
    const key = `${user.customerId}:${agent.id}`
    if (profileViewRef.current === key) return
    profileViewRef.current = key
    api.post(`/customers/${user.customerId}/agent-profile/view`, {
      agentId: agent.id,
      source: 'profile',
    }).catch(() => {})
  }, [user?.customerId, agent?.id])

  const handleSaveAgent = async () => {
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
    if (agentSaved || savingAgent) {
      return
    }
    setAgentSaved(true)
    setSavingAgent(true)
    try {
      await api.post(`/customers/${user.customerId}/saved-agents`, { agentId: agent.id })
      toast.success('Agent saved')
    } catch (err) {
      setAgentSaved(false)
      toast.error(err.response?.data?.error || 'Failed to save agent')
    } finally {
      setSavingAgent(false)
    }
  }

  const handleRemoveAgent = async () => {
    if (!user) {
      toast.error('Login to remove an agent')
      return
    }
    if (user.role !== 'CUSTOMER') {
      toast.error('Only customers can remove agents')
      return
    }
    if (!user.customerId) {
      toast.error('Customer profile not found')
      return
    }
    if (!agentSaved || savingAgent) {
      return
    }
    setAgentSaved(false)
    setSavingAgent(true)
    try {
      await api.delete(`/customers/${user.customerId}/saved-agents/${agent.id}`)
      toast.success('Agent removed')
    } catch (err) {
      setAgentSaved(true)
      toast.error(err.response?.data?.error || 'Failed to remove agent')
    } finally {
      setSavingAgent(false)
    }
  }

  const handleRateOpen = () => {
    if (!user) {
      toast.error('Login to rate an agent')
      return
    }
    if (user.role !== 'CUSTOMER') {
      toast.error('Only customers can rate agents')
      return
    }
    setRateOpen(true)
  }

  if (loading || !agent) {
    return (
      <main className="page-shell py-8">
        <Skeleton className="h-48" />
      </main>
    )
  }

  return (
    <main className="page-shell py-8 space-y-6">
      <div className="surface p-6">
        <div className="flex flex-col gap-4 sm:flex-row">
          <img src={agent.photo} alt={agent.name} className="h-28 w-28 rounded-2xl object-cover shadow" />
          <div className="flex-1 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold">{agent.name}</h1>
              <Badge label={`${agent.rating.toFixed(1)} rating`} tone="blue" />
              <Badge label={agent.availability} tone="green" />
            </div>
            <div className="text-slate-600">{agent.bio}</div>
            <div className="text-sm text-slate-500">Languages: {agent.languages.join(', ')}</div>
            <div className="text-sm text-slate-500">States: {agent.states.join(', ')}</div>
            <div className="text-sm text-slate-500">Specialty: {agent.specialty}</div>
            <div className="text-sm text-slate-500">Appointed carriers: {Array.isArray(agent.appointedCarriers) ? agent.appointedCarriers.length ? agent.appointedCarriers.join(', ') : '—' : agent.appointedCarriers || '—'}</div>
            <div className="text-sm text-slate-500">Products: {agent.products?.join(', ') || '—'}</div>
            <div className="text-sm text-slate-500">Producer #: {agent.producerNumber || '—'}</div>
            <div className="text-sm text-slate-500">Email: {agent.email || '—'}</div>
            <div className="text-sm text-slate-500">Phone: {agent.phone || '—'}</div>
            <div className="text-sm text-slate-500">Address: {agent.address || '—'} {agent.zip || ''}</div>
            <div className="flex gap-2 flex-wrap pt-2">
              <button onClick={handleRateOpen} className="pill-btn-ghost">
                Rate Agent
              </button>
              {agentSaved ? (
                <button
                  onClick={handleRemoveAgent}
                  className={`pill-btn-ghost ${savingAgent ? 'opacity-60 cursor-default' : ''}`}
                  disabled={savingAgent}
                >
                  Remove Agent
                </button>
              ) : (
                <button
                  onClick={handleSaveAgent}
                  className={`pill-btn-ghost ${savingAgent ? 'opacity-60 cursor-default' : ''}`}
                  disabled={savingAgent}
                >
                  Save Agent
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="surface p-6">
        <h3 className="text-lg font-semibold mb-3">Recent reviews</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          {agent.reviews.map((review, idx) => (
            <div key={idx} className="rounded-lg border border-slate-100 p-4 bg-white shadow-sm">
              <div className="font-semibold">{review.author}</div>
              <div className="text-sm text-slate-600">{review.comment}</div>
              <Badge label={`${review.rating} rating`} tone="amber" />
            </div>
          ))}
        </div>
      </div>
      <RateAgentModal
        open={rateOpen}
        agent={agent}
        onClose={() => setRateOpen(false)}
        onSubmitted={() => getAgent(id).then((data) => data && setAgent(data))}
      />
    </main>
  )
}

