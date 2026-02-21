const stores = new Map()

const getStore = (scope) => {
  if (!stores.has(scope)) {
    stores.set(scope, new Map())
  }
  return stores.get(scope)
}

const getKeyState = (scope, key, windowMs) => {
  const now = Date.now()
  const store = getStore(scope)
  const existing = store.get(key)
  if (!existing || now > existing.resetAt) {
    const next = { count: 0, resetAt: now + windowMs }
    store.set(key, next)
    return next
  }
  return existing
}

const isRateLimited = ({ scope, key, maxAttempts, windowMs }) => {
  if (!key) return { limited: false, retryAfterSeconds: 0 }
  const entry = getKeyState(scope, key, windowMs)
  if (entry.count < maxAttempts) {
    return { limited: false, retryAfterSeconds: 0 }
  }
  const retryAfterSeconds = Math.max(1, Math.ceil((entry.resetAt - Date.now()) / 1000))
  return { limited: true, retryAfterSeconds }
}

const registerFailure = ({ scope, key, windowMs }) => {
  if (!key) return
  const entry = getKeyState(scope, key, windowMs)
  entry.count += 1
}

const clearFailures = ({ scope, key }) => {
  if (!key) return
  const store = getStore(scope)
  store.delete(key)
}

module.exports = {
  isRateLimited,
  registerFailure,
  clearFailures,
}
