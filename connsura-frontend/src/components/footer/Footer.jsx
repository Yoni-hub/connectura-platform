import { Link } from 'react-router-dom'

const links = [
  { label: 'Contact us', to: '/contact' },
  { label: 'Privacy policy', to: '/privacy-policy' },
  { label: 'Legal notice', to: '/legal-notice' },
]

export default function Footer() {
  return (
    <footer className="border-t border-[#dfe7f3] bg-white">
      <div className="page-shell py-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-wrap gap-4 text-sm text-slate-700">
          {links.map((link) => (
            <Link key={link.label} to={link.to} className="hover:text-[#0b3b8c]">
              {link.label}
            </Link>
          ))}
        </div>
        <div className="text-sm text-slate-600">© 2025 Connsura</div>
      </div>
    </footer>
  )
}
