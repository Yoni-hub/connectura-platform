const summaryValue = (value) => (value ? value : '-')

const hasValue = (value) => {
  if (value === null || value === undefined) return false
  if (typeof value === 'string') return value.trim().length > 0
  return true
}

const formatValue = (value) => {
  if (Array.isArray(value)) return value.join(', ')
  if (value === null || value === undefined) return ''
  return String(value)
}

const renderDetails = (details = []) => {
  const filtered = Array.isArray(details) ? details.filter((detail) => hasValue(detail?.value)) : []
  if (!filtered.length) return null
  return (
    <div className="mt-3 grid gap-2 text-sm text-slate-700 sm:grid-cols-2">
      {filtered.map((detail, index) => (
        <div key={`${detail.label}-${index}`}>
          <span className="font-semibold text-slate-900">{detail.label}:</span> {formatValue(detail.value)}
        </div>
      ))}
    </div>
  )
}

const resolveAdditionalSelection = (forms, sections) => {
  if (!sections) return forms
  if (sections.additional) return forms
  if (!Array.isArray(sections.additionalIndexes)) {
    return []
  }
  return sections.additionalIndexes.map((index) => forms[index]).filter(Boolean)
}

export default function ShareSummary({ snapshot, sections }) {
  const household = snapshot?.household || {}
  const address = snapshot?.address || {}
  const additionalForms = Array.isArray(snapshot?.additionalForms) ? snapshot.additionalForms : []
  const showHousehold = sections ? Boolean(sections.household) : true
  const showAddress = sections ? Boolean(sections.address) : true
  const selectedAdditional = resolveAdditionalSelection(additionalForms, sections)
  const filteredAdditional = selectedAdditional
    .map((form) => ({
      ...form,
      questions: Array.isArray(form?.questions)
        ? form.questions.filter((question) => hasValue(question?.input))
        : [],
    }))
    .filter((form) => form.questions.length > 0)
  const showAdditional = filteredAdditional.length > 0

  return (
    <div className="space-y-4">
      {showHousehold && household?.primary && (
        <div className="w-full rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_24px_60px_rgba(0,42,92,0.08)]">
          <div className="text-sm font-semibold text-slate-900">{household.primary.label || 'Household'}</div>
          <div className="mt-3 flex flex-wrap gap-4 text-sm text-slate-700">
            <div>
              <span className="font-semibold text-slate-900">Full Name:</span> {summaryValue(household.primary.fullName)}
            </div>
            <div>
              <span className="font-semibold text-slate-900">Birthday:</span> {summaryValue(household.primary.dob)}
            </div>
            <div>
              <span className="font-semibold text-slate-900">Sex:</span> {summaryValue(household.primary.gender)}
            </div>
            <div>
              <span className="font-semibold text-slate-900">License Number:</span>{' '}
              {summaryValue(household.primary.licenseNumber)}
            </div>
          </div>
          {renderDetails(household.primary.details)}
        </div>
      )}

      {showHousehold &&
        Array.isArray(household?.additional) &&
        household.additional.map((person, index) => (
          <div
            key={`household-share-${index}`}
            className="w-full rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_24px_60px_rgba(0,42,92,0.08)]"
          >
            <div className="text-sm font-semibold text-slate-900">{person.label || `Household ${index + 1}`}</div>
            <div className="mt-3 flex flex-wrap gap-4 text-sm text-slate-700">
              <div>
                <span className="font-semibold text-slate-900">Full Name:</span> {summaryValue(person.fullName)}
              </div>
              <div>
                <span className="font-semibold text-slate-900">Birthday:</span> {summaryValue(person.dob)}
              </div>
              <div>
                <span className="font-semibold text-slate-900">Sex:</span> {summaryValue(person.gender)}
              </div>
              <div>
                <span className="font-semibold text-slate-900">License Number:</span>{' '}
                {summaryValue(person.licenseNumber)}
              </div>
            </div>
            {renderDetails(person.details)}
          </div>
        ))}

      {showAddress && address?.primary && (
        <div className="w-full rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_24px_60px_rgba(0,42,92,0.08)]">
          <div className="text-sm font-semibold text-slate-900">{address.primary.label || 'Address'}</div>
          <div className="mt-3 flex flex-wrap items-center gap-4 text-sm text-slate-700">
            <div>
              <span className="font-semibold text-slate-900">Phone #1:</span> {summaryValue(address.primary.phone1)}
            </div>
            <div>
              <span className="font-semibold text-slate-900">Email Address #1:</span>{' '}
              {summaryValue(address.primary.email1)}
            </div>
            <div>
              <span className="font-semibold text-slate-900">Street Address 1:</span>{' '}
              {summaryValue(address.primary.street1)}
            </div>
          </div>
          {renderDetails(address.primary.details)}
        </div>
      )}

      {showAddress &&
        Array.isArray(address?.additional) &&
        address.additional.map((entry, index) => (
          <div
            key={`address-share-${index}`}
            className="w-full rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_24px_60px_rgba(0,42,92,0.08)]"
          >
            <div className="text-sm font-semibold text-slate-900">{entry.label || `Address ${index + 1}`}</div>
            <div className="mt-3 flex flex-wrap items-center gap-4 text-sm text-slate-700">
              <div>
                <span className="font-semibold text-slate-900">Phone #1:</span> {summaryValue(entry.phone1)}
              </div>
              <div>
                <span className="font-semibold text-slate-900">Email Address #1:</span> {summaryValue(entry.email1)}
              </div>
              <div>
                <span className="font-semibold text-slate-900">Street Address 1:</span> {summaryValue(entry.street1)}
              </div>
            </div>
            {renderDetails(entry.details)}
          </div>
        ))}

      {showAdditional &&
        filteredAdditional.map((form, index) => (
          <div
            key={`additional-share-${index}`}
            className="w-full rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_24px_60px_rgba(0,42,92,0.08)]"
          >
            <div className="text-sm font-semibold text-slate-900">{form.name || `Additional Form ${index + 1}`}</div>
            <div className="mt-3 space-y-2 text-sm text-slate-700">
              {form.questions.length ? (
                form.questions.map((question, qIndex) => (
                  <div key={`additional-share-${index}-${qIndex}`} className="flex flex-wrap gap-2">
                    <span className="font-semibold text-slate-900">{summaryValue(question.question)}:</span>
                    <span>{summaryValue(question.input)}</span>
                  </div>
                ))
              ) : (
                <div className="text-slate-500">No additional questions added.</div>
              )}
            </div>
          </div>
        ))}
    </div>
  )
}
