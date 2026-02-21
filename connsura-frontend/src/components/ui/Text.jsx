const variants = {
  body: 'text-body text-slate-700',
  label: 'text-label font-semibold text-slate-700',
  caption: 'text-caption text-slate-500',
  muted: 'text-label text-slate-500',
}

export default function Text({ as: Tag = 'p', variant = 'body', className = '', children, ...props }) {
  const variantClass = variants[variant] || variants.body
  const merged = [variantClass, className].filter(Boolean).join(' ')
  return (
    <Tag className={merged} {...props}>
      {children}
    </Tag>
  )
}

