import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { API_URL } from '../services/api'
import Skeleton from '../components/ui/Skeleton'

const productOptions = [
  { value: 'personal-auto', label: 'Personal Auto' },
  { value: 'homeowners', label: 'Homeowners' },
  { value: 'renters', label: 'Renters' },
  { value: 'motorcycle-offroad', label: 'Motorcycle / Off-Road' },
  { value: 'commercial-auto', label: 'Commercial Auto' },
  { value: 'general-liability', label: 'General Liability Insurance' },
  { value: 'commercial-property', label: 'Commercial Property Insurance' },
  { value: 'workers-comp', label: "Workers' Compensation" },
  { value: 'professional-liability', label: 'Professional Liability (Errors & Omissions)' },
  { value: 'umbrella', label: 'Umbrella Insurance' },
  { value: 'travel', label: 'Travel Insurance' },
  { value: 'pet', label: 'Pet Insurance' },
  { value: 'flood-earthquake', label: 'Flood or Earthquake Insurance' },
  { value: 'health', label: 'Health Insurance' },
  { value: 'life', label: 'Life Insurance' },
  { value: 'disability', label: 'Disability Insurance' },
  { value: 'dental-vision', label: 'Dental & Vision Insurance' },
  { value: 'long-term-care', label: 'Long-Term Care Insurance' },
  { value: 'cyber-liability', label: 'Cyber Liability Insurance' },
]

const productConfigs = {
  'personal-auto': [
    { title: 'Named Insured', file: 'products/personal-auto/steps/step1.html' },
    { title: 'Current Mailing Address', file: 'products/personal-auto/steps/step2.html' },
    { title: 'Driver Information', file: 'products/personal-auto/steps/step3.html' },
    { title: 'Vehicle Information', file: 'products/personal-auto/steps/step4.html' },
    { title: 'Coverages', file: 'products/personal-auto/steps/step5.html' },
    { title: 'Prior Policy Information', file: 'products/personal-auto/steps/step6.html' },
    { title: 'Additional Information', file: 'products/personal-auto/steps/step7.html' },
  ],
  homeowners: [
    { title: 'Property & Insured', file: 'products/homeowners/steps/step1.html' },
    { title: 'Coverages', file: 'products/homeowners/steps/step2.html' },
    { title: 'Loss History', file: 'products/homeowners/steps/step3.html' },
  ],
  renters: [
    { title: 'Applicant & Address', file: 'products/renters/steps/step1.html' },
    { title: 'Contents Coverage', file: 'products/renters/steps/step2.html' },
  ],
  'motorcycle-offroad': [
    { title: 'Applicant & Contact', file: 'products/motorcycle-offroad/steps/step1.html' },
    { title: 'Motorcycle / Off-Road Unit', file: 'products/motorcycle-offroad/steps/step2.html' },
    { title: 'Coverages & History', file: 'products/motorcycle-offroad/steps/step3.html' },
  ],
  'commercial-auto': [
    { title: 'Business & Operations', file: 'products/commercial-auto/steps/step1.html' },
    { title: 'Vehicle Schedule', file: 'products/commercial-auto/steps/step2.html' },
    { title: 'Drivers', file: 'products/commercial-auto/steps/step3.html' },
    { title: 'Coverages & Loss History', file: 'products/commercial-auto/steps/step4.html' },
  ],
  'general-liability': [
    { title: 'Business & Operations', file: 'products/general-liability/steps/step1.html' },
    { title: 'Coverages & Limits', file: 'products/general-liability/steps/step2.html' },
    { title: 'Risk Controls & Loss History', file: 'products/general-liability/steps/step3.html' },
  ],
  'commercial-property': [
    { title: 'Location & Building Details', file: 'products/commercial-property/steps/step1.html' },
    { title: 'Protections & Exposure', file: 'products/commercial-property/steps/step2.html' },
    { title: 'Coverages & Valuation', file: 'products/commercial-property/steps/step3.html' },
  ],
  'workers-comp': [
    { title: 'Employer Information', file: 'products/workers-comp/steps/step1.html' },
    { title: 'Exposure & Payroll', file: 'products/workers-comp/steps/step2.html' },
    { title: 'Safety & Loss History', file: 'products/workers-comp/steps/step3.html' },
  ],
  'professional-liability': [
    { title: 'Firm Profile', file: 'products/professional-liability/steps/step1.html' },
    { title: 'Coverage Details', file: 'products/professional-liability/steps/step2.html' },
    { title: 'Claims & Risk Controls', file: 'products/professional-liability/steps/step3.html' },
  ],
  umbrella: [
    { title: 'Underlying Policies', file: 'products/umbrella/steps/step1.html' },
    { title: 'Exposure Summary', file: 'products/umbrella/steps/step2.html' },
    { title: 'Umbrella Coverage & Loss History', file: 'products/umbrella/steps/step3.html' },
  ],
  travel: [
    { title: 'Trip Details', file: 'products/travel/steps/step1.html' },
    { title: 'Traveler Information', file: 'products/travel/steps/step2.html' },
    { title: 'Coverage Selections', file: 'products/travel/steps/step3.html' },
  ],
  pet: [
    { title: 'Owner & Pet Details', file: 'products/pet/steps/step1.html' },
    { title: 'Health & Coverage', file: 'products/pet/steps/step2.html' },
  ],
  'flood-earthquake': [
    { title: 'Property Location', file: 'products/flood-earthquake/steps/step1.html' },
    { title: 'Building Details', file: 'products/flood-earthquake/steps/step2.html' },
    { title: 'Coverage & History', file: 'products/flood-earthquake/steps/step3.html' },
  ],
  health: [
    { title: 'Household Information', file: 'products/health/steps/step1.html' },
    { title: 'Coverage Preferences', file: 'products/health/steps/step2.html' },
    { title: 'Disclosures', file: 'products/health/steps/step3.html' },
  ],
  life: [
    { title: 'Proposed Insured', file: 'products/life/steps/step1.html' },
    { title: 'Coverage & Beneficiaries', file: 'products/life/steps/step2.html' },
    { title: 'Health & Lifestyle', file: 'products/life/steps/step3.html' },
  ],
  disability: [
    { title: 'Employment & Income', file: 'products/disability/steps/step1.html' },
    { title: 'Benefit Design', file: 'products/disability/steps/step2.html' },
    { title: 'Health & Risks', file: 'products/disability/steps/step3.html' },
  ],
  'dental-vision': [
    { title: 'Enrollee & Dependents', file: 'products/dental-vision/steps/step1.html' },
    { title: 'Coverage Elections', file: 'products/dental-vision/steps/step2.html' },
  ],
  'long-term-care': [
    { title: 'Applicant Profile', file: 'products/long-term-care/steps/step1.html' },
    { title: 'Coverage Design', file: 'products/long-term-care/steps/step2.html' },
    { title: 'Care Preferences & Health', file: 'products/long-term-care/steps/step3.html' },
  ],
  'cyber-liability': [
    { title: 'Organization & Data Profile', file: 'products/cyber-liability/steps/step1.html' },
    { title: 'Security Controls', file: 'products/cyber-liability/steps/step2.html' },
    { title: 'Incidents & Coverage', file: 'products/cyber-liability/steps/step3.html' },
  ],
}

