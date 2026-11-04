import assert from "node:assert/strict";
import test from "node:test";
import { cfpShowSlot, committeeReleaseLink } from "../app/lib/cfp-show.ts";

test("one-minute slots are restricted to the verified 2026 Eastern show windows", () => {
  const at = (value: string) => cfpShowSlot(Date.parse(value));
  assert.equal(at("2026-11-11T01:59:59Z"), null);
  assert.equal(at("2026-11-11T02:00:00Z")?.edition, "2026-11-10");
  assert.equal(at("2026-11-11T02:00:59Z")?.minute, at("2026-11-11T02:00:00Z")?.minute);
  assert.equal(at("2026-11-11T02:30:00Z"), null);
  assert.equal(at("2027-11-11T02:00:00Z"), null);
  const count = Array.from({ length: 180 }, (_, index) =>
    cfpShowSlot(Date.parse("2026-12-06T17:00Z") + index * 60_000));
  assert.equal(new Set(count.map(slot => slot?.minute)).size, 180);
  assert.equal(at("2026-12-06T20:00:00Z"), null);
});

test("committee observations require a same-day official release link", () => {
  const link = '<a href="/news/2026/11/3/rankings"><span>CFP Selection Committee Releases First Rankings of 2026</span></a>';
  assert.equal(committeeReleaseLink(link, "2026-11-03"), "https://collegefootballplayoff.com/news/2026/11/3/rankings");
  assert.equal(committeeReleaseLink(link, "2026-11-10"), null);
  assert.equal(committeeReleaseLink(link.replace('href="/', 'href="https://example.com/'), "2026-11-03"), null);
});
