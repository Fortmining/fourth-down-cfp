// https://collegefootballplayoff.com/news/2026/8/6/sc-aug-2627
const shows = [
  { edition: "2026-11-10", start: "2026-11-10T21:00:00-05:00", minutes: 30 },
  { edition: "2026-11-17", start: "2026-11-17T21:00:00-05:00", minutes: 30 },
  { edition: "2026-11-24", start: "2026-11-24T19:30:00-05:00", minutes: 30 },
  { edition: "2026-12-01", start: "2026-12-01T19:00:00-05:00", minutes: 30 },
  { edition: "2026-12-06", start: "2026-12-06T12:00:00-05:00", minutes: 180 },
] as const;

export function cfpShowSlot(now: number) {
  const show = shows.find(({ start, minutes }) => {
    const beginning = Date.parse(start);
    return now >= beginning && now < beginning + minutes * 60_000;
  });
  return show ? { edition: show.edition, minute: Math.floor(now / 60_000) } : null;
}

// A dated official release link is source telemetry. It cannot trigger push.
export function committeeReleaseLink(html: string, edition: string) {
  const [year, month, day] = edition.split("-").map(Number);
  const prefix = `/news/${year}/${month}/${day}/`;
  for (const match of html.matchAll(/<a\b[^>]*\bhref="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi)) {
    const [ , href, label ] = match;
    if (href.startsWith(prefix) && /^\/news\/[\w/-]+$/.test(href) &&
        /selection committee.*rankings|rankings.*selection committee/i.test(label.replace(/<[^>]*>/g, " "))) {
      return `https://collegefootballplayoff.com${href}`;
    }
  }
  return null;
}

export async function readShowSource(url: string, maxBytes: number) {
  const response = await fetch(url, {
    cache: "no-store", redirect: "error", signal: AbortSignal.timeout(5_000),
  });
  if (!response.ok || !response.body) throw new Error("Source unavailable");
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let size = 0;
  let text = "";
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) throw new Error("Source response exceeded limit");
      text += decoder.decode(value, { stream: true });
    }
    return { observedAt: new Date().toISOString(), text: text + decoder.decode() };
  } finally {
    await reader.cancel().catch(() => {});
  }
}
