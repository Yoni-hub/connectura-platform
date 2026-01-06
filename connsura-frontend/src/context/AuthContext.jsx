import { createContext, useContext, useEffect, useState } from 'react'
import { api } from '../services/api'
import toast from 'react-hot-toast'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [token, setToken] = useState(localStorage.getItem('connsura_token'))
  const [loading, setLoading] = useState(false)
  const [authChecking, setAuthChecking] = useState(true)
  const [lastPassword, setLastPassword] = useState('')

  useEffect(() => {
    if (!token) {
      setAuthChecking(false)
      return
    }
    setAuthChecking(true)
    api
      .get('/auth/me')
      .then((res) => {
        setUser(res.data.user)
        if (res.data.user?.role === 'AGENT') {
          const pending = res.data.user.agentStatus && res.data.user.agentStatus !== 'approved'
          const suspended = res.data.user.agentSuspended
          if (pending || suspended) {
            localStorage.setItem('connsura_agent_onboarding_pending', 'true')
            localStorage.setItem('connsura_agent_onboarding_submitted', 'true')
          } else {
            localStorage.removeItem('connsura_agent_onboarding_pending')
            localStorage.removeItem('connsura_agent_onboarding_submitted')
          }
        }
      })
      .catch(() => {
        setUser(null)
        setToken(null)
        localStorage.removeItem('connsura_token')
      })
      .finally(() => {
        setAuthChecking(false)
      })
  }, [token])

  const login = async (email, password) => {
    setLoading(true)
    try {
      const res = await api.post('/auth/login', { email, password })
      setToken(res.data.token)
      setUser(res.data.user)
      localStorage.setItem('connsura_token', res.data.token)
      setLastPassword(password)
      if (res.data.user.role === 'AGENT') {
        const pending = res.data.user.agentStatus && res.data.user.agentStatus !== 'approved'
        const suspended = res.data.user.agentSuspended
        if (pending || suspended) {
          localStorage.setItem('connsura_agent_onboarding_pending', 'true')
          localStorage.setItem('connsura_agent_onboarding_submitted', 'true')
        } else {
          localStorage.removeItem('connsura_agent_onboarding_pending')
          localStorage.removeItem('connsura_agent_onboarding_submitted')
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
      localStorage.setItem('connsura_token', res.data.token)
      setLastPassword(payload.password)
      if (res.data.user.role === 'AGENT') {
        localStorage.setItem('connsura_agent_onboarding_pending', 'true')
        localStorage.removeItem('connsura_agent_onboarding_submitted')
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
    localStorage.removeItem('connsura_token')
    localStorage.removeItem('connsura_agent_onboarding_pending')
    localStorage.removeItem('connsura_agent_onboarding_submitted')
  }

  return (
    <AuthContext.Provider value={{
      user,
      token,
      loading,
      authReady: !authChecking,
      login,
      register,
      logout,
      lastPassword,
      setLastPassword,
      setUser,
    }}
    >
      {children}
    </AuthContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => useContext(AuthContext)
