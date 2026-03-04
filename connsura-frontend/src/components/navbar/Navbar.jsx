import { Link } from 'react-router-dom'

export default function Navbar() {
  return (
    <header className="h-16 border-b border-slate-200 bg-[#eef2f7]">
      <div className="mx-auto flex h-full max-w-[1200px] items-center px-4 md:px-6 lg:px-8">
        <Link to="/" className="flex items-center gap-2.5">
          <img src="/your-logo.png" alt="Connsura logo" className="h-9 w-9 rounded-md object-cover" />
          <span className="text-[18px] font-semibold leading-none text-slate-800">Connsura</span>
        </Link>
      </div>
    </header>
  )
}
