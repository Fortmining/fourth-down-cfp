import DetailPage from '../../components/DetailPage';
export const metadata={title:'Game details | Fourth Down'};
export default async function Page({params}:{params:Promise<{id:string}>}) {const {id}=await params;return <DetailPage kind="game" id={id}/>;}
