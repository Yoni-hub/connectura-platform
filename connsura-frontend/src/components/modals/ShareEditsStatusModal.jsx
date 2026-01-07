import Modal from '../ui/Modal'

const statusCopy = {
  pending: {
    title: 'Awaiting client approval',
    message: 'Changes were sent to the client. You will see an update once they accept or decline.',
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
  const isPending = normalized === 'pending'
  const isAccepted = normalized === 'accepted'

  return (
    <Modal title={copy.title} open={open} onClose={isPending ? undefined : onClose} showClose={!isPending}>
      <div className="space-y-3 text-sm text-slate-600">
        {isAccepted && (
          <div className="flex justify-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#006aff]/10 text-[#006aff]">
              <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="3">
                <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          </div>
        )}
        <p>{copy.message}</p>
        {copy.helper ? <p className="text-xs text-slate-400">{copy.helper}</p> : null}
      </div>
    </Modal>
  )
}
