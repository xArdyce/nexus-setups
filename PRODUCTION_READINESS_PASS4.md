# Nexus Setups — Production Readiness Pass 4

Date: 2026-10-02. Canonical production origin: `https://www.setups.nexus`.

Completed against the current working tree, preserving Passes 1–3 and user changes. This is a code and local-browser release audit, not certification of the live deployment. No production database, deployment, migration, DNS, R2 configuration, SMTP behavior, commit, or push was changed.

## A. Production leftovers

**Confirmed defects:** stale production-origin examples, scaffold browser branding, broken Brand Guide destination, placeholder social links, and a public enquiry form reporting success without transmitting its contents. Fixed as described in J.

The reachable application contains no obsolete SCHEDULED/PUBLISHED or automated publishing/scheduling workflow claims. Task TODO is a legitimate workflow state. Sanitized server diagnostics and operator-script output remain intact. Localhost remains appropriate for local development examples.

**Optional improvements, not applied:** remove unreachable future analytics/OAuth markup and unused scaffold public SVG files. `dashboard-current.txt` contains historical terminology but is not imported or served; its existing edits were preserved. Historical audit reports retain their original findings and origins, with the README identifying this report as the latest release audit. The homepage's performance-reporting service claim requires business-owner confirmation; no new analytics integration was added.

## B. Metadata/browser presentation

**Confirmed defects fixed:** replaced scaffold title/description and Vercel favicon with Nexus Setups metadata and a simple existing N brand mark. Dashboard title is branded and its metadata discourages indexing. Default Next viewport retains device-width scaling and user zoom. No social image or unsupported Open Graph asset was invented.

**Requires live verification:** actual browser tab/icon cache, social previews, and crawler behavior after deployment. Robots metadata is not access control.

## C. Error/fallback handling

