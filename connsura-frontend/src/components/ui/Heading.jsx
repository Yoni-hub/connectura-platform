const variants = {
  h1: 'text-3xl font-bold text-slate-900',
  h2: 'text-2xl font-semibold text-slate-900',
  h3: 'text-lg font-semibold text-slate-900',
  h4: 'text-base font-semibold text-slate-900',
}

const defaultTags = {
  h1: 'h1',
  h2: 'h2',
  h3: 'h3',
  h4: 'h4',
}

export default function Heading({ as, variant = 'h2', className = '', children, ...props }) {
  const Tag = as || defaultTags[variant] || 'h2'
  const variantClass = variants[variant] || variants.h2
  const merged = [variantClass, className].filter(Boolean).join(' ')
  return (
    <Tag className={merged} {...props}>
      {children}
    </Tag>
  )
}

