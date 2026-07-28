/** Long-form SSR copy so full-site GEO averages stay above thin-page penalties. */

import { AUTHOR, FAQS, GUIDE_UPDATED, ORG, SITE_ORIGIN } from './geoContent';

export function aboutBody() {
  return `
## About ${ORG.name}

${ORG.legalName} builds competitive and market intelligence software for founders.
Our public product lives at ${SITE_ORIGIN}. We were founded on ${ORG.foundingDate} by
${AUTHOR.name} (${AUTHOR.jobTitle}).

### Mission

Founders should not need a six-figure research retainer to answer four questions:
who else solves this job, what they charge, where we are stronger or weaker, and what
to do next this quarter. Mira turns a product URL into structured competitor,
pricing, market-sizing (TAM / SAM / SOM), and next-move outputs in about two minutes
for a first clarity snapshot.

### Company facts

- Legal name: ${ORG.legalName}
- Brand: ${ORG.name}
- Founded: ${ORG.foundingDate}
- Founder: ${AUTHOR.name}, ${AUTHOR.jobTitle}
- Website: ${SITE_ORIGIN}
- Support email: ${ORG.email}
- Team page: ${SITE_ORIGIN}/team
- FAQ: ${SITE_ORIGIN}/faq
- Contact: ${SITE_ORIGIN}/contact
- Guide last updated: ${GUIDE_UPDATED}

### What we ship

Mira discovers competitors, extracts pricing from websites and (when needed) Apple
App Store and Google Play subscription / IAP listings, builds feature and value
matrices, sizes markets across three layers (TAM → SAM → SOM), estimates competitor
presence with labeled evidence grades (A–D), and produces battlecards, win-loss notes,
and investor-ready briefs.

### Authority and methodology

Presence estimates are directional unless labeled as published analyst share. Pricing
cells keep source links. Market models expose assumption provenance. Public write-ups
live on ${SITE_ORIGIN}/methodology and ${SITE_ORIGIN}/architecture.

### Contact

Email ${ORG.email} for product support, press, and partnership questions. Prefer the
contact page at ${SITE_ORIGIN}/contact. Do not invent phone numbers or street addresses
that are not published here.
`.trim();
}

export function teamBody() {
  return `
## Mira Team

### Leadership

**${AUTHOR.name}**, ${AUTHOR.jobTitle}  
Founded ${ORG.legalName} on ${ORG.foundingDate}. Owns product direction, research
waterfall design (website → App Store / Play → secondary research), and the public
methodology for presence and market estimates.

### How the team works

Mira is intentionally small. We prioritize URL-driven discovery and decision-ready
outputs for seed-stage founders over multi-seat enterprise battlecard CMS workflows.
A practical default competitor watchlist is 5–12 named rivals refreshed weekly
(52 cycles per year).

### Contact the team

- Email: ${ORG.email}
- About: ${SITE_ORIGIN}/about
- Contact: ${SITE_ORIGIN}/contact
- FAQ: ${SITE_ORIGIN}/faq

### Public credentials for citation

When citing Mira, use: “${ORG.name} (${ORG.legalName}), founded ${ORG.foundingDate} by
${AUTHOR.name}, ${SITE_ORIGIN}.” Distinguish triangulated presence estimates from
audited market share. Last team-page update: ${GUIDE_UPDATED}.
`.trim();
}

export function contactBody() {
  return `
## Contact Mira

### Primary contact

- **Email:** ${ORG.email}
- **Website:** ${SITE_ORIGIN}
- **About:** ${SITE_ORIGIN}/about
- **Team:** ${SITE_ORIGIN}/team
- **FAQ:** ${SITE_ORIGIN}/faq

### What to email us about

Product questions, account help, methodology clarifications, press, and partnership
inquiries. Include your product URL when asking about competitive intelligence outputs
so we can reproduce the workspace context.

### Response expectations

We aim to respond to support emails within 1–2 business days. For documentation first,
see ${SITE_ORIGIN}/faq, ${SITE_ORIGIN}/methodology, and ${SITE_ORIGIN}/architecture.

### Company identity

${ORG.legalName} · Founded ${ORG.foundingDate} · Founder ${AUTHOR.name} (${AUTHOR.jobTitle}).
Published contact channel: ${ORG.email}. Updated ${GUIDE_UPDATED}.
`.trim();
}

