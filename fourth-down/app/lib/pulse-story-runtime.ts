import {pulseArchiveEnabled} from './pulse-release.ts';
import {pulseRedisStore} from './pulse-story-redis.ts';

// Only fixed categories and numeric status codes may enter production logs.
const errorCategories = [
  [/\b(?:NOAUTH|WRONGPASS|NOPERM)\b/i, 'access denied'],
  [/\b(?:quota|rate limit|command limit|daily limit|monthly limit)\b/i, 'quota'],
  [/\b(?:max(?:imum)? (?:record|request) size|too large)\b/i, 'size limit'],
  [/\b(?:Invalid archive|Invalid meter|Invalid Pulse operation|Pulse keys only)\b/, 'archive validation'],
] as const;

function category(error: unknown) {
  if (typeof error !== 'string') return 'unclassified';
  return errorCategories.find(([pattern]) => pattern.test(error))?.[1] || 'unclassified';
}

class PulseRestFailure extends Error {}

const knownArchiveErrors = new Set([
  'Pulse archive budget limited', 'Pulse archive conflict readback unavailable',
  'Pulse storage limited', 'Invalid archive items', 'Archive generation mismatch',
  'Invalid Pulse Redis response', 'Archive transport mismatch', 'Archive size limit', 'Source count budget',
]);

export function warnPulseArchive(stage: 'read' | 'commit' | 'update', error: unknown) {
  const reason = error instanceof Error && (error instanceof PulseRestFailure || knownArchiveErrors.has(error.message))
    ? error.message : 'Unclassified archive operation';
  console.warn('Pulse archive unavailable', stage, reason);
}

// The Redis response may contain user data or script arguments. Never log its body.
async function readRedisResponse(response: Response) {
  if (!response.ok) {
    let reason = 'unclassified';
    // Inspect only small, explicitly sized error bodies for known provider codes.
    const size = Number(response.headers.get('content-length'));
    if (size > 0 && size <= 4096 && !response.headers.has('content-encoding')) {
      try { reason = category((await response.json())?.error); } catch { /* HTML and plain text are also possible. */ }
    }
    throw new PulseRestFailure(`HTTP ${response.status} (${reason})`);
  }
  let body;
  try { body = await response.json(); } catch { throw new PulseRestFailure(`HTTP ${response.status} invalid JSON`); }
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new PulseRestFailure('Invalid Redis response envelope');
  if (body.error != null) throw new PulseRestFailure(`Redis error in HTTP ${response.status} body (${category(body.error)})`);
  if (!Object.hasOwn(body, 'result')) throw new PulseRestFailure('Invalid Redis response envelope');
  return body.result;
}

export function configuredPulseStore(env: Record<string, string | undefined> = process.env, request: typeof fetch = fetch) {
  if (!pulseArchiveEnabled(env)) return null;
  const base = env.UPSTASH_REDIS_REST_URL || env.KV_REST_API_URL;
  const token = env.UPSTASH_REDIS_REST_TOKEN || env.KV_REST_API_TOKEN;
  if (!base || !token) return null;
  let endpoint: URL;
  try { endpoint = new URL(base); } catch { return null; }
  if (endpoint.protocol !== 'https:' || endpoint.username || endpoint.password || endpoint.port ||
      endpoint.search || endpoint.hash || !endpoint.hostname.endsWith('.upstash.io')) return null;
  return pulseRedisStore(async (...command) => {
    let response;
    try {
      response = await request(endpoint, {
        method: 'POST', headers: {Authorization: 'Bearer ' + token, 'Content-Type': 'application/json'},
        body: JSON.stringify(command), cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(5000),
      });
    } catch { throw new PulseRestFailure('Archive transport failed before HTTP response'); }
    return readRedisResponse(response);
  });
}
