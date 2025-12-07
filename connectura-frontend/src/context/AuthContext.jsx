import { createContext, useContext, useEffect, useState } from 'react'
import { api } from '../services/api'
import toast from 'react-hot-toast'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [token, setToken] = useState(localStorage.getItem('connectura_token'))
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!token) return
    api
      .get('/auth/me')
      .then((res) => setUser(res.data.user))
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
      toast.success('Logged in')
      return true
    } catch (err) {
      toast.error(err.response?.data?.error || 'Login failed')
      return false
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
      toast.success('Account created')
      return true
    } catch (err) {
      toast.error(err.response?.data?.error || 'Signup failed')
      return false
    } finally {
      setLoading(false)
    }
  }

  const logout = () => {
    setUser(null)
    setToken(null)
    localStorage.removeItem('connectura_token')
  }

  return (
    <AuthContext.Provider value={{ user, token, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
