#!/usr/bin/env bash

set -euo pipefail

repository="${1:-${GITHUB_REPOSITORY:-}}"
branch="${2:-main}"

if [[ -z "$repository" ]]; then
  printf 'Usage: GH_TOKEN=... %s owner/repository [branch]\n' "$0" >&2
  exit 2
fi

if [[ ! "$repository" =~ ^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$ ]]; then
  printf 'Invalid repository name: %s\n' "$repository" >&2
  exit 2
fi

if [[ -z "$branch" ]]; then
  printf 'Branch name must not be empty.\n' >&2
  exit 2
fi

if [[ -z "${GH_TOKEN:-}" ]]; then
  printf 'GH_TOKEN must have Administration write access to the repository.\n' >&2
  exit 2
fi

if ! command -v gh >/dev/null 2>&1; then
  printf 'GitHub CLI is required: https://cli.github.com/\n' >&2
  exit 2
fi

if ! command -v node >/dev/null 2>&1; then
  printf 'Node.js is required to encode the branch name.\n' >&2
  exit 2
fi

encoded_branch="$(
  node -e 'process.stdout.write(encodeURIComponent(process.argv[1]))' "$branch"
)"

# Update the complete protection object so repeated runs converge on the same policy.
gh api \
  --method PUT \
  -H "Accept: application/vnd.github+json" \
  -H "X-GitHub-Api-Version: 2022-11-28" \
  "repos/${repository}/branches/${encoded_branch}/protection" \
  --input - >/dev/null <<'JSON'
{
  "required_status_checks": {
    "strict": true,
    "contexts": [
      "quality",
      "e2e"
    ]
  },
  "enforce_admins": true,
  "required_pull_request_reviews": {
    "dismiss_stale_reviews": true,
    "require_code_owner_reviews": false,
    "required_approving_review_count": 1,
    "require_last_push_approval": true
  },
  "restrictions": null,
  "required_linear_history": true,
  "allow_force_pushes": false,
  "allow_deletions": false,
  "block_creations": false,
  "required_conversation_resolution": true,
  "lock_branch": false
}
JSON

printf 'Branch protection configured for %s:%s\n' "$repository" "$branch"
