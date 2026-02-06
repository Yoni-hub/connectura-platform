import { createContext, useContext, useEffect, useState } from 'react'
import { api } from '../services/api'
import { clearStoredToken, getStoredToken, setStoredToken } from '../utils/authStorage'
import toast from 'react-hot-toast'

const AuthContext = createContext(null)

const getSessionId = () => {
  if (typeof window === 'undefined') return 'server'
  const key = 'connsura_session_id'
  let value = sessionStorage.getItem(key)
  if (!value) {
    value = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
    sessionStorage.setItem(key, value)
  }
  return value
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [token, setToken] = useState(getStoredToken())
  const [loading, setLoading] = useState(false)
  const [authChecking, setAuthChecking] = useState(true)
  const [lastPassword, setLastPassword] = useState('')
  const [consentStatus, setConsentStatus] = useState(null)

  useEffect(() => {
    let active = true
    setAuthChecking(true)
    api
      .get('/auth/me')
      .then((res) => {
        if (!active) return
        setUser(res.data.user)
        setConsentStatus(res.data.consent || null)
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
        if (!active) return
        setUser(null)
        setToken(null)
        setConsentStatus(null)
        clearStoredToken()
      })
      .finally(() => {
        if (active) {
          setAuthChecking(false)
        }
      })
    return () => {
      active = false
    }
  }, [token])

  const applyAuth = (nextToken, nextUser, password, options = {}) => {
    const persist = options.persist !== false
    setToken(nextToken)
    setUser(nextUser)
    setStoredToken(nextToken, { persist })
    if (options.consent !== undefined) {
      setConsentStatus(options.consent)
    }
    if (password) {
      setLastPassword(password)
    }
    if (nextUser?.role === 'AGENT') {
      const pending = nextUser.agentStatus && nextUser.agentStatus !== 'approved'
      const suspended = nextUser.agentSuspended
      if (pending || suspended) {
        localStorage.setItem('connsura_agent_onboarding_pending', 'true')
        localStorage.setItem('connsura_agent_onboarding_submitted', 'true')
      } else {
        localStorage.removeItem('connsura_agent_onboarding_pending')
        localStorage.removeItem('connsura_agent_onboarding_submitted')
      }
    }
  }

  const login = async (email, password, options = {}) => {
    setLoading(true)
    try {
      const res = await api.post('/auth/login', { email, password, sessionId: getSessionId() })
      const remember = options.remember !== false
      applyAuth(res.data.token, res.data.user, password, { persist: remember, consent: res.data.consent || null })
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
      applyAuth(res.data.token, res.data.user, payload.password, { persist: true, consent: res.data.consent || null })
      if (res.data.user.role === 'AGENT') {
        localStorage.setItem('connsura_agent_onboarding_pending', 'true')
        localStorage.removeItem('connsura_agent_onboarding_submitted')
      }
      if (res.data.user.role === 'CUSTOMER') {
        sessionStorage.setItem('connsura_force_dashboard', 'true')
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

  const logout = async () => {
    try {
      await api.post('/auth/logout')
    } catch {
      // Ignore logout failures; still clear local state.
    }
    setUser(null)
    setToken(null)
    setLastPassword('')
    setConsentStatus(null)
    clearStoredToken()
    localStorage.removeItem('connsura_agent_onboarding_pending')
    localStorage.removeItem('connsura_agent_onboarding_submitted')
    sessionStorage.removeItem('connsura_force_dashboard')
  }

  return (
    <AuthContext.Provider value={{
      user,
      token,
      loading,
      authReady: !authChecking,
      login,
      register,
      completeAuth: applyAuth,
      logout,
      lastPassword,
      setLastPassword,
      setUser,
      consentStatus,
      setConsentStatus,
    }}
    >
      {children}
    </AuthContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => useContext(AuthContext)
