import axios from 'axios'
import { API_URL } from './api'

export const ADMIN_TOKEN_KEY = 'connsura_admin_token'

export const adminApi = axios.create({
  baseURL: API_URL,
})

adminApi.interceptors.request.use((config) => {
  const token = localStorage.getItem(ADMIN_TOKEN_KEY)
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})
