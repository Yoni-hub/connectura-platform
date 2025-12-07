import { useNavigate } from 'react-router-dom'
import ProfileForm from '../components/profile/ProfileForm'
import { useProfile } from '../context/ProfileContext'
import { useAuth } from '../context/AuthContext'
import toast from 'react-hot-toast'

export default function CreateProfile() {
  const { profile, saveProfile, loading } = useProfile()
  const { user } = useAuth()
  const nav = useNavigate()

  const handleSave = async (payload) => {
    const hasUser = user?.customerId
    if (!hasUser) {
      toast.error('Login as customer to save profile')
      return
    }
    await saveProfile(payload)
    nav('/dashboard')
  }

  return (
    <main className="page-shell py-8 space-y-4">
      <div className="surface p-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between mb-2">
          <h1 className="text-2xl font-semibold">Create your insurance profile</h1>
          <span className="text-sm text-slate-500">Customer dashboard + share with agent</span>
        </div>
        <ProfileForm initial={profile || { name: user?.email }} onSave={handleSave} busy={loading} />
      </div>
    </main>
  )
}
