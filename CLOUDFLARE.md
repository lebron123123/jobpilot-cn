# Cloudflare deployment plan

The current local Node server cannot be deployed unchanged to Cloudflare Pages.

## Target architecture

- Pages: `index.html`, `styles.css`, `auth.js`, `app.js`
- Pages Functions or Worker: authentication and application APIs
- D1: users, sessions, jobs, applications, interview sessions and audit records
- R2: uploaded resumes and generated resume documents
- Queue: resume parsing and batch tailoring jobs
- Separate browser worker service: recruitment-site browser preparation tasks

## Required migration before public deployment

1. Replace filesystem JSON storage with D1 migrations and parameterized queries.
2. Replace local generated-file storage with private R2 objects and signed downloads.
3. Replace Node `http`, `fs` and `child_process` calls with Worker request handlers.
4. Move Playwright/browser automation to a separate authorized execution service.
5. Configure production SMS, rate limiting, secrets and a custom domain with HTTPS.
6. Add privacy policy, user agreement, account deletion and data export.

## Recommended Git-integrated Pages settings

- Production branch: `main`
- Build command: leave empty until the Worker migration is added
- Build output directory: `/` only for a static preview; do not treat that preview as the working product

