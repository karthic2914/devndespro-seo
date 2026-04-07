const axios = require('axios')
const { pool } = require('../clients')

async function getGscAccessToken(refreshToken) {
  const { data } = await axios.post('https://oauth2.googleapis.com/token', {
    client_id: process.env.GOOGLE_CLIENT_ID,
    client_secret: process.env.GOOGLE_CLIENT_SECRET,
    refresh_token: refreshToken,
    grant_type: 'refresh_token',
  })
  return data.access_token
}

async function ensureSiteIsVerifiedInGsc(userId, siteUrl) {
  const { rows: userRows } = await pool.query('SELECT gsc_refresh_token FROM users WHERE id=$1', [userId])
  const refreshToken = userRows[0]?.gsc_refresh_token
  if (!refreshToken) {
    throw new Error('Connect Google Search Console first to validate domain ownership before adding a project.')
  }

  const accessToken = await getGscAccessToken(refreshToken)
  const { data } = await axios.get('https://www.googleapis.com/webmasters/v3/sites', {
    headers: { Authorization: `Bearer ${accessToken}` },
    timeout: 12000,
  })

  const entries = data?.siteEntry || []
  const targetHost = new URL(siteUrl).hostname.toLowerCase().replace(/^www\./, '')

  const isVerified = entries.some((entry) => {
    const property = String(entry?.siteUrl || '').trim().toLowerCase()
    const permission = String(entry?.permissionLevel || '').trim()
    if (!property || permission === 'siteUnverifiedUser') return false

    if (property.startsWith('sc-domain:')) {
      const domain = property.replace('sc-domain:', '').replace(/^www\./, '')
      return targetHost === domain || targetHost.endsWith(`.${domain}`)
    }

    try {
      const propertyHost = new URL(property).hostname.toLowerCase().replace(/^www\./, '')
      return targetHost === propertyHost || targetHost.endsWith(`.${propertyHost}`) || propertyHost.endsWith(`.${targetHost}`)
    } catch {
      return false
    }
  })

  if (!isVerified) {
    throw new Error('This domain is not verified in your Google Search Console account. Verify the property in GSC first.')
  }
}

module.exports = { getGscAccessToken, ensureSiteIsVerifiedInGsc }