**Hardening improvement:** added branded not-found, route error, and root error experiences. Generic messages expose no exception, stack, digest, or database details; retry and home controls are semantic and visibly focusable. Root errors supply their own document markup as required by [Next.js error handling](https://nextjs.org/docs/app/getting-started/error-handling).

Local production server returned the custom 404 with HTTP 404. Its mobile presentation was visually inspected. Existing API, loading, empty, forbidden, and session-failure handling was reviewed without changing backend contracts. Profile/email and password success messages now explicitly tell users to sign in again, matching existing session revocation.

**Requires live verification:** controlled route/root exceptions, actual session expiry, and end-to-end API failure states. Unexpected-error boundaries compiled successfully but were not triggered through deliberately injected application failures.

## D. Domain/origin audit

**Confirmed defect fixed:** production examples and smoke-test default now use `https://www.setups.nexus`. Authentication/reset behavior continues to derive its origin from configuration. No DNS or external apex redirect was altered.

**Requires live verification:** set production `AUTH_URL` to the canonical HTTPS origin; use an explicit HTTPS Preview origin where appropriate. Verify provider/callback/reset URLs, secure cookies, apex-to-www redirect, and absence of old Vercel origins in deployed configuration.

## E. Security headers

**Hardening improvement:** configured `nosniff`, `no-referrer`, disabled camera/microphone/geolocation, DENY framing, `frame-ancestors 'none'`, production HSTS (`max-age=31536000`), and disabled the powered-by header. Exact header values were observed on the local production response.

CSP is deliberately limited to framing; it does not restrict scripts, styles, connections, images, or presigned storage traffic. [MDN documents frame-ancestors separately](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy/frame-ancestors). **Optional improvement:** a fuller CSP after report-only and authenticated browser testing. **Requires live verification:** HTTPS/CDN header behavior and all required integrations; [HSTS is honored over HTTPS](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Strict-Transport-Security), so local HTTP observation does not verify enforcement. No includeSubDomains or preload policy was added.

## F. Client/server secret boundary

No confirmed credential exposure was found in the inspected source and generated browser chunks. Inspected database, authentication, R2, SMTP, and initial-admin credential variable names had zero matches in client JavaScript. Private-key/access-key pattern searches reported no matches; actual secret values were neither inspected nor printed. This is a current-tree/build check, not an exhaustive Git-history secret audit.

Opaque asset storage identifiers remain part of intentional metadata/API behavior; they are not credentials. Downloads continue through authorized presigned URLs. Backend error sanitization and server boundaries were preserved byte-for-byte.

## G. Destructive-action safety

Project/task/comment confirmation, asset deletion dialog, and failure handling remain intact. Review decisions retain explicit version context and existing revision/unresolved-review guards. Credential changes retain existing verification and session revocation. No account-deletion feature was introduced. **Requires live verification:** authenticated destructive and review flows with disposable nonproduction records, including cancellation, denied actions, and partial failures.

## H. Homepage release audit

**Confirmed defects fixed:** broken Brand Guide asset, fake enquiry success, placeholder social destinations, and auth dialog/mobile navigation accessibility. Auth dialog now traps keyboard focus, closes on Escape, restores focus to a visible control, and makes background/closed controls inert. Password visibility controls have names/state; authentication messages announce status/errors. Existing login/signup/reset contracts remain unchanged.

The enquiry form now clearly states that online enquiries are unavailable, disables submission, and offers the existing `hello@nexussetups.com` address. This prevents false acknowledgements; it does not implement enquiry delivery. **Requires live verification/business action:** confirm that mailbox and availability message are suitable for release, or implement and separately test an approved enquiry service later.

Actual built homepage checked at 375, 390, 430, 768, 1024, and 1440px in both light and dark themes: no scrollable horizontal overflow or clipped controls found. Decorative orbit bounds extend beyond the viewport within clipping containers. Mobile screenshots and dialog keyboard behavior were inspected; no uncaught browser errors were observed. No authenticated visual audit or full WCAG conformance claim is made for this pass.

## I. Repository/release hygiene

Real environment files, generated Prisma output, node_modules, and build output remain ignored; only `.env.example` is tracked. No dependency upgrades or package-script changes were made in Pass 4. Build remains `prisma generate && next build`; it does not deploy database migrations or run seeds. Production migration deployment and preceding release checks remain manual actions from Pass 2.

Combined working-tree changes were inspected for scope. Snapshot comparison confirms all 15 Prisma files, four test files, 22 API files, seven library files, `src/auth.ts`, and Pass 2/3 reports are byte-identical to their Pass 4 starting versions. Existing workflow/security/UI and unrelated user edits were preserved. No new tests were necessary for these focused presentation/configuration changes; browser checks supplement the existing regression suite.

## J. Confirmed issues fixed

| Classification / severity | Affected files | Problem and fix |
| --- | --- | --- |
| Confirmed defect / medium | `src/app/page.tsx`, `src/app/homepage.css` | Enquiry form falsely acknowledged unsent data. Removed fake success; clearly unavailable, disabled form with existing email fallback. |
| Confirmed defect / medium | `src/app/page.tsx`, `src/app/homepage.css` | Hidden auth/mobile controls and modal focus were keyboard-accessible or unmanaged. Added inert state, dialog naming, focus trap/restore, Escape, labels, announcements, and focus styles. |
| Confirmed defect / medium | `.env.example`, `R2_CORS.json`, `R2_SETUP.txt`, `README.md`, `scripts/production-smoke.mjs` | Old production origin in release guidance/defaults. Updated to canonical www origin and clarified configured origins. |
| Confirmed defect / low | `src/app/layout.tsx`, `src/app/dashboard/page.tsx`, `src/app/favicon.ico`, `src/app/icon.svg` | Scaffold metadata/icon and generic dashboard tab. Replaced with Nexus branding; removed old favicon. |
| Confirmed defect / low | `public/nexus-setups-brand-book.html`, `src/app/page.tsx` | Brand Guide link missing its asset; social links led to `#`. Restored existing guide with correct home/workflow language; removed placeholder social column. |
| Confirmed defect / low | `src/app/dashboard/DashboardClient.jsx` | Credential-change success omitted required relogin guidance. Updated two messages to match existing revocation behavior. |
| Hardening improvement / low | `next.config.ts` | Explicit baseline response protections missing. Added compatible headers; fuller CSP deferred. |
| Hardening improvement / low | `src/app/error.tsx`, `src/app/global-error.tsx`, `src/app/not-found.tsx`, `src/components/ReleaseFallback.tsx`, `src/components/release-fallback.css` | Framework fallback experience lacked consistent branded recovery. Added generic retry/home states without exception disclosure. |

## K. Tests/build results

- Workflow: 24/24 passed.
- Hardening: 11/11 passed.
- Backend/security and migration suite: 16/16 passed (14 backend/security, two migration tests).
- Total: all 51 existing tests preserved and passed.
- Prisma validation: passed, using an unreachable local dummy database URL; no production connection.
- `npm run build`: passed.
- `git diff --check`: passed; Git emitted existing LF/CRLF normalization notices, not whitespace errors.
- Local production smoke: 10/10 passed with explicit `http://localhost:4174`; anonymous dashboard redirected home and protected APIs returned 401.
- Built-browser metadata, icon, Brand Guide, 404, response headers, responsive/theme matrix, and modal keyboard checks passed within the scope described above.

Browser requests were anonymous local reads with a dummy unreachable database URL. No real login/signup/reset email, upload/download, or authenticated mutation was performed. Audit server and browser were stopped.

## L. Items requiring live production verification

1. Confirm canonical `AUTH_URL`, HTTPS cookies, callback/reset links, external apex redirect, DNS/TLS, and CDN headers.
2. Apply/review actual R2 CORS for the canonical origin. `If-None-Match` must be allowed for Pass 1's conditional uploads, along with Content-Type and any signed checksum headers. The checked-in wildcard AllowedHeaders permits these; editing this file does not configure Cloudflare. Verify preflight and uploads in a real browser, plus authorized historical downloads and ZIP cancellation.
3. Complete migration/release checks from Pass 2 with explicit operator authorization; build alone does not run `prisma migrate deploy`. No production migration was run here.
4. Exercise real login/signup/reset SMTP, session expiry/revocation, role-specific dashboard flows, review/final delivery, and destructive-action error recovery in a suitable environment.
5. Trigger controlled application/root errors and inspect final deployed metadata/favicon caching. Consider full CSP only after integration testing.
6. Confirm the homepage contact mailbox and performance-reporting claim. Online enquiry submission remains unavailable by design until an approved delivery integration exists.

## M. Complete Pass 4 file list

Modified: `.env.example`, `R2_CORS.json`, `R2_SETUP.txt`, `README.md`, `next.config.ts`, `scripts/production-smoke.mjs`, `src/app/layout.tsx`, `src/app/page.tsx`, `src/app/homepage.css`, `src/app/dashboard/page.tsx`, `src/app/dashboard/DashboardClient.jsx`.

Deleted: `src/app/favicon.ico`.

Added: `PRODUCTION_READINESS_PASS4.md`, `public/nexus-setups-brand-book.html`, `src/app/icon.svg`, `src/app/not-found.tsx`, `src/app/error.tsx`, `src/app/global-error.tsx`, `src/components/ReleaseFallback.tsx`, `src/components/release-fallback.css`.

Total: 20 Pass 4 files. Other dirty/untracked files predate this pass.
