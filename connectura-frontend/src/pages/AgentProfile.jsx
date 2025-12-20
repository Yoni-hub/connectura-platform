import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAgents } from '../context/AgentContext'
import Badge from '../components/ui/Badge'
import Skeleton from '../components/ui/Skeleton'
import Modal from '../components/ui/Modal'
import { api } from '../services/api'
import { useProfile } from '../context/ProfileContext'
import { useAuth } from '../context/AuthContext'
import toast from 'react-hot-toast'

export default function AgentProfile() {
  const { id } = useParams()
  const { getAgent } = useAgents()
  const [agent, setAgent] = useState(null)
  const [summary, setSummary] = useState(null)
  const [loading, setLoading] = useState(true)
  const [messageOpen, setMessageOpen] = useState(false)
  const [messageBody, setMessageBody] = useState('')
  const [messageSending, setMessageSending] = useState(false)
  const { shareWithAgent } = useProfile()
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
    api
      .get(`/agents/${id}/summary`)
      .then((res) => setSummary(res.data.summary))
      .catch(() => {})
  }, [id])

  const handleShare = () => {
    if (!user) return toast.error('Login to share profile')
    shareWithAgent(agent.id)
  }

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

  const handleSendMessage = async () => {
    const body = messageBody.trim()
    if (!body) {
      toast.error('Message cannot be empty')
      return
    }
    setMessageSending(true)
    try {
      await api.post('/messages', { agentId: agent.id, body })
      toast.success('Message sent')
      setMessageBody('')
      setMessageOpen(false)
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to send message')
    } finally {
      setMessageSending(false)
    }
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
            <div className="text-sm text-slate-500">Producer number: {agent.producerNumber || '—'}</div>
            <div className="text-sm text-slate-500">Address: {agent.address || '—'} {agent.zip || ''}</div>
            <div className="flex gap-2 flex-wrap pt-2">
              <button onClick={() => nav(`/call/voice/${agent.id}`)} className="pill-btn-primary">
                Voice call
              </button>
              <button onClick={() => nav(`/call/video/${agent.id}`)} className="pill-btn bg-slate-900 text-white hover:bg-slate-800">
                Video call
              </button>
              <button onClick={handleMessageOpen} className="pill-btn-ghost">
                Message
              </button>
              <button onClick={handleShare} className="pill-btn-ghost">
                Share profile
              </button>
            </div>
          </div>
        </div>
      </div>

      {summary && (
        <div className="surface p-6">
          <h3 className="text-lg font-semibold mb-4">Post-sale summary (placeholder)</h3>
          <div className="grid sm:grid-cols-2 gap-3">
            {Object.entries(summary).map(([key, val]) => (
              <div key={key} className="rounded-lg border border-slate-100 p-4 bg-slate-50 shadow-sm">
                <div className="text-xs uppercase text-slate-500">{key}</div>
                <div className="font-semibold">{val}</div>
              </div>
            ))}
          </div>
        </div>
      )}

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

      <Modal
        title="Message agent"
        open={messageOpen}
        onClose={() => {
          if (!messageSending) setMessageOpen(false)
        }}
      >
        <div className="space-y-4">
          <div className="text-sm text-slate-600">
            Send a message to <span className="font-semibold text-slate-900">{agent.name}</span>.
          </div>
          <label className="block text-sm">
            Message
            <textarea
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 min-h-[120px]"
              value={messageBody}
              onChange={(e) => setMessageBody(e.target.value)}
              placeholder="Type your message..."
            />
          </label>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              className="pill-btn-ghost px-4"
              onClick={() => setMessageOpen(false)}
              disabled={messageSending}
            >
              Cancel
            </button>
            <button
              type="button"
              className="pill-btn-primary px-5"
              onClick={handleSendMessage}
              disabled={messageSending}
            >
              {messageSending ? 'Sending...' : 'Send message'}
            </button>
          </div>
        </div>
      </Modal>
    </main>
  )
}
