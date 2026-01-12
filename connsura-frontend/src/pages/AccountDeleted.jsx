import { useEffect } from 'react'
import { useAuth } from '../context/AuthContext'

export default function AccountDeleted() {
  const { logout } = useAuth()

  useEffect(() => {
    logout()
  }, [logout])

  return (
    <main className="page-shell py-12">
      <div className="surface p-6 max-w-xl mx-auto space-y-3">
        <h1 className="text-2xl font-semibold text-slate-900">Account deleted</h1>
        <p className="text-slate-700">Your Connsura account has been deleted successfully.</p>
        <p className="text-slate-700">We've signed you out and removed your profile from our platform.</p>
        <p className="text-slate-700">If you change your mind, you can create a new account anytime.</p>
      </div>
    </main>
  )
}
