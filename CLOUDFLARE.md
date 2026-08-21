# Cloudflare deployment plan

The local Node server remains for desktop development. The production-compatible Pages Functions implementation is now deployed at `https://jobpilot-cn.pages.dev`.

## Target architecture

- Pages: `index.html`, `styles.css`, `auth.js`, `app.js`
- Pages Functions or Worker: authentication and application APIs
- D1: users, sessions, jobs, applications, interview sessions and audit records
- KV (current transition): uploaded resumes and generated resume documents
- R2 (target): file storage after R2 is enabled on the Cloudflare account
- Queue: resume parsing and batch tailoring jobs
- Separate browser worker service: recruitment-site browser preparation tasks

## Required migration before public deployment

1. Normalize the current D1 `user_states` JSON into dedicated job/application/interview tables.
2. Replace transitional KV file storage with private R2 objects after R2 is enabled.
3. Keep Node `child_process` browser automation in a separate authorized execution service.
4. Configure production SMS, rate limiting, secrets and a custom domain with HTTPS.
5. Add privacy policy, user agreement, account deletion and data export.

## Recommended Git-integrated Pages settings

- Production branch: `main`
- Build command: leave empty until the Worker migration is added
- Build output directory: `/` only for a static preview; do not treat that preview as the working product
