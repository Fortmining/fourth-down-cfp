#!/bin/sh
set -eu
# The credential is available only inside the supervised service.
CFBD_API_KEY=$(cat "${CREDENTIALS_DIRECTORY:?}/cfbd.key")
test -n "$CFBD_API_KEY"
export CFBD_API_KEY PYTHONDONTWRITEBYTECODE=1
exec /usr/bin/python3 scripts/pulse-cfbd.py --db "${STATE_DIRECTORY:?}/worker.sqlite" \
  --season "${CFBD_SEASON:?}" --class-year "${CFBD_CLASS_YEAR:?}" --week 1 "$@"
