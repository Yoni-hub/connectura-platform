import { createPortal } from 'react-dom'

export default function Modal({ title, open, onClose, children, panelClassName = '', showClose = true }) {
  if (!open) return null

  const content = (
    <div className="modal-overlay fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
      <div
        className={`modal-panel w-full max-w-md max-h-[90vh] overflow-y-auto rounded-2xl bg-white shadow-xl p-4 sm:p-6 ${panelClassName}`}
      >
        {showClose &&
          (title ? (
            <div className="modal-header print-hidden mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold">{title}</h3>
              <button onClick={onClose} className="text-sm text-slate-500 hover:text-slate-900">
                Close
              </button>
            </div>
          ) : (
            <div className="modal-header print-hidden mb-2 flex justify-end">
              <button onClick={onClose} className="text-sm text-slate-500 hover:text-slate-900">
                Close
              </button>
            </div>
          ))}
        {children}
      </div>
    </div>
  )

  if (typeof document === 'undefined') return content
  return createPortal(content, document.body)
}
