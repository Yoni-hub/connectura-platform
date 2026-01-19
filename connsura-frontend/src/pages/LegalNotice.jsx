import { useSiteContent } from '../hooks/useSiteContent'
import { renderSiteContent } from '../utils/siteContent'

const contentClasses =
  'space-y-4 text-slate-600 [&_h2]:text-lg [&_h2]:font-semibold [&_h3]:text-base [&_h3]:font-semibold [&_ul]:list-disc [&_ul]:pl-5 [&_p]:leading-relaxed'

export default function LegalNotice() {
  const { content } = useSiteContent('legal_notice', {
    title: 'Legal Notice',
    content: '<p>Legal notice content is loading.</p>',
  })

  return (
    <main className="page-shell py-10 space-y-6">
      <div className="surface p-6 space-y-2">
        <h1 className="text-3xl font-bold text-slate-900">{content?.title || 'Legal Notice'}</h1>
        <p className="text-sm text-slate-600">
          Legal inquiries? Email{' '}
          <a className="text-slate-900 underline" href="mailto:legal@connsura.com">
            legal@connsura.com
          </a>
          .
        </p>
      </div>

      <div className="surface p-6">
        <div
          className={contentClasses}
          dangerouslySetInnerHTML={{ __html: renderSiteContent(content?.content || '') }}
        />
      </div>
    </main>
  )
}
