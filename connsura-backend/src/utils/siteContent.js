const normalizeWhitespace = (value = '') => value.replace(/\s+/g, ' ').trim()

const ABOUT_PUBLIC_CONTENT = `
<h2>Introduction</h2>
<p>Connsura is a technology platform designed to simplify how people organize, manage, and share their insurance information.</p>
<p>Buying or reviewing insurance often means filling out the same forms repeatedly, navigating unfamiliar terminology, and struggling to communicate clearly with licensed professionals. Connsura was built to solve that problem without replacing or interfering with the insurance process itself.</p>
<h2>What We Do</h2>
<p>Connsura provides a secure digital Insurance Passport that allows individuals and families to:</p>
<ul>
  <li>Create and manage their insurance-related information in one place</li>
  <li>Update details once instead of re-entering them repeatedly</li>
  <li>Share their information securely with licensed insurance agents when they choose</li>
  <li>Find independent agents based on language, location, or name</li>
  <li>Communicate directly with agents using built-in messaging tools</li>
</ul>
<p>All information shared through Connsura remains under the user's control.</p>
<h2>What We Do Not Do</h2>
<p>To be clear:</p>
<ul>
  <li>Connsura does not sell insurance</li>
  <li>We do not quote premiums or recommend policies</li>
  <li>We do not negotiate coverage terms</li>
  <li>We do not bind insurance or collect payments</li>
  <li>We do not act on behalf of any insurance company</li>
</ul>
<p>All insurance transactions occur directly between consumers and independently licensed insurance agents.</p>
<h2>Our Role in the Insurance Ecosystem</h2>
<p>Connsura serves as neutral infrastructure - a secure bridge between consumers and licensed professionals.</p>
<p>We support:</p>
<ul>
  <li>Consumers by reducing friction and improving clarity</li>
  <li>Licensed agents by providing better-organized, client-approved information</li>
</ul>
<p>We do not replace agents, carriers, or regulators.</p>
<h2>Trust, Privacy &amp; Control</h2>
<ul>
  <li>Users own their data</li>
  <li>Information is shared only with explicit consent</li>
  <li>Access is logged and auditable</li>
  <li>Security and privacy are foundational to our design</li>
</ul>
<p>Trust is not a feature - it is the core of our platform.</p>
<h2>Our Vision</h2>
<p>We believe insurance should be easier to manage, easier to understand, and easier to communicate - without compromising regulation, professionalism, or consumer protection.</p>
<p>Connsura exists to modernize access, not bypass safeguards.</p>
`

const LEGAL_NOTICE_CONTENT = `
<h2>Connsura: Platform Overview &amp; Regulatory Position</h2>
<h3>Company Overview</h3>
<p>Connsura is an insurance technology (InsurTech) platform that enables consumers to digitally store, manage, and selectively share insurance-related information with independently licensed insurance producers.</p>
<p>Connsura operates exclusively as a technology and data-management platform and does not participate in insurance solicitation, negotiation, quoting, binding, or premium collection.</p>
<h3>Platform Functionality</h3>
<p>Connsura provides:</p>
<ul>
  <li>A secure consumer-managed insurance profile ("Insurance Passport")</li>
  <li>Consent-based data sharing with licensed agents</li>
  <li>Agent discovery tools (language, geography, name)</li>
  <li>Communication features supporting client-agent interaction</li>
  <li>Auditability and access controls for shared information</li>
</ul>
<p>All insurance-related decisions and transactions occur outside the Connsura platform.</p>
<h3>Explicit Exclusions</h3>
<p>Connsura does not:</p>
<ul>
  <li>Act as an insurance producer, broker, or agency</li>
  <li>Represent insurers or underwrite risk</li>
  <li>Provide policy recommendations or pricing</li>
  <li>Receive commissions or compensation tied to policy placement</li>
  <li>Collect or transmit insurance premiums</li>
</ul>
<p>The platform is intentionally structured to avoid activities requiring insurance producer licensure.</p>
<h3>Agent Relationship Model</h3>
<p>All agents using Connsura are:</p>
<ul>
  <li>Independently licensed insurance producers</li>
  <li>Responsible for their own regulatory compliance</li>
  <li>Not employees, contractors, or representatives of Connsura</li>
</ul>
<p>License verification may be performed for platform integrity, but Connsura does not sponsor, supervise, or control agent conduct.</p>
<h3>Data Governance &amp; Consumer Protection</h3>
<ul>
  <li>Data ownership remains with the consumer</li>
  <li>Information sharing is opt-in and revocable</li>
  <li>Access is logged for transparency and audit purposes</li>
  <li>Security controls align with industry best practices</li>
</ul>
<p>Connsura's compliance focus is centered on data protection, transparency, and consumer consent.</p>
<h3>Regulatory Position Statement</h3>
<p>Connsura should be classified as a non-regulated insurance technology service provider, similar to CRM platforms, data-management tools, and agent directories.</p>
<p>The platform does not engage in activities that constitute insurance solicitation or transaction under applicable state insurance laws.</p>
<h3>Long-Term Vision</h3>
<p>Connsura aims to become trusted infrastructure that supports licensed professionals while empowering consumers - without disrupting established regulatory frameworks.</p>
`

