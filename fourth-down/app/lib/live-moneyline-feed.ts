import type {OddsApiEvent} from './odds-api-moneyline';

const oddsBase = 'https://api.the-odds-api.com/v4/sports';
const scope = 'fd:{live-moneylines-v1}';
const snapshotKey = scope + ':snapshot';
const lockKey = scope + ':refresh';
const budgetKey = scope + ':credits';
const refreshSeconds = 120;
const rolloutCredits = 120;
const accountReserve = 50;

type Snapshot = {observedAt: string; events: OddsApiEvent[]};

async function redis(url: string, token: string, command: (string | number)[]) {
  const response = await fetch(url, {
    method: 'POST',
    headers: {Authorization: `Bearer ${token}`, 'Content-Type': 'application/json'},
    body: JSON.stringify(command),
    cache: 'no-store',
    signal: AbortSignal.timeout(4000),
  });
  const body = await response.json();
  if (!response.ok || body.error) throw new Error('Live moneyline cache unavailable');
  return body.result;
}

export async function liveMoneylineSnapshot(): Promise<Snapshot | null> {
  const key = process.env.ODDS_API_KEY;
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  if (process.env.VERCEL_ENV !== 'production' || !key || !url || !token) return null;

  const cache = (...command: (string | number)[]) => redis(url, token, command);
  try {
    const cached = await cache('GET', snapshotKey);
    if (cached) return JSON.parse(cached) as Snapshot;

    // One league-wide request per window, even across concurrent instances.
    // Reserve before outbound work and keep failed or uncertain attempts charged.
    const reserved = await cache('EVAL', `
      if redis.call('EXISTS', KEYS[1]) == 1 then return 0 end
      if tonumber(redis.call('GET', KEYS[2]) or '0') >= tonumber(ARGV[1]) then return 0 end
      if not redis.call('SET', KEYS[3], '1', 'NX', 'EX', ARGV[2]) then return 0 end
      redis.call('INCR', KEYS[2])
      return 1
    `, 3, snapshotKey, budgetKey, lockKey, rolloutCredits, refreshSeconds);
    if (reserved !== 1) return null;

    // The sports list is free. Fail closed if quota cannot be verified.
    const quota = await fetch(oddsBase + '?' + new URLSearchParams({apiKey: key}), {
      cache: 'no-store', signal: AbortSignal.timeout(5000),
    });
    const remaining = quota.headers.get('x-requests-remaining');
    await quota.body?.cancel();
    if (!quota.ok || !remaining || !/^\d+$/.test(remaining) || Number(remaining) <= accountReserve) return null;

    const query = new URLSearchParams({
      apiKey: key, markets: 'h2h', bookmakers: 'draftkings,fanduel', oddsFormat: 'american',
    });
    const response = await fetch(oddsBase + '/americanfootball_ncaaf/odds?' + query, {
      cache: 'no-store', signal: AbortSignal.timeout(9000),
    });
    if (!response.ok) return null;
    const events: OddsApiEvent[] = await response.json();
    if (!Array.isArray(events)) return null;
    const snapshot = {observedAt: new Date().toISOString(), events};
    await cache('SET', snapshotKey, JSON.stringify(snapshot), 'EX', refreshSeconds);
    return snapshot;
  } catch {
    return null;
  }
}
