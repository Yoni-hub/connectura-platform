export default function CreateProfile() {
  const inputClass =
    'h-7 w-full rounded border border-slate-300 bg-white px-2 text-sm text-slate-900 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)] focus:border-[#3b82f6] focus:outline-none focus:ring-2 focus:ring-[#3b82f6]/20 sm:w-1/2'
  const selectClass = `${inputClass} pr-7`
  const openCustomerLogin = () => {
    window.dispatchEvent(new Event('open-customer-auth'))
  }
  const openCustomerSignup = () => {
    window.dispatchEvent(new Event('open-customer-auth-signup'))
  }

  return (
    <main className="bg-white px-4 pb-10 pt-4 sm:px-8 lg:px-16">
      <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-start lg:gap-8">
        <div className="w-full max-w-[520px] space-y-3">
          <div className="rounded-2xl bg-3d p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.35em] text-slate-700">Create your profile</p>
            <h1 className="text-3xl font-semibold leading-tight text-slate-900 sm:text-4xl">
              Create Your Insurance Profile
            </h1>
            <img
              src="/create-profile.png"
              alt="My profile"
              className="mt-2 w-full max-w-[320px] object-contain"
              loading="lazy"
            />
          </div>
          <p className="text-sm text-slate-600">
            You must be signed in to save and continue searching for agents.
          </p>
          <div className="flex flex-wrap gap-3">
            <button type="button" className="pill-btn-primary px-5 py-2 text-sm" onClick={openCustomerLogin}>
              Signin/Signup
            </button>
          </div>
        </div>

        <div className="space-y-4" aria-labelledby="named-insured">
          <div className="max-w-[440px] space-y-2">
            <div className="inline-flex items-center rounded-t-md border border-b-0 border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700">
              General Information
            </div>
            <div className="-mt-px rounded-md border border-slate-300 bg-white p-1 shadow-[0_8px_18px_rgba(15,23,42,0.06)]">
              <h2 id="named-insured" className="text-lg font-semibold text-[#1e4f9d]">
                Named Insured
              </h2>
              <form className="mt-0.5 grid gap-x-0 gap-y-0 text-sm sm:grid-cols-[130px_minmax(0,1fr)]">
                <label htmlFor="named-first" className="text-slate-800">
                  <span className="mr-1 text-red-600">*</span>First Name:
                </label>
                <input id="named-first" className={inputClass} />

                <label htmlFor="named-middle" className="text-slate-800">
                  Middle Name:
                </label>
                <input id="named-middle" className={inputClass} />

                <label htmlFor="named-last" className="text-slate-800">
                  <span className="mr-1 text-red-600">*</span>Last Name:
                </label>
                <input id="named-last" className={inputClass} />

                <label htmlFor="named-suffix" className="text-slate-800">
                  Suffix:
                </label>
                <select id="named-suffix" className={selectClass}>
                  <option value="">Select</option>
                  <option>Jr.</option>
                  <option>Sr.</option>
                  <option>II</option>
                  <option>III</option>
                </select>

                <label htmlFor="named-dob" className="text-slate-800">
                  <span className="mr-1 text-red-600">*</span>Date of Birth:
                </label>
                <input id="named-dob" placeholder="MM/DD/YYYY" className={inputClass} />

                <label htmlFor="named-gender" className="text-slate-800">
                  Gender:
                </label>
                <select id="named-gender" className={selectClass}>
                  <option value="">Select</option>
                  <option>Female</option>
                  <option>Male</option>
                  <option>Non-binary</option>
                  <option>Prefer not to say</option>
                </select>

                <label htmlFor="named-marital" className="text-slate-800">
                  Marital Status:
                </label>
                <select id="named-marital" className={selectClass}>
                  <option value="">Select</option>
                  <option>Single</option>
                  <option>Married</option>
                  <option>Divorced</option>
                  <option>Widowed</option>
                  <option>Separated</option>
                </select>

                <label htmlFor="phone-one-area" className="text-slate-800">
                  Phone:
                </label>
                <input id="phone-one-area" className={inputClass} />

                <label htmlFor="named-email" className="text-slate-800">
                  Email Address:
                </label>
                <input id="named-email" className={inputClass} />
              </form>
            </div>
            <div className="flex flex-wrap gap-3">
              <button type="button" className="pill-btn-ghost px-6 py-2.5 text-sm">
                Save
              </button>
              <button type="button" className="pill-btn-primary px-6 py-2.5 text-sm">
                Next
              </button>
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}
