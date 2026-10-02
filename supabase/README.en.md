# Supabase SQL Guide

[中文](README.md) | English

This directory maintains a single SQL file: `platform.sql`. New development, test, and production environments should use this file to initialize the Supabase database, Auth Hook, and Storage.

## Contents

| Path | Description |
| --- | --- |
| `platform.sql` | The only SQL initialization script, including business tables, constraints, indexes, RLS, permission boundaries, the Auth Hook, publication function, and private Storage Bucket |
| `config.toml` | Supabase CLI local service configuration; it does not automatically create business tables |
| `.gitignore` | Ignore rules for Supabase CLI local temporary files |

## Initialization Steps

1. Open the target Supabase project.
2. Go to SQL Editor.
3. Paste and execute the full contents of `platform.sql`.
4. Confirm there are no unhandled errors.
5. Enable the Email Provider and email confirmation, then configure Site URL and Redirect URLs for the application environment.
6. Under Authentication → Hooks, enable the Before User Created Hook and select the
   `public.restrict_registration_email_domain` Postgres function.

`platform.sql` uses repeatable object creation where practical and is primarily intended for full initialization of new environments. It is not a replacement for carefully planned incremental upgrades on existing databases. When changing existing environments, prepare dedicated change SQL and validate it in a test project first.

## What the Script Creates

After executing `platform.sql`, the script creates or configures:

- Business tables for resume drafts, publication snapshots, asset metadata, and AI audit records.
- Indexes used by workspace listing, public sharing, asset reads, and AI audit queries.
- Table constraints and foreign keys.
- Row Level Security and direct role permission tightening.
- The `restrict_registration_email_domain` Auth Hook function for registration email domains.
- The `publish_resume_snapshot` transaction function.
- Private Storage Bucket `resume-assets`.
- Storage policies and limits for image type, file size, and access boundaries.

## Registration Email Domains

New accounts accept these domains:

```text
qq.com
163.com / 126.com / yeah.net
foxmail.com / sina.com / sina.cn / sohu.com / aliyun.com
139.com / 189.cn / wo.cn
gmail.com / outlook.com / hotmail.com / live.com
icloud.com / me.com / yahoo.com / proton.me / protonmail.com
```

The registration form applies the same rule first. `platform.sql` creates
`public.restrict_registration_email_domain` to reject direct signup requests
that bypass the page. After creating the function, bind it as the Before User
Created Hook under Authentication → Hooks. Existing-account sign-in, email-code
sign-in, and password recovery remain unrestricted.

## Local CLI Behavior

`config.toml` disables automatic migration and seed loading. As a result, `supabase db reset` does not automatically create project business tables. When rebuilding a local environment, execute the full `platform.sql` script again in SQL Editor.

The project does not maintain split migrations or seed SQL files, so the database structure has one initialization source.

## Post-Run Checks

After initialization, verify at least:

- Business tables such as `resumes`, `resume_publications`, and `resume_assets` exist.
- All business tables have Row Level Security enabled.
- `anon` and `authenticated` do not have direct access to business tables.
- The Before User Created Hook points to `public.restrict_registration_email_domain`.
- `publish_resume_snapshot` can only be executed by `service_role`.
- `resume-assets` Bucket exists and remains private.
- Storage allows PNG, JPEG, and WebP files only, up to 5 MiB per file.

## Security Requirements

- `SUPABASE_SERVICE_ROLE_KEY` is only configured in server-side environment variables, Vercel Environment Variables, or GitHub Secrets.
- Do not write service role keys into browser code, SQL files, README, issues, or logs.
- Validate changes in a test Supabase project before production.
- Prepare a verifiable rollback plan before deleting columns, changing types, or rewriting data.
- Production should have suitable backup and Point-in-Time Recovery settings.

## Related Documents

- [README](../README.en.md)
- [Development Guide](../docs/development-guide.en.md)
- [Deployment Guide](../docs/deployment-guide.en.md)
- [AI Agent Rules](../AGENTS.md)
