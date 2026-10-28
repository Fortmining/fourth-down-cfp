import {notFound} from 'next/navigation';import ResumeCenter from '../components/ResumeCenter';import {releasedResumesEnabled} from '../lib/playoff/confirmed-release';
export const dynamic='force-dynamic';export const metadata={title:'Team Resumes & Movers | Fourth Down',description:'Explained independent resume movement after confirmed results, separate from official polls. No playoff probabilities or projected bracket.'};
export default function Page(){if(!releasedResumesEnabled())notFound();return <ResumeCenter confirmed/>;}
