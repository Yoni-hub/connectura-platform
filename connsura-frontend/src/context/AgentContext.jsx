import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { api } from '../services/api'
import toast from 'react-hot-toast'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

const AgentContext = createContext(null)
const normalizeAgent = (agent) => ({ ...agent, photo: `${API_URL}${agent.photo}` })

export function AgentProvider({ children }) {
  const [agents, setAgents] = useState([])
  const [loading, setLoading] = useState(false)

  const fetchAgents = useCallback(
    async (filters = {}) => {
      setLoading(true)
      try {
        const params = new URLSearchParams(filters).toString()
        const res = await api.get(`/agents${params ? `?${params}` : ''}`)
        setAgents(res.data.agents.map(normalizeAgent))
      } catch {
        toast.error('Failed to load agents')
      } finally {
        setLoading(false)
      }
    },
    [setAgents, setLoading]
  )

  const getAgent = async (id) => {
    try {
      const res = await api.get(`/agents/${id}`)
      return normalizeAgent(res.data.agent)
    } catch {
      toast.error('Could not load agent')
      return null
    }
  }

  useEffect(() => {
    fetchAgents()
  }, [fetchAgents])

  return <AgentContext.Provider value={{ agents, loading, fetchAgents, getAgent }}>{children}</AgentContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export const useAgents = () => useContext(AgentContext)
