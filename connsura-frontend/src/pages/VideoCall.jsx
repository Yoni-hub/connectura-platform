import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAgents } from '../context/AgentContext'
import Badge from '../components/ui/Badge'
import Skeleton from '../components/ui/Skeleton'

export default function VideoCall() {
  const { id } = useParams()
  const { getAgent } = useAgents()
  const [agent, setAgent] = useState(null)
  const [loading, setLoading] = useState(true)
  const nav = useNavigate()

  useEffect(() => {
    getAgent(id).then((data) => {
      setAgent(data)
      setLoading(false)
    })
  }, [id])

  if (loading || !agent) return <Skeleton className="m-6 h-48" />

  return (
    <main className="page-shell py-8 space-y-4">
      <div className="surface p-6 space-y-4">
        <div className="flex items-center gap-3">
          <img src={agent.photo} alt={agent.name} className="h-12 w-12 rounded-full object-cover" />
          <div>
            <div className="font-semibold text-lg">{agent.name}</div>
            <div className="text-sm text-slate-500">Video call UI (placeholder)</div>
          </div>
          <Badge label={agent.availability} tone="green" />
        </div>
        <div className="h-64 rounded-2xl bg-slate-900 grid place-items-center text-white">
          <div className="text-center">
            <div className="text-xl font-semibold">Live Video</div>
            <div className="text-sm text-white/70">This is a UI-only placeholder</div>
          </div>
        </div>
        <div className="flex gap-3">
          <button className="rounded-full bg-emerald-500 px-4 py-2 text-white">Mute</button>
          <button className="rounded-full bg-amber-500 px-4 py-2 text-white">Pause Video</button>
          <button onClick={() => nav(-1)} className="rounded-full bg-rose-600 px-4 py-2 text-white">
            End Call
          </button>
        </div>
      </div>
    </main>
  )
}
