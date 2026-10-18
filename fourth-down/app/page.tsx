"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowUpRight,
  ArrowDownRight,
  ArrowRight,
  RefreshCw,
  Trophy,
  Radio,
  Search,
  ChevronRight,
} from "lucide-react";
import { Ranked, tiers, tierFor, movement, matchups } from "./lib/model";
import { readAppearance, saveAppearance, type Appearance } from "./lib/appearance";
import { Poll, SourceId, comparisonRows } from "./lib/rankings";
type Team = {
  id: string;
  name: string;
  logo?: string;
  score?: string;
  homeAway: string;
  winner?: boolean;
  rank?: number;
  record: string;
};
type Game = {
  id: string;
  name: string;
  date: string;
  status: string;
  detail: string;
  teams: Team[];
  broadcast: string;
};
type Feed = {
  polls: Poll[];
  defaultRankingSource: SourceId;
  updatedAt: string;
  season: number | null;
  week: number | null;
  rankingSource: string | null;
  rankingDate: string | null;
  isCommitteeRanking: boolean;
  rankings: Ranked[];
  games: Game[];
  warnings: string[];
  provider: string;
  scoreboardDate: string | null;
};
function publicationDate(value: string, short = false) {
  return new Date(value).toLocaleDateString(undefined, {
    month: "short", day: "numeric", ...(short ? {} : { year: "numeric" }),
    ...(/^\d{4}-\d{2}-\d{2}$/.test(value) ? { timeZone: "UTC" } : {}),
  });
}
function Logo({ src }: { src?: string }) {
  return src ? (
    <img
      src={src}
      alt=""
      width={33}
      height={33}
      decoding="async"
      loading="lazy"
      onError={(e) => {
        e.currentTarget.style.visibility = "hidden";
      }}
    />
  ) : (
    <span className="logoFallback" />
  );
}
function Change({ t }: { t: Ranked }) {
  const n = movement(t);
  return (
    <span
      className={"change " + (n && n > 0 ? "up" : n && n < 0 ? "down" : "")}
    >
      {n === null ? (
        "NEW"
      ) : n > 0 ? (
        <>
          <ArrowUpRight size={14} />
          {n}
        </>
      ) : n < 0 ? (
        <>
          <ArrowDownRight size={14} />
          {Math.abs(n)}
        </>
      ) : (
        "—"
      )}
      <span className="sr-only">
        {n === null
          ? " to poll"
          : n === 0
            ? " unchanged"
            : n! > 0
              ? " positions up"
              : " positions down"}
      </span>
    </span>
  );
}
export default function Page() {
  const [data, setData] = useState<Feed | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(true),
    [filter, setFilter] = useState("all"),
    [top25, setTop25] = useState(false),
    [query, setQuery] = useState(""),
    [tab, setTab] = useState("outlook"),
    [now, setNow] = useState(Date.now());
  const [appearance, setAppearance] = useState<Appearance>("light");
  useEffect(() => { setAppearance(readAppearance()); }, []);
  function chooseAppearance(value: Appearance) {
    setAppearance(value);
    saveAppearance(value);
  }
  const [theme, setTheme] = useState("stadium");
  useEffect(() => {
    try {
      const saved = localStorage.getItem("fourth-down-theme");
      if (saved && ["stadium", "turf", "prime"].includes(saved)) setTheme(saved);
    } catch { /* Storage may be disabled; the default theme still works. */ }
  }, []);
  function chooseTheme(value: string) {
    setTheme(value);
    try { localStorage.setItem("fourth-down-theme", value); } catch {}
  }
  const [chosenSource, setChosenSource] = useState<SourceId | null>(null);
  const [rankingView, setRankingView] = useState("list");
  const selectedPoll = data?.polls?.find(
    (p) => p.id === (chosenSource ?? data.defaultRankingSource),
  );
  const comparisons = useMemo(() => comparisonRows(data?.polls || []), [data]);
  const inFlight = useRef(false),
    controller = useRef<AbortController | null>(null);
  const refresh = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    const requestController = new AbortController();
    controller.current = requestController;
    const timeout = setTimeout(() => requestController.abort(), 15000);
    try {
      const r = await fetch("/api/live", {
        cache: "no-store",
        signal: requestController.signal,
      });
      if (!r.ok) throw Error();
      const next = await r.json();
      if (
        !Array.isArray(next.rankings) ||
        !Array.isArray(next.games) ||
        !Array.isArray(next.polls) ||
        !next.updatedAt
      )
        throw Error();
      if (controller.current !== requestController) return;
      setData(next);
      setError("");
    } catch {
      if (controller.current !== requestController) return;
      setError("We couldn’t refresh the feed. Try again shortly.");
    } finally {
      clearTimeout(timeout);
      if (controller.current === requestController) {
        inFlight.current = false;
        setBusy(false);
      }
    }
  }, []);
  useEffect(() => {
    refresh();
    const i = setInterval(() => {
      setNow(Date.now());
      if (!document.hidden) refresh();
    }, 60000);
    return () => {
      clearInterval(i);
      controller.current?.abort();
      controller.current = null;
      inFlight.current = false;
    };
  }, [refresh]);
  const games = useMemo(
    () =>
      (data?.games || [])
        .filter(
          (g) =>
            (filter === "all" || g.status === filter) &&
            (!top25 ||
              g.teams.some(
                (t) =>
                  (t.rank && t.rank <= 25) ||
                  data?.rankings.some((r) => r.teamId === t.id),
              )) &&
            g.teams.some((t) =>
              t.name.toLowerCase().includes(query.toLowerCase()),
            ),
        )
        .sort(
          (a, b) =>
            Number(b.status === "in") - Number(a.status === "in") ||
            Date.parse(a.date) - Date.parse(b.date),
        ),
    [data, filter, top25, query],
  );
  const stale = !!data && now - Date.parse(data.updatedAt) > 180000;
  const live = data?.games.filter((g) => g.status === "in").length || 0;
  const rankedTeams = data?.rankings || [];
  const movers = [
    ...rankedTeams
      .filter((t) => (movement(t) ?? 0) > 0)
      .sort((a, b) => movement(b)! - movement(a)!)
      .slice(0, 2),
    ...rankedTeams
      .filter((t) => (movement(t) ?? 0) < 0)
      .sort((a, b) => movement(a)! - movement(b)!)
      .slice(0, 2),
  ];
  const teamAt = (n: number) => data?.rankings.find((t) => t.rank === n);
  function TeamRow({ t }: { t: Ranked }) {
    return (
      <details className="team">
        <summary>
          <span className="rank">{t.rank.toString().padStart(2, "0")}</span>
          <Logo src={t.logo} />
          <span className="teamIdentity">
            <b>{t.name}</b>
            <small>
              {t.conference} <span>·</span> {t.record || "Record unavailable"}
            </small>
          </span>
          <Change t={t} />
          <ChevronRight size={15} className="chevron" />
        </summary>
        <div className="teamDetail">
          <b>{tierFor(t.rank)?.name}</b>
          <p>{tierFor(t.rank)?.reason}</p>
          <p>
            Previous poll:{" "}
            {t.previous && t.previous <= 25
              ? `No. ${t.previous}`
              : "Unranked / unavailable"}
            . Current position is from {data?.rankingSource}, not a playoff
            seed.
          </p>
          <a
            href={`https://www.espn.com/college-football/team/_/id/${encodeURIComponent(t.teamId)}`}
          >
            Team schedule & results ↗
          </a>
        </div>
      </details>
    );
  }
  return (
    <>
      <a className="skip" href="#content">
        Skip to tracker
      </a>
      <div className="shell" data-theme={theme} data-appearance={appearance}>
        <nav aria-label="Main">
          <a href="#" className="brand">
            <span className="mark">
              4<span>TH</span>
            </span>
            FOURTH DOWN
            <span className="brandDivider" />{" "}
            <span className="brandSub">THE PLAYOFF PICTURE</span>
          </a>
          <a href="#scores" className="navScore">
            <Radio size={15} /> Scoreboard <span>{live}</span>
          </a>
        </nav>
        <div className="gameDayStrip">
          <span>COLLEGE FOOTBALL / THE PLAYOFF PICTURE</span>
          <div className="displaySettings">
            <div className="appearancePicker" role="group" aria-label="Appearance">
              <span>APPEARANCE</span>
              {(["light", "dark"] as const).map(value => <button key={value} aria-pressed={appearance === value} onClick={() => chooseAppearance(value)}>{value === "light" ? "☀ Light" : "☾ Dark"}</button>)}
            </div>
          <label className="themePicker">COLORWAY
            <select aria-label="Colorway" value={theme} onChange={e => chooseTheme(e.target.value)}>
              <option value="stadium">Stadium Gold</option>
              <option value="turf">Turf Electric</option>
              <option value="prime">Prime Time</option>
            </select>
          </label>
          </div>
        </div>
        <main id="content">
          <header>
            <div>
              <div className="eyebrow">
                <span className="dot" /> EVERY SATURDAY CHANGES EVERYTHING
              </div>
              <h1>
                The road to <em>twelve.</em>
              </h1>
              <p>
                Your college football command center. Follow the race,
                <br className="desktop" /> track the movement, catch every
                result.
              </p>
            </div>
            <div className="seasonCard">
              <Trophy size={24} />
              <div>
                <strong>
                  {data?.season || "—"} <span>SEASON</span>
                </strong>
                <small>
                  {data?.week ? `WEEK ${data.week}` : "COLLEGE FOOTBALL"} · 12
                  TEAMS. ONE CHAMPION.
                </small>
              </div>
            </div>
          </header>
          <div className="statusBar" role="status" aria-live="polite">
            <div>
              <span className={"dot " + (stale || error ? "amber" : "")} />
              <b>
                {busy
                  ? "Updating feed…"
                  : stale
                    ? "Feed may be stale"
                    : error
                      ? "Refresh interrupted"
                      : "Tracking the race"}
              </b>
              <span className="statusMeta">
                {data
                  ? `Fetched ${new Date(data.updatedAt).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZoneName: "short" })} · refreshes every minute`
                  : "Connecting to ESPN"}
              </span>
            </div>
            <button
              onClick={refresh}
              disabled={busy}
              aria-label="Refresh scores and rankings"
            >
              <RefreshCw size={14} className={busy ? "spin" : ""} /> Refresh
            </button>
          </div>
          {(error || data?.warnings?.length || stale) && (
            <div className="alert" role="status">
              {error} {data?.warnings?.join(" ")}{" "}
              {data && error ? "Last successful data remains visible. " : ""}
              {stale ? "This snapshot is more than three minutes old." : ""}
            </div>
          )}
          <div className="quickLinks" aria-label="Jump to section">
            <a href="#rankings-heading">01 <span>Rankings</span> <ArrowRight size={16}/></a>
            <a href="#outlook">02 <span>Playoff race</span> <ArrowRight size={16}/></a>
            <a href="#scores">03 <span>Scoreboard</span> <ArrowRight size={16}/></a>
          </div>
          <section
            className="publishedRankings"
            aria-labelledby="rankings-heading"
          >
            <div className="intro">
              <div>
                <div className="eyebrow">
                  THREE SOURCES. THREE PERSPECTIVES.
                </div>
                <h2 id="rankings-heading">The published rankings.</h2>
              </div>
              <span className="badge">
                PUBLISHED RANKINGS · SEPARATE FROM OUR MODEL
              </span>
            </div>
            <p className="context">
              AP is the automatic default until current-season CFP committee
              rankings are available. A manual selection stays selected. Each
              source keeps its own edition and publication date; no poll is used
              to fill another poll’s column.
            </p>
            <div className="rankingControls">
              <label>
                Ranking source
                <select
                  value={chosenSource ?? data?.defaultRankingSource ?? "ap"}
                  onChange={(e) => setChosenSource(e.target.value as SourceId)}
                >
                  <option value="ap">AP Top 25</option>
                  <option value="coaches">AFCA Coaches Poll</option>
                  <option value="cfp">CFP committee rankings</option>
                </select>
              </label>
              <div className="filters" aria-label="Ranking display">
                {[
                  ["list", "Rankings"],
                  ["compare", "Compare polls"],
                ].map(([v, label]) => (
                  <button
                    key={v}
                    aria-pressed={rankingView === v}
                    className={rankingView === v ? "active" : ""}
                    onClick={() => setRankingView(v)}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <button
                className="autoSource"
                onClick={() => setChosenSource(null)}
              >
                Use automatic default
              </button>
            </div>
            <div className="pollStatuses">
              {data?.polls.map((p) => (
                <article
                  key={p.id}
                  className={
                    "pollStatus " +
                    (p.id === selectedPoll?.id ? "selectedPoll" : "")
                  }
                >
                  <a href={p.url}>{p.name} ↗</a>
                  <b>
                    {p.status === "available"
                      ? "Published"
                      : p.status === "awaiting_update"
                        ? "Awaiting current edition"
                        : p.status === "not_published"
                          ? "Not yet published"
                          : "Unavailable"}
                  </b>
                  <p>{p.message}</p>
                  <small>
                    {p.date
                      ? `Published ${publicationDate(p.date)} · ${p.season} season`
                      : "No current-season publication date"}
                  </small>
                </article>
              ))}
            </div>
            {!data ? (
              <div className="empty" role="status">
                {busy
                  ? "Loading ranking sources…"
                  : "Ranking sources could not be loaded. Try refreshing."}
              </div>
            ) : rankingView === "list" ? (
              <>
                <h3 className="pollListTitle">
                  {selectedPoll?.name}{" "}
                  <span>
                    {selectedPoll?.week ? `Week ${selectedPoll.week}` : ""}
                  </span>
                </h3>
                {selectedPoll?.teams.length ? (
                  <ol className="publishedList">
                    {selectedPoll.teams.map((t) => (
                      <li key={t.teamId}>
                        <span className="rank">{t.rank}</span>
                        <Logo src={t.logo} />
                        <span className="teamIdentity">
                          <b>{t.name}</b>
                          <small>
                            {t.conference} · {t.record || "Record unavailable"}
                          </small>
                        </span>
                        <Change t={t} />
                      </li>
                    ))}
                  </ol>
                ) : (
                  <div className="empty">
                    {selectedPoll?.message} No substitute poll is displayed.
                  </div>
                )}
              </>
            ) : (
              <>
                <p className="scoreNote">
                  Latest available edition for each source; dates may differ. NR
                  = not ranked in that published top 25. — = no edition
                  available. Spread is the highest minus lowest published rank
                  among sources that rank the team; it excludes NR and missing
                  polls.
                </p>
                <div
                  className="comparisonScroll"
                  role="region"
                  aria-label="Poll comparison table"
                  tabIndex={0}
                >
                  <table className="comparison">
                    <caption>
                      Side-by-side rankings · all teams ranked by at least one
                      available source
                    </caption>
                    <thead>
                      <tr>
                        <th scope="col">Team</th>
                        {data.polls.map((p) => (
                          <th scope="col" key={p.id}>
                            {p.name}
                            <small>
                              {p.date
                                ? publicationDate(p.date, true)
                                : "No edition"}
                            </small>
                          </th>
                        ))}
                        <th scope="col">Rank spread</th>
                      </tr>
                    </thead>
                    <tbody>
                      {comparisons.map((row) => (
                        <tr key={row.team.teamId}>
                          <th scope="row">
                            <span>
                              <Logo src={row.team.logo} />
                              {row.team.name}
                            </span>
                          </th>
                          {data.polls.map((p) => (
                            <td key={p.id}>
                              {!p.teams.length
                                ? "—"
                                : (row.ranks[p.id] ?? "NR")}
                            </td>
                          ))}
                          <td>{row.spread ?? "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {!comparisons.length && (
                  <div className="empty">
                    No current-season ranking editions are available to compare.
                  </div>
                )}
              </>
            )}
          </section>
          <div id="outlook" className="sectionNav" aria-label="Tracker views">
            {[
              ["outlook", "Playoff outlook"],
              ["bracket", "12-team bracket"],
            ].map(([v, label]) => (
              <button
                key={v}
                aria-pressed={tab === v}
                className={tab === v ? "selected" : ""}
                onClick={() => setTab(v)}
              >
                {label}
                {v === "bracket" && <span>PREVIEW</span>}
              </button>
            ))}
            <a href="#method">
              How it works <ArrowUpRight size={14} />
            </a>
          </div>
          <section className="intro">
            <div>
              <div className="eyebrow">
                {tab === "outlook"
                  ? "THE BIG PICTURE"
                  : "IF THE POLL WERE THE BRACKET"}
              </div>
              <h2>
                {tab === "outlook"
                  ? "Where the race stands."
                  : "A path to the championship."}
              </h2>
            </div>
            <span className="badge">MODEL OUTLOOK · NOT OFFICIAL</span>
          </section>
          <p className="context">
            {data?.rankingSource || "Current poll pending"}
            {data?.rankingDate
              ? ` · Published ${publicationDate(data.rankingDate)}`
              : ""}
            .{" "}
            {data?.isCommitteeRanking
              ? "Committee rankings are the input; these tiers are our interpretation."
              : "Independent poll-position outlook, not published rankings or selection probabilities."}{" "}
            <a href="#method">Read the methodology ↗</a>
          </p>
          {!data && busy ? (
            <div
              className="skeleton"
              aria-label="Loading rankings"
              role="status"
            >
              {[1, 2, 3, 4].map((n) => (
                <div key={n} />
              ))}
              <span className="sr-only">Loading rankings</span>
            </div>
          ) : !data?.rankings.length ? (
            <div className="empty">
              Rankings are unavailable. Refresh to try again; scores may still
              be available below.
            </div>
          ) : tab === "outlook" ? (
            <div className="outlook">
              {tiers.map((t) => (
                <section className={"tier " + t.tone} key={t.name}>
                  <div className="tierHead">
                    <div>
                      <span className="tierDot" />
                      <h3>{t.name}</h3>
                      <small>{t.range}</small>
                    </div>
                    <span>
                      {
                        data.rankings.filter(
                          (r) => r.rank >= t.min && r.rank <= t.max,
                        ).length
                      }{" "}
                      TEAMS
                    </span>
                  </div>
                  <div className="teamGrid">
                    {data.rankings
                      .filter((r) => r.rank >= t.min && r.rank <= t.max)
                      .map((r) => (
                        <TeamRow key={r.teamId} t={r} />
                      ))}
                  </div>
                </section>
              ))}
            </div>
          ) : (
            <>
              <div className="bracketWarning">
                Illustration using poll ranks 1–12. Automatic bids are not
                applied, so this is not a projected or official CFP field. Bowl
                assignments and winners are undetermined.
              </div>
              <div
                className="bracket"
                role="region"
                aria-label="Illustrative 12 team bracket"
                tabIndex={0}
              >
                <div className="bracketCol">
                  <h3>
                    01 <span>FIRST ROUND</span>
                  </h3>
                  {matchups.map((m) => (
                    <div className="match" key={m.host}>
                      {[m.host, m.away].map((n) => (
                        <div key={n}>
                          <span className="rank">{n}</span>
                          <Logo src={teamAt(n)?.logo} />
                          <b>{teamAt(n)?.name || "TBD"}</b>
                        </div>
                      ))}
                      <small>
                        Winner → vs. seed {m.bye} · Higher seed hosts
                      </small>
                    </div>
                  ))}
                </div>
                <div className="bracketCol quarters">
                  <h3>
                    02 <span>QUARTERFINALS</span>
                  </h3>
                  {matchups.map((m) => (
                    <div className="match" key={m.bye}>
                      <div>
                        <span className="rank">{m.bye}</span>
                        <Logo src={teamAt(m.bye)?.logo} />
                        <b>{teamAt(m.bye)?.name || "TBD"}</b>
                        <span className="bye">BYE</span>
                      </div>
                      <div className="placeholder">
                        Winner of {m.host} / {m.away}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="bracketCol semis">
                  <h3>
                    03 <span>SEMIFINALS</span>
                  </h3>
                  {[1, 2].map((n) => (
                    <div className="match" key={n}>
                      <div>Quarterfinal winner {n * 2 - 1}</div>
                      <div>Quarterfinal winner {n * 2}</div>
                    </div>
                  ))}
                </div>
                <div className="bracketCol championship">
                  <h3>
                    04 <span>CHAMPIONSHIP</span>
                  </h3>
                  <div className="match">
                    <Trophy size={30} />
                    <h4>One team remains.</h4>
                    <p>
                      Semifinal winner
                      <br />
                      vs. semifinal winner
                    </p>
                  </div>
                </div>
              </div>
            </>
          )}
          {!!movers.length && (
            <section className="movement">
              <div>
                <div className="eyebrow">POLL MOVEMENT</div>
                <h2>Making moves.</h2>
                <p>
                  Versus the previous edition
                  <br />
                  of the same poll.
                </p>
              </div>
              <div className="movers">
                {movers.map((t) => (
                  <div key={t.teamId}>
                    <Logo src={t.logo} />
                    <b>{t.name}</b>
                    <Change t={t} />
                  </div>
                ))}
              </div>
            </section>
          )}
          <section id="scores" className="scores">
            <div className="intro">
              <div>
                <div className="eyebrow">GAME DAY CENTER</div>
                <h2>Every result matters.</h2>
              </div>
              <span className="liveBadge">
                <Radio size={14} /> {live} LIVE
              </span>
            </div>
            <div className="scoreTools">
              <div className="filters" aria-label="Game status">
                {[
                  ["all", "All games"],
                  ["in", "Live"],
                  ["pre", "Upcoming"],
                  ["post", "Final"],
                ].map(([v, l]) => (
                  <button
                    key={v}
                    aria-pressed={filter === v}
                    className={filter === v ? "active" : ""}
                    onClick={() => setFilter(v)}
                  >
                    {l}
                  </button>
                ))}
              </div>
              <label className="top25">
                <input
                  type="checkbox"
                  checked={top25}
                  onChange={(e) => setTop25(e.target.checked)}
                />{" "}
                Top 25 only
              </label>
              <label className="search">
                <Search size={15} />
                <input
                  aria-label="Search games by team"
                  placeholder="Find a team…"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </label>
            </div>
            <p className="scoreNote">
              {data?.scoreboardDate ? `Scoreboard window: ${data.scoreboardDate}. ` : "Provider’s current scoreboard window. "}{games.length} matching games · dates and kickoff times
              shown in your local time. Top 25 uses supplied game ranks or the
              outlook input poll.
            </p>
            <div className="scoreGrid">
              {games.map((g) => (
                <article
                  className={"game " + (g.status === "in" ? "liveGame" : "")}
                  key={g.id}
                >
                  <div className="gameTop">
                    <b>
                      {g.status === "in" && <><span className="dot" /> LIVE · </>}
                      {g.status === "pre"
                        ? new Date(g.date).toLocaleTimeString([], {
                            hour: "numeric",
                            minute: "2-digit",
                          })
                        : g.detail}
                    </b>
                    <span>
                      {new Date(g.date).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                      })}
                    </span>
                  </div>
                  {[...g.teams]
                    .sort(
                      (a, b) =>
                        Number(a.homeAway === "home") -
                        Number(b.homeAway === "home"),
                    )
                    .map((t) => (
                      <div
                        className={"gameTeam " + (t.winner ? "winner" : "")}
                        key={t.id}
                      >
                        <Logo src={t.logo} />
                        <div>
                          <b>
                            {t.rank && (
                              <small className="pollRank">{t.rank} </small>
                            )}
                            {t.name}
                          </b>
                          <small>
                            {t.record || "Record unavailable"} ·{" "}
                            {t.homeAway === "home" ? "Home" : "Away"}
                          </small>
                        </div>
                        <strong>
                          {g.status === "pre" ? "—" : (t.score ?? "—")}
                        </strong>
                      </div>
                    ))}
                  <div className="gameBottom">
                    {g.broadcast || "Broadcast not provided"}
                    <a
                      href={`https://www.espn.com/college-football/game/_/gameId/${encodeURIComponent(g.id)}`}
                      aria-label={`Details for ${g.name}`}
                    >
                      Game details <ArrowUpRight size={13} />
                    </a>
                  </div>
                </article>
              ))}
            </div>
            {!games.length && (
              <div className="empty">
                {!data && busy
                  ? "Loading the scoreboard…"
                  : error && !data
                    ? "The scoreboard could not be loaded. Try refreshing."
                    : data?.warnings?.some((w) => w.startsWith("Scores"))
                    ? "Scores are temporarily unavailable. Try refreshing."
                    : "No games match these filters in the current scoreboard window."}
                {(filter !== "all" || top25 || query) && (
                  <button
                    onClick={() => {
                      setFilter("all");
                      setTop25(false);
                      setQuery("");
                    }}
                  >
                    Clear filters <ArrowRight size={14} />
                  </button>
                )}
              </div>
            )}
          </section>
          <section id="method" className="method">
            <div>
              <div className="eyebrow">TRANSPARENCY FIRST</div>
              <h2>
                A clearer picture.
                <br />
                No crystal ball.
              </h2>
            </div>
            <div>
              <h3>What this outlook measures</h3>
              <p>
                A transparent poll-position model: ranks 1–4 lead the race, 5–12
                are in the conversation, 13–18 are on the bubble, and 19–25 are
                chasing. CFP rankings take priority when available for the
                current season, then AP. The Coaches Poll is available in the
                published rankings view but never silently substitutes for AP.
                Changing the ranking selector does not change this model’s
                input. These are descriptive tiers, not calibrated
                probabilities. Unranked teams are outside this view, not
                eliminated.
              </p>
              <h3>How the real field is selected</h3>
              <p>
                For 2026, the ACC, Big Ten, Big 12 and SEC champions qualify,
                alongside the highest-ranked team from the other six FBS
                conferences and seven at-large teams. Notre Dame qualifies if in
                the final CFP top 12, reducing the at-large count to six. Seeds
                1–4 receive byes. The committee determines the actual field;
                this model does not predict conference winners.
              </p>
              <a href="https://collegefootballplayoff.com/sports/2024/5/29/12-team-format">
                Official CFP format & selection rules <ArrowUpRight size={14} />
              </a>
              <p className="scoreNote">
                Scores and polls: ESPN public feeds, which may be delayed or
                revised. Fetch time indicates when this app retrieved a
                snapshot, not when ESPN updated each result. Rankings have their
                own publication date. No betting odds, clinch claims, or
                mathematical elimination calculations.
              </p>
            </div>
          </section>
        </main>
        <footer>
          <a className="brand" href="#">
            FOURTH DOWN<span className="footerDot">/</span>
            <span className="brandSub">STAY IN THE GAME.</span>
          </a>
          <p>
            v0.4 · Independent, unofficial college football tracker.
            <br />
            Not affiliated with the CFP, ESPN, or any team. Team marks belong to
            their owners.
          </p>
        </footer>
      </div>
    </>
  );
}
