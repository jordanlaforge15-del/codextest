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

if [ -f openai_api_key ] && [ -z "${OPENAI_API_KEY:-}" ]; then
  export OPENAI_API_KEY
  OPENAI_API_KEY="$(tr -d '\r\n' < openai_api_key)"
fi

exec corepack pnpm --filter @apps/worker dev
