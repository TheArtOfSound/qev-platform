# QEV Trust Badge, Audit, Certification, and SEO/GEO Maximization Plan

**Date:** July 29, 2026  
**Status:** Product and marketing requirements. This plan does not claim that QEV or any customer is currently independently certified.

---

# 1. Decision

QEV should create a trust program, but the public badge must never be the evidence itself.

The correct model is:

```text
Visible badge
    ↓
Public verification page
    ↓
Signed machine-readable certificate
    ↓
Exact assessment scope, evidence, expiration, and revocation status
```

Do not issue a broad badge saying an entire company is “secure” or “QEV protected.”

Issue a scoped statement such as:

> QEV Protected Workflow — Estimate Approval through Job Completion

or:

> QEV Verified AI Evidence Flow — Customer Support Agent, Production Environment

---

# 2. Trust-mark levels

## Level 1 — QEV Compatible

Meaning:

- the application, connector, or package can exchange a supported QEV format;
- required interoperability tests passed;
- no claim about the organization’s overall security.

Requirements:

- format compatibility;
- canonical test vectors;
- successful lock, open, verify, tamper-failure, and migration tests;
- exact product and QEV versions;
- expiration when a major incompatible version appears.

Badge text:

> QEV Compatible

Do not use the word protected at this level.

---

## Level 2 — QEV Verified Configuration

Meaning:

- a defined workflow was configured according to a published QEV baseline;
- automatic configuration and operational checks passed at a specific time;
- this is not an independent security audit.

Requirements:

- approved QEV version;
- supported connector versions;
- encryption enabled;
- package signatures enabled;
- backups configured and recovery tested;
- credential storage protected;
- evidence requirements defined;
- missing evidence visible;
- connector health active;
- privacy mapping reviewed;
- authorized recipients reviewed;
- no critical configuration failures.

Badge text:

> QEV Verified Workflow

---

## Level 3 — QEV Protected Workflow

Meaning:

- a specific live workflow passed the QEV baseline;
- continuous health and control checks remain active;
- the certificate expires or suspends automatically when required controls fail.

Requirements:

- all Level 2 controls;
- live connector monitoring;
- signed package checkpoints;
- tested package restore;
- tested tamper detection;
- key lifecycle policy;
- update status;
- access review;
- incident contact;
- current evidence capture health;
- no unresolved critical failure;
- defined workflow scope.

Badge text:

> QEV Protected Workflow

Required scope text underneath:

> Scope: Field-service estimate, approval, photos, change orders, invoice, and completion.

The badge must never imply that unrelated company systems are protected.

---

## Level 4 — QEV Independently Assessed

Meaning:

- an independent qualified security firm assessed the defined QEV deployment or QEV product scope;
- the public certificate identifies the assessor and report date;
- only the exact assessed version and scope are covered.

Requirements:

- independent application penetration test;
- cryptographic design review;
- connector and credential review;
- architecture and threat-model review;
- package-format and verifier review;
- build and update-chain review;
- remediation verification;
- public summary report or buyer-accessible report.

Badge text:

> QEV Independently Assessed

Do not use “audited” unless the engagement and resulting report legitimately qualify as an audit.

---

## Level 5 — Organization assurance

This is for Qira itself, not a QEV customer badge.

Potential programs:

- SOC 2 Type I;
- SOC 2 Type II after an operating period;
- ISO/IEC 27001 certification;
- recurring penetration testing;
- vulnerability disclosure program;
- supply-chain and release attestations.

These programs assess Qira’s security management or controls. They do not prove that every customer deployment is correctly configured.

---

# 3. Public certificate requirements

Every badge must link to a verification URL such as:

```text
https://secure.imagineqira.com/trust/certificates/QEV-2026-000184
```

The page should show:

- certificate ID;
- legal organization name;
- verified domain;
- badge level;
- exact scope;
- QEV version;
- gateway version;
- connector names and versions;
- flow-pack name and version;
- issue date;
- expiration date;
- last continuous check;
- assessment method;
- assessor;
- controls tested;
- controls not tested;
- known exceptions;
- status;
- revocation reason when applicable;
- public-key fingerprint;
- signed-certificate download;
- verification instructions.

Statuses:

- active;
- expiring;
- suspended;
- revoked;
- expired;
- superseded.

A missing, expired, suspended, or revoked certificate must never show as active through a cached badge.

---

# 4. Signed certificate object

Example:

