import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import AuthModal from './AuthModal'
import { useAuth } from '../../context/AuthContext'
import { API_URL } from '../../services/api'
import AgentSearchModal from '../modals/AgentSearchModal'

export default function Navbar() {
  const nav = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)
  const [authOpen, setAuthOpen] = useState(false)
  const [authIntent, setAuthIntent] = useState('agent')
  const [agentChoiceOpen, setAgentChoiceOpen] = useState(false)
  const [agentSearchOpen, setAgentSearchOpen] = useState(false)
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

  const markAgentFlowSeen = () => {
    try {
      localStorage.setItem('connectura_agent_flow_seen', 'true')
    } catch {}
  }

  const handleForAgentsClick = () => {
    setMenuOpen(false)
    const seen = localStorage.getItem('connectura_agent_flow_seen') === 'true'
    if (seen) {
      setAgentSearchOpen(true)
      return
    }
    setAgentChoiceOpen(true)
  }

  const chooseAgent = () => {
    markAgentFlowSeen()
    setAgentChoiceOpen(false)
    setAgentSearchOpen(true)
  }

  const chooseAgency = () => {
    markAgentFlowSeen()
    setAgentChoiceOpen(false)
    nav('/agents')
  }

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-transparent bg-white/95 backdrop-blur shadow-none">
        <div className="page-shell flex items-center justify-between py-3">
          <Link to="/" className="flex items-center gap-3 font-semibold text-[#0b3b8c]">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#e7f0ff] text-lg font-bold text-[#006aff] shadow-[0_8px_20px_rgba(0,42,92,0.1)]">
              C
            </span>
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
            <Link to="/agents" className="text-slate-700 hover:text-[#0b3b8c]">
              Find agents
            </Link>
            <button type="button" onClick={() => triggerAuth('customer')} className="text-slate-700 hover:text-[#0b3b8c]">
              Build your insurance profile
            </button>
            {user?.role === 'AGENT' ? (
              (user?.agentStatus && user.agentStatus !== 'approved') || user?.agentSuspended ? (
                <Link to="/agent/onboarding" className="text-slate-700 hover:text-[#0b3b8c]">
                  Agent onboarding
                </Link>
              ) : (
                <Link to="/agent/dashboard" className="text-slate-700 hover:text-[#0b3b8c]">
                  Agent dashboard
                </Link>
              )
            ) : (
              <button type="button" onClick={handleForAgentsClick} className="text-slate-700 hover:text-[#0b3b8c]">
                For agents
              </button>
            )}
            <Link to="/contact" className="text-slate-700 hover:text-[#0b3b8c]">
              About us
            </Link>
          </nav>
        </div>

        {menuOpen && (
          <div className="md:hidden border-t border-[#dfe7f3] bg-white/95 backdrop-blur shadow-[0_16px_34px_rgba(0,42,92,0.08)]">
            <div className="page-shell flex flex-col gap-3 py-3 text-sm">
              <Link to="/agents" className="text-slate-700 hover:text-[#0b3b8c]" onClick={() => setMenuOpen(false)}>
                Find agents
              </Link>
              <button
                type="button"
                className="text-left text-slate-700 hover:text-[#0b3b8c]"
                onClick={() => {
                  triggerAuth('customer')
                  setMenuOpen(false)
                }}
              >
                Build your insurance profile
              </button>
              {user?.role === 'AGENT' ? (
                (user?.agentStatus && user.agentStatus !== 'approved') || user?.agentSuspended ? (
                  <Link
                    to="/agent/onboarding"
                    className="text-slate-700 hover:text-[#0b3b8c]"
                    onClick={() => setMenuOpen(false)}
                  >
                    Agent onboarding
                  </Link>
                ) : (
                  <Link
                    to="/agent/dashboard"
                    className="text-slate-700 hover:text-[#0b3b8c]"
                    onClick={() => setMenuOpen(false)}
                  >
                    Agent dashboard
                  </Link>
                )
              ) : (
                <button
                  type="button"
                  className="text-left text-slate-700 hover:text-[#0b3b8c]"
                  onClick={() => {
                    handleForAgentsClick()
                  }}
                >
                  For agents
                </button>
              )}
              <Link to="/contact" className="text-slate-700 hover:text-[#0b3b8c]" onClick={() => setMenuOpen(false)}>
                About us
              </Link>
            </div>
          </div>
        )}
      </header>
      <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} intent={authIntent} />

      {agentChoiceOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-xs rounded-2xl bg-white p-5 shadow-2xl space-y-4 text-center">
            <div className="text-sm font-semibold text-slate-800">Continue as</div>
            <div className="flex flex-col gap-2">
              <button
                type="button"
                className="rounded-lg border border-[#0b3b8c] px-4 py-2 text-[#0b3b8c] font-semibold hover:bg-[#e7f0ff]"
                onClick={chooseAgent}
              >
                Agent
              </button>
              <button
                type="button"
                className="rounded-lg border border-[#0b3b8c] px-4 py-2 text-[#0b3b8c] font-semibold hover:bg-[#e7f0ff]"
                onClick={chooseAgency}
              >
                Agency
              </button>
            </div>
            <button type="button" className="text-xs text-slate-500 hover:text-slate-700" onClick={() => setAgentChoiceOpen(false)}>
              Cancel
            </button>
          </div>
        </div>
      )}

      <AgentSearchModal open={agentSearchOpen} onClose={() => setAgentSearchOpen(false)} />
    </>
  )
}
