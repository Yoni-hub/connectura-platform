const escapeHtml = (value = '') =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')

export const renderSiteContent = (value = '') => {
  if (!value) return ''
  if (value.includes('<')) return value

  const lines = String(value).split('\n')
  let html = ''
  let inList = false

  const closeList = () => {
    if (inList) {
      html += '</ul>'
      inList = false
    }
  }

  lines.forEach((line) => {
    const trimmed = line.trim()
    if (!trimmed) {
      closeList()
      return
    }
    if (trimmed.startsWith('### ')) {
      closeList()
      html += `<h3>${escapeHtml(trimmed.slice(4))}</h3>`
      return
    }
    if (trimmed.startsWith('## ')) {
      closeList()
      html += `<h2>${escapeHtml(trimmed.slice(3))}</h2>`
      return
    }
    if (trimmed.startsWith('- ')) {
      if (!inList) {
        html += '<ul>'
        inList = true
      }
      html += `<li>${escapeHtml(trimmed.slice(2))}</li>`
      return
    }
    closeList()
    html += `<p>${escapeHtml(trimmed)}</p>`
  })

  closeList()
  return html
}