```json
{
  "schema": "qev.trust-certificate.v1",
  "certificate_id": "QEV-2026-000184",
  "subject": {
    "legal_name": "Example Company LLC",
    "domain": "example.com"
  },
  "level": "qev_protected_workflow",
  "scope": {
    "workspace": "Field Operations",
    "environment": "production",
    "flow_id": "field-service-job-evidence",
    "flow_version": "1.0.0",
    "included_systems": [
      "QEV Customer Portal",
      "Google Drive Connector",
      "Square Connector"
    ],
    "excluded_systems": [
      "Payroll",
      "General corporate email"
    ]
  },
  "controls": {
    "package_encryption": "pass",
    "package_signature": "pass",
    "backup_restore_test": "pass",
    "connector_health": "pass",
    "missing_evidence_visibility": "pass",
    "key_rotation_policy": "pass"
  },
  "issued_at": "2026-07-29T21:30:00Z",
  "expires_at": "2026-10-29T21:30:00Z",
  "status": "active",
  "assessor": {
    "type": "qev_automated_and_manual",
    "name": "Qira LLC"
  },
  "certificate_sha256": "...",
  "signature": {
    "algorithm": "Ed25519",
    "key_id": "qev-trust-root-2026-01",
    "value": "..."
  }
}
```

The certificate must use canonical serialization before hashing and signing.

---

# 5. Badge anti-abuse controls

Required:

- badge trademark and usage agreement;
- no local static badge without live status;
- badge script or image includes certificate ID;
- click-through verification;
- short expiration;
- automatic suspension on critical control failure;
- domain binding;
- referrer and unauthorized-use detection;
- public revocation list;
- signed certificate;
- archive of previous certificates;
- appeal and correction process;
- prohibition against changing the badge wording;
- enforcement process for false use.

The badge image alone has no evidentiary value.

---

# 6. Assessment separation

QEV needs three separate assessments.

## Product assessment

Covers QEV itself:

- cryptography;
- vault and bundle formats;
- gateway;
- verifier;
- connector runtime;
- SDK;
- update chain;
- key management;
- multi-tenancy;
- operational security.

## Connector assessment

Covers one integration:

- authorization;
- scopes;
- token storage;
- webhooks;
- replay;
- duplicates;
- backfill;
- privacy mapping;
- error behavior;
- provider-version compatibility.

## Deployment assessment

Covers one customer’s use:

- actual flow;
- actual systems;
- keys;
- storage;
- access;
- backups;
- retention;
- exceptions;
- health;
- incident ownership.

A product audit does not prove a customer deployment is safe. A customer deployment check does not replace a product audit.

---

# 7. Current QEV trust-mark eligibility

Based on the currently public QEV description, QEV is a controlled-use preview and publicly states:

- local trust model;
- no KMS/HSM integration;
- no key rotation or revocation;
- no formal third-party security audit.

Therefore:

- QEV can create a **QEV Compatible** test program after compatibility criteria are frozen.
- QEV can issue an internal **Pilot Configuration Passed** result for controlled pilots.
- QEV should not yet issue a broad **QEV Protected** or **Independently Audited** badge.

The stronger badge should follow the gateway P0 build, external assessment, remediation, and a real deployment-assessment process.

---

# 8. SEO status decision

Do not claim that QEV SEO is maximized.

What can currently be established publicly:

- the primary QEV homepage is discoverable in search;
- the public product page has substantial crawlable text;
- QEV has a public GitHub repository and GitHub Pages tool.

What is not yet proven from public evidence:

- a valid root `robots.txt` for every relevant hostname;
- a complete current sitemap;
- a sitemap submitted and clean in Google Search Console;
- an active IndexNow key and deployment hook;
- successful IndexNow submission logs;
- correct canonical tags across duplicate GitHub Pages and custom-domain pages;
- complete structured data;
- index coverage for every target page;
- Core Web Vitals and rendered-content status;
- no accidental `noindex`, soft 404, or duplicate-page problems.

SEO is an ongoing measured process, not a one-time “maximum” switch.

---

# 9. Domain and URL architecture

Use one primary commercial domain:

```text
https://secure.imagineqira.com/
```

Recommended crawlable pages:

```text
/
 /platform/
 /connectors/
 /sdk/
 /ai-agent-evidence/
 /legal-evidence/
 /field-service-evidence/
 /devops-change-evidence/
 /vendor-handoff/
 /confidential-investigations/
 /security/
 /trust/
 /trust/certificates/
 /audit/
 /threat-model/
 /docs/
 /docs/vault-format/
 /docs/evidence-bundle/
 /docs/gateway/
 /docs/sdk/javascript/
 /docs/sdk/python/
 /pricing/
 /about/
 /contact/
 /changelog/
```

Application routes:

```text
/app/
 /dashboard/
 /admin/
 /case/
 /package/
 /session/
```

should generally be authenticated and excluded from indexing.

Public documentation should use real path URLs, not hash routes.

The existing form:

```text
https://theartofsound.github.io/qev-desktop/#/tool
```

should remain functional for the application, but crawlable product documentation should be available through real URLs such as:

