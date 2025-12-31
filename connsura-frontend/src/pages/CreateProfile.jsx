import { useState } from 'react'

const labelClass = 'text-sm text-slate-900'
const inputClass =
  'h-7 w-40 justify-self-start border border-slate-700/60 bg-white px-2 text-sm text-slate-900 focus:border-[#006aff] focus:outline-none focus:ring-1 focus:ring-[#006aff]/20'
const gridClass = 'grid grid-cols-[150px_1fr] items-center gap-x-4 gap-y-2'
const sectionTitle = 'text-sm font-semibold text-slate-900'
const linkButton = 'text-sm font-semibold text-[#006aff] hover:underline disabled:text-slate-400 disabled:no-underline'
const backButton = 'pill-btn-ghost px-5 py-2 text-sm'
const nextButton = 'pill-btn-primary px-5 py-2 text-sm'
const miniButton = 'pill-btn-ghost px-3 py-1.5 text-xs'

function FieldRow({ id, label, type = 'text' }) {
  return (
    <>
      <label htmlFor={id} className={labelClass}>
        {label}
      </label>
      <input id={id} type={type} className={inputClass} />
    </>
  )
}

export default function CreateProfile() {
  const [currentStep, setCurrentStep] = useState(0)
  const [showResidentialExtra, setShowResidentialExtra] = useState(false)
  const [showMailingExtra, setShowMailingExtra] = useState(false)
  const steps = ['Named Insured', 'Contact Information', 'Residential Address', 'Mailing Address']
  const canGoBack = currentStep > 0
  const canGoNext = currentStep < steps.length - 1

  const goBack = () => {
    setCurrentStep((step) => Math.max(0, step - 1))
  }

  const goNext = () => {
    setCurrentStep((step) => Math.min(steps.length - 1, step + 1))
  }

  return (
    <main className="px-6 py-8">
      <div className="mx-auto max-w-4xl rounded-lg border border-slate-300 bg-white p-6">
        <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-800">
          Create your insurance passport
        </div>

        <div className="mt-1 text-sm text-slate-500">
          Step {currentStep + 1} of {steps.length}: {steps[currentStep]}
        </div>

        {currentStep === 0 && (
          <section className="mt-6">
            <h2 className={sectionTitle}>Named Insured</h2>
            <div className={`mt-3 ${gridClass}`}>
              <FieldRow id="ni-first" label="First Name" />
              <FieldRow id="ni-middle" label="Middle Name" />
              <FieldRow id="ni-last" label="Last Name" />
              <FieldRow id="ni-suffix" label="Suffix" />
              <FieldRow id="ni-dob" label="Date of Birth" />
              <FieldRow id="ni-gender" label="Gender" />
              <FieldRow id="ni-marital" label="Marital Status" />
              <FieldRow id="ni-occupation" label="Occupation" />
            </div>
            <div className="mt-4 flex gap-3">
              <button type="button" className={nextButton} onClick={goNext} disabled={!canGoNext}>
                Next
              </button>
            </div>
          </section>
        )}

        {currentStep === 1 && (
          <section className="mt-6">
            <h2 className={sectionTitle}>Contact Information</h2>
            <div className={`mt-3 ${gridClass}`}>
              <FieldRow id="contact-phone1" label="Phone #1" type="tel" />
              <FieldRow id="contact-phone2" label="Phone #2" type="tel" />
              <FieldRow id="contact-email1" label="Email Address #1" type="email" />
              <FieldRow id="contact-email2" label="Email Address #2" type="email" />
            </div>
            <div className="mt-4 flex gap-3">
              <button type="button" className={backButton} onClick={goBack} disabled={!canGoBack}>
                Back
              </button>
              <button type="button" className={nextButton} onClick={goNext} disabled={!canGoNext}>
                Next
              </button>
            </div>
          </section>
        )}

        {currentStep === 2 && (
          <section className="mt-6">
            <h2 className={sectionTitle}>Residential Address</h2>
            <div className={`mt-3 ${gridClass}`}>
              <FieldRow id="res-address1" label="Street Address 1" />
              <FieldRow id="res-city" label="City" />
              <FieldRow id="res-state" label="State" />
              <FieldRow id="res-zip" label="Zip Code" />
            </div>

            <div className="mt-3 flex gap-3">
              {!showResidentialExtra && (
                <button type="button" className={miniButton} onClick={() => setShowResidentialExtra(true)}>
                  Add More Address
                </button>
              )}
              {showResidentialExtra && (
                <button type="button" className={miniButton} onClick={() => setShowResidentialExtra(false)}>
                  Remove Address
                </button>
              )}
            </div>

            {showResidentialExtra && (
              <div className={`mt-3 ${gridClass}`}>
                <FieldRow id="res2-address1" label="Street Address 1" />
                <FieldRow id="res2-city" label="City" />
                <FieldRow id="res2-state" label="State" />
                <FieldRow id="res2-zip" label="Zip Code" />
              </div>
            )}

            <div className="mt-4 flex gap-3">
              <button type="button" className={backButton} onClick={goBack} disabled={!canGoBack}>
                Back
              </button>
              <button type="button" className={nextButton} onClick={goNext} disabled={!canGoNext}>
                Next
              </button>
            </div>
          </section>
        )}

        {currentStep === 3 && (
          <section className="mt-6">
            <h2 className={sectionTitle}>Mailing Address</h2>
            <div className="mt-2">
              <button type="button" className={miniButton}>
                Same as Residential Address
              </button>
            </div>
            <div className={`mt-3 ${gridClass}`}>
              <FieldRow id="mail-address1" label="Street Address 1" />
              <FieldRow id="mail-address2" label="Street Address 2" />
              <FieldRow id="mail-city" label="City" />
              <FieldRow id="mail-state" label="State" />
              <FieldRow id="mail-zip" label="Zip Code" />
            </div>

            <div className="mt-3 flex gap-3">
              {!showMailingExtra && (
                <button type="button" className={miniButton} onClick={() => setShowMailingExtra(true)}>
                  Add More Address
                </button>
              )}
              {showMailingExtra && (
                <button type="button" className={miniButton} onClick={() => setShowMailingExtra(false)}>
                  Remove Address
                </button>
              )}
            </div>

            {showMailingExtra && (
              <div className={`mt-3 ${gridClass}`}>
                <FieldRow id="mail2-address1" label="Street Address 1" />
                <FieldRow id="mail2-address2" label="Street Address 2" />
                <FieldRow id="mail2-city" label="City" />
                <FieldRow id="mail2-state" label="State" />
                <FieldRow id="mail2-zip" label="Zip Code" />
              </div>
            )}

            <div className="mt-4 flex gap-3">
              <button type="button" className={backButton} onClick={goBack} disabled={!canGoBack}>
                Back
              </button>
              <button type="button" className={nextButton} disabled={!canGoNext}>
                Next
              </button>
            </div>
          </section>
        )}
      </div>
    </main>
  )
}
