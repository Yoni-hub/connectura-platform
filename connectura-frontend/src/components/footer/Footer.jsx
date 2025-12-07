import { Link } from 'react-router-dom'

const links = [
  { label: 'About us', to: '/' },
  { label: 'Contact us', to: '/contact' },
  { label: 'Careers', to: '/careers' },
  { label: 'Privacy policy', to: '/privacy-policy' },
  { label: 'Legal notice', to: '/legal-notice' },
]

export default function Footer() {
  return (
    <footer className="border-t border-slate-200 bg-[#f9f6f3]">
      <div className="page-shell py-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-wrap gap-4 text-sm text-slate-700">
          {links.map((link) => (
            <Link key={link.label} to={link.to} className="hover:text-[#7a0638]">
              {link.label}
            </Link>
          ))}
        </div>
        <div className="text-sm text-slate-600">© 2025 Connectura</div>
      </div>
    </footer>
  )
}
