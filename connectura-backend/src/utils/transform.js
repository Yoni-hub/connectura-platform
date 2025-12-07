function parseJson(value, fallback) {
  try {
    return value ? JSON.parse(value) : fallback
  } catch (e) {
    return fallback
  }
}

module.exports = { parseJson }
