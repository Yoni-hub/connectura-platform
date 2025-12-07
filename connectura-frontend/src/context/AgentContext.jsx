import { createContext, useContext, useEffect, useState } from 'react'
import { api } from '../services/api'
import toast from 'react-hot-toast'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

const AgentContext = createContext(null)

export function AgentProvider({ children }) {
  const [agents, setAgents] = useState([])
  const [loading, setLoading] = useState(false)

  const normalize = (agent) => ({ ...agent, photo: `${API_URL}${agent.photo}` })

  const fetchAgents = async (filters = {}) => {
    setLoading(true)
    try {
      const params = new URLSearchParams(filters).toString()
      const res = await api.get(`/agents${params ? `?${params}` : ''}`)
      setAgents(res.data.agents.map(normalize))
    } catch (err) {
      toast.error('Failed to load agents')
    } finally {
      setLoading(false)
    }
  }

  const getAgent = async (id) => {
    try {
      const res = await api.get(`/agents/${id}`)
      return normalize(res.data.agent)
    } catch (err) {
      toast.error('Could not load agent')
      return null
    }
  }

  useEffect(() => {
    fetchAgents()
  }, [])

  return <AgentContext.Provider value={{ agents, loading, fetchAgents, getAgent }}>{children}</AgentContext.Provider>
}

export const useAgents = () => useContext(AgentContext)
