import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import AuthModal from './AuthModal'
import { useAuth } from '../../context/AuthContext'
import { API_URL } from '../../services/api'

export default function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false)
  const [authOpen, setAuthOpen] = useState(false)
  const [authIntent, setAuthIntent] = useState('agent')
  const { user } = useAuth()

  useEffect(() => {
    const openCustomer = () => {
      setAuthIntent('customer')
      setAuthOpen(true)
    }
    const openAgent = () => {
      setAuthIntent('agent')
      setAuthOpen(true)
    }
    window.addEventListener('open-customer-auth', openCustomer)
    window.addEventListener('open-agent-auth', openAgent)
    return () => {
      window.removeEventListener('open-customer-auth', openCustomer)
      window.removeEventListener('open-agent-auth', openAgent)
    }
  }, [])

  const triggerAuth = (intent) => {
    setAuthIntent(intent)
    setAuthOpen(true)
  }

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="page-shell flex items-center justify-between py-3">
          <Link to="/" className="flex items-center gap-2 font-semibold text-[#7a0638]">
            <span className="grid h-10 w-10 place-items-center rounded-2xl bg-[#7a0638]/10 text-lg font-bold">C</span>
            <div className="leading-tight">
              <div className="text-base font-bold">Connectura</div>
              <div className="text-xs text-slate-500">Insurance matchmaking</div>
            </div>
          </Link>

          <button
            className="md:hidden rounded-lg border border-slate-200 p-2 text-slate-600"
            onClick={() => setMenuOpen((v) => !v)}
            aria-label="Toggle navigation"
          >
            <div className="h-0.5 w-5 bg-slate-700 mb-1" />
            <div className="h-0.5 w-5 bg-slate-700 mb-1" />
            <div className="h-0.5 w-5 bg-slate-700" />
          </button>

          <nav className="hidden items-center gap-5 text-sm md:flex">
            <Link to="/agents" className="text-slate-700 hover:text-[#7a0638]">
              Find agents
            </Link>
            <button type="button" onClick={() => triggerAuth('customer')} className="text-slate-700 hover:text-[#7a0638]">
              Build your insurance profile
            </button>
            {user?.role === 'AGENT' ? (
              <Link to="/agent/dashboard" className="text-slate-700 hover:text-[#7a0638]">
                Agent dashboard
              </Link>
            ) : (
              <button
                type="button"
                onClick={() => setAuthOpen(true)}
                className="text-slate-700 hover:text-[#7a0638]"
              >
                For agents
              </button>
            )}
            <Link to="/contact" className="text-slate-700 hover:text-[#7a0638]">
              About us
            </Link>
          </nav>
        </div>

        {menuOpen && (
          <div className="md:hidden border-t border-slate-200 bg-white/95 backdrop-blur">
            <div className="page-shell flex flex-col gap-3 py-3 text-sm">
              <Link to="/agents" className="text-slate-700 hover:text-[#7a0638]" onClick={() => setMenuOpen(false)}>
                Find agents
              </Link>
              <button
                type="button"
                className="text-left text-slate-700 hover:text-[#7a0638]"
                onClick={() => {
                  triggerAuth('customer')
                  setMenuOpen(false)
                }}
              >
                Build your insurance profile
              </button>
              {user?.role === 'AGENT' ? (
                <Link
                  to="/agent/dashboard"
                  className="text-slate-700 hover:text-[#7a0638]"
                  onClick={() => setMenuOpen(false)}
                >
                  Agent dashboard
                </Link>
              ) : (
                <button
                  type="button"
                  className="text-left text-slate-700 hover:text-[#7a0638]"
                  onClick={() => {
                    setAuthOpen(true)
                    setMenuOpen(false)
                  }}
                >
                  For agents
                </button>
              )}
              <Link to="/contact" className="text-slate-700 hover:text-[#7a0638]" onClick={() => setMenuOpen(false)}>
                About us
              </Link>
            </div>
          </div>
        )}
      </header>
      <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} intent={authIntent} />
    </>
  )
}
