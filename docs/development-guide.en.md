# Résumé Lab Development Guide

[中文](development-guide.md) | English

This guide is for developers working on Résumé Lab. It summarizes local setup, project boundaries, development workflow, quality checks, testing strategy, and common troubleshooting paths.

## Product and System Boundary

Résumé Lab is a structured resume visualization platform. It provides form and
JSON editing, A4 pagination preview, web resume rendering, template switching,
private asset upload, AI suggestions, authentication with common-domain
registration controls, and public sharing.

Runtime boundaries:

- Browsers establish sessions through Supabase Auth.
- Browsers do not write business tables or private Storage directly.
- Next.js Route Handlers validate identity, ownership, administrator access, and Same-Origin for writes.
- Drafts, publications, assets, and AI audit records are stored in Supabase.
- Public share pages only read immutable publication snapshots.

## Tech Stack

| Category | Technology |
| --- | --- |
| Framework | Next.js 15 App Router, React 19 |
| Language | TypeScript 5 |
| Styling | Tailwind CSS 4, project CSS, Radix UI |
| Validation | Zod 4 |
| Data and auth | Supabase PostgreSQL, Auth, Storage |
| Unit and integration tests | Vitest, V8 Coverage |
| End-to-end tests | Playwright Chromium |
| Static checks | Biome, TypeScript |
| Package manager | pnpm with `pnpm-lock.yaml` |

## Repository Layout

```text
src/
├── app/                    Pages, layouts, and Route Handlers
├── components/ui/          Base UI components
├── features/               Editor, renderer, templates, auth, landing, workspace
├── lib/supabase/           Browser and server Supabase session helpers
├── server/                 Auth, domain services, repositories, assets, AI
└── shared/                 Shared Schema, template schemes, design tokens
supabase/
├── platform.sql            Single database initialization script
└── config.toml             Supabase CLI local config
tests/e2e/                  Playwright tests
scripts/                    Development and operations helpers
```

## Local Setup

Prerequisites:

- Node.js 22.13 or later (`pnpm@11.21.0` cannot start on anything older).
- pnpm 11.21.0.
- A dedicated Supabase development project.
- A confirmed administrator account in Supabase Auth.

Setup flow:

1. Install dependencies from the committed lockfile.
2. Execute the full `supabase/platform.sql` script in the Supabase SQL Editor.
3. Enable the Email Provider in Supabase Auth.
4. Require email confirmation so registration completes through the confirmation link.
5. Enable the Before User Created Hook and select the
   `public.restrict_registration_email_domain` Postgres function.
6. Configure the local Site URL and `/auth/callback` redirect URL.
7. Copy `.env.example` to `.env` and fill in local values.
8. Start the development server and verify landing page, workspace, editor, asset upload, publication, and share pages.

The login UI currently exposes email/password only. The email-code implementation
remains in place with a 60-second resend interval, but its entry is temporarily hidden
through styling. Registration accepts common email provider domains only, collects
email and password, then establishes the login session through the confirmation link.
Supported providers include QQ, NetEase, Foxmail, Sina, Sohu, Aliyun, Chinese
carrier mail, Gmail, Outlook, Hotmail, iCloud, Yahoo, and Proton. This restriction
applies only to new registrations. The form provides immediate feedback and the
`restrict_registration_email_domain` Hook performs final server-side enforcement.
Password recovery sends a secure link through `/auth/callback`, establishes a
recovery session, and returns the user to the original target after the password is
updated.

Exact command examples are kept in the Chinese guide and `package.json` scripts.

## Environment Variables

Required runtime variables:

| Variable | Scope | Description |
| --- | --- | --- |
| `RESUME_DATA_BACKEND` | Server | Use `supabase` for development integration and production |
| `SUPABASE_URL` | Server | Supabase Project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Server | Service role key, never expose to browser code |
| `NEXT_PUBLIC_SUPABASE_URL` | Browser | Public Supabase URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Browser | Browser publishable key |
| `ADMIN_USER_ID` | Server | Confirmed administrator Auth UUID |
| `PREVIEW_USER_ID` | Server | Read-only Preview account UUID |
| `PREVIEW_USER_EMAIL` | Server | Read-only Preview account email |
| `PREVIEW_RESUME_ID` | Server | Fixed Preview resume UUID |
| `PREVIEW_SESSION_SECRET` | Server | Preview session secret, at least 32 characters |

