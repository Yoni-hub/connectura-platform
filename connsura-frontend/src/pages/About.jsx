import { useSiteContent } from '../hooks/useSiteContent'
import { LEGAL_RICH_TEXT_CLASS } from '../styles/legalTypography'
import { renderSiteContent } from '../utils/siteContent'

const fallback = {
  title: 'About Connsura',
  content: `
    <h2>Introduction</h2>
    <p>Connsura is a technology platform designed to simplify how people organize, manage, and share their insurance information.</p>
  `,
}

export default function About() {
  const { content } = useSiteContent('about_public', fallback)

  return (
    <main className="page-shell py-10 space-y-6">
      <div className="surface p-6 space-y-2">
        <h1 className="text-3xl font-bold text-slate-900">{content?.title || 'About Connsura'}</h1>
      </div>
      <div className="surface p-6">
        <div
          className={`${LEGAL_RICH_TEXT_CLASS} text-slate-600`}
          dangerouslySetInnerHTML={{ __html: renderSiteContent(content?.content || '') }}
        />
      </div>
    </main>
  )
}

