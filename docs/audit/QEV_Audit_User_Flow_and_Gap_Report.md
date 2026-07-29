# QEV Audit, User-Flow Test, and Gap Report

**Audit date:** July 29, 2026  
**Scope:** Current public QEV surfaces, current browser-vault flow supplied in the conversation, public repository and CLI documentation, the connector simulator artifact, and the proposed commercial-platform requirements.

## Executive conclusion

QEV has a functioning local encrypted-envelope core and a meaningful trust model, but the commercial connector platform is not ready for real customer testing.

The next correct step is not to place live AH Crap customer data into the current vault or simulator. It is to close the P0 foundation gaps, run synthetic and historical tests, then use AH Crap in shadow mode.

### Current readiness

| Area | Verdict |
|---|---|
| Browser one-item vault | Controlled preview; partially usable |
| Cross-platform CLI format | Real early infrastructure; public naming/version gaps |
| Site and bundle trust messaging | Technically promising; confusing and currently inconsistent |
| Commercial gateway and connectors | Not built |
| Automated business evidence flow | Not built |
| AI-builder SDK/OTLP/proxy flow | Not built |
| Multi-event Evidence Bundle V1 | Not built |
| Enterprise key lifecycle | Not built |
| Installer and update trust | Fails commercial trust expectations |
| Independent assessment | Not completed |
| AH Crap live pilot | Not ready |
| Synthetic/historical AH Crap test | Ready only after Gate B foundation is implemented |

## What was actually checked

### Public surfaces

The audit inspected:

- QEV main product page.
- Download page.
- Security and trust page.
- Site-integrity verification page.
- Public qev-desktop repository.
- qev-cli public documentation.
- GitHub Pages web tool crawlability.
- Publicly visible version, test, installer, package-name, and trust claims.

### Current connector simulator

Executed local checks:

- HTML and JavaScript loaded without initial page errors.
- No duplicate static IDs.
- No missing `alt` attributes on present images.
- No unnamed buttons.
- External links opening a new tab used `noopener`.
- No horizontal page overflow at 1440 × 900 or 390 × 844.
- Connect → work → seal-screen navigation rendered.
- Mobile form controls fit the viewport.
- Visible raw checkboxes measured about 15 × 15 CSS pixels.
- Continue remained visible at the seal stage but did not advance before a seal and did not provide a clear local message.
- Full WebCrypto sealing was not executed in the audit harness because the harness used an opaque local document context where `crypto.subtle` was unavailable. This is an audit-environment limitation, not proof of a deployed-app defect. The deployed HTTPS build still needs a full browser matrix test.

### What was not possible to prove

- Actual live IndexNow submission logs.
- Google Search Console or Bing Webmaster Tools status.
- Root robots and sitemap behavior across every hostname.
- Actual binary contents and reproducibility.
- Deployed web-vault network silence.
- Native app behavior.
- Real connector behavior, because the commercial connector runtime does not exist publicly.
- Security of any future gateway or SDK.
- Third-party audit results, because none are published.

## Highest-priority gaps

### F-001 — CRITICAL: Commercial platform

**Status:** NOT BUILT

**Finding:** The public QEV surfaces do not provide the proposed customer-controlled gateway, connector runtime, SDK onboarding, no-code flow setup, or automatic cross-system evidence capture.

**Impact:** AH Crap Cleanup or an outside company cannot yet test the commercial connector product without custom development.

**Required correction:** Build one vertical slice: installable gateway, generic signed webhook or OTLP input, event normalization, evidence bundle, storage, verifier, setup wizard, and shadow mode.

### F-002 — CRITICAL: Product identity

**Status:** FAIL

**Finding:** The public story presents QEV as a policy-aware workflow platform, a local encrypted vault, a paired-device encrypted chat product, and Proof Lock Labs infrastructure without one clear hierarchy.

**Impact:** A buyer cannot quickly tell what exists today, what the commercial product will become, and which surface is primary.

**Required correction:** Publish one product hierarchy: Envelope Core, Gateway, Connectors, Flow Packs, Verify, optional Control Plane. Mark each capability Available, Preview, Planned, or Independently Assessed.

### F-003 — CRITICAL: Release trust

**Status:** FAIL

