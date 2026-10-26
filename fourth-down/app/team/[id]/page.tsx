import TeamPage from '../../components/TeamPage';
export const metadata={title:'Team center | Fourth Down',description:'Team overview, current records, official rankings, full 2026 schedule and verified ESPN statistics.'};
export default async function Page({params}:{params:Promise<{id:string}>}) {const {id}=await params;return <TeamPage key={id} id={id}/>;}
