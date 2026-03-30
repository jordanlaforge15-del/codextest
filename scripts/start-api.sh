#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

cd "${REPO_ROOT}"

corepack enable

if [ ! -f node_modules/.modules.yaml ]; then
  corepack pnpm install
fi

corepack pnpm --filter @apps/api db:generate
exec corepack pnpm --filter @apps/api dev