const PRIVACY_POLICY_CONTENT = `
<h2>Your Data, Your Control</h2>
<p>Connsura is built around consumer ownership of information. You decide what to add, update, and share. You can remove or stop sharing information at any time.</p>
<h2>Consent-Based Sharing</h2>
<p>Information is shared only when you explicitly authorize it. Sharing is opt-in, revocable, and scoped to the sections you choose.</p>
<h2>Auditability</h2>
<p>Access to shared information is logged. These records support transparency and accountability for data sharing actions.</p>
<h2>No Data Selling</h2>
<p>Connsura does not sell personal data. We do not monetize user information through advertising or third-party data brokering.</p>
<h2>Security</h2>
<p>Security controls align with industry best practices. We use technical and organizational measures designed to protect data from unauthorized access or disclosure.</p>
<h2>Retention &amp; Updates</h2>
<p>We retain information only as needed to operate the platform. This policy may be updated over time, and changes will be posted on this page.</p>
`

const CAREERS_INTRO = `
<p>Connsura builds technology that improves trust, accessibility, and clarity in how people manage insurance information. Every role supports a neutral, consumer-first platform. All open positions are non-insurance, non-producer roles.</p>
`

const CONTACT_INTRO = `
<p>Questions about the platform, data usage, or access? Reach out and our team will respond.</p>
`

const SITE_CONTENT_DEFAULTS = [
  {
    slug: 'about_public',
    title: 'About Connsura',
    content: ABOUT_PUBLIC_CONTENT,
  },
  {
    slug: 'privacy_policy',
    title: 'Privacy Policy',
    content: PRIVACY_POLICY_CONTENT,
  },
  {
    slug: 'legal_notice',
    title: 'Legal Notice',
    content: LEGAL_NOTICE_CONTENT,
  },
  {
    slug: 'careers_intro',
    title: 'Careers Intro',
    content: CAREERS_INTRO,
  },
  {
    slug: 'contact_intro',
    title: 'Contact Intro',
    content: CONTACT_INTRO,
  },
]

const COMPLIANCE_PATTERNS = [
  { pattern: /\bwe\s+quote\b/i, message: 'Content suggests quoting policies.' },
  { pattern: /\bwe\s+bind\b/i, message: 'Content suggests binding coverage.' },
  { pattern: /\bwe\s+sell\s+insurance\b/i, message: 'Content suggests selling insurance.' },
  { pattern: /\bwe\s+sell\s+policies\b/i, message: 'Content suggests selling policies.' },
  { pattern: /\bwe\s+recommend\s+polic(y|ies)\b/i, message: 'Content suggests recommending policies.' },
  { pattern: /\bwe\s+recommend\s+coverage\b/i, message: 'Content suggests recommending coverage.' },
  { pattern: /\bwe\s+collect\s+premiums\b/i, message: 'Content suggests premium collection.' },
  { pattern: /\bwe\s+underwrite\b/i, message: 'Content suggests underwriting activity.' },
  { pattern: /\bwe\s+receive\s+commissions?\b/i, message: 'Content suggests receiving commissions.' },
]

const sanitizeContent = (value = '') => {
  const withoutScripts = value.replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '')
  const withoutEvents = withoutScripts.replace(/\son\w+="[^"]*"/gi, '')
  return withoutEvents
}

const checkComplianceWarnings = (value = '') => {
  const normalized = normalizeWhitespace(String(value || ''))
  if (!normalized) return []
  return COMPLIANCE_PATTERNS.filter((entry) => entry.pattern.test(normalized)).map(
    (entry) => entry.message
  )
}

const getDefaultContent = (slug) => SITE_CONTENT_DEFAULTS.find((entry) => entry.slug === slug) || null

module.exports = {
  SITE_CONTENT_DEFAULTS,
  getDefaultContent,
  sanitizeContent,
  checkComplianceWarnings,
}
