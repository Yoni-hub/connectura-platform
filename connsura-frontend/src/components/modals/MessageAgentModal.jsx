import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { useAuth } from '../../context/AuthContext'
import { api } from '../../services/api'
import Modal from '../ui/Modal'

export default function MessageAgentModal({ open, agent, onClose, onSent }) {
  const { user } = useAuth()
  const [messageBody, setMessageBody] = useState('')
  const [sending, setSending] = useState(false)

  useEffect(() => {
    if (open) {
      setMessageBody('')
    }
  }, [open, agent?.id])

  if (!agent) return null

  const handleSend = async () => {
    const body = messageBody.trim()
    if (!body) {
      toast.error('Message cannot be empty')
      return
    }
    if (!user) {
      toast.error('Login to send a message')
      return
    }
    if (user.role !== 'CUSTOMER') {
      toast.error('Only customers can message agents')
      return
    }
    setSending(true)
    try {
      const convoRes = await api.post('/api/messages/conversations', { agentId: agent.id })
      const conversationId = convoRes.data?.conversationId
      if (!conversationId) {
        throw new Error('No conversation id')
      }
      await api.post(`/api/messages/conversations/${conversationId}/messages`, { body })
      toast.success('Message sent')
      setMessageBody('')
      onSent?.(agent)
      onClose?.()
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to send message')
    } finally {
      setSending(false)
    }
  }

  return (
    <Modal
      title="Message agent"
      open={open}
      onClose={() => {
        if (!sending) onClose?.()
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
          <button type="button" className="pill-btn-ghost px-4" onClick={onClose} disabled={sending}>
            Cancel
          </button>
          <button type="button" className="pill-btn-primary px-5" onClick={handleSend} disabled={sending}>
            {sending ? 'Sending...' : 'Send message'}
          </button>
        </div>
      </div>
    </Modal>
  )
}
