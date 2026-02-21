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
- Body copy: `text-body` (or `text-base`) with default readable leading. Body/help text must be `text-sm` or larger.
- Labels/field titles: `text-label font-semibold` via `<Text variant="label" />` where practical.
- Caption/meta text: `text-caption` (or `text-xs`) only for timestamps, badges/chips, and compact technical metadata.
- Muted copy: use `text-slate-500` or `text-slate-600` with standard size tokens.

### Do / Don't
- Do use shared primitives (`Heading`, `Text`) for page/section titles and readable copy.
- Do use Tailwind typography tokens (`text-body`, `text-label`, `text-caption`) instead of ad-hoc size classes.
- Do keep legal rich-text styling centralized via shared legal typography class.
- Don't use arbitrary text size utilities (`text-[...]` font sizes).
- Don't hardcode `font-family` in component styles; rely on global `font-sans`.
- Don't use `text-xs` for readable body/help copy.

### Approved Primitive Usage
- `<Heading />`: page titles, section headers, card titles.
- `<Text variant="body" />`: readable paragraphs and helper descriptions.
- `<Text variant="label" />`: field/section labels.
- `<Text variant="caption" />`: compact metadata only.
- `<Text variant="muted" />`: secondary descriptive copy.

### Dev Check Surface
- Route: `/dev/typography` (development only).
- Purpose: visual regression reference for heading scale, text variants, and metadata treatment.

## Components
## States
## Accessibility
## Responsive Behavior
