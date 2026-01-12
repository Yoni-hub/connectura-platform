import axios from 'axios'
import { API_URL } from './api'

export const adminApi = axios.create({
  baseURL: API_URL,
  withCredentials: true,
})
