#!/usr/bin/env bash
# Installs the toolchain required to build, test and run EduPlatform locally.
# Idempotent: safe to re-run.
set -euo pipefail

DOTNET_CHANNEL="10.0"
DOTNET_DIR="${DOTNET_ROOT:-$HOME/.dotnet}"
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

log() { printf '\n==> %s\n' "$1"; }

install_dotnet() {
  if [ -x "$DOTNET_DIR/dotnet" ]; then
    log ".NET SDK already present at $DOTNET_DIR"
    return
  fi

  log "Installing .NET SDK $DOTNET_CHANNEL"
  local script
  script="$(mktemp)"
  curl -fsSL https://dot.net/v1/dotnet-install.sh -o "$script"
  bash "$script" --channel "$DOTNET_CHANNEL" --install-dir "$DOTNET_DIR"
  rm -f "$script"
}

persist_dotnet_path() {
  local profile="$HOME/.bashrc"
  grep -q 'DOTNET_ROOT' "$profile" 2>/dev/null && return

  log "Adding .NET to PATH in $profile"
  {
    echo ''
    echo '# EduPlatform toolchain'
    echo "export DOTNET_ROOT=\"$DOTNET_DIR\""
    echo 'export PATH="$DOTNET_ROOT:$PATH"'
    echo 'export DOTNET_CLI_TELEMETRY_OPTOUT=1'
  } >>"$profile"
}

install_frontend_deps() {
  log "Installing frontend dependencies"
  ( cd "$REPO_ROOT/frontend" && npm ci --no-audit --no-fund )
}

restore_backend() {
  log "Restoring .NET solution"
  ( cd "$REPO_ROOT" && "$DOTNET_DIR/dotnet" restore EduPlatform.sln )
}

install_dotnet
persist_dotnet_path
restore_backend
install_frontend_deps

log "Setup complete"
printf 'dotnet: %s\n' "$("$DOTNET_DIR/dotnet" --version)"
printf 'node:   %s\n' "$(node --version)"
