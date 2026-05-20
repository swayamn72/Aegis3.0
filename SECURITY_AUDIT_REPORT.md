# Aegis Security Review Report

Audit date: 2026-04-30

## Scope and method
- Scope: full repo (server, clients, Flutter app, scripts)
- Method: static review only (no dependency audit, no runtime tests)
- Sources: code and configuration in the workspace

## Executive summary
This review found several high-impact issues that should be addressed urgently. The most critical issue is an admin-auth bypass that allows any valid JWT to access admin endpoints. Sensitive credential files are present in the repo. Several upload flows accept files based only on mimetype and store them in memory, increasing spoofing and memory-exhaustion risk.

## Findings

### Critical
1) Admin auth bypass (any JWT can access admin endpoints)
- Evidence: verifyAdminToken only verifies a JWT and does not enforce an admin role or claim, then routes trust it for admin access.
- Impact: any user token (player/org) signed with the shared JWT secret can access admin routes.
- References:
  - [server/middleware/adminAuth.js](server/middleware/adminAuth.js#L30)
  - [server/routes/admin.routes.js](server/routes/admin.routes.js#L93)
  - [server/routes/organization.routes.js](server/routes/organization.routes.js#L12)
- Recommendation: require an explicit admin claim (e.g., `role: 'admin'`) and verify it in `verifyAdminToken`. Consider a separate JWT secret or issuer for admin tokens and validate `adminId` against the Admin collection on every request.

### High
2) Sensitive credentials committed to the repo
- Evidence: credential files and environment secrets are present in the workspace.
- Impact: credential leakage enables full account compromise for Firebase/Google/SMTP/etc.
- References:
  - [server/aegis3-cbfba-firebase-adminsdk-fbsvc-b7e1b5653b.json](server/aegis3-cbfba-firebase-adminsdk-fbsvc-b7e1b5653b.json)
  - [client_secret_1016989901540-edd0h25562n41taond0ouga7stab7u2l.apps.googleusercontent.com.json](client_secret_1016989901540-edd0h25562n41taond0ouga7stab7u2l.apps.googleusercontent.com.json)
  - [server/.env](server/.env)
- Recommendation: remove these files from the repo, rotate all affected keys, and switch to environment-only secrets (as already supported in [server/config/firebase.js](server/config/firebase.js)).

3) File uploads rely on mimetype checks and in-memory buffering
- Evidence: multipart uploads accept files via multer memoryStorage with mimetype checks only; several routes do not validate file contents with `sharp` or similar.
- Impact: spoofed file types and memory pressure (e.g., 12 x 5MB uploads in memory) can lead to abuse and potential denial of service.
- References:
  - [server/config/multer.js](server/config/multer.js#L8)
  - [server/routes/match.routes.js](server/routes/match.routes.js#L1291)
  - [server/routes/orgTournament.routes.js](server/routes/orgTournament.routes.js#L1679)
  - [server/routes/orgTournament.routes.js](server/routes/orgTournament.routes.js#L2299)
  - [server/routes/post.routes.js](server/routes/post.routes.js#L30)
  - [server/routes/team.routes.js](server/routes/team.routes.js#L658)
- Recommendation: validate file contents (e.g., `sharp` decode) in every upload route, enforce total request size limits, and consider streaming storage to avoid large in-memory buffers. Reuse `validateUploadedImage` consistently.

### Medium
4) Content Security Policy disabled on the API server
- Evidence: CSP is explicitly disabled in Helmet config.
- Impact: if the API server ever serves admin pages or embeds user content, disabling CSP weakens XSS protections.
- Reference: [server/index.js](server/index.js#L62)
- Recommendation: enable CSP with a strict policy, or document that the API host never serves HTML/JS and ensure separate domains are used.

## Observations (non-blocking)
- Upload routes in [server/routes/organization.routes.js](server/routes/organization.routes.js#L60) and [server/routes/player.routes.js](server/routes/player.routes.js#L415) already use `validateUploadedImage`. Extending this pattern to other upload endpoints would improve consistency.
- Login, verification, and password reset flows include rate limits and generic responses to reduce enumeration risk in [server/routes/auth.routes.js](server/routes/auth.routes.js).

## Recommended next steps
1) Fix admin authorization checks and consider a distinct JWT secret/issuer for admin tokens.
2) Remove committed secrets, rotate keys, and enforce secret scanning in CI.
3) Harden all file upload endpoints (content validation + total size limits + streaming). 
4) Decide whether the API host should serve HTML; if yes, re-enable CSP.

## Verification checklist (optional)
- Attempt admin API access with a normal player JWT (should fail after the fix).
- Upload a spoofed file (e.g., non-image with image mimetype) to all upload endpoints (should fail after validation).
- Confirm secrets are no longer in the repo and rotated.
