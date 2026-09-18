#!/usr/bin/env bash
# Run on sebmer's Mac after the project lands under e.g. ~/Documents/GitHub/website
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
npm ci
npm run build
if [ ! -d .git ]; then
  git init -b main
fi
git add -A
git status
if git diff --cached --quiet; then
  echo "Nothing to commit"
else
  git commit -m "$(cat <<'MSG'
feat: amerged Next.js App Router landing page

Port the editorial single-file HTML landing into Next.js (App Router +
TypeScript) with server-rendered content for SEO and client progressive
enhancement for interactions.
MSG
)"
fi
git remote remove origin 2>/dev/null || true
git remote add origin https://github.com/amerged-org/website.git
git push -u origin main
echo "COMMIT_SHA=$(git rev-parse HEAD)"
echo "REPO_URL=https://github.com/amerged-org/website"
