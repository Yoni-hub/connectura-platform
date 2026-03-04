import { Link } from 'react-router-dom'

const productLinks = [
  { label: 'CoverPass', href: 'https://coverpass.connsura.com' },
  { label: 'QR Tickets', href: 'https://qr-tickets.connsura.com' },
]

const companyLinks = [
  { label: 'About', to: '/about' },
  { label: 'Contact', to: '/contact' },
]

const legalLinks = [
  { label: 'Terms of Service', to: '/terms' },
  { label: 'Privacy Policy', to: '/privacy' },
  { label: 'Data Sharing Policy', to: '/data-sharing' },
]

export default function Footer() {
  return (
    <footer className="border-t border-slate-300 bg-[#e9eef5]">
      <div className="mx-auto max-w-[1200px] px-4 py-8 md:px-6 lg:px-8">
        <div className="grid grid-cols-2 gap-8 lg:grid-cols-3">
          <div>
            <h3 className="text-[16px] font-semibold text-slate-800">Products</h3>
            <div className="mt-2 h-px w-full bg-slate-300" />
            <div className="mt-3 space-y-2 text-[14px]">
              {productLinks.map((link) => (
                <a key={link.label} href={link.href} target="_blank" rel="noreferrer" className="block text-blue-700 hover:text-blue-800">
                  {link.label}
                </a>
              ))}
            </div>
          </div>

          <div>
            <h3 className="text-[16px] font-semibold text-slate-800">Company</h3>
            <div className="mt-2 h-px w-full bg-slate-300" />
            <div className="mt-3 space-y-2 text-[14px]">
              {companyLinks.map((link) => (
                <Link key={link.label} to={link.to} className="block text-blue-700 hover:text-blue-800">
                  {link.label}
                </Link>
              ))}
            </div>
          </div>

          <div className="col-span-2 lg:col-span-1">
            <h3 className="text-[16px] font-semibold text-slate-800">Legal</h3>
            <div className="mt-2 h-px w-full bg-slate-300" />
            <div className="mt-3 space-y-2 text-[14px]">
              {legalLinks.map((link) => (
                <Link key={link.label} to={link.to} className="block text-blue-700 hover:text-blue-800">
                  {link.label}
                </Link>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-8 border-t border-slate-300 pt-4 text-center text-[14px] text-slate-500">
          © 2026 Connsura Technologies, Inc.
        </div>
      </div>
    </footer>
  )
}
