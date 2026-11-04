import { NextResponse } from "next/server";
import { cfpShowSlot, committeeReleaseLink, readShowSource } from "../../../lib/cfp-show";
import { cronAuthorized, redis } from "../../../lib/push-store";
import { collectPolls } from "../../../lib/rankings";
import type { RankingMemory } from "../../../lib/ranking-recovery";
import { GET as dispatch } from "../dispatch/route";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: Request) {
  const json = (body: object, status = 200) =>
    NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
  if (!cronAuthorized(request)) return json({ error: "Not authorized" }, 401);
  const slot = cfpShowSlot(Date.now());
  if (!slot) return json({ skipped: "Outside the verified CFP show window" });

  try {
    const claimed = await redis("SET", `fd:cfp-show:minute:${slot.minute}`, "1", "NX", "EX", 180);
    if (!claimed) return json({ skipped: "Minute already checked" });
    const [espn, committee] = await Promise.allSettled([
      readShowSource("https://site.api.espn.com/apis/site/v2/sports/football/college-football/rankings", 1_000_000),
      readShowSource("https://collegefootballplayoff.com/rankings", 1_500_000),
    ]);
    const raw = espn.status === "fulfilled" ? JSON.parse(espn.value.text) : {};
    const poll = collectPolls(Array.isArray(raw.rankings) ? raw.rankings : [], 2026, null, false)
      .find(candidate => candidate.id === "cfp");
    const verified = poll?.status === "available" && poll.date?.slice(0, 10) === slot.edition;
    const result = {
      edition: slot.edition,
      minute: slot.minute,
      espnObservedAt: espn.status === "fulfilled" ? espn.value.observedAt : null,
      espnComplete: verified,
      eventId: verified ? `poll:cfp:2026:${slot.edition}` : null,
      committeeObservedAt: committee.status === "fulfilled" ? committee.value.observedAt : null,
      committeeReleaseLink: committee.status === "fulfilled"
        ? committeeReleaseLink(committee.value.text, slot.edition) : null,
    };
    console.info("CFP show source observation", result);
    if (!verified) return json(result);
    const stored = await redis("GET", "fd:v08:ranking-state");
    const state: RankingMemory | null = stored ? JSON.parse(stored) : null;
    if (state?.season === 2026 && state.polls.cfp?.publishedAt >= Date.parse(slot.edition)) {
      return json({ ...result, dispatch: "Edition already observed" });
    }
    // Keep the existing dispatch lock, eligibility and persistent push claims.
    // Dispatch independently verifies the current feed before any send.
    const response = await dispatch(request);
    return json({ ...result, dispatch: response.status }, response.status);
  } catch {
    return json({ error: "CFP show check unavailable" }, 503);
  }
}
