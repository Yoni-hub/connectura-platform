import { QrCode, ShieldCheck } from 'lucide-react'
import ProductCard from '../components/home/ProductCard'

export default function Home() {
  return (
    <main className="bg-slate-50">
      <section className="relative overflow-hidden border-b border-slate-200 bg-[#e9eef5]">
        <img
          src="/hero-wave-background-transparent.png"
          alt=""
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-[#e9eef5]/55" aria-hidden="true" />

        <div className="relative z-10 mx-auto max-w-[1200px] px-4 pb-7 pt-4 text-center md:px-6 lg:px-8 lg:pb-8 lg:pt-6">
          <h1 className="mx-auto max-w-4xl text-[30px] font-bold leading-tight text-slate-800 lg:text-[38px]">
            Simple tools for real-world problems.
          </h1>
          <p className="mx-auto mt-3 max-w-3xl text-[14px] text-slate-700 lg:text-[16px]">
            Connsura Technologies builds secure online tools to help you manage important information and real-world
            activities.
          </p>
          <a
            href="#products"
            className="mt-4 inline-flex rounded-xl bg-blue-600 px-8 py-3 text-[15px] font-semibold text-white shadow-[0_6px_14px_rgba(37,99,235,0.35)] transition-colors hover:bg-blue-700"
          >
            View Our Products
          </a>
        </div>
      </section>

      <div className="mx-auto max-w-[1200px] px-4 md:px-6 lg:px-8">
        <section id="products" className="py-4 lg:py-5">
          <div className="flex items-center gap-6">
            <div className="h-px flex-1 bg-slate-300" />
            <h2 className="text-[28px] font-semibold text-slate-800 lg:text-[32px]">Our Products</h2>
            <div className="h-px flex-1 bg-slate-300" />
          </div>

          <div className="mt-3 grid grid-cols-1 gap-4 lg:grid-cols-2">
            <ProductCard
              icon={ShieldCheck}
              title="CoverPass"
              subtitle="Your Insurance Passport"
              body="Securely store and share your insurance information."
              href="https://coverpass.connsura.com"
              buttonLabel="Open CoverPass"
              imageSrc="/compass-shield-documents-transparent.png"
              imageAlt="CoverPass shield and documents"
              imageClassName="h-[230px] right-[-30px] bottom-[-16px] scale-[1.15]"
            />
            <ProductCard
              icon={QrCode}
              title="QR Tickets"
              subtitle="QR Event Ticket System"
              body="Generate QR tickets and manage event entry."
              href="https://qr-tickets.connsura.com"
              buttonLabel="Open QR Tickets"
              imageSrc="/qr-phone-transparent.png"
              imageAlt="QR phone ticket scanner"
              imageClassName="h-[245px] right-[-26px] bottom-[-22px] scale-[1.2]"
            />
          </div>
        </section>

        <section className="border-t border-slate-300 py-7 lg:py-8">
          <h2 className="text-center text-[28px] font-semibold text-slate-800 lg:text-[32px]">Why Connsura?</h2>
          <ul className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
            {['Easy to Use Solutions', 'Privacy-Focused Design', 'Real-World Impact'].map((item) => (
              <li key={item} className="flex items-center gap-3 text-slate-800">
                <img src="/blue-check.png" alt="" aria-hidden="true" className="h-14 w-14 shrink-0 object-contain" />
                <span className="text-[16px] font-medium">{item}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <section className="border-y border-slate-300 bg-[#e9eef5]">
        <div className="mx-auto grid max-w-[1200px] grid-cols-1 gap-3 px-4 py-3.5 md:px-6 lg:grid-cols-2 lg:items-center lg:px-8 lg:py-4">
          <div>
            <h2 className="text-[30px] font-semibold text-slate-800 lg:text-[36px]">Your data stays under your control</h2>
            <p className="mt-1.5 text-[15px] text-slate-700">We prioritize your privacy.</p>
            <p className="text-[15px] text-slate-700">You decide when to share your information.</p>
          </div>
          <div className="relative mx-auto h-64 w-full max-w-[520px]">
            <img
              src="/privacy-shield-lock-transparent.png"
              alt="Shield and lock privacy illustration"
              className="h-full w-full object-contain"
              loading="lazy"
            />
          </div>
        </div>
      </section>
    </main>
  )
}
