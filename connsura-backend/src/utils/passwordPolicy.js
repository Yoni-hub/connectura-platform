const MIN_PASSWORD_LENGTH = Number(process.env.PASSWORD_MIN_LENGTH || 8)

const PASSWORD_POLICY_MESSAGE =
  `Password must be at least ${MIN_PASSWORD_LENGTH} characters and include uppercase, lowercase, a number, and a symbol.`

const validatePasswordPolicy = (password) => {
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

module.exports = {
  MIN_PASSWORD_LENGTH,
  PASSWORD_POLICY_MESSAGE,
  validatePasswordPolicy,
}