Optional AI variables:

- `AI_MODEL_NAME`
- `AI_BASE_URL`
- `AI_API_KEY`

All three AI variables must be configured together. Global AI configuration is visible to editable users in the browser, so use a rotatable least-privilege key.

## Development Workflow

Recommended workflow:

1. Create or open a sample resume from the workspace.
2. Validate form editing, JSON editing, A4 preview, and web resume preview.
3. Keep changes close to the owning feature or domain module.
4. Add regression tests for bug fixes and risky behavior changes.
5. Update `.env.example`, README, and deployment docs when environment variables change.
6. Avoid unrelated formatting, broad refactors, and generated directory churn.

## Code Style

- Use Biome for formatting and static checks. Do not use ESLint.
- Keep TypeScript strict.
- Frontend filenames are lowercase with hyphen separators.
- Functions use lower camel case.
- Prefer existing helpers, domain services, repository adapters, UI primitives, and design tokens.
- Keep service-role Supabase access on the server.
- Add comments only when they explain non-obvious logic.

## Testing Strategy

Use focused tests based on risk:

- Shared Schema, auth, domain services, repositories, asset services, and AI parsing: Vitest.
- Editor interactions, shortcuts, template thumbnails, pagination, and layout behavior: feature-local tests.
- Login, workspace, full editing flow, preview, and share pages: Playwright.
- Large permission, publication, asset, or Schema changes: broader quality gates.

Coverage thresholds apply to shared Schema, authentication, and domain services:

| Metric | Threshold |
| --- | --- |
| Statements | 90% |
| Functions | 90% |
| Lines | 90% |
| Branches | 75% |

The gate runs in the `quality` job of both `.github/workflows/ci.yml` and
`publish.yml`. `pnpm test` alone does not enforce thresholds; use
`pnpm test:coverage` locally.

## Security Notes

- Do not commit real secrets.
- Do not log or document service-role keys.
- Do not expose `SUPABASE_SERVICE_ROLE_KEY` to browser code.
- Do not weaken ownership checks or RLS assumptions to pass tests.
- Preview mode is read-only.
- AI failures must be explicit and must not be replaced with fake local results.

## AI Instructions (system prompt)

The icon in the AI drawer's top-right corner opens "AI 指令" (AI Instructions), which
shows and edits the complete system prompt sent to the model.

| Concern | Contract |
| --- | --- |
| Storage | Browser-local `localStorage` only, key `resume-ai:prompts:v3:<userId>` |
| Concatenation | The server prepends nothing; the saved text is sent verbatim |
| Length limit | 8000 characters, enforced by `aiPromptGuidanceSchema` |
| Unmodified | Nothing is written locally; the server uses `defaultAiSystemPrompt` |
| Missing structure | Warned about before saving, but never blocked |

The `输出结构` (output structure) line is a hard dependency of the server-side Zod
validation. Removing it makes the model unable to return a parseable result and the AI
feature fails with a 502. `findMissingStructureMarkers` detects this; its probes are the
field names taken from that line.

When editing the prompt text, keep the structural requirements (JSON fields, unitId
correspondence, verbatim `original`, length caps) — they are contracts, not prose.
`src/shared/resume-ai/resume-ai-prompt-text.test.ts` asserts the defaults still contain them.

## Common Troubleshooting

| Symptom | Direction |
| --- | --- |
| Auth callback fails | Check Supabase Site URL and Redirect URLs |
| A common email domain cannot register | Confirm `platform.sql` is current and the Before User Created Hook points to `public.restrict_registration_email_domain` |
| Registration policy differs between UI and Auth | Keep `src/features/auth/email-policy.ts` and `supabase/platform.sql` domain lists synchronized |
| Business API returns 401 | Check local auth and public Supabase variables |
| Business API returns 403 | Check Preview mode and ownership rules |
| Asset upload fails | Check file type, file size, and private Bucket setup |
| Publication fails | Check `publish_resume_snapshot` function and service role permissions |
| AI config is missing | Configure all three `AI_*` variables or use browser personal config |
| E2E data is polluted | Use an isolated file backend data directory for Playwright |

## Related Documents

- [README](../README.en.md)
- [Deployment Guide](deployment-guide.en.md)
- [Supabase SQL Guide](../supabase/README.en.md)
- [AI Agent Rules](../AGENTS.md)
