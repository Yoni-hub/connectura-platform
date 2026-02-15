const fs = require('fs')
const path = require('path')
const maxmind = require('maxmind')

let cachedReader = null
let cachedMtime = null

const GEO_DB_PATH =
  process.env.GEOIP_DB_PATH ||
  path.resolve(__dirname, '..', '..', 'geo', 'GeoLite2-City.mmdb')

const isPrivateIp = (ip) => {
  if (!ip) return true
  const value = String(ip).trim().toLowerCase()
  if (!value) return true
  if (value === '::1' || value.startsWith('fe80:') || value.startsWith('fc') || value.startsWith('fd')) {
    return true
  }
  if (value.startsWith('127.') || value.startsWith('10.') || value.startsWith('192.168.')) {
    return true
  }
  if (value.startsWith('172.')) {
    const parts = value.split('.')
    const octet = Number(parts[1])
    if (octet >= 16 && octet <= 31) return true
  }
  return false
}

const loadReader = async () => {
  if (!fs.existsSync(GEO_DB_PATH)) return null
  const stat = fs.statSync(GEO_DB_PATH)
  const mtime = stat.mtimeMs
  if (cachedReader && cachedMtime === mtime) return cachedReader
  cachedReader = await maxmind.open(GEO_DB_PATH)
  cachedMtime = mtime
  return cachedReader
}

const formatLocationLabel = (city, region, country) => {
  const parts = [city, region, country].filter(Boolean)
  return parts.length ? parts.join(', ') : null
}

const lookupGeoIp = async (ip) => {
  if (!ip || isPrivateIp(ip)) return null
  const reader = await loadReader()
  if (!reader) return null
  const record = reader.get(ip)
  if (!record) return null
  const city = record.city?.names?.en || null
  const region = record.subdivisions?.[0]?.names?.en || null
  const country = record.country?.names?.en || null
  const latitude = record.location?.latitude ?? null
  const longitude = record.location?.longitude ?? null
  const locationLabel = formatLocationLabel(city, region, country)
  return {
    city,
    region,
    country,
    locationLabel,
    latitude,
    longitude,
  }
}

module.exports = {
  GEO_DB_PATH,
  lookupGeoIp,
}
