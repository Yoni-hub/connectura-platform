import { createContext, useContext, useEffect, useState } from 'react'
import { api } from '../services/api'
import toast from 'react-hot-toast'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [token, setToken] = useState(localStorage.getItem('connectura_token'))
  const [loading, setLoading] = useState(false)
  const [lastPassword, setLastPassword] = useState('')

  useEffect(() => {
    if (!token) return
    api
      .get('/auth/me')
      .then((res) => {
        setUser(res.data.user)
        if (res.data.user?.role === 'AGENT') {
          const pending = res.data.user.agentStatus && res.data.user.agentStatus !== 'approved'
          const suspended = res.data.user.agentSuspended
          if (pending || suspended) {
            localStorage.setItem('connectura_agent_onboarding_pending', 'true')
            localStorage.setItem('connectura_agent_onboarding_submitted', 'true')
          } else {
            localStorage.removeItem('connectura_agent_onboarding_pending')
            localStorage.removeItem('connectura_agent_onboarding_submitted')
          }
        }
      })
      .catch(() => {
        setUser(null)
        setToken(null)
        localStorage.removeItem('connectura_token')
      })
  }, [token])

  const login = async (email, password) => {
    setLoading(true)
    try {
      const res = await api.post('/auth/login', { email, password })
      setToken(res.data.token)
      setUser(res.data.user)
      localStorage.setItem('connectura_token', res.data.token)
      setLastPassword(password)
      if (res.data.user.role === 'AGENT') {
        const pending = res.data.user.agentStatus && res.data.user.agentStatus !== 'approved'
        const suspended = res.data.user.agentSuspended
        if (pending || suspended) {
          localStorage.setItem('connectura_agent_onboarding_pending', 'true')
          localStorage.setItem('connectura_agent_onboarding_submitted', 'true')
        } else {
          localStorage.removeItem('connectura_agent_onboarding_pending')
          localStorage.removeItem('connectura_agent_onboarding_submitted')
        }
      }
      toast.success('Logged in')
      return res.data.user
    } catch (err) {
      toast.error(err.response?.data?.error || 'Login failed')
      return null
    } finally {
      setLoading(false)
    }
  }

  const register = async (payload) => {
    setLoading(true)
    try {
      const res = await api.post('/auth/register', payload)
      setToken(res.data.token)
      setUser(res.data.user)
      localStorage.setItem('connectura_token', res.data.token)
      setLastPassword(payload.password)
      if (res.data.user.role === 'AGENT') {
        localStorage.setItem('connectura_agent_onboarding_pending', 'true')
        localStorage.removeItem('connectura_agent_onboarding_submitted')
      }
      toast.success('Account created')
      return res.data.user
    } catch (err) {
      toast.error(err.response?.data?.error || 'Signup failed')
      return null
    } finally {
      setLoading(false)
    }
  }

  const logout = () => {
    setUser(null)
    setToken(null)
    setLastPassword('')
    localStorage.removeItem('connectura_token')
    localStorage.removeItem('connectura_agent_onboarding_pending')
    localStorage.removeItem('connectura_agent_onboarding_submitted')
  }

  return (
    <AuthContext.Provider value={{ user, token, loading, login, register, logout, lastPassword, setLastPassword, setUser }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
