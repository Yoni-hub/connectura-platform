import { useSiteContent } from '../hooks/useSiteContent'
import { renderSiteContent } from '../utils/siteContent'

const contentClasses =
  'space-y-4 text-slate-600 [&_h1]:text-2xl [&_h1]:font-semibold [&_h2]:text-xl [&_h2]:font-semibold [&_h3]:text-lg [&_h3]:font-semibold [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:leading-relaxed'

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
          className={contentClasses}
          dangerouslySetInnerHTML={{ __html: renderSiteContent(content?.content || '') }}
        />
      </div>
    </main>
  )
}
