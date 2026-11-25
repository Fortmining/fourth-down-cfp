import {privateOddsEnabled} from '../../lib/private-odds-auth';
import Link from 'next/link';
import DetailPage from '../../components/DetailPage';
export const metadata={title:'Game details | Fourth Down'};
export default async function Page({params}:{params:Promise<{id:string}>}) {const {id}=await params;return <><DetailPage kind="game" id={id} privateOdds={privateOddsEnabled()}/>{privateOddsEnabled()&&<aside className="privateGameOddsLink"><Link href="/dev/odds">Private odds lab · separate provider identities →</Link></aside>}</>;}
