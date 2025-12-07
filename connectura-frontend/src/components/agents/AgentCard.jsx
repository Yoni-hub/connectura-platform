import { Link } from 'react-router-dom'
import Badge from '../ui/Badge'

export default function AgentCard({ agent, onVoice, onVideo, onSave }) {
  const statusTone = agent.availability === 'online' ? 'green' : agent.availability === 'busy' ? 'amber' : 'gray'
  return (
    <div className="glass rounded-2xl p-5 flex gap-4 items-center hover:shadow-lg transition bg-white">
      <div className="h-16 w-16 rounded-2xl bg-slate-100 overflow-hidden flex items-center justify-center shadow-inner border border-slate-200">
        <img src={agent.photo} alt={agent.name} className="h-full w-full object-cover" />
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
          {onSave && (
            <button onClick={() => onSave(agent)} className="pill-btn-ghost">
              Save preferred
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
