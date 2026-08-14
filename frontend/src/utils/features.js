export function isAdminUser(user) {
  return Number(user?.id) === 1
}

export function canUseBacklinks(user) {
  if (!user) return false
  if (isAdminUser(user)) return true
  if (user.features?.backlinks != null) return Boolean(user.features.backlinks)
  return Boolean(user.backlinks_enabled || user.is_paid)
}

export function canUseKeywords(user) {
  if (!user) return false
  if (isAdminUser(user)) return true
  if (user.features?.keywords != null) return Boolean(user.features.keywords)
  return Boolean(user.keywords_enabled || user.is_paid)
}
