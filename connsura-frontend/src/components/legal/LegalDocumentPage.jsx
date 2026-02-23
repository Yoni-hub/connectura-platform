import { useLegalDocument } from '../../hooks/useLegalDocument'
import { LEGAL_RICH_TEXT_CLASS } from '../../styles/legalTypography'
import { renderSiteContent } from '../../utils/siteContent'

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
          {document?.version && publishedDate ? ' - ' : ''}
          {publishedDate ? `Published ${publishedDate}` : ''}
        </div>
      </div>

      <div className="surface p-6">
        {loading && <div className="text-sm text-slate-500">Loading document...</div>}
        {!loading && error && <div className="text-sm text-rose-600">{error}</div>}
        {!loading && !error && (
          <div
            className={LEGAL_RICH_TEXT_CLASS}
            dangerouslySetInnerHTML={{ __html: renderSiteContent(document?.content || '') }}
          />
        )}
      </div>
    </main>
  )
}


