import Heading from '../../components/ui/Heading'
import Text from '../../components/ui/Text'
import Badge from '../../components/ui/Badge'

export default function DevTypography() {
  const timestamp = new Date().toLocaleString()

  return (
    <main className="page-shell py-8 space-y-6">
      <section className="surface p-6 space-y-4">
        <Heading as="h1" variant="h1">Typography Preview</Heading>
        <Text variant="body">Development-only typography reference for visual regression checks.</Text>
      </section>

      <section className="surface p-6 space-y-3">
        <Heading as="h2" variant="h2">Headings</Heading>
        <Heading as="h1" variant="h1">Heading H1</Heading>
        <Heading as="h2" variant="h2">Heading H2</Heading>
        <Heading as="h3" variant="h3">Heading H3</Heading>
        <Heading as="h4" variant="h4">Heading H4</Heading>
      </section>

      <section className="surface p-6 space-y-3">
        <Heading as="h2" variant="h2">Text Variants</Heading>
        <Text variant="body">Body text: primary readable paragraph copy for settings and helper content.</Text>
        <Text variant="label">Label text: control labels and short section labels.</Text>
        <Text variant="caption">Caption text: compact metadata and technical hints.</Text>
        <Text variant="muted">Muted text: secondary description with lower emphasis.</Text>
      </section>

      <section className="surface p-6 space-y-3">
        <Heading as="h2" variant="h2">Meta UI</Heading>
        <div className="flex items-center gap-3">
          <Badge label="Badge sample" tone="blue" />
          <span className="text-xs text-slate-500">{timestamp}</span>
        </div>
      </section>
    </main>
  )
}

