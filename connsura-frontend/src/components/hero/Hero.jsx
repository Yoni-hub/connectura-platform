export default function Hero({ onCreateProfile }) {
  return (
    <section className="relative overflow-hidden bg-[#0b3b8c] px-4 pt-8 sm:px-8 lg:px-16">
      <div className="relative z-10 grid gap-6">
        <div className="p-6">
          <div className="mx-auto flex w-full max-w-xl flex-col items-center gap-4 text-center text-white">
            <p className="text-xs font-semibold uppercase tracking-[0.35em] text-white/80">
              Connsura - Your Insurance Passport
            </p>
            <h1 className="text-2xl font-semibold leading-tight text-white sm:text-3xl">
              Create Your Insurance Profile - Once
            </h1>
            <p className="text-sm text-white/90">
              Build a reusable insurance profile you control. Share it securely with a link or PDF whenever you need
              coverage.
            </p>

            <div className="flex flex-wrap justify-center gap-3 pt-1">
              <button
                type="button"
                className="pill-btn-primary px-6 py-3 text-sm sm:text-base"
                onClick={onCreateProfile}
              >
                Create Your Insurance Profile
              </button>
            </div>

          </div>
        </div>
      </div>
    </section>
  )
}
