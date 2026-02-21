# Frontend UI Spec

## Typography

### Font Family
- Primary UI font: `Source Sans 3`
- Tailwind token: `font-sans`
- Fallback stack: `"Helvetica Neue", Arial, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`
- Intentional exception: `font-mono` is allowed for IDs, codes, and machine-readable values in admin/auth views.

### Heading Mapping
- `h1`: `text-3xl font-bold`
- `h2`: `text-2xl font-semibold`
- `h3`: `text-lg font-semibold`
- `h4`: `text-base font-semibold`
- Keep `h1-h4` semantic hierarchy in markup and avoid skipping levels without reason.

### Body, Label, Caption Rules
- Body copy: `text-body` (or `text-base`) with default readable leading.
- Labels/field titles: `text-label font-semibold`.
- Caption/meta text: `text-caption` (or `text-xs`) for timestamps, helper text, and dense metadata.
- Muted copy: use `text-slate-500` or `text-slate-600` with standard size tokens.

### Do / Don't
- Do use Tailwind typography tokens and shared primitives (`Heading`, `Text`) for new UI.
- Do keep legal rich-text styling centralized via shared legal typography class.
- Don't use arbitrary pixel text sizes like `text-[11px]`, `text-[13px]`, `text-[15px]`.
- Don't hardcode `font-family` in component styles; rely on global `font-sans`.

## Components
## States
## Accessibility
## Responsive Behavior