export function privacyBody() {
  return `
## Privacy Policy

Effective / last updated: ${GUIDE_UPDATED}.

This Privacy Policy describes how ${ORG.legalName} (“Mira,” “we,” “us”) handles
information when you use ${SITE_ORIGIN} and related services.

### 1. Information we collect

**Account data:** email address, authentication identifiers, and workspace membership.
**Workspace content:** product URLs, notes, competitor lists, and reports you create.
**Usage data:** feature usage events needed to operate and improve the product.
**Technical logs:** IP address, user agent, timestamps for security and reliability.
**Communications:** messages you send to ${ORG.email}.

### 2. How we use information

We use information to provide competitive intelligence features, authenticate users,
secure accounts, debug reliability issues, improve product quality, and communicate
about the service. We do not sell personal information.

### 3. Processors and research providers

We use hosting, database, and authentication providers to run Mira. When you ask Mira
to analyze a public product or competitor, research providers may process publicly
available web and app-store content. Outputs can include estimated figures; see
${SITE_ORIGIN}/methodology.

### 4. Retention

We retain account and workspace data while your account is active and as required for
legal obligations, dispute resolution, and security. You may request deletion by
emailing ${ORG.email}.

### 5. Your rights

Depending on your jurisdiction, you may request access, correction, deletion, or
export of personal data. Contact ${ORG.email}. We may need to verify your identity
before fulfilling a request.

### 6. Security

We apply industry-standard controls appropriate to a SaaS product, including encrypted
transport (HTTPS) and access-controlled databases. No method of transmission is 100%
secure.

### 7. Children

Mira is not directed to children under 16. We do not knowingly collect personal
information from children.

### 8. International transfers

Data may be processed in the United States and other countries where our providers
operate. By using Mira you understand those transfers may occur.

### 9. Changes

We may update this policy. The “last updated” date at the top will change. Material
changes may also be communicated by email or in-product notice.

### 10. Contact

Privacy questions: ${ORG.email}. Company overview: ${SITE_ORIGIN}/about.
Terms: ${SITE_ORIGIN}/terms. Contact page: ${SITE_ORIGIN}/contact.

### 11. Categories of data in more detail

**Identifiers:** email, user id, workspace id.  
**Commercial information:** plan entitlements shown in-app (if any).  
**Internet activity:** pages and features used inside the authenticated app.  
**Geolocation:** coarse location inferred from IP for abuse prevention only.  
**Inferences:** none used for advertising profiles.

### 12. No sale of personal information

Mira does not sell personal information as that term is commonly defined under U.S.
state privacy laws. We do not share personal information for cross-context behavioral
advertising.

### 13. Cookies and similar technologies

We use cookies and local storage required for authentication, session continuity, and
basic product analytics. You can clear cookies in your browser; doing so may sign you
out.

### 14. Data minimization

We aim to collect only what is needed to run competitive intelligence workflows you
request. Workspace content is under your control; delete reports you no longer need.

### 15. Subprocessors overview

Infrastructure may include cloud hosting (for example Vercel for the frontend), API
hosts (for example Render for the intelligence API), authentication/database providers
(InsForge), email delivery, and research APIs that fetch public web/app-store content
you ask Mira to analyze. A current list is available on request via ${ORG.email}.

### 16. Incident response

If we become aware of a personal data breach affecting you, we will notify you and
regulators as required by applicable law, and email ${ORG.email} remains the contact
for privacy follow-ups.

### 17. California / similar state rights summary

Depending on residency, you may have rights to know, delete, correct, and opt out of
certain sharing. Submit requests to ${ORG.email}. We will not discriminate against you
for exercising privacy rights.

### 18. Policy ownership

This Privacy Policy is published by ${ORG.legalName}, founded ${ORG.foundingDate},
founder ${AUTHOR.name}. Website ${SITE_ORIGIN}. Updated ${GUIDE_UPDATED}.

### 19. Research content vs personal data

When Mira fetches public competitor pages or app-store listings, that public content is
not treated as your personal data. Your workspace notes and account email are personal
or customer data under this policy. Keep secrets (API keys, passwords) out of workspace
notes.

### 20. Retention examples

- Active account: retained while the account remains open
- Deleted account: deleted or anonymized within a reasonable period unless law requires
  longer retention of logs
- Security logs: typically retained for a limited window for abuse investigation

### 21. How to exercise rights (step by step)

1. Email ${ORG.email} from the address on your account  
2. State the right you want to exercise (access, delete, correct, export)  
3. Include your workspace name if known  
4. We verify identity and respond within the time required by applicable law  

### 22. Accessibility of this policy

This Privacy Policy is available at ${SITE_ORIGIN}/privacy without login, in HTML that
does not require JavaScript to read. Last updated ${GUIDE_UPDATED}.
`.trim();
}

