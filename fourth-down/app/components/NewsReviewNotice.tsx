import './news-pulse.css';
export default function NewsReviewNotice(){
  if(process.env.NEXT_PUBLIC_FOURTH_DOWN_NEWS_REVIEW!=='true')return null;
  return <aside className="newsPilotNotice" aria-label="Protected Preview notice"><div><b>Protected review · Pulse pilot, archived scores</b><p>Scoreboard and team data were captured October 28, 2026; they are not live. Pulse may contain permission-cleared official news and dated editorial video selections, or explicitly labeled samples. Existing score data is archived; notifications are disabled. This Preview has separate browser preferences.</p></div></aside>;
}
