#!/usr/bin/env bash
# Local/CI verification pipeline for the presentation studio.
#   yarn verify:studio          -> static checks, studio tests, production build
#   yarn verify:studio:full     -> additionally runs the full repository test suite
set -euo pipefail

cd "$(dirname "$0")/.."

run() {
  echo
  echo "==> $1"
  shift
  "$@"
}

run "TypeScript" yarn test:typecheck
run "ESLint" yarn test:code
run "Prettier" yarn test:other
run "Studio tests" yarn test:app excalidraw-app/studio --watch=false

if [[ "${1:-}" == "--full" ]]; then
  # Two workers avoid timing flakes in unrelated core tests on shared runners.
  run "Full test suite" yarn test:app --watch=false --minWorkers=1 --maxWorkers=2
fi

run "Production build" yarn build

echo
echo "Studio verification passed."