**Finding:** The macOS and Windows downloads are not platform-signed. Users are instructed to clear macOS quarantine or click Windows Run anyway.

**Impact:** This is unacceptable friction and a serious trust barrier for a security product and enterprise pilot.

**Required correction:** Apple Developer signing and notarization, Windows Authenticode signing, signed update metadata, release provenance, SBOM, and downloadable checksum/signature bundle.

### F-004 — CRITICAL: Independent assurance

**Status:** FAIL

**Finding:** QEV publicly states that no formal third-party security audit has been conducted.

**Impact:** QEV cannot honestly issue a broad QEV Protected or Independently Assessed badge.

**Required correction:** Complete independent cryptographic design review, application penetration test, connector/runtime review, remediation verification, and publish a scoped summary.

### F-005 — CRITICAL: Key lifecycle

**Status:** NOT BUILT

**Finding:** The public platform has no KMS/HSM integration, automated key rotation, or revocation.

**Impact:** Commercial users cannot centrally control, rotate, suspend, recover, or audit package access.

**Required correction:** Implement multi-slot envelope keys, KMS and recipient slots, rewrap, key-version tracking, recovery trustees, revocation boundaries, and key-use audit.

### F-006 — CRITICAL: Evidence package

**Status:** NOT BUILT

**Finding:** The current Vault V2 flow is a small, one-item envelope rather than a multi-event, large-artifact commercial evidence bundle.

**Impact:** It cannot directly support job photos, legal document histories, long AI traces, or multi-system workflow evidence.

**Required correction:** Add QEV Evidence Bundle V1 with events, artifacts, streaming encryption, signatures, key slots, gaps, retention, and independent verification.

### F-007 — HIGH: Trust verification UX

**Status:** FAIL / MANUAL CONFIRMATION REQUIRED

**Finding:** The crawlable Site Integrity page displays 'Could not load the integrity record. The file may not have been generated yet.'

**Impact:** A trust page that visibly exposes a failure state undermines the core claim. JavaScript execution may change the browser result, so this must be tested manually in multiple browsers.

**Required correction:** Server-render the current signed record or make the failure actionable; add CI that blocks deployment if the integrity record, public key, manifest, or listed hashes cannot be fetched and verified.

### F-008 — HIGH: Release provenance

**Status:** FAIL

**Finding:** The public repository shows no GitHub Releases while the product site distributes binaries directly.

**Impact:** Reviewers lack a conventional, versioned, signed release record tying source, build, binary, checksums, and notes together.

**Required correction:** Publish versioned releases with signed artifacts, provenance, checksums, SBOM, changelog, and reproducible or attestable build information.

### F-009 — HIGH: Claims consistency

**Status:** FAIL

**Finding:** Public pages report inconsistent test counts: 258 on the main/security pages, 362 on the download page, and 26 tests in the CLI development section.

**Impact:** Reviewers cannot determine what was tested, against which version, on which platform.

**Required correction:** Publish one generated test matrix broken down by component, commit, version, operating system, and last run. Never hand-edit counts.

### F-010 — HIGH: Package naming

**Status:** FAIL

**Finding:** The repository root/download page uses @bryan237l/qev-cli while the qev-cli README uses @imagineqira/qev-cli.

**Impact:** Developers may install the wrong or unavailable package and lose trust in maintenance.

**Required correction:** Choose one official package name, deprecate the other with a clear migration path, and generate every public install command from one source.

### F-011 — HIGH: Version clarity

**Status:** PARTIAL

**Finding:** The site and apps are described as v0.29.0 while CLI examples and decrypted Vault V2 metadata show v0.28.1.

**Impact:** Cross-version compatibility may be legitimate, but the user is not shown a compatibility explanation or migration status.

**Required correction:** Publish a compatibility table and display producer version separately from current reader version.

### F-012 — HIGH: Browser vault UX

**Status:** FAIL

**Finding:** The basic lock flow exposes eight numbered sections, including an auto-picked secret number, scramble code, recipe, and box style.

**Impact:** The interface contradicts the 'zero learning curve' promise and makes standard cryptography look custom or harder than it is.

**Required correction:** Basic mode should have content, access method, strength recommendation, and Lock. Move non-actionable metadata into an Advanced details panel after creation.

