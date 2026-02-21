import { useSiteContent } from '../hooks/useSiteContent'
import { LEGAL_RICH_TEXT_CLASS } from '../styles/legalTypography'
import { renderSiteContent } from '../utils/siteContent'

export default function PrivacyPolicy() {
  const { content } = useSiteContent('privacy_policy', {
    title: 'Privacy Policy',
    content: '<p>Privacy policy content is loading.</p>',
  })

  return (
    <main className="page-shell py-10 space-y-6">
      <div className="surface p-6 space-y-2">
        <h1 className="text-3xl font-bold text-slate-900">{content?.title || 'Privacy Policy'}</h1>
        <p className="text-sm text-slate-600">
          Privacy questions? Email{' '}
          <a className="text-slate-900 underline" href="mailto:privacy@connsura.com">
            privacy@connsura.com
          </a>
          .
        </p>
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

