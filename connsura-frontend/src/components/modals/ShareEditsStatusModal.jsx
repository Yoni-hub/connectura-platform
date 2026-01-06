import Modal from '../ui/Modal'

const statusCopy = {
  pending: {
    title: 'Awaiting client approval',
    message: 'Changes were sent to the client. You will see an update once they accept or decline.',
    helper: 'Keep the tab open if you want instant updates.',
  },
  accepted: {
    title: 'Changes accepted',
    message: 'The client approved your edits. Profile sharing stays active.',
    helper: 'You can continue editing and submit more changes if needed.',
  },
  declined: {
    title: 'Sharing stopped',
    message: 'The client declined the edits or stopped sharing this profile.',
    helper: 'This session is no longer active.',
  },
}

export default function ShareEditsStatusModal({ open, status, onClose }) {
  if (!open) return null
  const normalized = status && statusCopy[status] ? status : 'pending'
  const copy = statusCopy[normalized]

  return (
    <Modal title={copy.title} open={open} onClose={onClose}>
      <div className="space-y-2 text-sm text-slate-600">
        <p>{copy.message}</p>
        <p className="text-xs text-slate-400">{copy.helper}</p>
      </div>
    </Modal>
  )
}