```text
https://secure.imagineqira.com/tools/envelope/
https://secure.imagineqira.com/docs/browser-tool/
```

---

# 10. Canonical-domain rules

For every duplicate page:

- choose one canonical URL;
- add a server-rendered `rel="canonical"`;
- use 301 redirects where possible;
- ensure sitemap contains only canonical URLs;
- keep internal links pointed at the canonical URL;
- do not canonicalize to a URL fragment;
- avoid publishing the same marketing text across GitHub Pages and the main domain.

GitHub repositories should remain indexable as source-code entities, but the main domain should own the commercial and use-case search intent.

---

# 11. Robots requirements

Each hostname requires a root-level crawler policy.

Example for the primary site:

```text
User-agent: *
Allow: /

Disallow: /app/
Disallow: /dashboard/
Disallow: /admin/
Disallow: /session/
Disallow: /case/
Disallow: /package/
Disallow: /api/
Disallow: /internal/
Disallow: /preview/

Sitemap: https://secure.imagineqira.com/sitemap-index.xml
```

Important:

- `robots.txt` controls crawling, not authentication.
- Never expose secret paths in `robots.txt` as a security mechanism.
- Use login and authorization for private content.
- Use `noindex` or `X-Robots-Tag: noindex` when a publicly fetchable resource must not appear in search.
- Do not block a page in `robots.txt` if a crawler must read its `noindex` instruction.
- Test Googlebot, Bingbot, image crawlers, and ordinary browsers.

Do not add dozens of crawler-specific blocks without a clear policy.

---

# 12. Sitemap architecture

Use:

```text
/sitemap-index.xml
    /sitemap-pages.xml
    /sitemap-docs.xml
    /sitemap-trust.xml
    /sitemap-images.xml
```

Requirements:

- canonical HTTPS URLs only;
- successful 200 response;
- valid XML;
- no redirects;
- no `noindex` pages;
- no authenticated pages;
- accurate `lastmod`;
- remove deleted URLs;
- keep each sitemap under protocol limits;
- regenerate on deployment;
- validate in CI;
- submit in Google Search Console and Bing Webmaster Tools.

The certificate sitemap should include only public certificates, not confidential deployment details.

---

# 13. IndexNow automation

IndexNow should run automatically on deployment.

Required:

1. Generate a dedicated IndexNow key.
2. Publish the key file at the primary hostname root.
3. Keep the key out of source-code comments and analytics.
4. Detect changed, added, redirected, and deleted canonical URLs.
5. Submit only changed URLs.
6. Use the global IndexNow endpoint or one participating endpoint.
7. Record response codes.
8. Retry temporary failures.
9. Alert on repeated 403, 422, or 429 responses.
10. Rotate the key with a controlled process.
11. Display submission history in an SEO operations report.

IndexNow receipt means the URL was received. It does not guarantee crawling, indexing, or ranking.

IndexNow applies to participating engines. Google must still be managed through Google Search Console, sitemaps, crawlable pages, and normal SEO practices.

---

# 14. Deployment hook

On each production release:

```text
Build pages
    ↓
Validate HTML
    ↓
Validate canonical tags
    ↓
Validate robots rules
    ↓
Generate sitemaps
    ↓
Check for noindex conflicts
    ↓
Run broken-link crawl
    ↓
Deploy
    ↓
Verify HTTP status and rendered content
    ↓
Submit changed URLs to IndexNow
    ↓
Update sitemap in search consoles
    ↓
Store deployment SEO report
```

A failed SEO validation should block production when it would:

- block the whole public site;
- remove canonical tags;
- publish staging URLs;
- create broken structured data;
- return 200 on error pages;
- place private routes in the sitemap.

---

# 15. Structured data

Use valid JSON-LD that matches visible page content.

Recommended types:

## Homepage

- `Organization`;
- `WebSite`;
- `SoftwareApplication`.

## Product pages

- `SoftwareApplication`;
- `Product` only when real commercial offers exist and required properties are accurate;
- `BreadcrumbList`.

## Documentation

- `TechArticle`;
- `BreadcrumbList`.

## Security and audit pages

- `WebPage`;
- `Organization`;
- `BreadcrumbList`.

## Public certificate pages

Use a conservative `WebPage` or `DigitalDocument` representation.

Do not invent a schema type implying an official security certification if none exists.

Validate markup using Google Rich Results Test and Schema.org Validator.

---

# 16. Page-level SEO requirements

Every indexable page needs:

- one clear search purpose;
- unique title;
- unique meta description;
- one primary H1;
- direct answer near the beginning;
- crawlable internal links;
- canonical URL;
- Open Graph and social metadata;
- descriptive image alt text;
- organization and product identity;
- last-updated date where appropriate;
- visible author or responsible organization;
- technical sources for security claims;
- no unsupported superlatives.