const defaultProduct = 'personal-auto'

export default function ClientForms() {
  const { user, logout } = useAuth()
  const nav = useNavigate()
  const contentRef = useRef(null)

  const [productKey, setProductKey] = useState(defaultProduct)
  const [stepIndex, setStepIndex] = useState(1)
  const [stepHtml, setStepHtml] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [reloadTick, setReloadTick] = useState(0)

  const steps = productConfigs[productKey] || []
  const activeStep = steps[stepIndex - 1]

  useEffect(() => {
    setStepIndex(1)
  }, [productKey])

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      if (!activeStep) {
        setStepHtml('')
        return
      }
      setLoading(true)
      setError('')
      try {
        const res = await fetch(`${API_URL}/forms/${activeStep.file}?v=${Date.now()}`, { cache: 'no-store' })
        if (!res.ok) throw new Error('Load error')
        const html = await res.text()
        if (!cancelled) setStepHtml(html)
      } catch (err) {
        if (!cancelled) {
          setError('Could not load this step. Please try again.')
          setStepHtml('')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [activeStep, reloadTick])

  useEffect(() => {
    const root = contentRef.current
    if (!root) return

    // run inline scripts if any
    const scripts = root.querySelectorAll('script')
    scripts.forEach((old) => {
      const s = document.createElement('script')
      Array.from(old.attributes).forEach((attr) => s.setAttribute(attr.name, attr.value))
      s.textContent = old.textContent
      old.replaceWith(s)
    })

    const addOtherSupport = (select) => {
      if (!select || select.dataset.hasOther === '1') return
      const hasOther = Array.from(select.options).some(
        (opt) => opt.value === 'other' || opt.textContent.trim().toLowerCase() === 'other'
      )
      if (!hasOther) {
        const opt = document.createElement('option')
        opt.value = 'other'
        opt.textContent = 'Other'
        select.appendChild(opt)
      }

      const wrapper = select.closest('.field-control') || select.parentElement
      const baseId = select.id || select.name || `select-${Math.random().toString(36).slice(2, 7)}`
      const originalName = select.getAttribute('name') || baseId
      const inputId = `${baseId}-other`
      let otherInput = wrapper.querySelector(`[data-other-for="${inputId}"]`)
      if (!otherInput) {
        otherInput = document.createElement('input')
        otherInput.type = 'text'
        otherInput.className = 'other-input'
        otherInput.placeholder = 'Please specify'
        otherInput.id = inputId
        otherInput.setAttribute('data-other-for', inputId)
        wrapper.appendChild(otherInput)
      }

      const syncOther = () => {
        const val = (select.value || '').toLowerCase()
        const txt = (select.options[select.selectedIndex]?.textContent || '').trim().toLowerCase()
        const show = val === 'other' || txt === 'other'
        otherInput.style.display = show ? 'block' : 'none'
        select.style.display = show ? 'none' : ''
        if (show) {
          select.name = `${originalName}__select`
          otherInput.name = originalName
          if (!otherInput.value) otherInput.focus()
        } else {
          select.name = originalName
          otherInput.name = ''
          otherInput.value = ''
        }
      }

      otherInput.addEventListener('blur', () => {
        if (!otherInput.value) {
          select.value = ''
          syncOther()
        }
      })
      select.addEventListener('change', syncOther)
      syncOther()
      select.dataset.hasOther = '1'
    }

    const enhanceAllSelects = (rootNode) => {
      rootNode.querySelectorAll('select').forEach(addOtherSupport)
    }

    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (!(node instanceof HTMLElement)) return
          if (node.tagName === 'SELECT') addOtherSupport(node)
          node.querySelectorAll && node.querySelectorAll('select').forEach(addOtherSupport)
        })
      })
    })

    enhanceAllSelects(root)
    observer.observe(root, { childList: true, subtree: true })
    return () => observer.disconnect()
  }, [stepHtml])

  const initials = useMemo(() => {
    if (user?.name) {
      return user.name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .slice(0, 2)
        .toUpperCase()
    }
    if (user?.email) return user.email[0]?.toUpperCase() ?? 'CL'
    return 'CL'
  }, [user])

  const displayName = user?.name || user?.email || 'client'

  return (
    <main className="page-shell py-8">
      <div className="grid gap-4 lg:grid-cols-[240px,1fr]">
        <aside className="surface p-4 lg:p-5">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-3">Steps</div>
          <div className="space-y-2">
            {steps.map((step, idx) => {
              const isActive = idx === stepIndex - 1
              return (
                <button
                  key={step.title}
                  onClick={() => setStepIndex(idx + 1)}
                  className={`w-full text-left rounded-xl px-3 py-2.5 font-semibold transition ${
                    isActive ? 'bg-[#e8f0ff] text-[#0b3b8c] shadow-sm' : 'text-slate-700 hover:bg-slate-50'
                  }`}
                  aria-current={isActive}
                >
                  <div className="text-xs font-semibold text-slate-500">Step {idx + 1}</div>
                  <div>{step.title}</div>
                </button>
              )
            })}
          </div>
        </aside>

        <section className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-semibold">Connectura Client Dashboard</h1>
              <p className="text-slate-500">Welcome back, {displayName}. Complete your insurance profile.</p>
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                className="pill-btn-ghost px-4"
                onClick={() => {
                  logout()
                  nav('/')
                }}
              >
                Log out
              </button>
              <div className="grid h-12 w-12 place-items-center rounded-full bg-[#006aff]/12 text-[#0b3b8c] font-bold">
                {initials}
              </div>
            </div>
          </div>

          {loading && !stepHtml && <Skeleton className="h-24" />}

          <div className="surface p-4 sm:p-5 space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <select
                className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-base shadow-[inset_0_1px_0_rgba(255,255,255,0.7)] focus:outline-none focus:ring-2 focus:ring-[#006aff]/20"
                value={productKey}
                onChange={(e) => setProductKey(e.target.value)}
              >
                {productOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            {error && <div className="text-red-600 text-sm">{error}</div>}

            {!error && (
              <div className="space-y-3">
                {loading && <div className="text-slate-500 text-sm">Loading step...</div>}
                <div ref={contentRef} className="step-html py-2" dangerouslySetInnerHTML={{ __html: stepHtml }} />
                <div className="form-card extra-card m-2">
                  <div className="card-title">Additional Details</div>
                  <div className="form-grid wide">
                    <label className="field-label" htmlFor={`missing-info-${productKey}-${stepIndex}`}>
                      Any missing Information, not included in the form ? Write it here:
                    </label>
                    <div className="field-control">
                      <textarea
                        id={`missing-info-${productKey}-${stepIndex}`}
                        name={`missing-info-${productKey}-${stepIndex}`}
                        placeholder="Add any extra info here"
                      />
                    </div>
                    <label className="field-label" htmlFor={`missing-upload-${productKey}-${stepIndex}`}>
                      Upload File:
                    </label>
                    <div className="field-control">
                      <label className="upload-btn" htmlFor={`missing-upload-${productKey}-${stepIndex}`}>
                        Upload File
                      </label>
                      <input
                        className="upload-input"
                        id={`missing-upload-${productKey}-${stepIndex}`}
                        name={`missing-upload-${productKey}-${stepIndex}`}
                        type="file"
                        accept="*/*"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="flex items-center justify-end gap-3 pt-1">
              <button
                type="button"
                onClick={() => {
                  setStepIndex(1)
                  setReloadTick((k) => k + 1)
                }}
                className="pill-btn-ghost px-6 border-[#b5c8e8] text-[#0b3b8c]"
              >
                Cancel
              </button>
              <button type="button" onClick={() => alert('Saved')} className="pill-btn-primary px-6">
                Save changes
              </button>
            </div>
          </div>
        </section>
      </div>
    </main>
  )
}
