import { useMemo } from 'react'
import Modal from '../ui/Modal'

const fieldLabelMap = {
  relation: 'Relation to Applicant',
  'first-name': 'First Name',
  'middle-initial': 'Middle Initial',
  'last-name': 'Last Name',
  suffix: 'Suffix',
  dob: 'Date of Birth',
  gender: 'Gender',
  'marital-status': 'Marital Status',
  'education-level': 'Education Level',
  employment: 'Employment',
  occupation: 'Occupation',
  'driver-status': 'Driver Status',
  'license-type': "Driver's License Type",
  'license-status': 'License Status',
  'years-licensed': 'Years Licensed',
  'license-state': 'License State',
  'license-number': 'License Number',
  'accident-prevention': 'Accident Prevention Course',
  sr22: 'SR-22 Required',
  fr44: 'FR-44 Required',
  phone1: 'Phone #1',
  phone2: 'Phone #2',
  email1: 'Email Address #1',
  email2: 'Email Address #2',
  address1: 'Address 1',
  city: 'City',
  state: 'State',
  zip: 'Zip Code',
  name: 'Name',
  type: 'Type',
  industry: 'Industry',
  years: 'Years',
  employees: 'Employees',
  phone: 'Phone',
  email: 'Email',
  question: 'Question',
  input: 'Answer',
  year: 'Year',
  make: 'Make',
  model: 'Model',
  vin: 'VIN',
  primaryUse: 'Primary Use',
}

const containerLabelMap = {
  household: 'Household',
  namedInsured: 'Named Insured',
  additionalHouseholds: 'Additional Household Member',
  address: 'Address',
  contacts: 'Contact',
  residential: 'Residential Address',
  mailing: 'Mailing Address',
  additionalAddresses: 'Additional Address',
  additional: 'Additional Information',
  additionalForms: 'Additional Form',
  questions: 'Question',
  vehicle: 'Vehicle',
  business: 'Business',
}

const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value)
const hasText = (value) => typeof value === 'string' && value.trim().length > 0

const normalizeValue = (value) => {
  if (value === null || value === undefined) return ''
  if (typeof value === 'string') return value.trim()
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  return ''
}

const flattenToMap = (value, path = '', map = {}) => {
  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      const nextPath = path ? `${path}[${index + 1}]` : `[${index + 1}]`
      flattenToMap(item, nextPath, map)
    })
    return map
  }
  if (isObject(value)) {
    Object.keys(value).forEach((key) => {
      const nextPath = path ? `${path}.${key}` : key
      flattenToMap(value[key], nextPath, map)
    })
    return map
  }
  if (!path) return map
  map[path] = normalizeValue(value)
  return map
}

const collectArrays = (value, path = '', map = {}) => {
  if (Array.isArray(value)) {
    map[path] = value
    value.forEach((item, index) => {
      const nextPath = path ? `${path}[${index + 1}]` : `[${index + 1}]`
      collectArrays(item, nextPath, map)
    })
    return map
  }
  if (isObject(value)) {
    Object.keys(value).forEach((key) => {
      const nextPath = path ? `${path}.${key}` : key
      collectArrays(value[key], nextPath, map)
    })
  }
  return map
}

const signatureForValue = (value) => {
  if (Array.isArray(value)) {
    return `[${value.map(signatureForValue).join(',')}]`
  }
  if (isObject(value)) {
    const keys = Object.keys(value).sort()
    return `{${keys.map((key) => `${key}:${signatureForValue(value[key])}`).join('|')}}`
  }
  return normalizeValue(value)
}

const summarizeRemoval = (value) => {
  if (Array.isArray(value)) {
    return value.length ? `${value.length} items` : 'Removed'
  }
  if (isObject(value)) {
    const nameParts = [
      value['first-name'],
      value['middle-initial'],
      value['last-name'],
      value.fullName,
      value.name,
    ]
      .filter(hasText)
      .join(' ')
    if (hasText(nameParts)) return nameParts
    if (hasText(value.relation)) return value.relation
    const fallbackKey = Object.keys(value).find((key) => hasText(normalizeValue(value[key])))
    if (fallbackKey) {
      return `${fieldLabelMap[fallbackKey] || fallbackKey}: ${normalizeValue(value[fallbackKey])}`
    }
  }
  return 'Removed'
}

