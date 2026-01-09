import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { useAuth } from '../../context/AuthContext'
import { api } from '../../services/api'
import Modal from '../ui/Modal'

export default function RateAgentModal({ open, agent, onClose, onSubmitted }) {
  const { user } = useAuth()
  const [rating, setRating] = useState(0)
  const [comment, setComment] = useState('')
  const [sending, setSending] = useState(false)

  useEffect(() => {
    if (open) {
      setRating(0)
      setComment('')
    }
  }, [open, agent?.id])

  if (!agent) return null

  const handleSubmit = async () => {
    if (!user) {
      toast.error('Login to rate an agent')
      return
    }
    if (user.role !== 'CUSTOMER') {
      toast.error('Only customers can rate agents')
      return
    }
    if (!rating) {
      toast.error('Select a rating first')
      return
    }
    setSending(true)
    try {
      const res = await api.post(`/agents/${agent.id}/reviews`, { rating, comment })
      toast.success('Thanks for your rating')
      onSubmitted?.(res.data.agent)
      onClose?.()
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to submit rating')
    } finally {
      setSending(false)
    }
  }

  return (
    <Modal
      title="Rate agent"
      open={open}
      onClose={() => {
        if (!sending) onClose?.()
      }}
    >
      <div className="space-y-4">
        <div className="text-sm text-slate-600">
          Rate <span className="font-semibold text-slate-900">{agent.name}</span>.
        </div>
        <div>
          <div className="text-sm font-semibold text-slate-700">Rating</div>
          <div className="mt-2 flex flex-wrap gap-2">
            {[1, 2, 3, 4, 5].map((value) => (
              <button
                key={value}
                type="button"
                aria-label={`Rate ${value} star${value === 1 ? '' : 's'}`}
                className={`h-10 w-10 rounded-full border transition ${
                  rating >= value ? 'bg-amber-500 text-white border-amber-500' : 'bg-white text-amber-500 border-slate-200'
                }`}
                onClick={() => setRating(value)}
                disabled={sending}
              >
                <svg
                  aria-hidden="true"
                  viewBox="0 0 24 24"
                  className="mx-auto h-5 w-5 fill-current"
                >
                  <path d="M12 17.27l-5.18 2.73 0.99-5.78-4.2-4.09 5.8-0.84L12 4l2.59 5.29 5.8 0.84-4.2 4.09 0.99 5.78z" />
                </svg>
              </button>
            ))}
          </div>
        </div>
        <label className="block text-sm">
          Comment (optional)
          <textarea
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 min-h-[110px]"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Share a short note..."
            disabled={sending}
          />
        </label>
        <div className="flex justify-end gap-2">
          <button type="button" className="pill-btn-ghost px-4" onClick={onClose} disabled={sending}>
            Cancel
          </button>
          <button type="button" className="pill-btn-primary px-5" onClick={handleSubmit} disabled={sending}>
            {sending ? 'Submitting...' : 'Submit rating'}
          </button>
        </div>
      </div>
    </Modal>
  )
}
