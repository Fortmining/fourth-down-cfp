import './news-pulse.css';
export default function NewsReviewNotice(){
  if(process.env.NEXT_PUBLIC_FOURTH_DOWN_NEWS_REVIEW!=='true')return null;
  return <aside className="newsPilotNotice" aria-label="Protected Preview notice"><div><b>Protected review · sample Pulse, archived scores</b><p>Scoreboard and team data were captured October 28, 2026; they are not live. Pulse cards are fictional test scenarios. Publisher connections and notifications are disabled. This Preview has separate browser preferences.</p></div></aside>;
}
