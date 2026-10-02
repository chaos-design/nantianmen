# Résumé Lab Deployment Guide

[中文](deployment-guide.md) | English

This guide is for operators responsible for deploying, rolling back, and troubleshooting Résumé Lab in Vercel and Supabase environments.

## Deployment Model

Résumé Lab uses:

- Vercel for hosting the Next.js application.
- Supabase for Auth, PostgreSQL, and private Storage.
- Vercel Git integration as the deployment entry: `main` builds to Production, other branches and pull requests build Preview Deployments.
- GitHub Actions as the quality gate and the auditable release archive.

The two channels are independent. The Git integration owns production traffic, while `publish.yml` produces a versioned build archive and a GitHub Release. If only one deployment channel is needed, disable automatic deployments in Vercel Project Settings → Git, or stop `publish.yml`. Do not let both channels own production.

## Environment Isolation

| Environment | Application runtime | Data service | Purpose |
| --- | --- | --- | --- |
| Development | Local `next dev` | Supabase Development | Daily development and debugging |
| Test | Vercel Preview | Supabase Test | Acceptance and integration validation |
| Production | Vercel Production | Supabase Production | Real user traffic |

Hard requirements:

- Development, test, and production use different Supabase projects.
- Vercel Preview and Production do not share service role keys.
- Test environments never connect to production PostgreSQL or Storage.
- Preview account variables are for the read-only demo account and are unrelated to Vercel Preview deployments.

## Required Runtime Configuration

Application variables:

| Variable | Environment | Description |
| --- | --- | --- |
| `RESUME_DATA_BACKEND` | Server | Use `supabase` for deployed environments |
| `SUPABASE_URL` | Server | Supabase Project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Server | Service role key, never expose to browser bundles |
| `SUPABASE_STORAGE_BUCKET` | Server | Optional, defaults to `resume-assets` |
| `NEXT_PUBLIC_SUPABASE_URL` | Browser | Public Supabase URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Browser | Browser publishable key |
| `ADMIN_USER_ID` | Server | Confirmed administrator Auth UUID |
| `PREVIEW_USER_ID` | Server | Read-only Preview account UUID |
| `PREVIEW_USER_EMAIL` | Server | Read-only Preview account email |
| `PREVIEW_RESUME_ID` | Server | Fixed Preview resume UUID |
| `PREVIEW_SESSION_SECRET` | Server | Preview session secret, at least 32 characters |

Optional global AI provider:

- `AI_MODEL_NAME`
- `AI_BASE_URL`
- `AI_API_KEY`

The global AI provider is enabled only when all three values are present. Because the global AI config is sent to editable users' browsers, use a rotatable least-privilege key.

Never configure `AUTH_TEST_USER_ID` or `AUTH_TEST_USER_EMAIL` in a deployed environment; the server refuses to start when they are present. `AUTH_TEST_*` and `RESUME_FILE_*` exist only for Playwright-injected local test runs.

## Supabase Setup

For every environment:

1. Create or open the target Supabase project.
2. Execute the full `supabase/platform.sql` script in SQL Editor.
3. Confirm all business tables exist and Row Level Security is enabled.
4. Confirm direct access is not granted to `anon` or `authenticated`.
5. Confirm `publish_resume_snapshot` is executable only by `service_role`.
6. Confirm private Bucket `resume-assets` exists.
7. Confirm Storage limits PNG, JPEG, and WebP files to 5 MiB.
8. Enable the Email Provider, require email confirmation, and configure Supabase Auth Site URL and Redirect URLs.
9. Enable the Before User Created Hook and select the
   `public.restrict_registration_email_domain` Postgres function.
10. Confirm registration succeeds with a common provider and rejects unsupported domains before creating a user.
11. Confirm the hidden email-code implementation retains its 60-second resend interval and registration completes through the confirmation link.

Production should also have appropriate backup and recovery settings enabled.

## Vercel Setup

Project setup:

- Connect the Git repository during project creation.
- Framework Preset: Next.js.
- Root Directory: repository root.
- Node.js Version: 22.x or later, or let `engines.node` in `package.json` decide. `pnpm@11.21.0` requires Node.js 22.13+ and fails during dependency installation on older runtimes.
- Install, Build, and Dev commands come from `vercel.json` in the repository root; do not override them in the dashboard.
- In Settings → Git, confirm that `main` deploys to Production and other branches and pull requests produce Preview Deployments.

Environment variables:

