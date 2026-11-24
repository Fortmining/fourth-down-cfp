# Pulse CFBD worker on Proxmox

Use a dedicated unprivileged Debian 12 or newer LXC. Start with one vCPU,
512 MiB RAM, 512 MiB swap headroom, and an 8 GiB SSD-backed root disk included
in Proxmox backup. The projected data is small, but Python can expand one
12 MiB response substantially while parsing and normalizing it. These are
starting allocations, not live benchmarks. Check peak RSS and database size
after the first cycle. Allow DNS to the approved resolver, clock synchronization
via the host, and outbound HTTPS to CFBD. During commissioning, allow access to
the distribution package mirrors. The ingestion-only container needs no inbound
service. Host 2026 roster replay used about 0.7 MB of SQLite space, excluding
other feeds. At 149 requests and the 12 MiB response guard the response-body
envelope is about 1.75 GiB per 31 days, plus protocol overhead. Real consumption
has not been measured.

## Install on an existing host

The owner must choose the node, an unused CT ID, an existing Debian template,
storage and bridge, and provide authorized host console access or run these
steps. The following example uses DHCP. Substitute values appropriate to the
existing host. A root filesystem on persistent Proxmox storage holds worker
state across stops and reboots.

```sh
# From the development checkout, using the reviewed branch with this directory.
git archive --format=tar HEAD:fourth-down > /tmp/fourth-down-worker.tar
scp /tmp/fourth-down-worker.tar root@PROXMOX_HOST:/tmp/fourth-down-worker.tar

# On the Proxmox host. Pick values from your actual storage and template list.
pct list
pvesm status
CT=260
TEMPLATE='local:vztmpl/REPLACE_WITH_DEBIAN_TEMPLATE.tar.zst'
STORAGE=local-lvm
BRIDGE=vmbr0
pct create "$CT" "$TEMPLATE" --hostname pulse-cfbd --unprivileged 1 \
  --cores 1 --memory 512 --swap 512 --rootfs "$STORAGE:8" \
  --net0 "name=eth0,bridge=$BRIDGE,ip=dhcp,firewall=1" --onboot 1
pct start "$CT"
pct push "$CT" /tmp/fourth-down-worker.tar /tmp/fourth-down-worker.tar
pct enter "$CT"

# Inside the container as root.
apt-get update
apt-get install --no-install-recommends -y python3 sqlite3 ca-certificates
useradd --system --user-group --home-dir /var/lib/pulse-cfbd --shell /usr/sbin/nologin pulse-cfbd
install -d -m 0755 /opt/fourth-down
tar -xf /tmp/fourth-down-worker.tar -C /opt/fourth-down
rm /tmp/fourth-down-worker.tar
install -d -m 0700 /etc/pulse-cfbd
printf 'CFBD_SEASON=2026\nCFBD_CLASS_YEAR=2027\n' > /etc/pulse-cfbd/season.conf
chmod 0600 /etc/pulse-cfbd/season.conf
install -m 0644 /opt/fourth-down/ops/proxmox/*.service /opt/fourth-down/ops/proxmox/*.timer /etc/systemd/system/
systemd-analyze verify /etc/systemd/system/pulse-cfbd*.service /etc/systemd/system/pulse-cfbd*.timer
systemd-analyze calendar '*-*-* 00/4:14:00 UTC'
systemctl daemon-reload
systemctl list-timers --all 'pulse-cfbd*'
```

From a root **Bash** console inside the container, enter the existing key
at the masked prompt. Use the owner's secret manager or CFBD account to
retrieve it. The existing sensitive Vercel variable is not a secret export.
The key is read by systemd at service start, copied into that service's private
credential directory and passed to Python by its wrapper. It never appears
in the command arguments, unit environment configuration, Git or routine logs.
Do not run this block with shell tracing enabled.

```bash
(
  set +x
  set -eu
  umask 077
  staged=$(mktemp /etc/pulse-cfbd/.key.XXXXXX)
  trap 'rm -f "$staged"' EXIT
  systemd-ask-password 'Existing CFBD API key' > "$staged"
  test -s "$staged"
  mv -f "$staged" /etc/pulse-cfbd/cfbd.key
)
```

## Controlled fresh cycle

