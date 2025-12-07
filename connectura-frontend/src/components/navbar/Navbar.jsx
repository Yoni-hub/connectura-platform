import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import AuthModal from './AuthModal'
import toast from 'react-hot-toast'

export default function Navbar() {
  const { user, logout } = useAuth()
  const [open, setOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

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
              Agents
            </Link>
            <Link to="/profile/create" className="text-slate-700 hover:text-[#7a0638]">
              Profile builder
            </Link>
            <Link to="/dashboard" className="text-slate-700 hover:text-[#7a0638]">
              Dashboard
            </Link>
            {user ? (
              <div className="flex items-center gap-2">
                <span className="text-slate-600 hidden lg:inline">{user.email}</span>
                <button
                  onClick={() => {
                    logout()
                    toast.success('Logged out')
                  }}
                  className="rounded-full border border-slate-200 px-3 py-1.5 hover:border-[#7a0638]/40 hover:text-[#7a0638]"
                >
                  Logout
                </button>
              </div>
            ) : (
              <button onClick={() => setOpen(true)} className="rounded-full bg-[#7a0638] px-4 py-2 text-white shadow hover:bg-[#5f042c]">
                Login / Sign up
              </button>
            )}
          </nav>
        </div>

        {menuOpen && (
          <div className="md:hidden border-t border-slate-200 bg-white/95 backdrop-blur">
            <div className="page-shell flex flex-col gap-3 py-3 text-sm">
              <Link to="/agents" className="text-slate-700 hover:text-[#7a0638]" onClick={() => setMenuOpen(false)}>
                Agents
              </Link>
              <Link to="/profile/create" className="text-slate-700 hover:text-[#7a0638]" onClick={() => setMenuOpen(false)}>
                Profile builder
              </Link>
              <Link to="/dashboard" className="text-slate-700 hover:text-[#7a0638]" onClick={() => setMenuOpen(false)}>
                Dashboard
              </Link>
              {user ? (
                <button
                  onClick={() => {
                    logout()
                    toast.success('Logged out')
                    setMenuOpen(false)
                  }}
                  className="rounded-full border border-slate-200 px-3 py-2 text-left hover:border-[#7a0638]/40 hover:text-[#7a0638]"
                >
                  Logout
                </button>
              ) : (
                <button
                  onClick={() => {
                    setOpen(true)
                    setMenuOpen(false)
                  }}
                  className="rounded-full bg-[#7a0638] px-4 py-2 text-white shadow hover:bg-[#5f042c]"
                >
                  Login / Sign up
                </button>
              )}
            </div>
          </div>
        )}
      </header>
      <AuthModal open={open} onClose={() => setOpen(false)} />
    </>
  )
}
