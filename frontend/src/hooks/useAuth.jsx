import { useState, useEffect, createContext, useContext } from 'react'
import api from '../utils/api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Support older key once, then normalize to a single key.
    const token = localStorage.getItem('seo_token') || localStorage.getItem('token')
    if (token) {
      localStorage.setItem('seo_token', token)
      localStorage.removeItem('token')
      api.defaults.headers.common['Authorization'] = `Bearer ${token}`
      api.get('/auth/me')
        .then(res => setUser(res.data))
        .catch(() => {
          localStorage.removeItem('seo_token')
          localStorage.removeItem('token')
          delete api.defaults.headers.common['Authorization']
        })
        .finally(() => setLoading(false))
    } else {
      setLoading(false)
    }
  }, [])

  const login = async (googleToken) => {
    const res = await api.post('/auth/google', { token: googleToken })
    const { token } = res.data
    localStorage.setItem('seo_token', token)
    api.defaults.headers.common['Authorization'] = `Bearer ${token}`
    const me = await api.get('/auth/me')
    setUser(me.data)
    return me.data
  }

  const loginWithEmail = async (email) => {
    const res = await api.post('/auth/email', { email })
    const { token } = res.data
    localStorage.setItem('seo_token', token)
    api.defaults.headers.common['Authorization'] = `Bearer ${token}`
    const me = await api.get('/auth/me')
    setUser(me.data)
    return me.data
  }

  const refreshUser = async () => {
    const me = await api.get('/auth/me')
    setUser(me.data)
    return me.data
  }

  const logout = () => {
    localStorage.removeItem('seo_token')
    localStorage.removeItem('token')
    delete api.defaults.headers.common['Authorization']
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, loginWithEmail, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
