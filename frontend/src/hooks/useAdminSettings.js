import { useEffect, useState } from 'react'
import api from '../utils/api'

export default function useAdminSettings() {
  const [settings, setSettings] = useState({ cold_emails_enabled: true })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    api.get('/settings')
      .then(r => setSettings(r.data || {}))
      .catch(() => setSettings({ cold_emails_enabled: true }))
      .finally(() => setLoading(false))
  }, [])

  return { settings, loading }
}
