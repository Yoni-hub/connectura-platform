const { chromium } = require('playwright')
const cheerio = require('cheerio')

const SOURCE_URL = 'https://www.scc.virginia.gov/boi/consumerinquiry/search.aspx?searchType=agent'

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

const needsHuman = (html = '') => {
  const text = html.toLowerCase()
  return text.includes('captcha') || text.includes('verify you are human') || text.includes('robot') || text.includes('challenge')
}

async function fetchPageByNpn(rawNpn) {
  const npn = String(rawNpn || '').trim()
  if (!/^[0-9]+$/.test(npn)) {
    return { html: null, needs_human_verification: false, error: 'Invalid NPN format. Digits only.' }
  }

  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage({ userAgent: 'Connsura/1.0 (scc-agent-lookup)' })

  try {
    await page.goto(SOURCE_URL, { waitUntil: 'domcontentloaded', timeout: 30000 })
    // Ensure Agent tab/input is available
    const npnLocator = page.locator('#ctl00_MainContent_txtAgNPN').first().or(page.getByLabel(/National Producer Number/i))
    await npnLocator.waitFor({ timeout: 15000 })
    await npnLocator.fill(npn)

    // Click Search (agent tab)
    const searchBtn = page.locator('#ctl00_MainContent_btnAgSearch').first().or(page.getByRole('button', { name: /search/i }))
    await searchBtn.click({ timeout: 15000 })
    await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {})
    await sleep(1000)

    const html = await page.content()
    if (needsHuman(html)) {
      return { html, needs_human_verification: true, error: 'SCC requested human verification.' }
    }
    return { html, needs_human_verification: false, error: null }
  } catch (err) {
    return { html: null, needs_human_verification: false, error: err.message || 'Lookup failed' }
  } finally {
    await browser.close()
  }
}

function parseAgentRecord(html) {
  if (!html) return { matches: [], found: false, needs_human_verification: false, error: 'No HTML to parse' }
  if (needsHuman(html)) return { matches: [], found: false, needs_human_verification: true, error: 'Human verification required' }

  const $ = cheerio.load(html)
  const matches = []

  const textVal = (selector) => {
    const val = $(selector).first().text().trim()
    return val || null
  }

  // Detail section labels
  const detail = {
    name: textVal('#ctl00_MainContent_lblAgentName'),
    city: textVal('#ctl00_MainContent_lblAgentCity'),
    state: textVal('#ctl00_MainContent_lblAgentState'),
    zip: textVal('#ctl00_MainContent_lblAgentZip'),
    residency: textVal('#ctl00_MainContent_lblAgentResident'),
    status: textVal('#ctl00_MainContent_lblAgentStatus'),
    licenseNumber: textVal('#ctl00_MainContent_lblVLN'),
    npn: textVal('#ctl00_MainContent_lblAgentNPN'),
    licenseEffective: textVal('#ctl00_MainContent_rptLicense_ctl01_lblAgencyStatusDate'),
    licenseExpires: textVal('#ctl00_MainContent_rptLicense_ctl01_lblAgencyExpDate'),
  }

  const loa = []
  $('[id*=lblLOA]').each((_, el) => {
    const v = $(el).text().trim()
    if (v) loa.push(v)
  })

  const tableRows = $('#ctl00_MainContent_gvAgResults tr').toArray().slice(1)
  tableRows.forEach((row) => {
    const cells = $(row).find('td').toArray()
    if (!cells.length) return
    matches.push({
      name: $(cells[0]).text().trim() || null,
      npn: null,
      license_status: $(cells[1]).text().trim() || null,
      license_number: null,
      loa: [],
      effective_date: null,
      expiration_date: null,
      address: [$(cells[2]).text().trim(), $(cells[3]).text().trim(), $(cells[4]).text().trim()].filter(Boolean).join(', ') || null,
      source_url: SOURCE_URL,
      raw_text: $(row).text().trim() || null,
    })
  })

  if (detail.name || detail.npn || detail.status) {
    matches.unshift({
      name: detail.name,
      npn: detail.npn,
      license_status: detail.status,
      license_number: detail.licenseNumber,
      loa,
      effective_date: detail.licenseEffective || null,
      expiration_date: detail.licenseExpires || null,
      address: detail.city || detail.state || detail.zip ? [detail.city, detail.state, detail.zip].filter(Boolean).join(', ') : null,
      source_url: SOURCE_URL,
      raw_text: null,
    })
  }

  return {
    matches,
    found: matches.length > 0,
    needs_human_verification: false,
    error: matches.length ? null : 'No results found for query',
  }
}

async function getAgentRecordByNpn(rawNpn) {
  const base = {
    query: { npn: String(rawNpn || '').trim() },
    found: false,
    matches: [],
    retrieved_at: new Date().toISOString(),
    needs_human_verification: false,
    error: null,
  }

  const fetchResult = await fetchPageByNpn(rawNpn)
  if (fetchResult.error && !fetchResult.html) {
    return { ...base, error: fetchResult.error }
  }
  if (fetchResult.needs_human_verification) {
    return { ...base, needs_human_verification: true, error: fetchResult.error || 'Human verification required' }
  }

  const parsed = parseAgentRecord(fetchResult.html)
  return {
    ...base,
    matches: parsed.matches || [],
    found: Boolean(parsed.matches?.length),
    needs_human_verification: parsed.needs_human_verification || false,
    error: parsed.error,
  }
}

module.exports = { fetchPageByNpn, parseAgentRecord, getAgentRecordByNpn, SOURCE_URL }
