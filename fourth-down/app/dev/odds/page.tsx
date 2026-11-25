import {notFound} from 'next/navigation';
import {privateOddsEnabled} from '../../lib/private-odds-auth';
import PrivateOdds from '../../components/PrivateOdds';
import AppFrame from '../../components/AppFrame';
export const dynamic='force-dynamic';
export const metadata={title:'Private odds lab | Fourth Down',robots:{index:false,follow:false}};
export default function Page(){if(!privateOddsEnabled())notFound();return <AppFrame compact title="Private odds lab." description="Authenticated internal development. No public odds release."><PrivateOdds/></AppFrame>;}
