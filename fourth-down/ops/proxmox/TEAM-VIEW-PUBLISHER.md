# Private Pulse team-view publisher on CT 260

Package the reviewed commit on the development machine. Substitute the existing
authorized Proxmox host for the placeholder.

```sh
git archive --format=tar HEAD fourth-down/ops/proxmox fourth-down/app/data/pulse-teams-2026.json > /tmp/fourth-down-reader.tar
scp /tmp/fourth-down-reader.tar root@PROXMOX_HOST:/tmp/fourth-down-reader.tar
# On the Proxmox host
pct push 260 /tmp/fourth-down-reader.tar /tmp/fourth-down-reader.tar
pct enter 260
```

Run this as root inside CT 260 for initial installation or code updates.
It preserves an existing reader credential. The collector and its timers
need no changes.

```sh
set -eu
stage=$(mktemp -d)
tar -xf /tmp/fourth-down-reader.tar -C "$stage"
src="$stage/fourth-down"
getent passwd pulse-cfbd-read >/dev/null || useradd --system --user-group --no-create-home --shell /usr/sbin/nologin pulse-cfbd-read
install -d -o root -g root -m 0755 /opt/fourth-down-reader
install -d -o root -g pulse-cfbd-read -m 0750 /srv/pulse-cfbd-read
install -d -o root -g root -m 0700 /etc/pulse-cfbd-read
install -m 0644 "$src/ops/proxmox/team_views_http.py" "$src/ops/proxmox/stage_team_views.py" /opt/fourth-down-reader/
install -m 0644 "$src/app/data/pulse-teams-2026.json" /opt/fourth-down-reader/
install -m 0644 "$src/ops/proxmox/pulse-cfbd-read.service" /etc/systemd/system/
if [ ! -e /etc/pulse-cfbd-read/read.key ]; then
  umask 077
  python3 -c 'import secrets; print(secrets.token_hex(32))' > /etc/pulse-cfbd-read/read.key
fi
chown root:root /etc/pulse-cfbd-read/read.key
chmod 0600 /etc/pulse-cfbd-read/read.key
PYTHONDONTWRITEBYTECODE=1 python3 /opt/fourth-down-reader/stage_team_views.py \
  /var/lib/pulse-cfbd/views /srv/pulse-cfbd-read /opt/fourth-down-reader/pulse-teams-2026.json --worker-lock /var/lib/pulse-cfbd/worker.sqlite.lock
systemd-analyze verify /etc/systemd/system/pulse-cfbd-read.service
systemctl daemon-reload
systemctl restart pulse-cfbd-read.service
systemctl is-active pulse-cfbd-read.service
```

Repeat just the staging command for data updates. It validates all 138 team
views before replacing any, then replaces each view atomically. The root-owned
copies are readable by the dedicated publisher account. Its systemd unit
masks the worker database, backups and secret directory. For custom ports use
root-owned `/etc/pulse-cfbd-read/ports.conf` with `CFBD_READ_PORT` and
`CFBD_READ_HEALTH_PORT`, then restart and adjust the smoke test.

## Localhost smoke test

Run as root. The check prints results without revealing the bearer or bodies.

```sh
python3 - <<'PY'
from http.client import HTTPConnection
from pathlib import Path

token = Path('/etc/pulse-cfbd-read/read.key').read_text().strip()
auth = {'Authorization': 'Bearer ' + token}
def get(port, path, headers=None):
    conn = HTTPConnection('127.0.0.1', port, timeout=5)
    try:
        conn.request('GET', path, headers=headers or {})
        res = conn.getresponse()
        return res.status, res.getheader('ETag'), len(res.read())
    finally:
        conn.close()

target = '/v1/teams/2633'
assert get(8766, '/healthz')[0] == 200
assert get(8765, '/healthz')[0] == 404
assert get(8765, target)[0] == 401
status, tag, size = get(8765, target, auth)
assert status == 200 and tag and 0 < size <= 24576
assert get(8765, target, {**auth,'If-None-Match':tag}) == (304,tag,0)
assert get(8765, '/v1/teams/../worker.sqlite', auth)[0] == 404
print('Local health, authorization, team view, ETag and path restrictions passed')
PY
ss -lnt '( sport = :8765 or sport = :8766 )'
systemctl is-enabled pulse-cfbd.timer pulse-cfbd-backup.timer || true
```

The install starts only the publisher. To start it on boot after approval,
run `systemctl enable pulse-cfbd-read.service`. To roll it back, run
`systemctl disable --now pulse-cfbd-read.service`.

## Future Cloudflare Access and Vercel integration

1. Use the existing tunnel if its connector runs inside CT 260. If it runs
   elsewhere, arrange an approved connector in CT 260 so the origin stays on
   loopback. Use a dedicated hostname protected by an Access self-hosted
   application and a Service Auth policy scoped to an expiring service token.
   Set the matching application audience for tunnel-side JWT validation and use
   a team-path-only ingress to `http://127.0.0.1:8765` followed by a 404
   catchall. Bypass Cloudflare's edge cache. Keep port 8766 local.
2. In Vercel, keep the fixed HTTPS origin, the Access client ID and secret,
   and the dedicated origin bearer server-only. Transfer the origin bearer
   through the owner's secret manager. Send the Access token headers
   `CF-Access-Client-Id` and `CF-Access-Client-Secret` plus the origin
   `Authorization: Bearer …`. Use a short timeout and reject redirects.
   Keep authorization headers out of logs and client responses.
3. Validate the approved team ID before fetching. Enforce 24 KiB on the
   received body and reuse Fourth Down's team view decoder. Store validated
   data and its ETag in the server-side cache scoped to the origin and team.
   Use the existing six-hour freshness policy and conditional revalidation.
   A 304 requires a previously validated body. On failure, show the last
   validated edition with its observation time, or show unavailable.
4. Before activation, verify Access denial without its token, origin denial
   without its bearer, a successful authenticated request, conditional GET,
   and an isolated Vercel read. Check availability under the current plan.
   This package makes no tunnel, Access, DNS or Vercel changes.