const formatPath = (path) => {
  const segments = path.split('.')
  const labels = segments.map((segment) => {
    const match = segment.match(/^(.*)\[(\d+)\]$/)
    if (match) {
      const base = match[1]
      const index = match[2]
      const baseLabel = containerLabelMap[base] || fieldLabelMap[base] || base
      return `${baseLabel} ${index}`
    }
    return containerLabelMap[segment] || fieldLabelMap[segment] || segment.replace(/[-_]/g, ' ')
  })
  return labels
    .map((label) => label.replace(/\b\w/g, (char) => char.toUpperCase()))
    .join(' > ')
}

export default function ReviewShareEditsModal({ open, onClose, share, currentForms, onApprove, onDecline }) {
  const pendingForms = share?.pendingEdits?.forms || {}
  const baselineForms = currentForms || share?.snapshot?.forms || {}

  const changes = useMemo(() => {
    const beforeMap = flattenToMap(baselineForms)
    const afterMap = flattenToMap(pendingForms || {})
    const sections = Object.keys(pendingForms || {}).filter(Boolean)
    const isScopedKey = (key) =>
      sections.some((section) => key === section || key.startsWith(`${section}.`) || key.startsWith(`${section}[`))

    const fieldChanges = Object.keys(afterMap)
      .filter(isScopedKey)
      .map((key) => {
        const beforeValue = beforeMap[key] ?? ''
        const afterValue = afterMap[key] ?? ''
        if (beforeValue === afterValue) return null
        return {
          path: formatPath(key),
          before: beforeValue || '-',
          after: afterValue || '-',
        }
      })
      .filter(Boolean)

    const beforeArrays = collectArrays(baselineForms)
    const afterArrays = collectArrays(pendingForms || {})
    const removalChanges = []

    Object.keys(beforeArrays)
      .filter(isScopedKey)
      .forEach((path) => {
        const beforeArray = Array.isArray(beforeArrays[path]) ? beforeArrays[path] : []
        const afterArray = Array.isArray(afterArrays[path]) ? afterArrays[path] : []
        if (!beforeArray.length || beforeArray.length <= afterArray.length) return
        const afterCounts = new Map()
        afterArray.forEach((item) => {
          const sig = signatureForValue(item)
          afterCounts.set(sig, (afterCounts.get(sig) || 0) + 1)
        })
        beforeArray.forEach((item, index) => {
          const sig = signatureForValue(item)
          const count = afterCounts.get(sig) || 0
          if (count > 0) {
            afterCounts.set(sig, count - 1)
            return
          }
          removalChanges.push({
            path: formatPath(`${path}[${index + 1}]`),
            before: summarizeRemoval(item),
            after: 'Removed',
          })
        })
      })

    return [...fieldChanges, ...removalChanges]
  }, [baselineForms, pendingForms])

  return (
    <Modal title="Review profile edits" open={open} onClose={onClose} panelClassName="max-w-3xl">
      <div className="space-y-4">
        <div className="text-sm text-slate-600">
          {share?.agent?.name ? `Edits submitted by ${share.agent.name}.` : 'Edits submitted from a shared link.'}
        </div>
        <div className="space-y-3 max-h-[60vh] overflow-y-auto">
          {changes.length ? (
            changes.map((change, index) => (
              <div key={`${change.path}-${index}`} className="rounded-xl border border-slate-200 bg-white p-3">
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">{change.path}</div>
                <div className="mt-2 text-sm text-slate-600">
                  <span className="line-through text-slate-400">{change.before}</span>
                  <span className="mx-2 text-slate-400">-&gt;</span>
                  <span className="font-semibold text-slate-900">{change.after}</span>
                </div>
              </div>
            ))
          ) : (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
              No changes detected.
            </div>
          )}
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          <button type="button" className="pill-btn-ghost px-4" onClick={onDecline}>
            Decline & stop sharing
          </button>
          <button type="button" className="pill-btn-primary px-5" onClick={onApprove}>
            Accept changes
          </button>
        </div>
      </div>
    </Modal>
  )
}
