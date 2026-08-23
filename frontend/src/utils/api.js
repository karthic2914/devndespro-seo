import axios from 'axios'
import { Capacitor } from '@capacitor/core'

const api = axios.create({
  baseURL: Capacitor.isNativePlatform() ? `${import.meta.env.VITE_API_URL}/api` : '/api',
  headers: { 'Content-Type': 'application/json' }
})

api.interceptors.response.use(
  res => res,
  err => {
    if (err.response?.status === 401) {
      localStorage.removeItem('seo_token')
      localStorage.removeItem('token')
      window.location.href = '/login'
    }
    return Promise.reject(err)
  }
)

export default api