### F-013 — HIGH: Browser vault UX

**Status:** FAIL

**Finding:** The meaning and security role of 'secret number' and 'scramble code' are unclear in the ordinary user flow.

**Impact:** Users may think they must save additional secrets, misunderstand the threat model, or suspect custom cryptography.

**Required correction:** Remove these fields from basic mode unless they are required. If retained, rename them with precise cryptographic meaning and make them non-editable technical metadata.

### F-014 — HIGH: Review UX

**Status:** FAIL

**Finding:** A structured agent receipt decrypts into raw JSON rather than an understandable receipt view.

**Impact:** Business users cannot quickly understand what occurred, what is verified, what is merely claimed, or what is missing.

**Required correction:** Render known schemas into human-readable timeline, source, artifact, decision, and trust panels, with raw JSON as an advanced view.

### F-015 — HIGH: Recovery UX

**Status:** FAIL BY DESIGN FOR CURRENT VAULT / BLOCKER FOR COMMERCIAL PRODUCT

**Finding:** The current vault states there is no reset, recovery, or recovery key slot.

**Impact:** This is acceptable for a deliberately irreversible one-off vault but not sufficient for company evidence retention.

**Required correction:** Keep irreversible personal mode, but add organization KMS, recipient key, device, and recovery-trustee slots for commercial packages.

### F-016 — HIGH: Marketing accuracy

**Status:** FAIL

**Finding:** The download page says 'No servers' while also describing encrypted chat with relay delivery.

**Impact:** The wording can be interpreted as contradictory even if the relay cannot read message content.

**Required correction:** State exactly which operations are offline and which use a relay. Use 'no plaintext server' only where technically true.

### F-017 — HIGH: Marketing accuracy

**Status:** FAIL

**Finding:** The download page says 'The app itself is safe' despite unsigned installers and no formal third-party audit.

**Impact:** An absolute safety claim is not supportable and weakens the otherwise honest threat model.

**Required correction:** Replace with bounded claims: source available, internal tests passed, artifact hash provided, not independently audited.

### F-018 — HIGH: Authentication semantics

**Status:** PARTIAL

**Finding:** Current bundle verification uses HMAC terminology described as a signature, while public site integrity uses Ed25519.

**Impact:** HMAC can authenticate to parties sharing the secret but does not provide public attribution. Buyers may misunderstand what 'signed' proves.

**Required correction:** Call current HMAC output authenticated unless a precise shared-key signature definition is shown. Use Ed25519 or customer KMS signing for independently verifiable commercial packages.

### F-019 — HIGH: Connector reliability

**Status:** NOT BUILT

**Finding:** There is no implemented durable queue, idempotency, duplicate suppression, replay protection, out-of-order handling, backfill, dead-letter queue, or connector self-healing.

**Impact:** Automatic evidence capture would silently lose or duplicate evidence under ordinary provider behavior.

**Required correction:** Make these P0 gateway requirements and test them through failure injection before live jobs.

### F-020 — HIGH: Identity and approval

**Status:** NOT BUILT

**Finding:** There is no implemented company SSO, role mapping, passkey approval, approval-to-artifact binding, or commit-time authorization recheck.

**Impact:** A name in a payload cannot establish who approved the action.

**Required correction:** Add OIDC/SSO, stable subject IDs, WebAuthn or source-signed approvals, exact action/artifact hash binding, expiry, and authorization revalidation.

### F-021 — HIGH: Pilot safety

**Status:** NOT BUILT

**Finding:** There is no implemented shadow mode that records and compares without controlling business operations.

**Impact:** Testing could interfere with AH Crap Cleanup or a customer before capture reliability is known.

**Required correction:** Add synthetic, historical, shadow, limited-live, automation, then gate-mode stages.

### F-022 — HIGH: Accessibility

**Status:** NOT VERIFIED

**Finding:** No WCAG 2.2 AA audit, screen-reader test, keyboard test, zoom test, or mobile assistive-technology evidence is published.

**Impact:** A security workflow may be unusable to customers or reviewers with disabilities.

**Required correction:** Run automated and human WCAG 2.2 AA testing on public pages, gateway admin, customer portal, verifier, desktop, and mobile apps.

### F-023 — MEDIUM: Connector simulator

