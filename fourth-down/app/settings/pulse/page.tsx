import AppFrame from '../../components/AppFrame';
import NewsPulsePreferences from '../../components/NewsPulsePreferences';
import Link from 'next/link';
import '../../components/news-pulse.css';
export const metadata={title:'Pulse settings | Fourth Down',robots:{index:false,follow:false}};
export default function Page(){return <AppFrame title="Your Pulse. Your pace." eyebrow="SETTINGS · PULSE" description="Separate news and highlights choices. Pulse push delivery stays off."><Link prefetch={false} className="routeLink" href="/pulse">← Back to Pulse</Link><NewsPulsePreferences/></AppFrame>;}