Keep both timers disabled for the trial. Ensure the container clock is
synchronized. Start the first invocation manually and capture only aggregate
counts and sanitized endpoint statuses. The program may exit successfully
after a handled provider failure, so accept it only after checking the ledger.
A fresh healthy first invocation can attempt eight requests, including quota
sampling. The ninth endpoint, national player season stats, defers due to the
rolling cap. Start the second invocation **more than 24 hours after the last
reserved attempt**. On the healthy path the second attempts five requests
including four daily checks, for 13 total. The two invocations can attempt at
most 16 total, and the worker can decline work if access, freshness or quota
checks fail. Do not delete attempt history to force retries.

```sh
systemctl is-enabled pulse-cfbd.timer pulse-cfbd-backup.timer
systemctl start pulse-cfbd.service
journalctl -u pulse-cfbd.service -n 30 --no-pager
DB=/var/lib/pulse-cfbd/worker.sqlite
sqlite3 -readonly "$DB" <<'SQL'
PRAGMA quick_check;
SELECT scope, count(*) AS attempts FROM cf_calls GROUP BY scope;
SELECT datetime(MAX(at),'unixepoch') AS latest_attempt_utc FROM cf_calls;
SELECT datetime(sampled,'unixepoch') AS quota_sample_utc, remaining AS provider_remaining,
       datetime(cooldown,'unixepoch') AS hold_until_utc FROM cf_quota;
SELECT scope, COUNT(DISTINCT team) AS observed_programs FROM cf_seen GROUP BY scope;
SELECT scope, COUNT(*) AS retained_revisions FROM cf_editions GROUP BY scope;
SQL
systemctl start pulse-cfbd-backup.service
```

After the persistent container restarts, rerun the read-only checks. Verify
that the first reservations and editions survived, then run the second
invocation on schedule and repeat the checks. Confirm the transfer and recruiting
views still use provider observation language. Compare the sampled remaining
quota with second-run local reservations and note that other CFBD/CBBD clients
may use the same budget. Keep identity mismatches, missing programs, oversized
responses and absent editions visible. Do not treat source silence as zero.

The backup unit uses SQLite's online backup API and retains seven verified
copies on the volume. Also back up the container to existing private Proxmox
backup storage, restrict access to backups containing credentials, and test a
restore to an isolated container with the timers disabled. Restore SQLite into
a new directory without old WAL sidecars. A recovered historical backup is
suitable for review and display. Before resuming ingestion on it, reconcile
reservations since the backup from the surviving ledger or wait out the
31-day rolling window and get a fresh provider quota sample. Never run two
collectors against the same account on separate restored volumes.

After a separate decision to start ongoing isolated collection, enable the
worker and backup timers with
`systemctl enable --now pulse-cfbd.timer pulse-cfbd-backup.timer`. A persistent
timer may immediately run one missed check after activation. Existing SQLite
admission rules still apply. To pause, run
`systemctl disable --now pulse-cfbd.timer pulse-cfbd-backup.timer` and let a
currently running service finish or stop it explicitly.

## Hosted read design

Keep the SQLite database, backups and worker on the private network. Publish
only atomic, schema-validated team view files into a separate read-only
directory owned by a dedicated publication service account. Do not grant that
account access to the database or CFBD credential. Reuse an approved reachable
TLS reverse proxy if available. Permit only authenticated GET requests to
`/v1/teams/<existing-team-id>`, reject other routes and methods, disable
listings, cap responses at 24 KiB and rate-limit the proxy. Return ETags and
support conditional GET after authentication. Use a separate scoped random
read bearer stored in Vercel server-side and authenticated before any content
is read. Do not log authorization headers. Use the existing six-hour
application cache and validate team IDs and the response schema again in Vercel.
Fallback is the last validated edition with its observed date, or unavailable
if none exists. Never proxy arbitrary upstream paths.

If no approved ingress exists, prefer uploading the same validated team views
to an existing private HTTPS artifact store using a separate write credential.
Use a versioned manifest to switch complete editions atomically. Give Vercel a
read-only credential. Neither option invokes Redis or gives Vercel a route to
ingestion. Local validation reads exported files directly. Network publication,
credentials and a hosted reachability check remain separate approval gates.
