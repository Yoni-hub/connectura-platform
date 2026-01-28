const AGENT_SEARCH_URL = 'https://www.scc.virginia.gov/boi/consumerinquiry/Search.aspx?searchType=agent'

const fetchFn =
  typeof fetch !== 'undefined'
    ? fetch
    : async (...args) => {
        const { default: nodeFetch } = await import('node-fetch')
        return nodeFetch(...args)
      }

const htmlDecode = (value = '') =>
  value
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')

const extractHidden = (html, name) => {
  const match = html.match(new RegExp(`name="${name}".*?value="([^"]*)"`))
  return match ? match[1] : ''
}

const extractById = (html, id) => {
  const match = html.match(new RegExp(`id="${id}"[^>]*>([^<]*)<`, 'i'))
  return match ? htmlDecode(match[1].trim()) : ''
}

const parseAgentRows = (html) => {
  const rows = []
  const rowRegex =
    /Select\$(\d+)'.*?<\/a><\/td><td[^>]*>(.*?)<\/td><td[^>]*>(.*?)<\/td><td[^>]*>(.*?)<\/td><td[^>]*>(.*?)<\/td><td[^>]*>(.*?)<\/td>/gms
  let match
  while ((match = rowRegex.exec(html))) {
    rows.push({
      index: Number(match[1]),
      name: htmlDecode(match[2].trim()),
      status: htmlDecode(match[3].trim()),
      city: htmlDecode(match[4].trim()),
      state: htmlDecode(match[5].trim()),
      zip: htmlDecode(match[6].trim()),
    })
  }
  return rows
}

async function lookupAgentOnScc({
  firstName = '',
  lastName = '',
  zip = '',
  state = '',
  npn = '',
  licenseNumber = '',
  activeOnly = true,
  city = '',
  insuranceType = '',
  licenseType = '',
  lastNameMode = 'starts',
  selectionIndex,
}) {
  const headers = {
    'User-Agent': 'Connsura/1.0 (license-check)',
  }

  const initialRes = await fetchFn(AGENT_SEARCH_URL, { headers })
  const cookie = initialRes.headers.get('set-cookie') || ''
  const initialHtml = await initialRes.text()

  const baseFields = {
    __EVENTTARGET: 'ctl00$MainContent$btnAgSearch',
    __EVENTARGUMENT: '',
    __LASTFOCUS: '',
    __VIEWSTATE: extractHidden(initialHtml, '__VIEWSTATE'),
    __VIEWSTATEGENERATOR: extractHidden(initialHtml, '__VIEWSTATEGENERATOR'),
    __VIEWSTATEENCRYPTED: extractHidden(initialHtml, '__VIEWSTATEENCRYPTED'),
    __PREVIOUSPAGE: extractHidden(initialHtml, '__PREVIOUSPAGE'),
    __EVENTVALIDATION: extractHidden(initialHtml, '__EVENTVALIDATION'),
    'ctl00$MainContent$rblAgActive': activeOnly ? 'Y' : 'N',
    'ctl00$MainContent$txtAgLicenseNum': licenseNumber || '',
    'ctl00$MainContent$txtAgNPN': npn || '',
    'ctl00$MainContent$rblAgStartsWith': lastNameMode === 'contains' ? 'N' : 'Y',
    'ctl00$MainContent$txtLast': lastName || '',
    'ctl00$MainContent$txtFirst': firstName || '',
    'ctl00$MainContent$txtAgCity': city || '',
    'ctl00$MainContent$ddlAgState': state || '',
    'ctl00$MainContent$txtAgZipcode': zip || '',
    'ctl00$MainContent$ddlAgInsuranceType': insuranceType || '',
    'ctl00$MainContent$ddlAgLicenseType': licenseType || '',
    'ctl00$MainContent$btnAgSearch': 'Search',
    'ctl00$MainContent$hfActiveTabIndex': '0',
    'ctl00$MainContent$hfLastView': 'tpAgent',
  }

  const searchBody = new URLSearchParams(baseFields)
  const searchRes = await fetchFn(AGENT_SEARCH_URL, {
    method: 'POST',
    headers: {
      ...headers,
      Cookie: cookie,
      'Content-Type': 'application/x-www-form-urlencoded',
      Referer: AGENT_SEARCH_URL,
    },
    body: searchBody,
  })
  const searchHtml = await searchRes.text()
  const results = parseAgentRows(searchHtml)

  if (!results.length) {
    return { results, detail: null, needsSelection: false }
  }

  if (results.length > 1 && !selectionIndex) {
    return { results, detail: null, needsSelection: true }
  }

  const detailHidden = {
    __VIEWSTATE: extractHidden(searchHtml, '__VIEWSTATE'),
    __VIEWSTATEGENERATOR: extractHidden(searchHtml, '__VIEWSTATEGENERATOR'),
    __VIEWSTATEENCRYPTED: extractHidden(searchHtml, '__VIEWSTATEENCRYPTED'),
    __PREVIOUSPAGE: extractHidden(searchHtml, '__PREVIOUSPAGE'),
    __EVENTVALIDATION: extractHidden(searchHtml, '__EVENTVALIDATION'),
  }

  const selectedResult = selectionIndex ? results[selectionIndex - 1] : results[0]
  if (!selectedResult) {
    return { results, detail: null, needsSelection: true }
  }

  const detailBody = new URLSearchParams({
    __EVENTTARGET: 'ctl00$MainContent$gvAgResults',
    __EVENTARGUMENT: `Select$${selectedResult.index}`,
    __LASTFOCUS: '',
    ...detailHidden,
    'ctl00$MainContent$rblAgActive': activeOnly ? 'Y' : 'N',
    'ctl00$MainContent$hfActiveTabIndex': '0',
    'ctl00$MainContent$hfLastView': 'tpAgent',
  })

  const detailRes = await fetchFn(AGENT_SEARCH_URL, {
    method: 'POST',
    headers: {
      ...headers,
      Cookie: cookie,
      'Content-Type': 'application/x-www-form-urlencoded',
      Referer: AGENT_SEARCH_URL,
    },
    body: detailBody,
  })
  const detailHtml = await detailRes.text()

  const detail = {
    name: extractById(detailHtml, 'ctl00_MainContent_lblAgentName'),
    city: extractById(detailHtml, 'ctl00_MainContent_lblAgentCity'),
    state: extractById(detailHtml, 'ctl00_MainContent_lblAgentState'),
    zip: extractById(detailHtml, 'ctl00_MainContent_lblAgentZip'),
    residency: extractById(detailHtml, 'ctl00_MainContent_lblAgentResident'),
    status: extractById(detailHtml, 'ctl00_MainContent_lblAgentStatus'),
    licenseNumber: extractById(detailHtml, 'ctl00_MainContent_lblVLN'),
    npn: extractById(detailHtml, 'ctl00_MainContent_lblAgentNPN'),
    licenseEffective: extractById(detailHtml, 'ctl00_MainContent_rptLicense_ctl01_lblAgencyStatusDate'),
    licenseExpires: extractById(detailHtml, 'ctl00_MainContent_rptLicense_ctl01_lblAgencyExpDate'),
  }

  return { results, detail }
}

module.exports = { lookupAgentOnScc }
