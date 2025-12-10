import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { API_URL } from '../services/api'

export default function ClientDashboard() {
  const { user, logout } = useAuth()
  const nav = useNavigate()

  useEffect(() => {
    if (!user) return
  }, [user])

  const initials = user?.name
    ? user.name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .slice(0, 2)
        .toUpperCase()
    : 'C'

  return (
    <main className="page-shell py-8 space-y-6">
      <div className="flex items-center gap-3">
        <div className="h-12 w-12 rounded-full bg-[#7a0638]/10 text-[#7a0638] grid place-items-center font-bold text-lg">C</div>
        <div>
          <div className="font-semibold text-[#7a0638]">Connectura</div>
          <div className="text-xs text-slate-500">Insurance matchmaking</div>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="grid gap-1">
          <h1 className="text-2xl font-semibold">Connectura Client Dashboard</h1>
          <p className="text-slate-600">Welcome back, {user?.name || user?.email || 'client'}.</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            className="pill-btn-ghost px-5"
            onClick={() => {
              logout()
              nav('/', { replace: true })
            }}
          >
            Log out
          </button>
          <div className="h-12 w-12 rounded-full bg-[#7a0638]/15 text-[#7a0638] grid place-items-center font-bold">
            {initials}
          </div>
        </div>
      </div>

      <section className="surface p-4 sm:p-6">
        <iframe
          title="Insurance profile form"
          src={`${API_URL}/forms/customer-information.html`}
          className="w-full"
          style={{ minHeight: '80vh', border: 'none' }}
        />
      </section>
    </main>
  )
}
