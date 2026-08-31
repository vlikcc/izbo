#!/usr/bin/env bash
# Fails when any project (directly or transitively) resolves a package with a known advisory.
# `dotnet list package --vulnerable` always exits 0, so the output has to be inspected.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SOLUTION="${1:-$REPO_ROOT/EduPlatform.sln}"

report="$(mktemp)"
trap 'rm -f "$report"' EXIT

dotnet list "$SOLUTION" package --vulnerable --include-transitive >"$report" 2>&1 || true

cat "$report"

if grep -qE '^\s+> ' "$report"; then
  echo ""
  echo "ERROR: vulnerable packages detected. Pin a fixed version in Directory.Packages.props." >&2
  exit 1
fi

echo ""
echo "No known vulnerable packages."
