import MarkdownIt from 'markdown-it'

const md = new MarkdownIt({
  html: false,
  linkify: true,
  breaks: false,
})

const hasHtmlTag = (value = '') => /<\/?[a-z][\s\S]*>/i.test(value)

const normalizeMarkdown = (value = '') => {
  if (!value) return ''
  return String(value)
    .replace(/\r\n/g, '\n')
    .replace(/^\s*•\s+/gm, '- ')
}

export const renderSiteContent = (value = '') => {
  if (!value) return ''
  if (hasHtmlTag(value)) return value

  const normalized = normalizeMarkdown(value)
  return md.render(normalized)
}
