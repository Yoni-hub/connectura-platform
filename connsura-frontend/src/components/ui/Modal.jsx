export default function Modal({ title, open, onClose, children }) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
      <div className="w-full max-w-md max-h-[90vh] overflow-y-auto rounded-2xl bg-white shadow-xl p-4 sm:p-6">
        {title ? (
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">{title}</h3>
            <button onClick={onClose} className="text-sm text-slate-500 hover:text-slate-900">
              Close
            </button>
          </div>
        ) : (
          <div className="flex justify-end mb-2">
            <button onClick={onClose} className="text-sm text-slate-500 hover:text-slate-900">
              Close
            </button>
          </div>
        )}
        {children}
      </div>
    </div>
  )
}
