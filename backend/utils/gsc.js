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
  // GSC verification is advisory only - any site can be added
  // If user has GSC connected, we check and log but never block
  try {
    const { rows: userRows } = await pool.query('SELECT gsc_refresh_token FROM users WHERE id=$1', [userId])
    const refreshToken = userRows[0]?.gsc_refresh_token
    if (!refreshToken) return // No GSC connected - allow anyway

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
      } catch { return false }
    })

    if (!isVerified) {
      console.log(`[GSC] Site ${siteUrl} not in GSC - added anyway`)
    }
  } catch (e) {
    console.log('[GSC] Verification skipped:', e.message)
    // Never block - just log and continue
  }
}

async function resolveGscPropertyUrl(accessToken, siteUrl) {
  // Finds the exact GSC property string (sc-domain:... or https://.../) that matches siteUrl.
  // Falls back to the raw siteUrl if no match is found, so behavior is unchanged when unresolved.
  try {
    const { data } = await axios.get('https://www.googleapis.com/webmasters/v3/sites', {
      headers: { Authorization: `Bearer ${accessToken}` },
      timeout: 12000,
    })
    const entries = data?.siteEntry || []
    const targetHost = new URL(siteUrl).hostname.toLowerCase().replace(/^www\./, '')

    for (const entry of entries) {
      const property = String(entry?.siteUrl || '').trim()
      const permission = String(entry?.permissionLevel || '').trim()
      if (!property || permission === 'siteUnverifiedUser') continue

      if (property.toLowerCase().startsWith('sc-domain:')) {
        const domain = property.toLowerCase().replace('sc-domain:', '').replace(/^www\./, '')
        if (targetHost === domain || targetHost.endsWith(`.${domain}`)) return property
      } else {
        try {
          const propertyHost = new URL(property).hostname.toLowerCase().replace(/^www\./, '')
          if (targetHost === propertyHost || targetHost.endsWith(`.${propertyHost}`) || propertyHost.endsWith(`.${targetHost}`)) {
            return property
          }
        } catch { /* skip malformed property entry */ }
      }
    }
    console.log(`[GSC] No matching property found for ${siteUrl} - using raw URL as fallback`)
    return siteUrl
  } catch (e) {
    console.log('[GSC] Property resolution failed, using raw URL as fallback:', e.message)
    return siteUrl
  }
}

module.exports = { getGscAccessToken, ensureSiteIsVerifiedInGsc, resolveGscPropertyUrl }