- Configure Development, Preview, and Production separately.
- Do not upload local `.env`. `.vercelignore` already excludes `.env*` and keeps only `.env.example`.
- Public variables with `NEXT_PUBLIC_` are embedded into the client build and require redeployment when changed.
- Server secrets remain server-only in Vercel Project Settings.

Variable sources per channel:

| Channel | Source |
| --- | --- |
| Vercel Git automatic deployment | Injected by Vercel at build time from the target Environment |
| Publish workflow | `vercel pull` from Vercel Project Settings |
| Local development | `.env`, loaded by Next.js |

A failed build usually means a missing `NEXT_PUBLIC_*` value. Read the build log in Vercel Dashboard → Deployments, fix the target Environment, and redeploy. Never place real values in `vercel.json` or source code.

## GitHub Actions Setup

Create GitHub Environments:

- `preview`
- `production`

Configure the following secrets in each environment:

- `VERCEL_TOKEN`
- `VERCEL_ORG_ID`
- `VERCEL_PROJECT_ID`

The production environment may require reviewers if the team wants an approval gate before production releases.

## Automated Release Flow

Vercel Git integration:

1. Pushing a non-`main` branch or opening a pull request builds a Preview Deployment.
2. Merging into `main` builds and deploys to Production.
3. Build commands come from `vercel.json`; variables come from the target Environment.
4. Confirm the Deployment reaches Ready state in Vercel Dashboard → Deployments.

The Git integration does not run Playwright. To guarantee that only tested code reaches production, make the `quality` and `e2e` checks required in GitHub branch protection.

Publish workflow archive channel, on `main` updates:

1. Run Biome, TypeScript, and Vitest quality checks.
2. Run Playwright end-to-end tests.
3. Pull target Vercel environment configuration.
4. Build Vercel output.
5. Package the build output as a versioned archive.
6. Upload the archive as a GitHub Artifact.
7. Deploy the same prebuilt output to Vercel.
8. Create or update the GitHub Release for production deployments.

Production version format is based on the package major/minor version and the GitHub Actions run number.

## Manual Deployment

Manual deployment is reserved for cases where GitHub Actions is unavailable or a Vercel build needs direct validation.

Manual deployments bypass branch protection and do not imply code review. Confirm the code is merged into `main` before deploying manually to production.

To verify a production build locally:

```bash
pnpm install --frozen-lockfile
pnpm build
pnpm start
```

The `start` script already pins `next start --port 3001` so it does not collide with the development server on port 3000. The CLI flag takes precedence over the `PORT` environment variable, so exporting `PORT` will not change the listening port. Open `http://localhost:3001` after startup. Stop the process with `Ctrl+C`.

Pass an explicit flag to use another port, for example `pnpm start --port 3100`.

Before any manual production deployment:

- Confirm the code is reviewed and corresponds to the intended main-branch state.
- Confirm test Supabase changes and functional validation are complete.
- Confirm Vercel and Supabase production variables are complete.
- Confirm database backup and rollback approach.
- Avoid modifying a verified build output before deployment.

## Rollback

For production incidents:

1. Identify the latest stable Vercel Deployment.
2. Promote or roll back to that deployment first.
3. Verify public routes, login, workspace, editor, asset access, and share pages.
4. Preserve incident context: version, deployment URL, workflow run, timestamps, and user-visible symptoms.
5. Investigate root cause after traffic is stable.

If a database change is involved, do not blindly roll back application code without confirming schema compatibility.

## Operational Checks

Before release:

- `supabase/platform.sql` initialized and verified.
- Email Provider, email confirmation, Auth Site URL, and Redirect URLs configured.
- The Before User Created Hook is bound and common/unsupported registration domains behave as expected.
- Vercel Development, Preview, and Production variables all reviewed.
- GitHub environment secrets available.
- Quality and E2E checks pass.
- Preview and Production point to different Supabase projects.
- Preview account is read-only.
- AI provider configuration is intentional and least-privilege.

After release:

- GitHub Actions run succeeds.
- The Vercel Production Deployment is Ready.
- Landing page loads.
- Login and auth callback work.
- Workspace lists and creates resumes.
- Editor can save drafts.
- A4 preview renders.
- Web builder renders.
- Publication creates a snapshot.
- Public A4 and web share pages load anonymously.
- Private and public assets respect access boundaries.

## Related Documents

- [README](../README.en.md)
- [Development Guide](development-guide.en.md)
- [Supabase SQL Guide](../supabase/README.en.md)
- [AI Agent Rules](../AGENTS.md)