**Status:** PASS WITH GAPS

**Finding:** The current connector simulator loads without initial JavaScript errors in a local render, has no duplicate static IDs, no horizontal overflow at 1440px or 390px, and has named buttons and external-link protection.

**Impact:** The explainer is structurally usable, but this does not validate the future gateway.

**Required correction:** Keep it as an explainer; do not use simulator results as evidence that production connectors work.

### F-024 — MEDIUM: Connector simulator

**Status:** FAIL

**Finding:** At the seal stage, the Continue control remains visible but does not advance before sealing and did not show a clear message during the local interaction test.

**Impact:** Users can click a control that appears available and receive no useful response.

**Required correction:** Disable Continue until sealing succeeds or replace it with one primary Freeze and continue action plus an inline explanation.

### F-025 — MEDIUM: Connector simulator accessibility

**Status:** PARTIAL

**Finding:** Visible checkboxes measured about 15 by 15 CSS pixels in the local mobile and desktop render.

**Impact:** The hit target may be difficult on touch or for users with motor impairments unless the entire label/card is clickable.

**Required correction:** Ensure the effective hit area is at least 24 by 24 CSS pixels and preferably 44 by 44 for primary mobile controls; test label activation.

### F-026 — MEDIUM: Password UX

**Status:** PARTIAL

**Finding:** The CLI describes a generated four-word phrase as roughly 37 bits of entropy.

**Impact:** For a stolen vault subject to offline guessing, that may be inadequate for higher-value or long-retained evidence.

**Required correction:** Offer risk-based generated phrases, default to substantially stronger random secrets for commercial records, support password managers, and show an offline-attack warning rather than a generic strength label.

### F-027 — MEDIUM: SEO

**Status:** NOT VERIFIED

**Finding:** The audit could not publicly verify working robots files, complete sitemaps, Search Console coverage, IndexNow keys/submission logs, or canonical rules across all QEV hostnames.

**Impact:** Search discoverability and duplicate handling cannot be called maximized.

**Required correction:** Add deployment-time SEO validation, sitemap generation, canonical tests, IndexNow logging, and Search Console/Bing reporting.

### F-028 — MEDIUM: Support and operations

**Status:** NOT BUILT

**Finding:** Public support is primarily an email contact; there is no published status page, incident process, support bundle, support SLA, or recovery runbook.

**Impact:** A customer has no operational path when connectors, packages, keys, or updates fail.

**Required correction:** Create status, incident, support-bundle, escalation, recovery, and customer-communication processes before external pilots.


# User-journey audit

## Journey 1 — Visitor discovers QEV

### Intended experience

A visitor should understand:

1. QEV's current core is an encrypted evidence-envelope system.
2. The commercial gateway and connectors are the next layer.
3. The simulator explains that planned layer.
4. The product does not capture data from disconnected systems.
5. QEV verifies integrity and provenance properties, not factual truth.

### Current result

The public pages distribute attention across the policy platform, vault, encrypted chat, device pairing, Qira Link, decryption challenge, demo, technical review, and buyer review. This demonstrates substantial work but makes the primary commercial direction harder to understand.

### Acceptance test

Five people who have never seen QEV receive the homepage for 30 seconds. At least four must independently state:

> QEV gathers selected evidence from connected systems, encrypts and freezes a portable record, and later shows what was captured, what is missing, and what verifies.

They must also correctly identify which connector functions exist today.

---

## Journey 2 — Ordinary user locks one item

### Current strengths

- Clear separation between encrypt and decrypt.
- Phrase-based access is understandable.
- Honest endpoint and forgotten-phrase limitations are disclosed.
- The existing core uses a portable file and does not require an account.

### Current UX gaps

- Eight numbered sections are too many for a basic one-item action.
- Secret number and scramble code are unclear.
- Recipe and format should be informational, not decision points.
- Commercial records need recovery and organization access paths.
- A structured agent receipt should not open as raw JSON by default.

### Required basic flow

```text
Add content
→ Choose personal or organization access
→ Use recommended protection
→ Lock
→ Save or share
```

Advanced cryptographic metadata appears after creation.

---

## Journey 3 — Small business installs QEV

### Current result

The public download flow requires users to bypass macOS Gatekeeper or Windows SmartScreen because the applications are unsigned. That is a commercial blocker for a security product.

