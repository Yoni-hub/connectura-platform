export const MIN_PASSWORD_LENGTH = 12

export const PASSWORD_POLICY_MESSAGE =
  `Password must be at least ${MIN_PASSWORD_LENGTH} characters and include uppercase, lowercase, a number, and a symbol.`

export const getPasswordPolicyChecks = (password = '') => {
  const value = String(password || '')
  return [
    { id: 'length', label: `At least ${MIN_PASSWORD_LENGTH} characters`, met: value.length >= MIN_PASSWORD_LENGTH },
    { id: 'upper', label: 'At least 1 uppercase letter', met: /[A-Z]/.test(value) },
    { id: 'lower', label: 'At least 1 lowercase letter', met: /[a-z]/.test(value) },
    { id: 'number', label: 'At least 1 number', met: /[0-9]/.test(value) },
    { id: 'symbol', label: 'At least 1 symbol', met: /[^A-Za-z0-9]/.test(value) },
  ]
}

export const validatePasswordPolicy = (password = '') => {
  const checks = getPasswordPolicyChecks(password)
  if (checks.some((check) => !check.met)) {
    return { valid: false, message: PASSWORD_POLICY_MESSAGE }
  }
  return { valid: true, message: '' }
}
