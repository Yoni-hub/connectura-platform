import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAgents } from '../context/AgentContext'
import Badge from '../components/ui/Badge'
import Skeleton from '../components/ui/Skeleton'
import { api } from '../services/api'
import { useAuth } from '../context/AuthContext'
import toast from 'react-hot-toast'
import MessageAgentModal from '../components/modals/MessageAgentModal'
import RateAgentModal from '../components/modals/RateAgentModal'

export default function AgentProfile() {
  const { id } = useParams()
  const { getAgent } = useAgents()
  const [agent, setAgent] = useState(null)
  const [loading, setLoading] = useState(true)
  const [messageOpen, setMessageOpen] = useState(false)
  const [rateOpen, setRateOpen] = useState(false)
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

  const handleMessageOpen = () => {
    if (!user) {
      toast.error('Login to send a message')
      return
    }
    if (user.role !== 'CUSTOMER') {
      toast.error('Only customers can message agents')
      return
    }
    setMessageOpen(true)
  }

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
    try {
      await api.post(`/customers/${user.customerId}/saved-agents`, { agentId: agent.id })
      toast.success('Agent saved')
      nav(`/client/dashboard?tab=agents`)
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to save agent')
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
            <div className="text-sm text-slate-500">Products: {agent.products?.join(', ') || '—'}</div>
            <div className="text-sm text-slate-500">Producer #: {agent.producerNumber || '—'}</div>
            <div className="text-sm text-slate-500">Email: {agent.email || '—'}</div>
            <div className="text-sm text-slate-500">Phone: {agent.phone || '—'}</div>
            <div className="text-sm text-slate-500">Address: {agent.address || '—'} {agent.zip || ''}</div>
            <div className="flex gap-2 flex-wrap pt-2">
              <button onClick={handleMessageOpen} className="pill-btn-ghost">
                Message
              </button>
              <button onClick={handleRateOpen} className="pill-btn-ghost">
                Rate Agent
              </button>
              <button onClick={handleSaveAgent} className="pill-btn-ghost">
                Save Agent
              </button>
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
      <MessageAgentModal
        open={messageOpen}
        agent={agent}
        onClose={() => setMessageOpen(false)}
        onSent={(sentAgent) => nav(`/client/dashboard?tab=messages&agent=${sentAgent.id}`)}
      />
      <RateAgentModal
        open={rateOpen}
        agent={agent}
        onClose={() => setRateOpen(false)}
        onSubmitted={() => getAgent(id).then((data) => data && setAgent(data))}
      />
    </main>
  )
}
