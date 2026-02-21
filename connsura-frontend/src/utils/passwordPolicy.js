export const MIN_PASSWORD_LENGTH = 12

export const PASSWORD_POLICY_MESSAGE =
  `Password must be at least ${MIN_PASSWORD_LENGTH} characters and include uppercase, lowercase, a number, and a symbol.`

export const validatePasswordPolicy = (password = '') => {
  const value = String(password || '')
  if (value.length < MIN_PASSWORD_LENGTH) {
    return { valid: false, message: PASSWORD_POLICY_MESSAGE }
  }
  if (!/[A-Z]/.test(value)) {
    return { valid: false, message: PASSWORD_POLICY_MESSAGE }
  }
  if (!/[a-z]/.test(value)) {
    return { valid: false, message: PASSWORD_POLICY_MESSAGE }
  }
  if (!/[0-9]/.test(value)) {
    return { valid: false, message: PASSWORD_POLICY_MESSAGE }
  }
  if (!/[^A-Za-z0-9]/.test(value)) {
    return { valid: false, message: PASSWORD_POLICY_MESSAGE }
  }
  return { valid: true, message: '' }
}
