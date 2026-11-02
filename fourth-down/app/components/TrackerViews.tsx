"use client";
import Link from 'next/link';
import {useEffect,useMemo,useState} from 'react';
import {ArrowUpRight,ArrowDownRight} from 'lucide-react';
import Following from './Following';import MoreSettings from './MoreSettings';
import AppFrame from './AppFrame';import {useLiveFeed,useResumePacket} from './useTrackerData';import GamesExplorer from './GamesExplorer';import FavoriteTeams from './FavoriteTeams';
import {displayRecord} from '../lib/playoff/record-view';import {movement,type Ranked} from '../lib/model';import {comparisonRows,type SourceId} from '../lib/rankings';
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

export default function TrackerViews({view}:{view:'games'|'rankings'|'following'|'settings'}){
 const {data,error,busy,refresh}=useLiveFeed();const [chosenSource,setChosenSource]=useState<SourceId|null>(null),[rankingView,setRankingView]=useState('list');
 useEffect(()=>{const requested=new URLSearchParams(location.search).get('ranking');if(requested==='ap'||requested==='coaches'||requested==='cfp')setChosenSource(requested);},[]);
 const {packet}=useResumePacket(view==='games'||view==='following');
 const selectedPoll=data?.polls.find(p=>p.id===(chosenSource??data.defaultRankingSource));
 const comparisons=useMemo(()=>comparisonRows(data?.polls||[]),[data]);
 const recordFor=(t:{record:string;teamId?:string;id?:string})=>data?.currentRecords?displayRecord(t.teamId??t.id??'',data.currentRecords):t.record;
 const titles={games:'Every game. One place.',rankings:'The official polls.',following:'Your game day.',settings:'Make it yours.'};
 return <AppFrame title={titles[view]} eyebrow={view==='following'?'FOLLOWING':view.toUpperCase()} description={{games:'Live scores, kickoff times and the full scoreboard.',rankings:'AP, Coaches and CFP editions, exactly as published.',following:'Your favorites and temporary Watchlist, together for game day.',settings:'Notifications, favorites and the way Fourth Down looks.'}[view]}>
 <div className="pageFeedStatus"><span role="status">{busy?'Refreshing…':data?`Updated ${new Date(data.updatedAt).toLocaleTimeString([],{hour:'numeric',minute:'2-digit'})}`:'Feed unavailable'}</span><button onClick={refresh} disabled={busy}>Refresh</button></div>{error&&<p className="teamWarning" role="status">{error} Last available data stays visible.</p>}
 {view==='rankings'&&<>          <section
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
              <div className="scopeTabs" role="group" aria-label="Official poll">{(['ap','coaches','cfp'] as const).map(id=><button key={id} aria-pressed={(chosenSource??data?.defaultRankingSource??'ap')===id} onClick={()=>setChosenSource(id)}>{id==='ap'?'AP':id==='coaches'?'Coaches':'CFP'}</button>)}</div>
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
                <p className="context">Records are current ESPN totals when available; positions and arrows belong to the published edition.</p>
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
                        <Link prefetch={false} href={`/team/${t.teamId}`} aria-label={`${t.name} team page`}><Logo src={t.logo} /></Link>
                        <span className="teamIdentity">
                          <b><Link prefetch={false} href={`/team/${t.teamId}`}>{t.name}</Link></b>
                          <small>
                            {t.conference} · {recordFor(t) || "Current record unavailable"}
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
                              <Link prefetch={false} className="teamProfileLink" href={`/team/${row.team.teamId}`}><Logo src={row.team.logo} />{row.team.name}</Link>
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
          {data?.recordObservedAt&&<p className="context">Current records: latest available ESPN totals · observed {new Date(data.recordObservedAt).toLocaleString(undefined,{timeZoneName:"short"})}. Official ranks and poll movement retain their publication dates. {data.recordStatus}</p>}
</>}
 {view==='games'&&<GamesExplorer feed={data} packet={packet} busy={busy}/>}
 {view==='following'&&<><FavoriteTeams feed={data} packet={packet}/><Following games={data?.games||[]} currentRecords={data?.currentRecords}/><Link prefetch={false} className="routeLink" href="/settings#alerts">Notification preferences →</Link></>}
 {view==='settings'&&<MoreSettings games={data?.games||[]} resumesAvailable={process.env.NEXT_PUBLIC_FOURTH_DOWN_RESUMES==='true'} teams={[...new Map([...(data?.games.flatMap(g=>g.teams)||[]),...(data?.rankings.map(t=>({id:t.teamId,name:t.name}))||[])].map(t=>[t.id,{id:t.id,name:t.name}])).values()]}/>}
 </AppFrame>;
}
