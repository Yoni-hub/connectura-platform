import { createContext, useContext, useEffect, useState } from 'react'
import { api } from '../services/api'
import { useAuth } from './AuthContext'
import toast from 'react-hot-toast'

const ProfileContext = createContext(null)

export function ProfileProvider({ children }) {
  const { user } = useAuth()
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(false)

  const loadProfile = async () => {
    if (!user?.customerId) return
    setLoading(true)
    try {
      const res = await api.get(`/customers/${user.customerId}/profile`)
      const profilePayload = res.data.profile
      setProfile(profilePayload ? { ...profilePayload, profileData: profilePayload.profileData || {} } : null)
    } catch {
      // silent fail until profile is created
    } finally {
      setLoading(false)
    }
  }

  const saveProfile = async (payload) => {
    if (!user?.customerId) {
      toast.error('Customer account required')
      return
    }
    setLoading(true)
    try {
      const res = await api.post(`/customers/${user.customerId}/profile`, payload)
      const profilePayload = res.data.profile
      setProfile(profilePayload ? { ...profilePayload, profileData: profilePayload.profileData || {} } : null)
      toast.success('Profile saved')
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to save profile')
    } finally {
      setLoading(false)
    }
  }


  useEffect(() => {
    loadProfile()
  }, [user?.customerId])

  return (
    <ProfileContext.Provider value={{ profile, loading, saveProfile, loadProfile }}>
      {children}
    </ProfileContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export const useProfile = () => useContext(ProfileContext)
