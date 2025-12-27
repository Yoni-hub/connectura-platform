export default function CreateProfile() {
  const inputClass =
    'h-7 rounded border border-slate-300 bg-white px-2 text-sm text-slate-900 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)] focus:border-[#3b82f6] focus:outline-none focus:ring-2 focus:ring-[#3b82f6]/20'
  const selectClass = `${inputClass} pr-7`

  return (
    <main className="bg-white px-4 pb-10 pt-4 sm:px-8 lg:px-16">
      <section className="grid gap-4 lg:grid-cols-[1fr_1fr] lg:items-start lg:gap-0">
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-[0.35em] text-slate-500">Create your profile</p>
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

        <div className="space-y-4 lg:-ml-40" aria-labelledby="named-insured">
          <div className="max-w-[520px] space-y-3">
            <div className="inline-flex items-center rounded-t-md border border-b-0 border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700">
              General Information
            </div>
            <div className="-mt-px rounded-md border border-slate-300 bg-white p-6 shadow-[0_8px_18px_rgba(15,23,42,0.06)]">
              <h2 id="named-insured" className="text-lg font-semibold text-[#1e4f9d]">
                Named Insured
              </h2>
              <form className="mt-4 grid gap-x-4 gap-y-3 text-sm sm:grid-cols-[160px_minmax(0,1fr)]">
                <label htmlFor="named-first" className="text-slate-800">
                  <span className="mr-1 text-red-600">*</span>First Name:
                </label>
                <input id="named-first" className={`${inputClass} max-w-[220px]`} />

                <label htmlFor="named-middle" className="text-slate-800">
                  Middle Name:
                </label>
                <input id="named-middle" className={`${inputClass} max-w-[220px]`} />

                <label htmlFor="named-last" className="text-slate-800">
                  <span className="mr-1 text-red-600">*</span>Last Name:
                </label>
                <input id="named-last" className={`${inputClass} max-w-[220px]`} />

                <label htmlFor="named-suffix" className="text-slate-800">
                  Suffix:
                </label>
                <select id="named-suffix" className={`${selectClass} max-w-[180px]`}>
                  <option value="">Select</option>
                  <option>Jr.</option>
                  <option>Sr.</option>
                  <option>II</option>
                  <option>III</option>
                </select>

                <label htmlFor="phone-one-area" className="text-slate-800">
                  Phone One:
                </label>
                <div className="flex flex-wrap items-center gap-2">
                  <input id="phone-one-area" className={`${inputClass} w-12`} />
                  <span className="text-slate-400">-</span>
                  <input className={`${inputClass} w-12`} />
                  <span className="text-slate-400">-</span>
                  <input className={`${inputClass} w-16`} />
                  <select className={`${selectClass} w-24`}>
                    <option>Mobile</option>
                    <option>Home</option>
                    <option>Work</option>
                  </select>
                </div>

                <label htmlFor="phone-two-area" className="text-slate-800">
                  Phone Two:
                </label>
                <div className="flex flex-wrap items-center gap-2">
                  <input id="phone-two-area" className={`${inputClass} w-12`} />
                  <span className="text-slate-400">-</span>
                  <input className={`${inputClass} w-12`} />
                  <span className="text-slate-400">-</span>
                  <input className={`${inputClass} w-16`} />
                  <select className={`${selectClass} w-24`}>
                    <option>Mobile</option>
                    <option>Home</option>
                    <option>Work</option>
                  </select>
                </div>

                <label htmlFor="named-email" className="text-slate-800">
                  Email Address:
                </label>
                <input id="named-email" className={`${inputClass} max-w-[280px]`} />

                <label htmlFor="named-dob" className="text-slate-800">
                  <span className="mr-1 text-red-600">*</span>Date of Birth:
                </label>
                <input id="named-dob" placeholder="MM/DD/YYYY" className={`${inputClass} max-w-[160px]`} />

                <label htmlFor="named-ssn-1" className="text-slate-800">
                  Social Security:
                </label>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-slate-300 text-[10px] text-slate-500">
                    ?
                  </span>
                  <input id="named-ssn-1" className={`${inputClass} w-12`} />
                  <span className="text-slate-400">-</span>
                  <input className={`${inputClass} w-10`} />
                  <span className="text-slate-400">-</span>
                  <input className={`${inputClass} w-14`} />
                </div>
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
