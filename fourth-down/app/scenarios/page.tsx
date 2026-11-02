import {notFound} from 'next/navigation';import {releasedResumesEnabled} from '../lib/playoff/confirmed-release';import ScenarioSandbox from '../components/ScenarioSandbox';
export const dynamic='force-dynamic';export const metadata={title:'What If? | Fourth Down',description:'Explore hypothetical game outcomes and record changes, separate from official rankings.'};
export default function Page(){if(!releasedResumesEnabled())notFound();return <ScenarioSandbox/>;}
