import {notFound} from 'next/navigation';import ResumeCenter from '../../components/ResumeCenter';import {canaryEnabled} from '../../lib/playoff/resume-canary';
export const dynamic='force-dynamic';export const maxDuration=15;export const metadata={title:'Private Resume Canary | Fourth Down',robots:{index:false,follow:false}};
export default function Page(){if(!canaryEnabled())notFound();return <ResumeCenter canary/>;}
