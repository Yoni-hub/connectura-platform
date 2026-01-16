import axios from 'axios'
import { API_URL } from './api'

const ADMIN_TOKEN_KEY = 'connsura_admin_token'

export const getAdminToken = () => {
  try {
    return localStorage.getItem(ADMIN_TOKEN_KEY)
  } catch {
    return null
  }
}

export const setAdminToken = (token) => {
  try {
    if (!token) {
      localStorage.removeItem(ADMIN_TOKEN_KEY)
      return
    }
    localStorage.setItem(ADMIN_TOKEN_KEY, token)
  } catch {
    // ignore storage failures
  }
}

export const clearAdminToken = () => setAdminToken(null)

export const adminApi = axios.create({
  baseURL: API_URL,
  withCredentials: true,
})

adminApi.interceptors.request.use((config) => {
  const token = getAdminToken()
  if (token) {
    config.headers = config.headers || {}
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})