Avoid:

- keyword stuffing;
- hundreds of near-identical city or industry pages;
- copy-pasted AI text;
- hidden text;
- unsupported “unhackable” claims;
- fake review counts;
- fake customer logos;
- fake audit badges.

---

# 17. Search-intent content plan

QEV needs pages written for actual buyer and developer questions.

## Commercial intent

- encrypted evidence platform;
- tamper-evident workflow records;
- private audit trail software;
- portable encrypted evidence;
- evidence connector for business software;
- encrypted chain-of-custody platform.

## AI intent

- AI agent audit trail;
- AI tool-call evidence;
- encrypted AI execution records;
- OpenTelemetry AI evidence;
- AI agent approval gateway;
- private AI trace archive.

## Legal intent

- encrypted legal evidence package;
- document-version chain of custody;
- confidential matter evidence;
- e-signature evidence history;
- legal agreement version verification.

## Field service intent

- estimate approval evidence;
- before-and-after job record;
- contractor change-order proof;
- encrypted customer job record;
- service dispute documentation.

## Developer intent

- encrypted evidence SDK;
- evidence webhook gateway;
- signed event bundle;
- portable verification SDK;
- local-first evidence API.

Each page must describe an actual or clearly marked planned capability.

---

# 18. Authority and trust content

Create and maintain:

- security overview;
- threat model;
- cryptographic design;
- trust-semantics specification;
- external audit summary when completed;
- remediation log;
- vulnerability disclosure policy;
- security contact;
- signed release verification;
- software bill of materials;
- uptime/status page for hosted services;
- changelog;
- roadmap;
- package-format specification;
- compatibility matrix;
- case studies;
- pilot results with honest metrics.

High-quality original security and technical documentation is more valuable than mass-produced SEO pages.

---

# 19. AI and answer-engine discoverability

Add:

- clean server-rendered HTML;
- clear definitions;
- stable documentation URLs;
- OpenAPI specifications;
- JSON Schema;
- example code;
- machine-readable changelog;
- GitHub releases;
- package registry metadata;
- citation-quality technical pages;
- an optional `/llms.txt` index pointing to authoritative documentation.

`llms.txt` may improve usability for some tools, but it must not be marketed as a guaranteed ranking mechanism or universal standard.

---

# 20. Performance and accessibility

Track:

- Largest Contentful Paint;
- Interaction to Next Paint;
- Cumulative Layout Shift;
- mobile rendering;
- JavaScript errors;
- broken resources;
- accessibility failures;
- keyboard navigation;
- screen-reader labels;
- color contrast;
- image sizes;
- caching;
- compression;
- font loading.

Pre-render important public content. Do not require search crawlers to execute a large application merely to see the product explanation.

---

# 21. Search measurement

Required accounts:

- Google Search Console;
- Bing Webmaster Tools;
- privacy-respecting analytics;
- uptime monitoring;
- performance monitoring.

Weekly report:

- indexed URLs;
- excluded URLs;
- crawl failures;
- sitemap status;
- IndexNow accepted/rejected submissions;
- branded queries;
- nonbranded queries;
- impressions;
- clicks;
- click-through rate;
- average position;
- landing-page conversion;
- broken links;
- structured-data errors;
- Core Web Vitals;
- referring domains;
- duplicate canonical issues.

Do not judge SEO only by searching QEV manually.

---

# 22. Immediate priorities

## Trust program

1. Freeze badge names and scope language.
2. Do not release “QEV Protected” yet.
3. Create QEV Compatible test suite.
4. Create signed certificate schema.
5. Create public certificate-verification page.
6. Define suspension and revocation rules.
7. Complete third-party product security assessment.
8. Pilot deployment assessments.
9. Release the scoped QEV Protected Workflow mark.

## SEO

1. Audit the actual root `robots.txt`.
2. Audit the actual sitemap responses.
3. Verify Google Search Console ownership.
4. Verify Bing Webmaster Tools ownership.
5. confirm or implement IndexNow key and deployment submission.
6. Replace index-dependent hash routes with real public URLs.
7. establish canonical rules between the main site and GitHub Pages.
8. Add Organization, SoftwareApplication, and Breadcrumb JSON-LD.
9. Create dedicated use-case, connector, SDK, security, and trust pages.
10. Run a full crawl after every production deployment.
11. Publish audit and trust content only when factual.
12. Measure indexing and conversion continuously.

---

# 23. Final rule

Use this language:

> QEV Protected Workflow means that the specific workflow and systems named in the linked certificate met the stated QEV controls during the certificate period. It is not a guarantee against every attack and does not certify unrelated company systems.

Never use:

> QEV-secured company

unless the exact scope is immediately clear.

The badge should strengthen trust because it is narrow, verifiable, revocable, and honest—not because the graphic looks official.
