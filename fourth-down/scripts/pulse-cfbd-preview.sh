#!/bin/sh
# Optional build command for an explicitly approved, protected Preview.
set -eu
if [ "${VERCEL_ENV:-}" != preview ]; then
  echo 'CFBD probe requires Vercel Preview.' >&2
  exit 2
fi
cd "$(dirname "$0")/.."
umask 077
private_dir=$(mktemp -d)
trap 'rm -rf "$private_dir"' EXIT
python3 scripts/pulse-cfbd.py --probe --db "$private_dir/probe.sqlite" --season 2026 --class-year 2027 --week 12
npm run build