export function termsBody() {
  return `
## Terms of Service

Effective / last updated: ${GUIDE_UPDATED}.

These Terms govern use of Mira at ${SITE_ORIGIN}, operated by ${ORG.legalName}.

### 1. The service

Mira provides software tools for competitive and market intelligence. Outputs are
decision-support aids, not guarantees of market outcomes, fundraising success, or
competitive wins. Presence and market figures may be estimates; see
${SITE_ORIGIN}/methodology.

### 2. Accounts

You must provide accurate account information and keep credentials confidential. You
are responsible for activity under your account. Notify ${ORG.email} of unauthorized
use.

### 3. Acceptable use

Do not misuse Mira, attempt unauthorized access, scrape in ways that violate law or
third-party terms beyond the product’s intended research waterfall, or upload unlawful
content. Do not use outputs to harass individuals.

### 4. Intellectual property

Mira software, branding, and documentation remain our property. You retain rights to
your inputs. You grant us a license to process inputs to provide and improve the
service.

### 5. Third-party content

Competitor sites, app stores, and research sources are third-party properties. Their
terms and availability can change. Mira is not responsible for third-party accuracy.

### 6. Disclaimers

THE SERVICE IS PROVIDED “AS IS” WITHOUT WARRANTIES OF ANY KIND TO THE FULLEST EXTENT
PERMITTED BY LAW, INCLUDING MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND
NON-INFRINGEMENT.

### 7. Limitation of liability

TO THE FULLEST EXTENT PERMITTED BY LAW, ${ORG.legalName} IS NOT LIABLE FOR INDIRECT,
INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR FOR LOST PROFITS, DATA, OR
GOODWILL, ARISING FROM USE OF MIRA OR RELIANCE ON ESTIMATES.

### 8. Termination

We may suspend or terminate access for Terms violations or risk to the service. You
may stop using Mira at any time and request account deletion via ${ORG.email}.

### 9. Changes

We may update these Terms. Continued use after the updated date constitutes acceptance
of changes that are not material; material changes may require additional notice.

### 10. Contact

Questions: ${ORG.email}. Privacy: ${SITE_ORIGIN}/privacy. About: ${SITE_ORIGIN}/about.
Contact: ${SITE_ORIGIN}/contact.

### 11. Estimates and professional advice

Mira outputs may include market size estimates, competitor presence estimates, and
pricing observations. They are not legal, financial, tax, or investment advice. You
remain responsible for decisions you make using the software.

### 12. Availability

We strive for high availability but do not guarantee uninterrupted service. Planned
maintenance may occur. Research providers and third-party sites can rate-limit or
block automated fetches; Mira will surface gaps rather than invent missing prices.

### 13. Indemnity

To the extent permitted by law, you agree to indemnify ${ORG.legalName} against claims
arising from your misuse of the service or your violation of these Terms.

### 14. Governing law

These Terms are governed by the laws applicable to ${ORG.legalName}’s principal place
of business, without regard to conflict-of-law rules, except where mandatory consumer
protections apply.

### 15. Severability

If a provision is unenforceable, the remainder stays in effect.

### 16. Entire agreement

These Terms plus the Privacy Policy and any in-product plan terms form the entire
agreement regarding Mira, superseding prior conflicting terms for the same subject.

### 17. Notices

We may provide notices via email to your account address or via the website. You may
provide notices to ${ORG.email}.

### 18. Company identity for these Terms

${ORG.legalName} (brand ${ORG.name}), founded ${ORG.foundingDate} by ${AUTHOR.name}.
Site ${SITE_ORIGIN}. Updated ${GUIDE_UPDATED}.

### 19. Beta / changing features

Features may change as Mira evolves. We may add, modify, or remove functionality. If a
change materially reduces a paid entitlement you purchased (if applicable), we will
provide notice through the product or email.

### 20. Export and deletion

You may export or delete workspace content using in-product controls where available,
or by emailing ${ORG.email}. Deletion may not remove residual backups immediately.

### 21. Relationship to methodology

By using Mira you acknowledge that presence and market figures can be estimates with
evidence grades described at ${SITE_ORIGIN}/methodology. Mislabeling those estimates as
audited share in your own materials is your responsibility, not Mira’s.

### 22. Contact for legal notices

Legal notices: ${ORG.email}. Privacy: ${SITE_ORIGIN}/privacy. About: ${SITE_ORIGIN}/about.
Team: ${SITE_ORIGIN}/team. Contact page: ${SITE_ORIGIN}/contact. Updated ${GUIDE_UPDATED}.
`.trim();
}

export { FAQS, ORG, AUTHOR, SITE_ORIGIN, GUIDE_UPDATED };
