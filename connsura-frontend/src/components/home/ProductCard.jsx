export default function ProductCard({ icon: Icon, title, subtitle, body, href, buttonLabel, imageSrc, imageAlt, imageClassName = '' }) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-[#edf2f8] p-4 shadow-sm">
      <div className="grid gap-3 lg:grid-cols-[1fr_190px] lg:items-end">
        <div className="relative z-10">
          <div className="flex items-center gap-2">
            <Icon size={28} className="text-blue-600" aria-hidden="true" />
            <h3 className="text-[28px] font-semibold leading-none text-[#0e63bf]">{title}</h3>
          </div>
          <p className="mt-2 text-[15px] font-medium leading-tight text-slate-800 md:text-[14px]">{subtitle}</p>
          <div className="mt-2 h-px w-full bg-slate-300" />
          <p className="mt-3 max-w-sm text-[14px] leading-tight text-slate-600">{body}</p>
          <a
            href={href}
            target="_blank"
            rel="noreferrer"
            className="mt-4 inline-flex rounded-xl bg-blue-600 px-5 py-2.5 text-[14px] font-semibold leading-none text-white transition-colors hover:bg-blue-700"
          >
            {buttonLabel}
          </a>
        </div>
        <div className="relative hidden min-h-[155px] lg:block">
          <img
            src={imageSrc}
            alt={imageAlt}
            className={`absolute bottom-0 right-0 h-[180px] max-w-none object-contain ${imageClassName}`.trim()}
            loading="lazy"
          />
        </div>
      </div>
    </article>
  )
}
