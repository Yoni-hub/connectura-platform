const TOKEN_KEY = 'connsura_token'

const hasStorage = () => typeof window !== 'undefined' && window.localStorage && window.sessionStorage

export const getStoredToken = () => {
  if (!hasStorage()) return null
  return localStorage.getItem(TOKEN_KEY) || sessionStorage.getItem(TOKEN_KEY)
}

export const setStoredToken = (token, { persist = true } = {}) => {
  if (!hasStorage()) return
  if (!token) {
    localStorage.removeItem(TOKEN_KEY)
    sessionStorage.removeItem(TOKEN_KEY)
    return
  }
  if (persist) {
    localStorage.setItem(TOKEN_KEY, token)
    sessionStorage.removeItem(TOKEN_KEY)
  } else {
    sessionStorage.setItem(TOKEN_KEY, token)
    localStorage.removeItem(TOKEN_KEY)
  }
}

export const clearStoredToken = () => {
  if (!hasStorage()) return
  localStorage.removeItem(TOKEN_KEY)
  sessionStorage.removeItem(TOKEN_KEY)
}
