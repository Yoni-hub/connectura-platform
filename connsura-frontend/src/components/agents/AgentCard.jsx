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

export default function AgentCard({ agent, onRate, onSave, onRemove, onViewProfile, saved = false }) {
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
        {Array.isArray(agent.products) && agent.products.length > 0 && (
          <div className="text-sm text-slate-600">Products: {agent.products.join(', ')}</div>
        )}
        <div className="text-xs text-slate-500">Licensed in: {agent.states.join(', ')}</div>
        <div className="mt-3 flex gap-2 flex-wrap">
          {onViewProfile ? (
            <button onClick={() => onViewProfile(agent)} className="pill-btn-ghost">
              View profile
            </button>
          ) : (
            <Link to={`/agents/${agent.id}`} className="pill-btn-ghost">
              View profile
            </Link>
          )}
          {onRate && (
            <button onClick={() => onRate(agent)} className="pill-btn-ghost">
              Rate Agent
            </button>
          )}
          {onSave && (
            <button
              onClick={() => onSave(agent)}
              className={`pill-btn-ghost ${saved ? 'opacity-60 cursor-default' : ''}`}
              disabled={saved}
            >
              {saved ? 'Saved' : 'Save Agent'}
            </button>
          )}
          {onRemove && (
            <button onClick={() => onRemove(agent)} className="pill-btn-ghost text-rose-600 hover:text-rose-700">
              Remove Agent
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
