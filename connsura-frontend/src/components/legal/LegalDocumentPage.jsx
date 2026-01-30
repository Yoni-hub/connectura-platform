import { useLegalDocument } from '../../hooks/useLegalDocument'
import { renderSiteContent } from '../../utils/siteContent'

const contentClasses =
  'space-y-4 text-slate-700 [&_h1]:text-2xl [&_h1]:font-semibold [&_h2]:text-xl [&_h2]:font-semibold [&_h3]:text-lg [&_h3]:font-semibold [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:leading-relaxed'

const formatDate = (value) => {
  if (!value) return ''
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return ''
  return parsed.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
}

export default function LegalDocumentPage({ type, title, contactEmail }) {
  const { document, loading, error } = useLegalDocument(type)
  const publishedDate = formatDate(document?.publishedAt)

  return (
    <main className="page-shell py-10 space-y-6">
      <div className="surface p-6 space-y-2">
        <h1 className="text-3xl font-bold text-slate-900">{title}</h1>
        {contactEmail && (
          <p className="text-sm text-slate-600">
            Questions? Email{' '}
            <a className="text-slate-900 underline" href={`mailto:${contactEmail}`}>
              {contactEmail}
            </a>
            .
          </p>
        )}
        <div className="text-xs text-slate-500">
          {document?.version ? `Version ${document.version}` : ''}
          {document?.version && publishedDate ? ' · ' : ''}
          {publishedDate ? `Published ${publishedDate}` : ''}
        </div>
      </div>

      <div className="surface p-6">
        {loading && <div className="text-sm text-slate-500">Loading document...</div>}
        {!loading && error && <div className="text-sm text-rose-600">{error}</div>}
        {!loading && !error && (
          <div
            className={contentClasses}
            dangerouslySetInnerHTML={{ __html: renderSiteContent(document?.content || '') }}
          />
        )}
      </div>
    </main>
  )
}
