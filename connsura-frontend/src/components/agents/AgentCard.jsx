import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import Badge from '../ui/Badge'

const getInitials = (name = '', fallback = 'AG') => {
  const parts = name.trim().split(' ').filter(Boolean)
  if (!parts.length) return fallback
  return parts
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase()
}

export default function AgentCard({ agent, onVoice, onVideo, onMessage }) {
  const statusTone = agent.availability === 'online' ? 'green' : agent.availability === 'busy' ? 'amber' : 'gray'
  const [photoError, setPhotoError] = useState(false)
  const initials = getInitials(agent.name)

  useEffect(() => {
    setPhotoError(false)
  }, [agent.photo])

  const showPhoto = agent.photo && !photoError
  return (
    <div className="glass rounded-2xl p-5 flex gap-4 items-center hover:shadow-lg transition bg-white">
      <div className="h-16 w-16 rounded-2xl bg-slate-100 overflow-hidden flex items-center justify-center shadow-inner border border-slate-200">
        {showPhoto ? (
          <img
            src={agent.photo}
            alt={agent.name}
            className="h-full w-full object-cover"
            onError={() => setPhotoError(true)}
          />
        ) : (
          <span className="text-lg font-semibold text-slate-500">{initials}</span>
        )}
      </div>
      <div className="flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <h4 className="text-lg font-semibold">{agent.name}</h4>
          <Badge label={`${agent.rating.toFixed(1)} rating`} tone="blue" />
          <Badge label={agent.availability} tone={statusTone} />
        </div>
        <div className="text-sm text-slate-600">
          {agent.specialty} • {agent.languages.join(', ')}
        </div>
        <div className="text-xs text-slate-500">Licensed in: {agent.states.join(', ')}</div>
        <div className="mt-3 flex gap-2 flex-wrap">
          <Link to={`/agents/${agent.id}`} className="pill-btn-ghost">
            View profile
          </Link>
          <button onClick={() => onVoice?.(agent)} className="pill-btn-primary">
            Voice call
          </button>
          <button onClick={() => onVideo?.(agent)} className="pill-btn bg-slate-900 text-white hover:bg-slate-800">
            Video call
          </button>
          {onMessage && (
            <button onClick={() => onMessage(agent)} className="pill-btn-ghost">
              Message
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
