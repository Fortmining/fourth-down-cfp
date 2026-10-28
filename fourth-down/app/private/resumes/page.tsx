import {notFound} from 'next/navigation';
import ResumeCenter from '../../components/ResumeCenter';
export const dynamic='force-dynamic';
export const metadata={title:'Team Resumes & Movers | Fourth Down',description:'Experimental Team Resumes and explained movement from confirmed results, separate from official rankings and playoff seeds.',robots:{index:false,follow:false}};
export default function Page(){
 if(process.env.NODE_ENV!=='development'||process.env.FOURTH_DOWN_PRIVATE_RESUME_PREVIEW!=='true')notFound();
 return <ResumeCenter/>;
}