### Required flow

```text
Download signed installer
→ Verify publisher automatically
→ Install
→ QEV runs preflight
→ Choose flow
→ Connect systems
→ Run synthetic test
→ Review captured evidence
→ Start shadow mode
```

No terminal, quarantine clearing, or Run anyway step.

---

## Journey 4 — Company connects a system

This journey is not built.

Required screens:

1. Choose provider.
2. Explain exact permissions.
3. Authorize.
4. Select account/tenant.
5. Run safe read.
6. Select history window.
7. Preview captured fields.
8. Choose privacy modes.
9. Confirm case-matching rule.
10. Start shadow mode.
11. Show health and last successful event.

Every error must explain the lost evidence period and next action.

---

## Journey 5 — AH Crap Cleanup job

The correct pilot flow is:

```text
Create job
→ Assign QEV job ID
→ Create portal and evidence folder
→ Bind estimate and approval
→ Capture before photos
→ Record and approve scope changes
→ Capture after photos and receipts
→ Bind invoice and payment status
→ Obtain completion acknowledgement
→ Check required evidence
→ Seal internal package
→ Produce customer-safe package
```

The pilot may begin only after synthetic and historical tests pass. Live operation starts in record-only shadow mode.

---

## Journey 6 — Small AI builder

Required low-friction paths:

- Change OTLP endpoint.
- Install one JavaScript or Python adapter.
- Route through a local compatible proxy.
- Use a tiny SDK for custom events.

The setup must preview exactly what prompts, outputs, retrieval data, and tool arguments will be stored. Hidden chain-of-thought must be marked unavailable.

---

## Journey 7 — Reviewer opens evidence

The default review experience should show:

```text
Integrity
Signer
Source authenticity
Identity strength
Artifact matches
Time strength
Evidence coverage
Known gaps
Policy decisions
Unsupported conclusions
```

Raw JSON is an advanced view.

A single green Verified result is prohibited.

---

## Journey 8 — Failure and recovery

The product must survive:

- duplicate events;
- out-of-order events;
- expired tokens;
- provider outage;
- restart;
- disk full;
- unavailable KMS;
- partial file write;
- failed update;
- backup restore;
- late evidence;
- revoked recipient;
- uncertain case match.

No evidence may disappear silently.

---

## Journey 9 — Offboarding

A customer cancelling Qira service must retain:

- encrypted packages;
- schemas;
- public verification software;
- its own keys or KMS references;
- export of configuration and audit history;
- instructions for long-term verification.

Billing must not become a lock on evidence the customer already owns.

# Test inventory

The package includes **136 defined tests** covering:

- product comprehension;
- vault lock/open behavior;
- installation;
- connector onboarding and lifecycle;
- event correlation;
- durable workflows;
- evidence completeness;
- privacy;
- large artifacts;
- package sealing;
- identity and key management;
- AH Crap field service;
- small AI builders;
- accessibility;
- support;
- trust badge;
- SEO.

These are not all marked passed. Most commercial-platform cases are intentionally marked **Not built** or **Not verified**.

# Release decision

## Do not yet

- Use live AH Crap customer data as the first platform test.
- Market QEV as an automatic connector platform.
- Issue a QEV Protected company badge.
- Claim independent audit.
- Claim SEO or IndexNow is maximized.
- Describe unsigned binaries as safe.
- Describe HMAC-authenticated bundles as publicly attributable signatures without qualification.

## Build next

1. Correct public identity, claims, version, package name, and test reporting.
2. Fix release signing and site-integrity delivery.
3. Build the P0 gateway vertical slice.
4. Build Field Service synthetic flow.
5. Run the complete test inventory through synthetic failure injection.
6. Import redacted historical AH Crap jobs.
7. Run shadow mode.
8. Complete independent security review.
9. Begin a limited live pilot.
10. Add gate mode and trust badge only after evidence supports them.

# Audit limitation

This audit is broad, not mathematically exhaustive. Each provider connector will add provider-specific permissions, webhook, API-version, rate-limit, regional, and retention tests. Each operating system and browser also needs a maintained compatibility matrix.

The correct control is a living test registry tied to releases—not a one-time document claiming that every future condition has been anticipated.
